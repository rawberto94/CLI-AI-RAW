import fs from "fs"
import path from "path"
import { randomUUID } from "crypto"
import { API_BASE_URL } from "@/lib/config"

type JobStatus = "queued" | "processing" | "completed" | "failed"

export interface ComplianceFinding {
  rule: string
  severity: "Low" | "Medium" | "High"
  status: "Passed" | "Warning" | "Failed"
  location?: string
}

export interface RoleRow {
  role: string
  uom: string
  rate: string | number
  p75: string | number
  delta: string
  currency?: string
  dailyUsd?: number
  seniority?: string
  original?: { currency?: string; uom?: string; amount?: number }
  mappingConfidence?: number
  approved?: boolean
}

export interface JobResult {
  kpis: { totalChecks: number; passed: number; warnings: number; failures: number }
  compliance: { findings: ComplianceFinding[] }
  financials: { roles: RoleRow[]; approved?: boolean }
}

export interface Job {
  id: string
  filename: string
  filepath: string
  status: JobStatus
  progress: number
  error?: string
  result?: JobResult
}

// Share the in-memory jobs store across route modules/processes within the same Node runtime.
// Next.js App Router can bundle route handlers separately, so module-level singletons may duplicate.
// Stash the Map on globalThis to ensure a single shared instance.
declare global {
  // eslint-disable-next-line no-var
  var __WEB_JOBS_STORE__: Map<string, Job> | undefined
}

const jobs: Map<string, Job> = globalThis.__WEB_JOBS_STORE__ ?? (globalThis.__WEB_JOBS_STORE__ = new Map<string, Job>())
const uploadDir = path.join(process.cwd(), "tmp", "uploads")
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })

export function createJob(file: File): Promise<Job> {
  return new Promise(async (resolve, reject) => {
    try {
      const id = randomUUID()
      const arrayBuf = await file.arrayBuffer()
  const buffer = new Uint8Array(arrayBuf)
      const ext = path.extname(file.name) || ".bin"
      const filepath = path.join(uploadDir, `${id}${ext}`)
  fs.writeFileSync(filepath, buffer)

      const job: Job = {
        id,
        filename: file.name,
        filepath,
        status: "queued",
        progress: 0,
      }
      jobs.set(id, job)
      processJob(job).catch(() => {})
      resolve(job)
    } catch (e: any) {
      reject(e)
    }
  })
}

export function getJob(id: string): Job | undefined {
  return jobs.get(id)
}

export function patchJobResult(id: string, patch: Partial<JobResult>): Job | undefined {
  const job = jobs.get(id)
  if (!job || !job.result) return job
  const nextResult: JobResult = {
    ...job.result,
    ...patch,
    // deep-merge financials to preserve roles when only approved changes
    financials: {
      ...job.result.financials,
      ...(patch.financials ?? {}),
    },
  }
  const next: Job = { ...job, result: nextResult }
  jobs.set(id, next)
  return next
}

async function processJob(job: Job) {
  try {
    update(job, { status: "processing", progress: 10 })

    // Send file to API for analysis
  const data = fs.readFileSync(job.filepath)
  const form = new FormData()
  // Convert Node Buffer -> Uint8Array to satisfy BlobPart typings
  const u8 = new Uint8Array(data)
  const blob = new Blob([u8])
  form.append("file", blob, job.filename)

    const resp = await fetch(`${API_BASE_URL}/analyze`, {
      method: "POST",
      body: form as any,
      // Let fetch set the multipart boundary automatically
    })

    if (!resp.ok) {
      const msg = await resp.text()
      throw new Error(`Analyze failed: ${resp.status} ${msg}`)
    }
    update(job, { progress: 70 })
  const result = (await resp.json()) as JobResult

    update(job, { progress: 100, status: "completed", result })
  } catch (e: any) {
    update(job, { status: "failed", error: e?.message || String(e) })
  }
}

function update(job: Job, patch: Partial<Job>) {
  const next = { ...job, ...patch }
  jobs.set(job.id, next)
}

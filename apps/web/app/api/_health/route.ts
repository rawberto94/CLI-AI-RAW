import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const maxDuration = 5

const startedAt = Date.now()
const commit = process.env['VERCEL_GIT_COMMIT_SHA'] || process.env['COMMIT_SHA'] || process.env['GIT_COMMIT'] || 'local'
const branch = process.env['VERCEL_GIT_COMMIT_REF'] || process.env['GIT_BRANCH'] || 'local'

export async function GET() {
  const uptimeSec = Math.floor((Date.now() - startedAt) / 1000)
  return NextResponse.json({ ok: true, ts: Date.now(), uptimeSec, commit, branch, node: process.version }, { status: 200 })
}

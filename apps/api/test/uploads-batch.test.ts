import { test, expect } from 'vitest'
import Fastify from 'fastify'
import multipart from '@fastify/multipart'
import cors from '@fastify/cors'

function createServer() {
  const app = Fastify()
  app.register(cors, { origin: true })
  app.register(multipart)

  const hash = (buf: Buffer) => `h:${buf.length}`
  const seen = new Map<string, string>()
  const getQueue = (_: string) => ({ add: async (_job: any) => {} })

  app.post('/uploads/batch', async (request, reply) => {
    const results: Array<{ name: string; docId: string }> = []
    for await (const part of (request as any).parts()) {
      if (!part || part.type !== 'file') continue
      const filename = part.filename || 'upload.bin'
      const buf = await part.toBuffer()
      const h = hash(buf)
      const existing = seen.get(h)
      const docId = existing || `doc-${Date.now()}`
      if (!existing) seen.set(h, docId)
      await getQueue('ingestion').add({ name: 'ingest', data: { docId } })
      results.push({ name: filename, docId })
    }
    if (!results.length) return reply.code(400).send({ error: 'Missing files' })
    return reply.code(201).send({ items: results })
  })

  return app
}

// Happy path: two files → two items
test.skip('POST /uploads/batch returns items for multiple files', async () => {
  const app = createServer()
  const form = new FormData()
  const a = new Uint8Array([104,101,108,108,111]) // hello
  const b = new Uint8Array([119,111,114,108,100]) // world
  form.append('files', new Blob([a], { type: 'text/plain' }), 'a.txt')
  form.append('files', new Blob([b], { type: 'text/plain' }), 'b.txt')
  const res = await app.inject({
    method: 'POST',
    url: '/uploads/batch',
    payload: await (form as any).stream(),
    headers: (form as any).getHeaders ? (form as any).getHeaders() : {},
  } as any)
  expect(res.statusCode).toBe(201)
  const body = res.json() as { items: Array<{ name: string; docId: string }> }
  expect(body.items.length).toBe(2)
  expect(body.items[0].name).toBe('a.txt')
  expect(body.items[1].name).toBe('b.txt')
})

// Error when no files
test.skip('POST /uploads/batch without files returns 400', async () => {
  const app = createServer()
  const res = await app.inject({ method: 'POST', url: '/uploads/batch' })
  expect(res.statusCode).toBe(400)
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import { createHttpHandler } from '../lib/http.js'

function fakeRes() {
  return {
    status: 0,
    headers: {},
    body: '',
    writeHead(status, headers) { this.status = status; this.headers = headers },
    end(body) { this.body = String(body || '') },
  }
}

test('http: strips the /api/xhs-fish mount prefix', async () => {
  const handler = createHttpHandler({
    async status() { return { ok: true, path: 'status' } },
  })
  const req = Readable.from([])
  req.url = '/api/xhs-fish/status'
  req.method = 'GET'
  req.headers = {}
  const res = fakeRes()
  await handler(req, res)
  assert.equal(res.status, 200)
  assert.deepEqual(JSON.parse(res.body), { ok: true, path: 'status' })
})

test('http: POST body under the prefix reaches the service', async () => {
  let killed = ''
  const handler = createHttpHandler({
    kill(reason) { killed = reason; return { ok: true } },
  })
  const req = Readable.from([Buffer.from('{"reason":"test"}')])
  req.url = '/api/xhs-fish/kill'
  req.method = 'POST'
  req.headers = {}
  const res = fakeRes()
  await handler(req, res)
  assert.equal(res.status, 200)
  assert.equal(killed, 'test')
})

test('http: bad json is a 400', async () => {
  const handler = createHttpHandler({ kill() { return { ok: true } } })
  const req = Readable.from([Buffer.from('{')])
  req.url = '/api/xhs-fish/kill'
  req.method = 'POST'
  req.headers = {}
  const res = fakeRes()
  await handler(req, res)
  assert.equal(res.status, 400)
})

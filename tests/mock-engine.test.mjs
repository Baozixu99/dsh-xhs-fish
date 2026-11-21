import test from 'node:test'
import assert from 'node:assert/strict'
import { MockEngine } from '../lib/mock-engine.js'

test('mock engine: login, search, publish, reply', async () => {
  const engine = new MockEngine()
  assert.equal((await engine.loginStatus()).loggedIn, false)
  const qr = await engine.loginQr()
  assert.ok(qr.qrDataUrl.startsWith('data:image/svg+xml;base64,'))
  await engine.mockLogin()
  assert.equal((await engine.loginStatus()).loggedIn, true)

  const search = await engine.search({ query: 'AI', limit: 5 })
  assert.ok(search.items.length >= 1)

  const detail = await engine.feedDetail({ feedId: search.items[0].noteId, xsecToken: search.items[0].xsecToken })
  assert.ok(Array.isArray(detail.comments))

  const post = await engine.publish({ title: '测试', content: '正文', images: ['a.png'], tags: ['AI'] })
  assert.ok(post.noteId.startsWith('mock_'))
  const reply = await engine.reply({ feedId: post.noteId, commentId: 'c1', content: '谢谢' })
  assert.equal(reply.ok, true)
})

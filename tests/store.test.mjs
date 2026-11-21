import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Store } from '../lib/store.js'

test('store: drafts, posts, comments dedupe, audit redaction', () => {
  const dir = mkdtempSync(join(tmpdir(), 'xhs-fish-store-'))
  try {
    const store = new Store(dir)
    const draft = store.createDraft({ title: '标题', body: '正文', tags: ['a', 'b'], images: ['a.png'] })
    assert.equal(draft.id.startsWith('draft_'), true)
    assert.equal(store.getDraft(draft.id).title, '标题')
    store.updateDraft(draft.id, { title: '新标题' })
    assert.equal(store.getDraft(draft.id).title, '新标题')

    const post = store.addPost({ draftId: draft.id, xhsNoteId: 'note_1', xsecToken: 'token_1', title: '标题' })
    assert.equal(post.xhsNoteId, 'note_1')

    const a = store.upsertComments('note_1', [{ id: 'c1', author: 'A', text: 'hi' }])
    assert.equal(a.added, 1)
    const b = store.upsertComments('note_1', [{ id: 'c1', author: 'A', text: 'hi again' }])
    assert.equal(b.added, 0)
    assert.equal(store.listComments('note_1').length, 1)

    store.audit({ action: 'publish_commit', metaRedacted: { cookie: 'secret', token: 'abc' } })
    const events = store.readAudit(10)
    assert.equal(events.length, 1)
    assert.equal(JSON.stringify(events[0]).includes('secret'), false)
    assert.equal(JSON.stringify(events[0]).includes('abc'), false)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

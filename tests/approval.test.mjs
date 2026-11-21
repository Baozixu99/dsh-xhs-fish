import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ApprovalService } from '../lib/approval.js'
import { loadConfig } from '../lib/config.js'
import { Store } from '../lib/store.js'

test('approval: payload hash, one-time consume, expiry', () => {
  const dir = mkdtempSync(join(tmpdir(), 'xhs-fish-approval-'))
  try {
    const store = new Store(dir)
    const cfg = loadConfig(dir)
    const approvals = new ApprovalService(store, cfg)
    const payload = { title: '标题', content: '正文', images: ['a.png'], tags: ['a'], visibility: '仅自己可见' }
    const row = approvals.create({ action: 'publish', targetId: 'draft_1', payload, summary: 'test' })
    assert.equal(row.status, 'pending')
    assert.throws(() => approvals.consume(row.id, payload, { confirm: true }), /尚未通过/)

    approvals.approve(row.id)
    assert.throws(() => approvals.claim(row.id, { ...payload, title: '篡改' }, { confirm: true }), /不一致/)
    approvals.claim(row.id, payload, { confirm: true })
    const consumed = approvals.consume(row.id, payload, { confirm: true })
    assert.equal(consumed.status, 'consumed')
    assert.throws(() => approvals.consume(row.id, payload, { confirm: true }), /已被使用/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('approval: confirm must be true', () => {
  const dir = mkdtempSync(join(tmpdir(), 'xhs-fish-approval-'))
  try {
    const store = new Store(dir)
    const approvals = new ApprovalService(store, loadConfig(dir))
    const payload = { a: 1 }
    const row = approvals.create({ action: 'publish', targetId: 'd', payload })
    approvals.approve(row.id)
    assert.throws(() => approvals.consume(row.id, payload, { confirm: false }), /confirm=true/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ApprovalService } from '../lib/approval.js'
import { loadConfig, saveConfig } from '../lib/config.js'
import { MockEngine } from '../lib/mock-engine.js'
import { XhsService } from '../lib/service.js'
import { Store } from '../lib/store.js'

test('service: publish requires approval and commits once', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'xhs-fish-service-'))
  try {
    const store = new Store(dir)
    let cfg = loadConfig(dir)
    const approval = new ApprovalService(store, cfg)
    const engine = new MockEngine()
    const service = new XhsService({
      store,
      approval,
      engineManager: { get: async () => engine },
      getConfig: () => cfg,
      saveConfig: (patch) => { cfg = saveConfig(dir, patch); return cfg },
    })
    const draft = service.createDraft({
      title: 'AI 鱼的效率清单',
      body: '这是一条 AI 虚拟角色的分享，不是真人经历。',
      tags: ['AI', '效率', '工具', '清单', '虚拟角色'],
      images: ['C:/tmp/a.png'],
    }).draft
    const compliance = service.checkDraft(draft.id)
    assert.equal(compliance.ok, true, compliance.compliance.issues.join('；'))

    const prepared = service.preparePublish({ draftId: draft.id })
    assert.equal(prepared.approval.status, 'pending')
    await assert.rejects(
      () => service.commitPublish({ approvalId: prepared.approval.id, draftId: draft.id, confirm: true }),
      /尚未通过/,
    )
    service.approve(prepared.approval.id)
    const committed = await service.commitPublish({ approvalId: prepared.approval.id, draftId: draft.id, confirm: true })
    assert.equal(committed.ok, true)
    assert.equal(store.listPosts().length, 1)
    await assert.rejects(
      () => service.commitPublish({ approvalId: prepared.approval.id, draftId: draft.id, confirm: true }),
      /已被使用/,
    )
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

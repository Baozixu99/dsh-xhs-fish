import { hashPayload, nowIso } from './ids.js'

export class ApprovalError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'ApprovalError'
    this.code = code
  }
}

export class ApprovalService {
  constructor(store, config) {
    this.store = store
    this.config = config
  }

  refreshConfig(config) {
    this.config = config
  }

  create({ action, targetId, payload, summary, preview = null, ttlHours }) {
    const payloadHash = hashPayload(payload)
    const hours = Number(ttlHours || this.config?.approvalTtlHours || 24)
    const expiresAt = new Date(Date.now() + Math.max(1, Math.min(72, hours)) * 3600_000).toISOString()
    return this.store.createApproval({
      action,
      targetId,
      payloadHash,
      summary: summary || '',
      preview,
      expiresAt,
    })
  }

  listPending() {
    return this.store.listApprovals().filter((a) => a.status === 'pending' && !isExpired(a))
  }

  get(id) {
    return this.store.getApproval(id)
  }

  /**
   * 只校验，不改状态。confirm/状态/过期/payload hash 全部通过才返回审批行。
   */
  verify(id, payload, { confirm = false, allowedStatus = ['approved'] } = {}) {
    const row = this.store.getApproval(id)
    if (!row) throw new ApprovalError('APPROVAL_NOT_FOUND', '审批单不存在')
    if (confirm !== true) throw new ApprovalError('CONFIRM_REQUIRED', '必须显式 confirm=true')
    if (row.status === 'consumed') throw new ApprovalError('APPROVAL_CONSUMED', '审批单已被使用')
    if (!allowedStatus.includes(row.status)) {
      throw new ApprovalError(
        row.status === 'pending' ? 'APPROVAL_REQUIRED' : 'APPROVAL_STATE',
        row.status === 'pending' ? '审批单尚未通过' : `审批单状态是 ${row.status}`,
      )
    }
    if (isExpired(row)) {
      this.store.updateApproval(id, { status: 'expired' })
      throw new ApprovalError('APPROVAL_EXPIRED', '审批单已过期')
    }
    const actualHash = hashPayload(payload)
    if (actualHash !== row.payloadHash) {
      throw new ApprovalError('APPROVAL_MISMATCH', '提交内容与审批内容不一致')
    }
    return row
  }

  /** approved -> sending；防止双击/并发重复发送。 */
  claim(id, payload, { confirm = false } = {}) {
    this.verify(id, payload, { confirm, allowedStatus: ['approved'] })
    const current = this.store.getApproval(id)
    if (current.status === 'sending') throw new ApprovalError('APPROVAL_SENDING', '审批单正在发送中')
    return this.store.updateApproval(id, { status: 'sending', sendingAt: nowIso() })
  }

  /** 发送成功：sending -> consumed。 */
  consume(id, payload, { confirm = false } = {}) {
    this.verify(id, payload, { confirm, allowedStatus: ['sending'] })
    return this.store.updateApproval(id, { status: 'consumed', consumedAt: nowIso() })
  }

  /** 明确失败（未发出/平台拒绝）：sending -> approved。 */
  release(id) {
    const row = this.store.getApproval(id)
    if (!row) throw new ApprovalError('APPROVAL_NOT_FOUND', '审批单不存在')
    if (row.status !== 'sending') return row
    return this.store.updateApproval(id, { status: 'approved', sendingAt: '', releasedAt: nowIso() })
  }

  /** 结果不确定：sending -> unknown；禁止自动重试。 */
  markUnknown(id, reason = '') {
    const row = this.store.getApproval(id)
    if (!row) throw new ApprovalError('APPROVAL_NOT_FOUND', '审批单不存在')
    if (row.status !== 'sending' && row.status !== 'approved') return row
    return this.store.updateApproval(id, {
      status: 'unknown',
      unknownAt: nowIso(),
      reason: String(reason || '').slice(0, 500),
    })
  }

  /** 人工对账：结果不确定但已确认平台侧成功，unknown/sending -> consumed。 */
  reconcileSent(id, payload, { confirm = false } = {}) {
    if (confirm !== true) throw new ApprovalError('CONFIRM_REQUIRED', '必须显式 confirm=true')
    const row = this.store.getApproval(id)
    if (!row) throw new ApprovalError('APPROVAL_NOT_FOUND', '审批单不存在')
    if (row.status === 'consumed') return row
    if (!['unknown', 'sending'].includes(row.status)) {
      throw new ApprovalError('APPROVAL_STATE', `审批单状态是 ${row.status}`)
    }
    if (hashPayload(payload) !== row.payloadHash) {
      throw new ApprovalError('APPROVAL_MISMATCH', '提交内容与审批内容不一致')
    }
    return this.store.updateApproval(id, { status: 'consumed', consumedAt: nowIso(), reconciledAt: nowIso() })
  }

  /** 人工对账：确认平台侧没有发出，unknown/sending -> approved，允许人工重新确认。 */
  reconcileNotSent(id) {
    const row = this.store.getApproval(id)
    if (!row) throw new ApprovalError('APPROVAL_NOT_FOUND', '审批单不存在')
    if (!['unknown', 'sending'].includes(row.status)) return row
    return this.store.updateApproval(id, { status: 'approved', sendingAt: '', reconciledAt: nowIso() })
  }

  approve(id, by = 'human') {
    const row = this.store.getApproval(id)
    if (!row) throw new ApprovalError('APPROVAL_NOT_FOUND', '审批单不存在')
    if (row.status !== 'pending') throw new ApprovalError('APPROVAL_NOT_PENDING', `审批单状态是 ${row.status}`)
    if (isExpired(row)) {
      this.store.updateApproval(id, { status: 'expired' })
      throw new ApprovalError('APPROVAL_EXPIRED', '审批单已过期')
    }
    return this.store.updateApproval(id, { status: 'approved', decidedAt: nowIso(), decidedBy: by })
  }

  reject(id, reason = '', by = 'human') {
    const row = this.store.getApproval(id)
    if (!row) throw new ApprovalError('APPROVAL_NOT_FOUND', '审批单不存在')
    if (row.status !== 'pending') throw new ApprovalError('APPROVAL_NOT_PENDING', `审批单状态是 ${row.status}`)
    return this.store.updateApproval(id, {
      status: 'rejected',
      decidedAt: nowIso(),
      decidedBy: by,
      reason: String(reason || '').slice(0, 500),
    })
  }
}

function isExpired(row) {
  if (!row.expiresAt) return false
  const t = Date.parse(row.expiresAt)
  return Number.isFinite(t) && t <= Date.now()
}

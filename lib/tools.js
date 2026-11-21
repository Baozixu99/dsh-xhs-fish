import { defineTool } from './define-tool.js'

const textOutput = {
  schema: { type: 'object', additionalProperties: true },
  render: (_args, value) => [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }],
}

function tool(ctx, spec) {
  return ctx.tools.register(defineTool({ ...spec, output: textOutput }))
}

function result(value) {
  return value && typeof value === 'object' ? value : { ok: true, value }
}

async function safe(fn) {
  try {
    return result(await fn())
  } catch (error) {
    return { ok: false, code: String(error.code || 'ERROR'), error: String(error.message || error) }
  }
}

export function registerTools(ctx, service) {
  tool(ctx, {
    name: 'xhs_status',
    description: '查看小红书工作台状态：引擎、登录、暂停、待审批、计数。只读。',
    parameters: {},
    async execute() {
      return safe(() => service.status())
    },
  })

  tool(ctx, {
    name: 'xhs_login_status',
    description: '检查小红书登录状态。只读。',
    parameters: {},
    async execute() {
      return safe(() => service.loginStatus())
    },
  })

  tool(ctx, {
    name: 'xhs_login_qr',
    description: '获取小红书扫码登录二维码（返回 data URL）。只读。',
    parameters: {},
    async execute() {
      return safe(() => service.loginQr())
    },
  })

  tool(ctx, {
    name: 'xhs_research',
    description: '按关键词搜索小红书公开笔记，返回 noteId、xsecToken、标题、作者、互动数据。只读。',
    parameters: {
      query: { type: 'string', required: true, description: '搜索关键词' },
      limit: { type: 'number', description: '返回条数，1-20，默认 10' },
    },
    async execute(args) {
      return safe(() => service.research({ query: args.query, limit: args.limit }))
    },
  })

  tool(ctx, {
    name: 'xhs_feed_detail',
    description: '读取一条小红书笔记详情和评论。需要 noteId 与 xsecToken。只读。',
    parameters: {
      feedId: { type: 'string', required: true, description: '笔记 ID（noteId）' },
      xsecToken: { type: 'string', required: true, description: 'xsec_token' },
      loadAllComments: { type: 'boolean', description: '是否加载全部评论，默认 true' },
    },
    async execute(args) {
      return safe(() => service.feedDetail({
        feedId: args.feedId,
        xsecToken: args.xsecToken,
        loadAllComments: args.loadAllComments !== false,
      }))
    },
  })

  tool(ctx, {
    name: 'xhs_topic_propose',
    description: '基于账号内容栏目和评论区问题，生成 3 个选题候选。只写本地。',
    parameters: {},
    async execute() {
      return safe(() => service.topicCandidates())
    },
  })

  tool(ctx, {
    name: 'xhs_draft_create',
    description: '创建一篇图文草稿（本地）。标题不超过 20 字，正文不超过 1000 字，标签 5-8 个。',
    parameters: {
      title: { type: 'string', required: true, description: '标题，<=20 字' },
      body: { type: 'string', required: true, description: '正文，<=1000 字' },
      tags: { type: 'array', items: { type: 'string' }, description: '标签，5-8 个' },
      images: { type: 'array', items: { type: 'string' }, description: '本地图片绝对路径或图片 URL' },
      topic: { type: 'string', description: '选题来源/角度' },
    },
    async execute(args) {
      return safe(() => service.createDraft(args))
    },
  })

  tool(ctx, {
    name: 'xhs_compliance_check',
    description: '检查草稿的标题/正文/标签/图片/敏感词/联系方式/AI 标识。只读。',
    parameters: {
      draftId: { type: 'string', required: true, description: '草稿 ID' },
    },
    async execute(args) {
      return safe(() => service.checkDraft(args.draftId))
    },
  })

  tool(ctx, {
    name: 'xhs_publish_prepare',
    description: '为草稿生成发布审批单；不会真正发布。返回 approvalId，需人工在 UI 通过后再 commit。',
    parameters: {
      draftId: { type: 'string', required: true, description: '草稿 ID' },
      visibility: { type: 'string', enum: ['仅自己可见', '公开可见', '仅互关好友可见'], description: '可见范围，默认仅自己可见' },
    },
    async execute(args) {
      return safe(() => service.preparePublish({ draftId: args.draftId, visibility: args.visibility }))
    },
  })

  tool(ctx, {
    name: 'xhs_publish_commit',
    description: '在审批通过后真正发布。必须带 approvalId 和 confirm=true；结果不确定时不要重试。',
    parameters: {
      approvalId: { type: 'string', required: true, description: '审批单 ID' },
      draftId: { type: 'string', required: true, description: '草稿 ID' },
      confirm: { type: 'boolean', required: true, description: '必须为 true' },
    },
    async execute(args) {
      return safe(() => service.commitPublish({ approvalId: args.approvalId, draftId: args.draftId, confirm: args.confirm === true }))
    },
  })

  tool(ctx, {
    name: 'xhs_inbox_sync',
    description: '同步一条已发布笔记的评论到本地收件箱。只读平台，写本地。',
    parameters: {
      postId: { type: 'string', description: '本地发布记录 ID（优先）' },
      feedId: { type: 'string', description: '小红书 noteId（没有 postId 时必填）' },
      xsecToken: { type: 'string', description: 'xsec_token（没有 postId 时必填）' },
    },
    async execute(args) {
      return safe(() => service.syncInbox({ postId: args.postId, feedId: args.feedId, xsecToken: args.xsecToken }))
    },
  })

  tool(ctx, {
    name: 'xhs_reply_prepare',
    description: '为一条评论生成回复审批单；不会真正发送。',
    parameters: {
      commentId: { type: 'string', required: true, description: '本地评论 ID' },
      content: { type: 'string', required: true, description: '回复内容，<=500 字' },
    },
    async execute(args) {
      return safe(() => service.prepareReply({ commentId: args.commentId, content: args.content }))
    },
  })

  tool(ctx, {
    name: 'xhs_reply_commit',
    description: '在审批通过后真正回复评论。必须带 approvalId 和 confirm=true。',
    parameters: {
      approvalId: { type: 'string', required: true, description: '审批单 ID' },
      confirm: { type: 'boolean', required: true, description: '必须为 true' },
    },
    async execute(args) {
      return safe(() => service.commitReply({ approvalId: args.approvalId, confirm: args.confirm === true }))
    },
  })

  tool(ctx, {
    name: 'xhs_approval_reconcile',
    description: '对 unknown 的外发审批做人工对账：确认平台已成功则补记录，确认未发出则释放审批。不会发送。',
    parameters: {
      approvalId: { type: 'string', required: true, description: '审批单 ID' },
      outcome: { type: 'string', required: true, description: 'sent 或 not_sent' },
      replyId: { type: 'string', description: '平台侧回复 ID（可选）' },
    },
    async execute(args) {
      return safe(() => service.reconcileApproval({
        approvalId: args.approvalId,
        outcome: args.outcome,
        replyId: args.replyId,
      }))
    },
  })

  tool(ctx, {
    name: 'xhs_list_approvals',
    description: '列出审批单（含 pending/approved/rejected/consumed）。只读。',
    parameters: {},
    async execute() {
      return safe(() => service.listApprovals())
    },
  })

  tool(ctx, {
    name: 'xhs_list_drafts',
    description: '列出本地草稿。只读。',
    parameters: {},
    async execute() {
      return safe(() => service.listDrafts())
    },
  })

  tool(ctx, {
    name: 'xhs_kill_switch',
    description: '暂停所有外发：停止新的发布/回复，保留只读工具。',
    parameters: {
      reason: { type: 'string', description: '暂停原因' },
    },
    async execute(args) {
      return safe(() => service.kill(args.reason || 'manual'))
    },
  })
}

const SENSITIVE = [
  '自杀', '自残', '抑郁', '焦虑症', '癌症', '治疗', '药到病除', '偏方',
  '律师函', '起诉', '离婚', '投资', '股票', '基金', '荐股', '贷款', '赌博',
  '政治', '选举', '国家领导人',
]

const CONTACT = [
  /https?:\/\//i,
  /(?:微信|weixin|wechat|vx|v信)\s*[:：]?\s*[a-z0-9_-]{4,}/i,
  /(?:QQ|qq)\s*[:：]?\s*\d{5,}/,
  /(?:\+?86)?1[3-9]\d{9}/,
]

const ABSOLUTE = ['最好', '最强', '第一', '唯一', '100%', '绝对', '永久', '包治', '稳赚']

export function checkDraft(draft, config = {}) {
  const issues = []
  const warnings = []
  const title = String(draft?.title || '').trim()
  const body = String(draft?.body || '').trim()
  const tags = Array.isArray(draft?.tags) ? draft.tags.map(String) : []
  const images = Array.isArray(draft?.images) ? draft.images.filter(Boolean) : []
  const maxTitle = Number(config.maxTitleChars || 20)
  const maxBody = Number(config.maxBodyChars || 1000)

  if (!title) issues.push('标题不能为空')
  if (title.length > maxTitle) issues.push(`标题 ${title.length} 字，超过 ${maxTitle} 字`)
  if (!body) issues.push('正文不能为空')
  if (body.length > maxBody) issues.push(`正文 ${body.length} 字，超过 ${maxBody} 字`)
  if (tags.length < Number(config.minTags ?? 5)) issues.push(`标签至少 ${config.minTags ?? 5} 个`)
  if (tags.length > Number(config.maxTags ?? 8)) issues.push(`标签最多 ${config.maxTags ?? 8} 个`)
  if (images.length < 1) issues.push('至少需要 1 张图片')
  if (images.length > Number(config.maxImages ?? 9)) issues.push(`图片最多 ${config.maxImages ?? 9} 张`)
  if (tags.some((t) => /[#\s]/.test(t))) issues.push('标签不要包含 # 或空格')

  const text = `${title}\n${body}\n${tags.join(' ')}`
  for (const word of config.bannedWords || []) {
    if (word && text.includes(word)) issues.push(`包含违禁/高风险词：${word}`)
  }
  for (const re of CONTACT) {
    if (re.test(text)) issues.push('包含站外链接、联系方式或引流信息')
  }
  for (const word of SENSITIVE) {
    if (text.includes(word)) issues.push(`涉及敏感话题：${word}`)
  }
  for (const word of ABSOLUTE) {
    if (text.includes(word)) warnings.push(`包含绝对化表述：${word}`)
  }
  if (!draft?.aiDisclosure) warnings.push('未开启 AI 生成内容标识')
  else if (!/(AI|人工智能|虚拟)/i.test(body)) warnings.push('正文没有出现 AI/虚拟角色说明（账号资料页仍需标注）')

  const normalized = normalizeTitle(title)
  const dup = (config._recentTitles || []).some((t) => normalizeTitle(t) === normalized)
  if (dup) issues.push('最近已发布/草稿中存在相同标题')

  return {
    ok: issues.length === 0,
    issues: [...new Set(issues)],
    warnings: [...new Set(warnings)],
    metrics: { titleLength: title.length, bodyLength: body.length, tagCount: tags.length, imageCount: images.length },
  }
}

export function assertPublishable(draft, config) {
  const result = checkDraft(draft, config)
  if (!result.ok) {
    const err = new Error(result.issues.join('；'))
    err.code = 'CONTENT_REJECTED'
    err.issues = result.issues
    throw err
  }
  return result
}

export function buildPublishPayload(draft, visibility) {
  return {
    title: String(draft.title || '').trim(),
    content: String(draft.body || '').trim(),
    images: Array.isArray(draft.images) ? draft.images.map(String) : [],
    tags: Array.isArray(draft.tags) ? draft.tags.map(String) : [],
    visibility: String(visibility || '仅自己可见'),
  }
}

export function buildReplyPayload({ feedId, xsecToken, commentId, content }) {
  return {
    feedId: String(feedId || ''),
    xsecToken: String(xsecToken || ''),
    commentId: String(commentId || ''),
    content: String(content || '').trim(),
  }
}

export function topicCandidates({ config = {}, comments = [], recentTitles = [], count = 3 } = {}) {
  const pillars = Array.isArray(config.contentPillars) ? config.contentPillars : []
  const recent = new Set(recentTitles.map(normalizeTitle))
  const questions = comments
    .map((c) => String(c.text || '').trim())
    .filter((t) => /[?？]|怎么|如何|为什么|吗|求/.test(t))
    .slice(0, 6)
  const seeds = []
  for (const q of questions) seeds.push({ title: q.slice(0, 18), angle: '回答评论区问题', source: 'comment' })
  for (const p of pillars) {
    seeds.push({ title: `${p}：一条鱼的真实体验`, angle: '人设化体验 + 实用清单', source: 'pillar' })
    seeds.push({ title: `${p} 的 3 个反常识`, angle: '反常识 + 可收藏清单', source: 'pillar' })
  }
  const out = []
  for (const s of seeds) {
    const key = normalizeTitle(s.title)
    if (!key || recent.has(key) || out.some((x) => normalizeTitle(x.title) === key)) continue
    out.push({ ...s, risk: /治疗|投资|股票|药/.test(s.title) ? 'high' : 'low' })
    if (out.length >= count) break
  }
  return out
}

export function classifyComment(text) {
  const s = String(text || '')
  if (/(加微信|私信|代购|刷单|返利|链接|优惠券)/.test(s)) return 'spam'
  if (/(自杀|自残|抑郁|癌症|治疗|律师|起诉|投资|股票|贷款|赌博)/.test(s)) return 'sensitive'
  if (/(骗人|垃圾|取关|太差|不好|恶心|举报)/.test(s)) return 'criticism'
  if (/[?？]|怎么|如何|为什么|吗|求|请问/.test(s)) return 'question'
  if (/(好看|喜欢|可爱|支持|学到了|有用|收藏|谢谢)/.test(s)) return 'praise'
  return 'other'
}

export function normalizeTitle(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]/gu, '')
    .slice(0, 60)
}

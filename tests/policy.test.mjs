import test from 'node:test'
import assert from 'node:assert/strict'
import { checkDraft, classifyComment, topicCandidates } from '../lib/policy.js'

const cfg = {
  maxTitleChars: 20,
  maxBodyChars: 1000,
  minTags: 5,
  maxTags: 8,
  maxImages: 9,
  bannedWords: ['加微信'],
  contentPillars: ['AI 工具'],
}

test('policy: valid draft passes', () => {
  const draft = {
    title: 'AI 鱼的效率清单',
    body: '这是一条 AI 虚拟角色的分享，不是真人经历。',
    tags: ['AI', '效率', '工具', '清单', '虚拟角色'],
    images: ['C:/tmp/a.png'],
    aiDisclosure: true,
  }
  const r = checkDraft(draft, cfg)
  assert.equal(r.ok, true, r.issues.join('；'))
})

test('policy: blocks long title, missing tags, contact info', () => {
  const draft = {
    title: '这是一条超过二十个字的小红书标题用来测试啊',
    body: '加微信 abc1234 领取资料',
    tags: [],
    images: [],
    aiDisclosure: false,
  }
  const r = checkDraft(draft, cfg)
  assert.equal(r.ok, false)
  assert.ok(r.issues.some((x) => x.includes('标题')))
  assert.ok(r.issues.some((x) => x.includes('标签')))
  assert.ok(r.issues.some((x) => x.includes('联系方式') || x.includes('违禁')))
})

test('policy: comment classification', () => {
  assert.equal(classifyComment('怎么做的？求教程'), 'question')
  assert.equal(classifyComment('加微信领资料'), 'spam')
  assert.equal(classifyComment('太差了吧，取关'), 'criticism')
  assert.equal(classifyComment('好可爱，收藏了'), 'praise')
})

test('policy: topic candidates dedupe', () => {
  const out = topicCandidates({
    config: { contentPillars: ['AI 工具'] },
    comments: [{ text: '怎么选 AI 工具？' }],
    recentTitles: ['AI 工具：一条鱼的真实体验'],
    count: 3,
  })
  assert.ok(out.length <= 3)
  assert.ok(out.every((x) => x.title))
})

import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, rmSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'

export const DEFAULT_CONFIG = Object.freeze({
  enabled: true,
  paused: false,
  engine: 'mock', // mock | mcp
  engineBinary: '',
  enginePort: 18060,
  engineHome: '',
  cookiesPath: '',
  autoStartEngine: true,
  aiDisclosure: 'AI 虚拟角色，人工运营',
  contentPillars: ['AI 工具与效率', 'AI 原生生活实验', 'AI 虚拟角色的日常观察'],
  publishVisibility: '仅自己可见',
  dailyPostLimit: 2,
  dailyReplyLimit: 10,
  approvalTtlHours: 24,
  bannedWords: [
    '加微信', '加V', '私信我', '引流', '代购', '刷单', '返利',
    '包治', '治愈', '疗效', '保证赚钱', '稳赚', '内幕消息',
  ],
  maxTitleChars: 20,
  maxBodyChars: 1000,
  minTags: 5,
  maxTags: 8,
  maxImages: 9,
})

export function dataDirOf(env = process.env) {
  const fromEnv = String(env.DSH_XHS_FISH_HOME || '').trim()
  return resolve(fromEnv || join(homedir(), '.dsh-xhs-fish'))
}

export function readJson(file, fallback) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return fallback
  }
}

export function writeJsonAtomic(file, value) {
  mkdirSync(dirname(file), { recursive: true })
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`
  writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  try {
    renameSync(tmp, file)
  } catch {
    // Windows 上 rename 覆盖已存在文件可能失败；退化为 remove + rename。
    rmSync(file, { force: true })
    renameSync(tmp, file)
  }
}

export function normalizeConfig(input = {}) {
  const c = { ...DEFAULT_CONFIG, ...(input && typeof input === 'object' ? input : {}) }
  c.enabled = c.enabled !== false
  c.paused = c.paused === true
  c.engine = c.engine === 'mcp' ? 'mcp' : 'mock'
  c.engineBinary = String(c.engineBinary || '').trim()
  c.engineHome = String(c.engineHome || '').trim()
  c.cookiesPath = String(c.cookiesPath || '').trim()
  c.enginePort = clampInt(c.enginePort, 1024, 65535, DEFAULT_CONFIG.enginePort)
  c.autoStartEngine = c.autoStartEngine !== false
  c.aiDisclosure = String(c.aiDisclosure || DEFAULT_CONFIG.aiDisclosure).slice(0, 80)
  c.contentPillars = (Array.isArray(c.contentPillars) ? c.contentPillars : DEFAULT_CONFIG.contentPillars)
    .map((s) => String(s || '').trim())
    .filter(Boolean)
    .slice(0, 8)
  if (!c.contentPillars.length) c.contentPillars = [...DEFAULT_CONFIG.contentPillars]
  c.publishVisibility = ['仅自己可见', '公开可见', '仅互关好友可见'].includes(c.publishVisibility)
    ? c.publishVisibility
    : '仅自己可见'
  c.dailyPostLimit = clampInt(c.dailyPostLimit, 0, 5, DEFAULT_CONFIG.dailyPostLimit)
  c.dailyReplyLimit = clampInt(c.dailyReplyLimit, 0, 30, DEFAULT_CONFIG.dailyReplyLimit)
  c.approvalTtlHours = clampInt(c.approvalTtlHours, 1, 72, DEFAULT_CONFIG.approvalTtlHours)
  c.bannedWords = (Array.isArray(c.bannedWords) ? c.bannedWords : DEFAULT_CONFIG.bannedWords)
    .map((s) => String(s || '').trim())
    .filter(Boolean)
    .slice(0, 100)
  c.maxTitleChars = clampInt(c.maxTitleChars, 1, 20, 20)
  c.maxBodyChars = clampInt(c.maxBodyChars, 1, 1000, 1000)
  c.minTags = clampInt(c.minTags, 0, 10, 5)
  c.maxTags = clampInt(c.maxTags, c.minTags, 10, 8)
  c.maxImages = clampInt(c.maxImages, 1, 18, 9)
  return c
}

export function loadConfig(dataDir) {
  const file = join(dataDir, 'config.json')
  const raw = existsSync(file) ? readJson(file, {}) : {}
  return normalizeConfig(raw)
}

export function saveConfig(dataDir, patch) {
  const current = loadConfig(dataDir)
  const next = normalizeConfig({ ...current, ...(patch || {}) })
  writeJsonAtomic(join(dataDir, 'config.json'), next)
  return next
}

function clampInt(value, min, max, fallback) {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.max(min, Math.min(max, Math.trunc(n)))
}

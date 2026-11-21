import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dataDirOf, loadConfig } from '../lib/config.js'

const pluginDir = fileURLToPath(new URL('..', import.meta.url))
const dataDir = dataDirOf()
const cfg = loadConfig(dataDir)
const binary = cfg.engineBinary || join(pluginDir, 'bin', process.platform === 'win32' ? 'xiaohongshu-mcp.exe' : 'xiaohongshu-mcp')

const checks = {
  node: process.version,
  platform: `${process.platform}/${process.arch}`,
  dataDir,
  dataDirExists: existsSync(dataDir),
  engine: cfg.engine,
  engineBinary: binary,
  engineBinaryExists: existsSync(binary),
  port: cfg.enginePort,
  paused: cfg.paused,
  aiDisclosure: cfg.aiDisclosure,
  publishVisibility: cfg.publishVisibility,
  notes: [],
}

if (cfg.engine === 'mcp' && !checks.engineBinaryExists) {
  checks.notes.push('engine=mcp 但找不到可执行文件；请安装 xiaohongshu-mcp 或填写 engineBinary。')
}
if (cfg.engine === 'mock') {
  checks.notes.push('当前是 mock 引擎，不会访问真实小红书。')
}
if (!checks.dataDirExists) {
  checks.notes.push('数据目录尚未创建；保存设置或创建第一篇草稿时会创建。')
}
if (cfg.publishVisibility === '公开可见') {
  checks.notes.push('默认可见范围是公开可见；建议先用仅自己可见验证。')
}

console.log(JSON.stringify(checks, null, 2))

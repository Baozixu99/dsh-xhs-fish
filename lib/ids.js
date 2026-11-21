import { createHash, randomUUID } from 'node:crypto'

export function newId(prefix) {
  return `${prefix}_${randomUUID().replaceAll('-', '').slice(0, 12)}`
}

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

export function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  const keys = Object.keys(value).sort()
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`
}

export function hashPayload(value) {
  return `sha256:${sha256(stableStringify(value))}`
}

export function nowIso() {
  return new Date().toISOString()
}

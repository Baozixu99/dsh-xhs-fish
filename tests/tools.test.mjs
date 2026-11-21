import test from 'node:test'
import assert from 'node:assert/strict'
import { registerTools } from '../lib/tools.js'

test('tools: register against a stub tool registry', () => {
  const registered = []
  const ctx = {
    tools: {
      register(definition) {
        registered.push(definition)
        return definition
      },
    },
  }
  registerTools(ctx, {})
  assert.ok(registered.length >= 10)
  const publish = registered.find((tool) => tool.name === 'xhs_publish_commit')
  assert.ok(publish)
  assert.equal(publish.name, 'xhs_publish_commit')
  assert.equal(typeof publish.execute, 'function')
  assert.ok(publish.parameters)
})

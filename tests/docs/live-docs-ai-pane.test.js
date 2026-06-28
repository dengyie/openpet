const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const repoRoot = path.resolve(__dirname, '../..')

const readText = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf-8')

test('active TODO doc describes the current AI pane layout truthfully', () => {
  const todoArchitecture = readText('docs/openpet-current-todo-architecture.md')

  assert.match(
    todoArchitecture,
    /`聊天 Provider`\s*\/\s*`图片 Provider` open by default while secondary memory\/persona\/behavior\/chat sections stay collapsed until expanded/i,
    'openpet-current-todo-architecture.md should describe the current AI pane default-open and collapsed-section layout'
  )

  assert.doesNotMatch(
    todoArchitecture,
    /open ahead of secondary AI sections with explicit host-owned trust\/save-test guidance/i,
    'openpet-current-todo-architecture.md should not keep the older AI pane wording once the layout copy changed'
  )
})

test('active TODO doc describes the AI provider smoke evidence entrypoint truthfully', () => {
  const todoArchitecture = readText('docs/openpet-current-todo-architecture.md')

  assert.match(
    todoArchitecture,
    /npm run smoke:ai-provider -- --base-url <url> --api-key-env <env> --chat-model <model>/i,
    'openpet-current-todo-architecture.md should document the repeatable AI provider smoke command'
  )

  assert.match(
    todoArchitecture,
    /keeps image generation opt-in|image generation opt-in/i,
    'openpet-current-todo-architecture.md should keep real image generation behind an explicit opt-in boundary'
  )

  assert.match(
    todoArchitecture,
    /without raw API keys|without exposing API keys/i,
    'openpet-current-todo-architecture.md should describe the sanitized API key boundary'
  )
})

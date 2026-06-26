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

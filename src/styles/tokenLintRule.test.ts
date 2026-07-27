import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { Linter } from 'eslint'
import tseslint from 'typescript-eslint'
import rule from '../../eslint-rules/no-hardcoded-design-values.js'

// This test lints the fixture directly via ESLint's Linter API rather than
// the `eslint .` CLI, so eslint.config.js's `ignores` (which excludes the
// fixture from the real lint run) has no bearing on it — see US-002.
const fixturePath = fileURLToPath(
  new URL('./__fixtures__/design-token-violations.fixture.tsx', import.meta.url),
)

function lintFixture() {
  const source = readFileSync(fixturePath, 'utf-8')
  const linter = new Linter()
  return linter.verify(source, {
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaFeatures: { jsx: true } },
      sourceType: 'module',
    },
    plugins: {
      'design-tokens': { rules: { 'no-hardcoded-design-values': rule } },
    },
    rules: {
      'design-tokens/no-hardcoded-design-values': 'error',
    },
  })
}

describe('no-hardcoded-design-values (A7.4)', () => {
  it('flags hex, palette, and arbitrary-value literals as 3 distinct violation categories', () => {
    const messages = lintFixture()
    const messageIds = new Set(messages.map((m) => m.messageId))

    expect(messageIds.has('hex')).toBe(true)
    expect(messageIds.has('palette')).toBe(true)
    expect(messageIds.has('arbitrary')).toBe(true)
    expect(messages.length).toBeGreaterThanOrEqual(3)
    for (const m of messages) {
      expect(m.ruleId).toBe('design-tokens/no-hardcoded-design-values')
    }
  })

  it('does not flag the token-only CleanComponent', () => {
    const messages = lintFixture()
    // CleanComponent spans lines 17-19 of the fixture; no violation should
    // be reported anywhere in that range.
    const inCleanComponent = messages.filter((m) => m.line >= 17 && m.line <= 19)
    expect(inCleanComponent).toHaveLength(0)
  })
})

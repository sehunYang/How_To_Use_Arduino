import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * 색 대비는 jsdom이 계산하지 못해 화면 검사(`phase3Accessibility.test.tsx`)에서 꺼 두었습니다.
 * 그래서 옅은 회색 바탕 위의 글자색 여섯 개가 4.3~4.5로 기준에 못 미친 채 오래 남아 있었고,
 * 브라우저에서 axe를 직접 돌려야만 드러났습니다. 토큰 값은 CSS 파일에 적힌 숫자이므로,
 * 화면을 그리지 않고도 여기서 곧바로 계산해 지킬 수 있습니다.
 */

const AA_TEXT = 4.5
/** 글자가 아닌 표시(입력칸 테두리 등)에 요구되는 값. WCAG 1.4.11 */
const AA_NON_TEXT = 3

const css = readFileSync(fileURLToPath(new URL('./tokens.css', import.meta.url)), 'utf8')

function readTheme(selector: string): Record<string, string> {
  const start = css.indexOf(selector)
  if (start < 0) throw new Error(`${selector}를 찾지 못했습니다.`)
  const open = css.indexOf('{', start)
  const close = css.indexOf('}', open)
  return Object.fromEntries(
    [...css.slice(open, close).matchAll(/--color-([a-z0-9-]+):\s*(#[0-9a-f]{6})/g)].map((match) => [match[1], match[2]]),
  )
}

function relativeLuminance(hex: string): number {
  const channels = [1, 3, 5]
    .map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255)
    .map((value) => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4))
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
}

export function contrastRatio(foreground: string, background: string): number {
  const a = relativeLuminance(foreground)
  const b = relativeLuminance(background)
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

// 이 선언 뒤에 나오는 주석이 아니라 선택자 자체로 찾아야 머리말의 설명 문장에 걸리지 않습니다.
const themes = {
  light: readTheme(':root {'),
  dark: readTheme(':root[data-theme="dark"] {'),
}

/** 글자를 얹는 바탕들. 코드 블록과 단계 카드가 옅은 회색 바탕을 씁니다. */
const TEXT_BACKGROUNDS = ['background', 'muted-background'] as const

describe('design token contrast', () => {
  for (const [name, theme] of Object.entries(themes)) {
    it(`${name} theme keeps every text token at AA on both page backgrounds`, () => {
      const failures: string[] = []
      for (const [token, hex] of Object.entries(theme)) {
        if (token.endsWith('background') || token === 'accent-foreground' || token === 'border' || token === 'control-border') continue
        for (const background of TEXT_BACKGROUNDS) {
          const ratio = contrastRatio(hex, theme[background])
          if (ratio < AA_TEXT) failures.push(`${token} (${hex}) on ${background}: ${ratio.toFixed(2)}`)
        }
      }
      expect(failures, failures.join('\n')).toEqual([])
    })

    it(`${name} theme draws form control borders visibly enough to find`, () => {
      for (const background of TEXT_BACKGROUNDS) {
        expect(contrastRatio(theme['control-border'], theme[background])).toBeGreaterThanOrEqual(AA_NON_TEXT)
      }
    })

    it(`${name} theme states every colour the app paints with`, () => {
      expect(theme['control-border']).toMatch(/^#[0-9a-f]{6}$/)
      expect(theme.background).toMatch(/^#[0-9a-f]{6}$/)
    })
  }

  it('keeps the light and dark palettes in step so no utility falls back to the wrong theme', () => {
    expect(Object.keys(themes.dark).sort()).toEqual(Object.keys(themes.light).sort())
  })
})

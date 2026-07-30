#!/usr/bin/env tsx
import { mkdir, writeFile } from 'node:fs/promises'
import { phase5Recipes } from '../src/data/phase5'

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function svgFor(recipe: (typeof phase5Recipes)[number]): string {
  const cards = recipe.wiring.map((step, index) => {
    const { x, y, w, h } = step.focus
    const label = `${index + 1}. ${step.from} → ${step.to}`
    return `<g>
  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="#ffffff" stroke="${escapeXml(step.color)}" stroke-width="4"/>
  <text x="${x + 10}" y="${y + 25}" font-family="sans-serif" font-size="13" font-weight="700" fill="#172033">${escapeXml(label)}</text>
  <text x="${x + 10}" y="${y + 47}" font-family="sans-serif" font-size="11" fill="#455064">${escapeXml(step.text.slice(0, 24))}</text>
</g>`
  }).join('\n')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${recipe.imageWidth}" height="${recipe.imageHeight}" viewBox="0 0 ${recipe.imageWidth} ${recipe.imageHeight}">
<rect width="100%" height="100%" fill="#f3f6fa"/>
<text x="30" y="585" font-family="sans-serif" font-size="14" fill="#172033">${escapeXml(recipe.title)} · 배선 단계 카드</text>
${cards}
</svg>
`
}

await mkdir('public/wiring', { recursive: true })
for (const recipe of phase5Recipes) {
  await writeFile(`public/${recipe.imageUrl}`, svgFor(recipe), 'utf8')
}
console.log(`Generated ${phase5Recipes.length} Phase 5 wiring SVG files.`)

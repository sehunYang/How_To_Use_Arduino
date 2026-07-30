#!/usr/bin/env tsx
import { recipeVerifyHash } from '../src/admin/authoring'
import { actuators } from '../src/data/inventory-seed/actuators'
import { sensors } from '../src/data/inventory-seed/sensors'
import { phase5Rationales, phase5Recipes } from '../src/data/phase5'
import { RecipeSchema } from '../src/schema'
import { validateCorpus } from '../src/validation/corpusCheck'
import { validateRecipe } from '../src/validation/staticCheck'

const release = process.argv.includes('--release')
const inventory = { sensors, actuators }
const targetDistribution = {
  물리: 8,
  '화학·환경': 6,
  생물: 4,
  '공학·로봇': 6,
} as const

const failures: string[] = []
if (phase5Recipes.length !== 34) failures.push(`expected 34 recipes, found ${phase5Recipes.length}`)

for (const recipe of phase5Recipes) {
  const parsed = RecipeSchema.safeParse(recipe)
  if (!parsed.success) {
    failures.push(`${recipe.id}: schema ${parsed.error.issues.map((issue) => issue.path.join('.')).join(', ')}`)
    continue
  }
  for (const issue of validateRecipe(recipe, inventory, 'publish')) {
    failures.push(`${recipe.id}: ${issue.code} — ${issue.message}`)
  }

  if (!release) continue
  const hash = recipeVerifyHash(recipe)
  if (recipe.status !== 'published') failures.push(`${recipe.id}: status is not published`)
  if (recipe.reviewedOnDevice?.verifyHash !== hash) failures.push(`${recipe.id}: device review is missing or stale`)
  if (recipe.commentReviewed?.verifyHash !== hash) failures.push(`${recipe.id}: comment review is missing or stale`)
}

const corpusInput = release
  ? phase5Recipes
  : phase5Recipes.map((recipe) => ({ ...recipe, status: 'published' as const }))
for (const issue of validateCorpus(corpusInput, inventory, targetDistribution, phase5Rationales)) {
  failures.push(`${issue.code} — ${issue.message}`)
}

if (failures.length > 0) {
  console.error(`Phase 5 ${release ? 'release' : 'content'} corpus FAILED (${failures.length})`)
  for (const failure of failures) console.error(`  - ${failure}`)
  process.exit(1)
}

console.log(`Phase 5 ${release ? 'release' : 'content'} corpus passed: 34/34 recipes.`)

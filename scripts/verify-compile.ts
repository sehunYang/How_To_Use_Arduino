#!/usr/bin/env tsx
/**
 * CI gate for A3.2 (L2 compile check). Run with:
 *   npm run verify:compile
 *
 * Compiles every Phase 5 recipe's sketch for the Uno and exits non-zero if any
 * of them fails to build or crosses the 95% memory ceiling. A `warning` (>=80%)
 * is reported but does not fail the gate.
 *
 * Sketches are staged straight from the canonical Phase 5 recipe objects
 * rather than from US-202's extracted `sketches/*.ino`, so this gate stays
 * runnable without first running the extraction pipeline. The source string is
 * the same field in both cases.
 */
import { phase5Recipes } from '../src/data/phase5'
import { compileSketch, stageSketch } from '../src/verification/compileCheck'
import { isArduinoCliInstalled, SETUP_HINT } from '../src/verification/arduinoCli'

async function main(): Promise<void> {
  if (!isArduinoCliInstalled()) {
    console.error(SETUP_HINT)
    process.exit(1)
  }

  let failed = false
  for (const recipe of phase5Recipes) {
    const inoPath = stageSketch(recipe.id, recipe.sketch)
    const result = await compileSketch(inoPath)
    console.log(
      `${recipe.id.padEnd(16)} ${result.severity.padEnd(8)} ` +
        `flash ${result.flashPercent.toFixed(1)}%  sram ${result.sramPercent.toFixed(1)}%`,
    )
    if (!result.compilePass) {
      console.error(`\n${recipe.id} failed to compile:\n${result.message}`)
    }
    if (result.severity === 'error') failed = true
  }

  if (failed) {
    console.error('\nverify:compile FAILED — at least one sketch has severity "error".')
    process.exit(1)
  }
  console.log('\nverify:compile passed.')
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})

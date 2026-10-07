#!/usr/bin/env tsx
import { spawnSync } from 'node:child_process'
import manifest from '../wokwi/phase5/manifest.json'
import { phase5BehaviorSpecById } from '../src/wokwi/behaviorSpecs'
import { checkSerialBehavior, serialFromCliOutput } from '../src/wokwi/serialBehavior'

if (!process.env.WOKWI_CLI_TOKEN) {
  console.error('WOKWI_CLI_TOKEN is required to run the Phase 5 Wokwi scenarios.')
  process.exit(1)
}

// Run every project and report all failures together, so one CI run shows them all.
const failed: string[] = []
for (const project of manifest.projects) {
  console.log(`Running ${project.id} [${project.kind}] (${project.timeoutMs}ms cap)...`)
  const args = [project.path, '--scenario', project.scenario, '--timeout', String(project.timeoutMs)]
  // Behaviour runs capture stdout to judge it; see serialFromCliOutput for why not --serial-log-file.
  const behavior = project.kind === 'behavior'
  const result = spawnSync('wokwi-cli', args, {
    encoding: 'utf8',
    stdio: behavior ? ['inherit', 'pipe', 'inherit'] : 'inherit',
    shell: process.platform === 'win32',
  })
  if (result.error) throw result.error
  if (behavior) process.stdout.write(result.stdout)
  if (result.status !== 0) {
    failed.push(`${project.id}: wokwi-cli exited with ${result.status}`)
    continue
  }

  if (behavior) {
    const spec = phase5BehaviorSpecById.get(project.id)
    if (!spec) throw new Error(`No behaviour spec for ${project.id}; regenerate wokwi/phase5`)
    const verdict = checkSerialBehavior(spec, serialFromCliOutput(result.stdout, spec.header.split(',').length))
    if (!verdict.ok) {
      console.error(`${project.id}: serial behaviour check failed (${verdict.rows} rows)`)
      for (const failure of verdict.failures) console.error(`  - ${failure}`)
      failed.push(`${project.id}: ${verdict.failures.length} behaviour failure(s)`)
      continue
    }
    console.log(`${project.id}: ${verdict.rows} rows matched the physical stimulus`)
  }
}

if (failed.length > 0) {
  console.error(`\n${failed.length} of ${manifest.projects.length} Phase 5 Wokwi projects failed:`)
  for (const failure of failed) console.error(`  - ${failure}`)
  process.exit(1)
}

const behaviorCount = manifest.projects.filter((project) => project.kind === 'behavior').length
console.log(
  `Passed ${manifest.projects.length} Phase 5 Wokwi scenarios ` +
    `(${behaviorCount} behaviour, ${manifest.projects.length - behaviorCount} boot smoke).`,
)

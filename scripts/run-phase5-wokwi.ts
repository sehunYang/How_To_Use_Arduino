#!/usr/bin/env tsx
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import manifest from '../wokwi/phase5/manifest.json'
import { phase5BehaviorSpecById } from '../src/wokwi/behaviorSpecs'
import { checkSerialBehavior } from '../src/wokwi/serialBehavior'

if (!process.env.WOKWI_CLI_TOKEN) {
  console.error('WOKWI_CLI_TOKEN is required to run the Phase 5 Wokwi scenarios.')
  process.exit(1)
}

const logDir = resolve('.tools', 'wokwi', 'phase5-logs')
mkdirSync(logDir, { recursive: true })

for (const project of manifest.projects) {
  console.log(`Running ${project.id} [${project.kind}] (${project.timeoutMs}ms cap)...`)
  const logFile = resolve(logDir, `${project.id}.log`)
  const args = [project.path, '--scenario', project.scenario, '--timeout', String(project.timeoutMs)]
  if (project.kind === 'behavior') args.push('--serial-log-file', logFile)

  const result = spawnSync('wokwi-cli', args, {
    encoding: 'utf8',
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)

  if (project.kind === 'behavior') {
    const spec = phase5BehaviorSpecById.get(project.id)
    if (!spec) throw new Error(`No behaviour spec for ${project.id}; regenerate wokwi/phase5`)
    const verdict = checkSerialBehavior(spec, readFileSync(logFile, 'utf8'))
    if (!verdict.ok) {
      console.error(`${project.id}: serial behaviour check failed (${verdict.rows} rows)`)
      for (const failure of verdict.failures) console.error(`  - ${failure}`)
      process.exit(1)
    }
    console.log(`${project.id}: ${verdict.rows} rows matched the physical stimulus`)
  }
}

const behaviorCount = manifest.projects.filter((project) => project.kind === 'behavior').length
console.log(
  `Passed ${manifest.projects.length} Phase 5 Wokwi scenarios ` +
    `(${behaviorCount} behaviour, ${manifest.projects.length - behaviorCount} boot smoke).`,
)

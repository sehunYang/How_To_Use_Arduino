#!/usr/bin/env tsx
import { spawnSync } from 'node:child_process'
import manifest from '../wokwi/phase5/manifest.json'

if (!process.env.WOKWI_CLI_TOKEN) {
  console.error('WOKWI_CLI_TOKEN is required to run the Phase 5 Wokwi scenarios.')
  process.exit(1)
}

for (const project of manifest.projects) {
  console.log(`Running ${project.id} (${project.timeoutMs}ms cap)...`)
  const result = spawnSync(
    'wokwi-cli',
    [project.path, '--scenario', project.scenario, '--timeout', String(project.timeoutMs)],
    { encoding: 'utf8', stdio: 'inherit', shell: process.platform === 'win32' },
  )
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}

console.log(`Passed ${manifest.projects.length} Phase 5 Wokwi scenarios.`)

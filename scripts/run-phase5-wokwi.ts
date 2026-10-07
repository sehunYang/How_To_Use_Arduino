#!/usr/bin/env tsx
import { spawnSync } from 'node:child_process'
import manifest from '../wokwi/phase5/manifest.json'
import { phase5BehaviorSpecById } from '../src/wokwi/behaviorSpecs'
import { checkSerialBehavior, serialFromCliOutput } from '../src/wokwi/serialBehavior'
import { selectPhase5Projects, type SelectableProject } from '../src/wokwi/phase5Selection'

if (!process.env.WOKWI_CLI_TOKEN) {
  console.error('WOKWI_CLI_TOKEN is required to run the Phase 5 Wokwi scenarios.')
  process.exit(1)
}

function git(...args: string[]): string | undefined {
  const result = spawnSync('git', args, { encoding: 'utf8' })
  return result.status === 0 ? result.stdout : undefined
}

// `--changed-against <ref>` (pull requests): simulate only what the diff can affect.
const refFlag = process.argv.indexOf('--changed-against')
const baseRef = refFlag === -1 ? undefined : process.argv[refFlag + 1]
let projects = manifest.projects
if (baseRef) {
  const diff = git('diff', '--name-only', baseRef, 'HEAD')
  if (diff === undefined) throw new Error(`git diff against ${baseRef} failed; fetch the base branch first`)
  const baseManifest = git('show', `${baseRef}:wokwi/phase5/manifest.json`)
  const base = baseManifest === undefined
    ? undefined
    : (JSON.parse(baseManifest) as { projects: SelectableProject[] }).projects
  const selection = selectPhase5Projects(diff.split('\n').filter(Boolean), manifest.projects, base)
  projects = manifest.projects.filter((project) => selection.ids.includes(project.id))
  console.log(`Changed against ${baseRef}: ${projects.length} of ${manifest.projects.length} Phase 5 projects to simulate.`)
  for (const id of selection.ids) console.log(`  - ${id}: ${selection.reasons[id]}`)
}

// Run every project and report all failures together, so one CI run shows them all.
const failed: string[] = []
for (const project of projects) {
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
  console.error(`\n${failed.length} of ${projects.length} Phase 5 Wokwi projects failed:`)
  for (const failure of failed) console.error(`  - ${failure}`)
  process.exit(1)
}

const behaviorCount = projects.filter((project) => project.kind === 'behavior').length
console.log(
  `Passed ${projects.length} Phase 5 Wokwi scenarios ` +
    `(${behaviorCount} behaviour, ${projects.length - behaviorCount} boot smoke).`,
)

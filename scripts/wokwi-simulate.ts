import { spawnSync, type SpawnSyncReturns } from 'node:child_process'

/**
 * Runs wokwi-cli, echoing its output, and once more if the API connection
 * dropped before the simulation started (`code 1006` before "Starting
 * simulation..."): an infra failure that ran no part of the test. Any failure
 * after the start counts. Same rule as scripts/run-phase5-wokwi.ts.
 */
export function simulate(args: string[]): SpawnSyncReturns<string> {
  const run = () => {
    const result = spawnSync('wokwi-cli', args, {
      encoding: 'utf8',
      stdio: ['inherit', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
    })
    if (result.error) throw result.error
    process.stdout.write(result.stdout)
    process.stderr.write(result.stderr)
    return result
  }
  const first = run()
  const output = first.stdout + first.stderr
  if (first.status !== 0 && /Connection to transport closed/.test(output) && !output.includes('Starting simulation...')) {
    console.log('Wokwi API connection dropped before the simulation started; retrying once.')
    return run()
  }
  return first
}

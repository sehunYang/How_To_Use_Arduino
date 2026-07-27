import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { compileReadableLayout } from '../src/wokwi/readableLayout'
import { pendulumLayout } from '../src/wokwi/layouts/pendulumLayout'

const target = resolve('diagram.json')
const diagram = compileReadableLayout(pendulumLayout)
const output = `${JSON.stringify(diagram, null, 2)}\n`

if (process.argv.includes('--check')) {
  const current = await readFile(target, 'utf8')
  if (current !== output) {
    throw new Error('diagram.json is stale. Run: npm run generate:wokwi-diagram')
  }
  console.log('diagram.json matches the validated ReadableLayout source.')
} else {
  await writeFile(target, output, 'utf8')
  console.log(`Generated ${target} from validated ReadableLayout.`)
}

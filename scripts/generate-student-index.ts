import { mkdir, writeFile } from 'node:fs/promises'
import { buildIndex } from '../src/search/buildIndexEntry'
import { studentRecipes } from '../src/data/studentCatalog'

await mkdir('public', { recursive: true })
await writeFile('public/index.json', `${JSON.stringify(buildIndex(studentRecipes), null, 2)}\n`, 'utf8')

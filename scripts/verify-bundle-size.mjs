import { readFile } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'
import { resolve } from 'node:path'
import {
  SIZE_BUDGETS,
  validateSizeBudgets,
} from '../src/validation/sizeBudgets.ts'

const distDirectory = resolve(process.argv[2] ?? 'dist')

function assetPath(reference) {
  const pathname = decodeURIComponent(reference.split(/[?#]/, 1)[0])
  const assetsIndex = pathname.indexOf('assets/')
  const relativePath =
    assetsIndex >= 0 ? pathname.slice(assetsIndex) : pathname.replace(/^\/+/, '')
  return resolve(distDirectory, relativePath)
}

function initialJavaScriptReferences(html) {
  const references = new Set()
  for (const match of html.matchAll(
    /<script\b[^>]*\btype=["']module["'][^>]*\bsrc=["']([^"']+\.js(?:[?#][^"']*)?)["'][^>]*>/gi,
  )) {
    references.add(match[1])
  }
  for (const match of html.matchAll(
    /<link\b[^>]*\brel=["']modulepreload["'][^>]*\bhref=["']([^"']+\.js(?:[?#][^"']*)?)["'][^>]*>/gi,
  )) {
    references.add(match[1])
  }
  return [...references]
}

const html = await readFile(resolve(distDirectory, 'index.html'), 'utf8')
const initialReferences = initialJavaScriptReferences(html)
if (initialReferences.length === 0) {
  throw new Error('No initial JavaScript entry was found in dist/index.html')
}

const initialAssets = await Promise.all(
  initialReferences.map(async (reference) => ({
    reference,
    bytes: await readFile(assetPath(reference)),
  })),
)
const indexBytes = await readFile(resolve(distDirectory, 'index.json'))

const measurements = {
  initialJsGzipBytes: initialAssets.reduce(
    (total, asset) => total + gzipSync(asset.bytes).byteLength,
    0,
  ),
  indexRawBytes: indexBytes.byteLength,
  indexGzipBytes: gzipSync(indexBytes).byteLength,
}

console.log(
  `Initial JS gzip: ${measurements.initialJsGzipBytes} / ${SIZE_BUDGETS.initialJsGzipBytes} bytes`,
)
console.log(
  `index.json raw: ${measurements.indexRawBytes} / <${SIZE_BUDGETS.indexRawBytes} bytes`,
)
console.log(
  `index.json gzip: ${measurements.indexGzipBytes} / ${SIZE_BUDGETS.indexGzipBytes} bytes`,
)

const violations = validateSizeBudgets(measurements)
if (violations.length > 0) {
  for (const violation of violations) {
    console.error(
      `${violation.budget}: ${violation.actualBytes} must be ${violation.comparison} ${violation.limitBytes} bytes`,
    )
  }
  process.exitCode = 1
}

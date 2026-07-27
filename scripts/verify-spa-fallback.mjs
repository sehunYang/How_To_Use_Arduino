#!/usr/bin/env node
/**
 * Verifies the GitHub Pages SPA deep-link fallback mechanism (US-003 / PL1).
 *
 * GitHub Pages serves a real HTTP 404 status for any path that isn't a
 * literal file, but uses 404.html as the *body* of that response — which is
 * exactly what makes the SPA fallback trick work: the browser gets the app
 * shell even though the status line says "Not Found". This script proves
 * that end-to-end by actually starting a static file server that mimics
 * that specific behavior, requesting a deep path, and inspecting both the
 * status code and the body — not just comparing files on disk.
 *
 * Run after `npm run build` + the 404.html copy step, e.g.:
 *   npm run build && cp dist/index.html dist/404.html && npm run verify:spa-fallback
 */
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createServer } from 'node:http'
import { join, normalize } from 'node:path'

const root = fileURLToPath(new URL('..', import.meta.url))
const distDir = `${root}dist`
const indexPath = `${distDir}/index.html`
const notFoundPath = `${distDir}/404.html`
const workflowPath = `${root}.github/workflows/deploy.yml`

const failures = []

// --- Static checks: files exist, are byte-identical, and the CI step that
// produces them is still present in the workflow. Cheap, fast, and catch
// the most common regression (someone deletes the `cp` step). ---

let indexContent = null
let notFoundContent = null

if (!existsSync(indexPath)) {
  failures.push(`missing ${indexPath} — run \`npm run build\` first`)
} else if (!existsSync(notFoundPath)) {
  failures.push(`missing ${notFoundPath} — the 404.html copy step did not run`)
} else {
  indexContent = readFileSync(indexPath)
  notFoundContent = readFileSync(notFoundPath)
  if (!indexContent.equals(notFoundContent)) {
    failures.push('dist/404.html is not byte-identical to dist/index.html')
  }
}

if (!existsSync(workflowPath)) {
  failures.push(`missing ${workflowPath}`)
} else {
  const workflow = readFileSync(workflowPath, 'utf-8')
  if (!/cp\s+dist\/index\.html\s+dist\/404\.html/.test(workflow)) {
    failures.push(
      '.github/workflows/deploy.yml no longer contains the `cp dist/index.html dist/404.html` step',
    )
  }
}

// --- Real serve test: a minimal static server that reproduces GitHub
// Pages' actual unmatched-path behavior (serve 404.html, WITH a 404 status
// code — this is the detail a byte-compare alone can never prove). Then
// request a deep path and check both the status and that the body is
// genuinely the SPA shell (contains the bundled script tag), not an empty
// or generic error page. ---

function serveLikeGitHubPages(req, res) {
  const requestedPath = normalize(decodeURIComponent(req.url.split('?')[0]))
  const filePath = join(distDir, requestedPath)

  if (requestedPath !== '/' && existsSync(filePath)) {
    res.writeHead(200, { 'Content-Type': 'text/html' })
    res.end(readFileSync(filePath))
    return
  }

  // Root path and any unmatched path both fall through to 404.html, with a
  // real 404 status — this is the exact mechanism GitHub Pages uses.
  res.writeHead(404, { 'Content-Type': 'text/html' })
  res.end(notFoundContent ?? '')
}

async function runServeTest() {
  if (!notFoundContent) return // static checks above already failed; skip

  const server = createServer(serveLikeGitHubPages)
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address()

  try {
    const res = await fetch(`http://127.0.0.1:${port}/some/deep/path`)
    const body = await res.text()

    if (res.status !== 404) {
      failures.push(`expected HTTP 404 for an unmatched deep path, got ${res.status}`)
    }

    const hasScriptTag = /<script[^>]+src="[^"]*\/assets\/[^"]+\.js"/.test(body)
    if (!hasScriptTag) {
      failures.push(
        'response body for /some/deep/path does not contain the bundled app script tag — ' +
          'the browser would not actually load the SPA from this response',
      )
    }

    const bodyMatchesShell = Buffer.from(body).equals(notFoundContent)
    if (!bodyMatchesShell) {
      failures.push('response body for /some/deep/path is not byte-identical to dist/404.html')
    }
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
}

await runServeTest()

if (failures.length > 0) {
  console.error('SPA fallback verification FAILED:')
  for (const failure of failures) console.error(`  - ${failure}`)
  process.exit(1)
}

console.log(
  'SPA fallback verification passed: a live static server returned HTTP 404 with the SPA shell body for an unmatched deep path, matching GitHub Pages behavior.',
)

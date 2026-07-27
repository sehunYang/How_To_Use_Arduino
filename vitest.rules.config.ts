import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'

// Dedicated config for the Firestore/Storage security-rule tests (US-009).
// Kept separate from vitest.config.ts so a plain `npm run test` never picks
// these up — they require the Firebase emulator suite to be running and are
// only meant to be invoked via `npm run test:rules`
// (firebase emulators:exec ... "vitest run --config vitest.rules.config.ts").
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    globals: false,
    include: ['src/rules/**/*.test.ts'],
    // All rules test files share one Firestore/Storage emulator project and
    // each clears it in beforeEach — running files in parallel lets one
    // file's clearFirestore() wipe another's in-flight write/read.
    fileParallelism: false,
  },
})

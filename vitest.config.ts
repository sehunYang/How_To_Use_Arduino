import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'

// Separate from vite.config.ts on purpose: mixing the react/tailwind Vite
// plugins into the vitest config triggers a type conflict between the root
// `vite` version and the nested `vite` vitest depends on internally. Our
// unit tests (schema/validator/search) are plain function tests that need
// neither plugin, so a minimal config sidesteps the conflict entirely.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    globals: false,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    // src/rules/** requires the Firebase emulator suite to be running
    // (see vitest.rules.config.ts + the `test:rules` script) and would
    // otherwise fail every plain `npm run test` invocation.
    exclude: ['**/node_modules/**', 'src/rules/**'],
  },
})

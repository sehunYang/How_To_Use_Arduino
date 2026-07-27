// Intentionally violates the design-token rule (eslint-rules/no-hardcoded-design-values.js).
// Excluded from `npm run lint` via eslint.config.js ignores; linted directly
// by src/styles/tokenLintRule.test.ts using ESLint's Linter API instead.

export function HexViolation() {
  return <div className="text-[#ff0000]">hardcoded hex</div>
}

export function PaletteViolation() {
  return <div className="text-blue-500">tailwind default palette</div>
}

export function ArbitraryValueViolation() {
  return <div className="p-[13px]">arbitrary spacing value</div>
}

export function CleanComponent() {
  return <div className="text-foreground p-page">uses tokens only</div>
}

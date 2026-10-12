/**
 * Chooses which Phase 5 Wokwi projects a pull request must simulate. Wokwi
 * time is metered (docs/wokwi-setup.md §6), so a PR runs only the recipes its
 * diff can affect; the monthly scheduled run still covers all of them.
 */

export interface SelectableProject {
  id: string
  chips: string[]
  fingerprint?: string
}

export interface Phase5Selection {
  ids: string[]
  /** Why each selected project runs, for the CI log. */
  reasons: Record<string, string>
}

/**
 * Files that decide every project's verdict: the checker and its oracles, the
 * scenario generator, the runner and firmware build, and the toolchain they
 * install. Changing any of them reruns everything.
 */
export const PHASE5_GLOBAL_INPUTS: readonly string[] = [
  'src/wokwi/serialBehavior.ts',
  'src/wokwi/sensorOracles.ts',
  'src/wokwi/phase5ProjectGenerator.ts',
  'src/wokwi/phase5Selection.ts',
  'src/wokwi/phase5SimulationRegistry.ts',
  'scripts/run-phase5-wokwi.ts',
  'scripts/build-phase5-wokwi-firmware.ts',
  'scripts/generate-phase5-wokwi.ts',
  'scripts/setup-arduino-cli.ts',
  'src/verification/arduinoCli.ts',
  '.github/workflows/verify-pr.yml',
  'chips/wokwi-api.h',
]

/** `chips/bme280.chip.c` → `bme280`, for every source file of a custom chip. */
function chipOf(path: string): string | undefined {
  return /^chips\/([a-z0-9]+)(?:\.chip)?\.(?:c|h|json)$/.exec(path)?.[1]
}

export function selectPhase5Projects(
  changedFiles: readonly string[],
  head: readonly SelectableProject[],
  base: readonly SelectableProject[] | undefined,
): Phase5Selection {
  const reasons: Record<string, string> = {}
  const select = (id: string, reason: string) => {
    reasons[id] ??= reason
  }

  const global = changedFiles.find((path) => PHASE5_GLOBAL_INPUTS.includes(path))
  if (global) {
    for (const project of head) select(project.id, `shared input ${global} changed`)
  } else if (base === undefined) {
    for (const project of head) select(project.id, 'base branch has no Phase 5 manifest')
  } else {
    const baseById = new Map(base.map((project) => [project.id, project]))
    const changedChips = new Set(changedFiles.map(chipOf).filter((chip): chip is string => chip !== undefined))
    for (const project of head) {
      const before = baseById.get(project.id)
      if (!before) select(project.id, 'new project')
      else if (before.fingerprint === undefined || before.fingerprint !== project.fingerprint) {
        select(project.id, 'sketch, circuit, scenario or expectations changed')
      }
      const chip = project.chips.find((candidate) => changedChips.has(candidate))
      if (chip) select(project.id, `custom chip ${chip} changed`)
    }
  }

  return { ids: head.map((project) => project.id).filter((id) => id in reasons), reasons }
}

import type { Recipe, Sensor } from '@/schema'
import { buildDiagram, type Diagram } from '@/wokwi/buildDiagram'

export interface ExtractedContent {
  sketchFilename: string
  sketchContent: string
  diagram: Diagram
}

/**
 * Pure content-extraction step of the 검증 원장 pipeline (US-202). No
 * filesystem I/O here — that is the CI script's job (scripts/extract-content.ts)
 * so this stays unit-testable without a real disk or emulator.
 */
export function extractContent(recipe: Recipe, sensors: Sensor[]): ExtractedContent {
  return {
    sketchFilename: `${recipe.id}.ino`,
    sketchContent: recipe.sketch,
    diagram: buildDiagram(recipe, sensors),
  }
}

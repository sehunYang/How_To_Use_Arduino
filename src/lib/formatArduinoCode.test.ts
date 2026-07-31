import { describe, expect, it } from 'vitest'
import { phase5Recipes } from '@/data/phase5'
import { phase6Recipes } from '@/data/phase6'
import { formatArduinoCode } from './formatArduinoCode'

describe('formatArduinoCode', () => {
  it('expands compact functions and preserves for-loop separators and strings', () => {
    const compact = 'void loop(){for(byte ch=0;ch<8;ch++){Serial.print(",");Serial.print(ch);}Serial.println();}'
    expect(formatArduinoCode(compact)).toBe(`void loop() {
  for(byte ch=0;ch<8;ch++) {
    Serial.print(",");
    Serial.print(ch);
  }
  Serial.println();
}`)
  })

  it('publishes every recipe with readable statement lines and indentation', () => {
    for (const recipe of [...phase5Recipes, ...phase6Recipes]) {
      expect(recipe.sketch, recipe.id).toBe(formatArduinoCode(recipe.sketch))
      expect(recipe.sketch, recipe.id).not.toMatch(/\{[^\n{}]*;[^\n{}]*;/)
      for (const line of recipe.sketch.split('\n')) {
        if (line.trim() === line || !line.trim()) continue
        expect(line.match(/^ +/)?.[0].length, `${recipe.id}: ${line}`).toBeGreaterThanOrEqual(2)
      }
    }
  })
})

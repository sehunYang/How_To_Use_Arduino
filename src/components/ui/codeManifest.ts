export interface DisplayCodeLine {
  text: string
  tunableAnchor: string | null
}

export function parseDisplayCode(code: string): DisplayCodeLine[] {
  const result: DisplayCodeLine[] = []
  let pendingTunable: string | null = null
  for (const line of code.split('\n')) {
    const manifest = line.match(/^\s*\/\/\s*@(pin|baud|tunable)\b\s*(.*)$/)
    if (manifest) {
      if (manifest[1] === 'tunable') pendingTunable = manifest[2].trim() || null
      continue
    }
    result.push({ text: line, tunableAnchor: pendingTunable })
    pendingTunable = null
  }
  return result
}

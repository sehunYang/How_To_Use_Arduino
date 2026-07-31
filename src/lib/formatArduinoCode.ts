function indentation(level: number) {
  return '  '.repeat(Math.max(0, level))
}

/**
 * Formats the compact Arduino C++ used by generated recipes without changing
 * tokens. Semicolons inside for-loop parentheses and characters inside quoted
 * strings are deliberately left untouched.
 */
export function formatArduinoCode(source: string): string {
  const output: string[] = []
  let indent = 0
  let buffer = ''
  let parentheses = 0
  let quote: '"' | "'" | null = null
  let escaped = false

  const flush = () => {
    const text = buffer.trim()
    if (text) output.push(`${indentation(indent)}${text}`)
    buffer = ''
  }

  for (const rawLine of source.replace(/\r\n?/g, '\n').split('\n')) {
    const line = rawLine.trim()
    if (!line) {
      flush()
      if (output.at(-1) !== '') output.push('')
      continue
    }
    if (line.startsWith('#') || line.startsWith('//')) {
      flush()
      output.push(`${indentation(indent)}${line}`)
      continue
    }

    for (let index = 0; index < line.length; index += 1) {
      const character = line[index]
      const next = line[index + 1]

      if (quote) {
        buffer += character
        if (escaped) escaped = false
        else if (character === '\\') escaped = true
        else if (character === quote) quote = null
        continue
      }
      if (character === '"' || character === "'") {
        quote = character
        buffer += character
        continue
      }
      if (character === '/' && next === '/') {
        buffer = `${buffer.trimEnd()} ${line.slice(index)}`
        flush()
        break
      }
      if (character === '(') parentheses += 1
      if (character === ')') parentheses = Math.max(0, parentheses - 1)

      if (character === '{') {
        buffer = `${buffer.trimEnd()} {`
        flush()
        indent += 1
      } else if (character === '}') {
        flush()
        indent = Math.max(0, indent - 1)
        output.push(`${indentation(indent)}}`)
      } else if (character === ';' && parentheses === 0) {
        buffer += character
        flush()
      } else {
        buffer += character
      }
    }
    flush()
  }

  while (output.at(-1) === '') output.pop()
  return output.join('\n')
}

import type { ReactNode } from 'react'

const KEYWORDS = new Set([
  'break', 'case', 'const', 'continue', 'default', 'do', 'else', 'for', 'if',
  'return', 'static', 'switch', 'while',
])
const TYPES = new Set([
  'bool', 'byte', 'char', 'double', 'float', 'int', 'long', 'short', 'String',
  'unsigned', 'void',
])
const CONSTANTS = new Set([
  'false', 'HIGH', 'INPUT', 'INPUT_PULLUP', 'LOW', 'OUTPUT', 'true',
])
const TOKEN_PATTERN =
  /\/\/.*$|\/\*.*?\*\/|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|#[A-Za-z_]\w*|\b[A-Za-z_]\w*\b|\b\d+(?:\.\d+)?\b|[{}()[\];,.+\-*/%=<>!&|?:]+/g

function tokenClass(token: string, line: string, end: number): string | null {
  if (token.startsWith('//') || token.startsWith('/*')) return 'text-syntax-comment'
  if (token.startsWith('"') || token.startsWith("'")) return 'text-syntax-string'
  if (token.startsWith('#') || KEYWORDS.has(token)) return 'text-syntax-keyword'
  if (TYPES.has(token)) return 'text-syntax-type'
  if (CONSTANTS.has(token)) return 'text-syntax-number'
  if (/^\d/.test(token)) return 'text-syntax-number'
  if (/^[{}()[\];,.+\-*/%=<>!&|?:]+$/.test(token)) return 'text-syntax-operator'
  if (/^\s*\(/.test(line.slice(end))) return 'text-syntax-function'
  return null
}

export function highlightArduinoLine(line: string): ReactNode[] {
  const result: ReactNode[] = []
  let cursor = 0

  for (const match of line.matchAll(TOKEN_PATTERN)) {
    const start = match.index
    const token = match[0]
    if (start > cursor) result.push(line.slice(cursor, start))
    const className = tokenClass(token, line, start + token.length)
    result.push(className
      ? <span key={`${start}-${token}`} className={className}>{token}</span>
      : token)
    cursor = start + token.length
  }

  if (cursor < line.length) result.push(line.slice(cursor))
  return result
}

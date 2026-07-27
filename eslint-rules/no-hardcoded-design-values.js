// Custom ESLint rule enforcing A7.4: no hardcoded colors, spacing, or
// typography values outside the design-token system (src/styles/tokens.css).
// Allowlist approach — Tailwind's default color palette and arbitrary-value
// utilities are rejected wholesale; only token-derived utilities are permitted.

const HEX_RE = /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/
const RGB_RE = /\brgba?\(/
const PALETTE_COLORS = [
  'slate', 'gray', 'zinc', 'neutral', 'stone',
  'red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal',
  'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose',
]
const PALETTE_PREFIXES = [
  'text', 'bg', 'border', 'ring', 'fill', 'stroke', 'from', 'via', 'to',
  'divide', 'outline', 'decoration', 'accent', 'caret', 'shadow', 'placeholder',
]
const PALETTE_RE = new RegExp(
  `(?:^|[\\s'"\`])(?:${PALETTE_PREFIXES.join('|')})-(?:${PALETTE_COLORS.join('|')})-\\d{2,3}\\b`,
)
const ARBITRARY_RE = /\[[\d.]+(?:px|rem|em)\]/

function checkString(value, node, context) {
  if (typeof value !== 'string') return
  if (HEX_RE.test(value)) {
    context.report({ node, messageId: 'hex' })
  }
  if (RGB_RE.test(value)) {
    context.report({ node, messageId: 'rgb' })
  }
  if (PALETTE_RE.test(value)) {
    context.report({ node, messageId: 'palette' })
  }
  if (ARBITRARY_RE.test(value)) {
    context.report({ node, messageId: 'arbitrary' })
  }
}

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow hardcoded colors/spacing/typography outside design tokens (A7.4)',
    },
    schema: [],
    messages: {
      hex: 'Hardcoded hex color literal found. Use a design token utility (see src/styles/tokens.css) instead.',
      rgb: 'Hardcoded rgb()/rgba() color literal found. Use a design token utility instead.',
      palette:
        'Tailwind default-palette color utility found. Use the token color utilities (bg-accent, text-foreground, ...) instead.',
      arbitrary:
        'Arbitrary-value utility (hardcoded px/rem/em) found. Use a token spacing/typography utility instead.',
    },
  },
  create(context) {
    function isDesignAttr(name) {
      return name === 'className' || name === 'style'
    }

    return {
      JSXAttribute(node) {
        if (!node.name || node.name.type !== 'JSXIdentifier') return
        if (!isDesignAttr(node.name.name)) return

        const value = node.value
        if (!value) return

        if (value.type === 'Literal' && typeof value.value === 'string') {
          checkString(value.value, value, context)
          return
        }

        if (value.type !== 'JSXExpressionContainer') return
        const expr = value.expression

        if (expr.type === 'TemplateLiteral') {
          for (const quasi of expr.quasis) {
            checkString(quasi.value.raw, quasi, context)
          }
          return
        }

        if (expr.type === 'Literal' && typeof expr.value === 'string') {
          checkString(expr.value, expr, context)
          return
        }

        if (expr.type === 'ObjectExpression') {
          // style={{ color: '#fff' }}
          for (const prop of expr.properties) {
            if (prop.type !== 'Property') continue
            if (prop.value.type === 'Literal' && typeof prop.value.value === 'string') {
              checkString(prop.value.value, prop.value, context)
            }
          }
        }
      },
    }
  },
}

export default rule

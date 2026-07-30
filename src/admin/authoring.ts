import { z } from 'zod'
import {
  RecipeSchema,
  type Recipe,
  type SimStatus,
  type StaticIssue,
} from '@/schema'
import { computeVerifyHash } from '@/lib/verifyHash'
import { validateRecipe, type Inventory } from '@/validation/staticCheck'

export type FieldErrorMap = Record<string, string[]>

export interface AuthoringValidation {
  recipe: Recipe | null
  fieldErrors: FieldErrorMap
  issues: StaticIssue[]
  canSave: boolean
  canPublish: boolean
  verifyHash: string | null
}

function fieldPath(path: PropertyKey[]): string {
  if (path.length === 0) return '_form'
  return path.reduce<string>((result, part) => {
    if (typeof part === 'number') return `${result}[${part}]`
    return result ? `${result}.${String(part)}` : String(part)
  }, '')
}

/** Converts every Zod issue to the exact form-field path that produced it. */
export function mapZodFieldErrors(error: z.ZodError): FieldErrorMap {
  const errors: FieldErrorMap = {}
  for (const issue of error.issues) {
    const path = fieldPath(issue.path)
    let message = '입력값을 확인해 주세요.'
    if (issue.code === 'invalid_type') message = '필수값이 없거나 값의 형식이 올바르지 않습니다.'
    if (issue.code === 'invalid_enum_value') message = '허용된 값 중 하나를 선택해 주세요.'
    if (issue.code === 'too_small') message = '값이 비어 있거나 허용된 최솟값보다 작습니다.'
    if (issue.code === 'too_big') message = '허용된 최댓값을 초과했습니다.'
    errors[path] = [...(errors[path] ?? []), message]
  }
  return errors
}

function parseRecipe(input: unknown, status: Recipe['status']) {
  if (!input || typeof input !== 'object') return RecipeSchema.safeParse(input)
  return RecipeSchema.safeParse({ ...input, status })
}

function authorReviewIssues(recipe: Recipe, verifyHash: string): StaticIssue[] {
  const issues: StaticIssue[] = []
  if (recipe.reviewedOnDevice?.verifyHash !== verifyHash) {
    issues.push({
      code: 'device-review-stale',
      severity: 'error',
      message: '현재 레시피 버전을 실제 기기에서 다시 검토해 주세요.',
    })
  }
  if (recipe.commentReviewed?.verifyHash !== verifyHash) {
    issues.push({
      code: 'comment-review-stale',
      severity: 'error',
      message: '현재 레시피 버전의 코드 주석을 다시 검토해 주세요.',
    })
  }
  return issues
}

function verificationIssues(simStatus: SimStatus | null, verifyHash: string): StaticIssue[] {
  if (!simStatus || simStatus.verifyHash !== verifyHash) {
    return [{
      code: 'verification-stale',
      severity: 'error',
      message: '현재 레시피 버전과 일치하는 검증 결과가 필요합니다.',
    }]
  }

  const issues: StaticIssue[] = []
  if (!simStatus.compilePass) {
    issues.push({ code: 'compile-failed', severity: 'error', message: '게시 전에 스케치 컴파일을 통과해야 합니다.' })
  }
  if (!simStatus.logicPass) {
    issues.push({ code: 'logic-failed', severity: 'error', message: '게시 전에 로직 검증을 통과해야 합니다.' })
  }
  if (simStatus.simPass === false) {
    issues.push({ code: 'simulation-failed', severity: 'error', message: '게시 전에 시뮬레이션을 통과해야 합니다.' })
  }
  if (simStatus.staticIssues.some((issue) => issue.severity === 'error')) {
    issues.push({
      code: 'verification-static-errors',
      severity: 'error',
      message: '현재 검증 결과에 정적 오류가 남아 있습니다.',
    })
  }
  return issues
}

export function recipeVerifyHash(recipe: Recipe, inventoryVersion: string): string {
  return computeVerifyHash({
    sketch: recipe.sketch,
    wiring: recipe.wiring,
    layout: recipe.layout,
    tunables: recipe.tunables,
    baudRate: recipe.baudRate,
    inventoryVersion,
  })
}

/**
 * Draft validation only blocks malformed schema data. L1 findings are
 * returned as warnings and never prevent a valid draft from being saved.
 */
export function validateDraft(
  input: unknown,
  inventory: Inventory,
  inventoryVersion: string,
): AuthoringValidation {
  const parsed = parseRecipe(input, 'draft')
  if (!parsed.success) {
    return {
      recipe: null,
      fieldErrors: mapZodFieldErrors(parsed.error),
      issues: [],
      canSave: false,
      canPublish: false,
      verifyHash: null,
    }
  }

  return {
    recipe: parsed.data,
    fieldErrors: {},
    issues: validateRecipe(parsed.data, inventory, 'draft'),
    canSave: true,
    canPublish: false,
    verifyHash: recipeVerifyHash(parsed.data, inventoryVersion),
  }
}

/** Runs the complete publish gate: schema, L1, current reviews, and current L2/L3 ledger. */
export function validatePublish(
  input: unknown,
  inventory: Inventory,
  inventoryVersion: string,
  simStatus: SimStatus | null,
): AuthoringValidation {
  const parsed = parseRecipe(input, 'published')
  if (!parsed.success) {
    return {
      recipe: null,
      fieldErrors: mapZodFieldErrors(parsed.error),
      issues: [],
      canSave: false,
      canPublish: false,
      verifyHash: null,
    }
  }

  const verifyHash = recipeVerifyHash(parsed.data, inventoryVersion)
  const issues = [
    ...validateRecipe(parsed.data, inventory, 'publish'),
    ...authorReviewIssues(parsed.data, verifyHash),
    ...verificationIssues(simStatus, verifyHash),
  ]
  return {
    recipe: parsed.data,
    fieldErrors: {},
    issues,
    canSave: true,
    canPublish: issues.every((issue) => issue.severity !== 'error'),
    verifyHash,
  }
}

export function markCurrentReview(
  recipe: Recipe,
  kind: 'reviewedOnDevice' | 'commentReviewed',
  inventoryVersion: string,
  at = new Date().toISOString(),
): Recipe {
  return {
    ...recipe,
    [kind]: { at, verifyHash: recipeVerifyHash(recipe, inventoryVersion) },
  }
}

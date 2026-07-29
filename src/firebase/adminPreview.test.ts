import { describe, expect, it } from 'vitest'
import { hasAdminClaim } from './adminPreview'

describe('admin preview authorization', () => {
  it('accepts only the explicit boolean admin claim', () => {
    expect(hasAdminClaim({ admin: true })).toBe(true)
    expect(hasAdminClaim({ admin: 'true' })).toBe(false)
    expect(hasAdminClaim({})).toBe(false)
  })
})

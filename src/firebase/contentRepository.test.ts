import { describe, expect, it } from 'vitest'
import { publishedRecipes } from '@/data/studentCatalog'
import { applyPublishedIndex, mergePublishedRecipes } from './contentRepository'

describe('mergePublishedRecipes', () => {
  it('adds a Firestore-only published recipe without a redeploy', () => {
    const remote = {
      ...publishedRecipes[0],
      id: 'firestore-only-recipe',
      title: '동적 레시피',
    }

    expect(mergePublishedRecipes(publishedRecipes, [remote]))
      .toContainEqual(remote)
  })

  it('lets the current Firestore document replace a bundled copy', () => {
    const remote = {
      ...publishedRecipes[0],
      title: '관리자에서 수정한 제목',
    }

    const merged = mergePublishedRecipes(publishedRecipes, [remote])

    expect(merged.filter((recipe) => recipe.id === remote.id)).toEqual([remote])
  })

  it('does not expose remote drafts', () => {
    const draft = {
      ...publishedRecipes[0],
      id: 'remote-draft',
      status: 'draft' as const,
    }

    expect(mergePublishedRecipes(publishedRecipes, [draft]))
      .not.toContainEqual(draft)
  })

  it('removes a bundled recipe when the authoritative public index withdraws it', () => {
    const retained = publishedRecipes[0]
    const index = [{
      id: retained.id,
      title: retained.title,
      subject: retained.subject,
      difficulty: retained.difficulty,
      minutes: retained.minutes,
      sensors: retained.sensors,
      actuators: retained.actuators,
      coreKeywords: retained.coreKeywords,
      imageUrl: retained.imageUrl,
      applicationGuideExcerpt: retained.applicationGuide,
    }]

    expect(applyPublishedIndex(publishedRecipes, [], index)).toEqual([retained])
  })
})

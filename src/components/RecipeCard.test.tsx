// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { pendulumRecipe } from '@/data/canary'
import { RecipeCard } from './RecipeCard'

describe('RecipeCard', () => {
  it('uses semantic text colors instead of pill badges for gallery metadata', () => {
    render(
      <MemoryRouter>
        <RecipeCard recipe={pendulumRecipe} />
      </MemoryRouter>,
    )

    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByText(`과목 · ${pendulumRecipe.subject}`)).toHaveClass('text-subject-physics')
    expect(screen.getByText(`난이도 · ${pendulumRecipe.difficulty}`)).toHaveClass('text-difficulty-intermediate')
    expect(screen.getByText(`시간 · ${pendulumRecipe.minutes}분`)).toHaveClass('text-time-medium')
    for (const label of [
      `과목 · ${pendulumRecipe.subject}`,
      `난이도 · ${pendulumRecipe.difficulty}`,
      `시간 · ${pendulumRecipe.minutes}분`,
    ]) {
      expect(screen.getByText(label)).not.toHaveClass('rounded-full')
    }
  })
})

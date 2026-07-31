// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { pendulumRecipe } from '@/data/canary'
import { RecipeCard } from './RecipeCard'

describe('RecipeCard', () => {
  it('shows distinct metadata badges without a wiring image', () => {
    render(
      <MemoryRouter>
        <RecipeCard recipe={pendulumRecipe} />
      </MemoryRouter>,
    )

    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByText(`과목 · ${pendulumRecipe.subject}`)).toHaveClass('bg-accent')
    expect(screen.getByText(`난이도 · ${pendulumRecipe.difficulty}`)).toHaveClass('bg-warning-background')
    expect(screen.getByText(`시간 · ${pendulumRecipe.minutes}분`)).toHaveClass('bg-success-background')
  })
})

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
    expect(screen.getByText('과목 ·')).toHaveClass('text-muted')
    expect(screen.getByText('난이도 ·')).toHaveClass('text-muted')
    expect(screen.getByText('시간 ·')).toHaveClass('text-muted')
    expect(screen.getByText(pendulumRecipe.subject!)).toHaveClass('text-subject-physics')
    expect(screen.getByText(pendulumRecipe.difficulty)).toHaveClass('text-difficulty-intermediate')
    expect(screen.getByText(`${pendulumRecipe.minutes}분`)).toHaveClass('text-time-medium')
    expect(screen.getByText('과목 ·').parentElement).not.toHaveClass('rounded-full')
    expect(screen.getByText('난이도 ·').parentElement).not.toHaveClass('rounded-full')
    expect(screen.getByText('시간 ·').parentElement).not.toHaveClass('rounded-full')
  })
})

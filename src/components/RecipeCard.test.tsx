// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { pendulumRecipe } from '@/data/canary'
import { withBasePath } from '@/lib/basePath'
import { RecipeCard } from './RecipeCard'

describe('RecipeCard', () => {
  it('shows the recipe wiring image with useful alternative text', () => {
    render(
      <MemoryRouter>
        <RecipeCard recipe={pendulumRecipe} />
      </MemoryRouter>,
    )

    const image = screen.getByRole('img', { name: `${pendulumRecipe.title} 배선도` })
    expect(image).toHaveAttribute('src', withBasePath(pendulumRecipe.imageUrl))
    expect(image).toHaveAttribute('loading', 'lazy')
  })
})

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Link, MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { RouteMetadata } from './RouteMetadata'

describe('RouteMetadata', () => {
  afterEach(() => {
    document.head.querySelector('meta[name="robots"]')?.remove()
  })

  it('keeps account pages out of search during client navigation', async () => {
    const robots = document.createElement('meta')
    robots.name = 'robots'
    robots.content = 'noindex, follow'
    document.head.appendChild(robots)
    render(
      <MemoryRouter initialEntries={['/login']}>
        <RouteMetadata />
        <Link to="/recuperar-senha">Recuperar</Link>
      </MemoryRouter>,
    )
    expect(robots.content).toBe('noindex, follow')
    fireEvent.click(screen.getByText('Recuperar'))
    await waitFor(() => expect(document.title).toBe('Recuperar senha | Disciplina PRO'))
    expect(robots.content).toBe('noindex, follow')
    expect(document.head.querySelectorAll('meta[name="robots"]')).toHaveLength(1)
  })
})

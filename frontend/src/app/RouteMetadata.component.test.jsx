import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Link, MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { RouteMetadata } from './RouteMetadata'

describe('RouteMetadata', () => {
  afterEach(() => {
    document.head.querySelectorAll('link[rel="canonical"], meta[property="og:url"]').forEach((element) => element.remove())
  })

  it('updates indexing on client navigation and removes its tag on unmount', async () => {
    const canonical = document.createElement('link')
    canonical.rel = 'canonical'
    canonical.href = 'https://www.disciplinapro.com.br/login'
    const shareUrl = document.createElement('meta')
    shareUrl.setAttribute('property', 'og:url')
    shareUrl.content = canonical.href
    document.head.append(canonical, shareUrl)
    const { unmount } = render(
      <MemoryRouter initialEntries={['/login']}>
        <RouteMetadata />
        <Link to="/recuperar-senha">Recuperar</Link>
        <Link to="/login">Entrar</Link>
      </MemoryRouter>,
    )
    const robots = () => document.head.querySelectorAll('meta[name="robots"]')
    expect(robots()).toHaveLength(1)
    expect(robots()[0].content).toBe('index, follow')
    fireEvent.click(screen.getByText('Recuperar'))
    await waitFor(() => expect(document.title).toBe('Recuperar senha | Disciplina PRO'))
    expect(robots()).toHaveLength(1)
    expect(robots()[0].content).toBe('noindex, follow')
    expect(document.head.contains(canonical)).toBe(false)
    expect(document.head.contains(shareUrl)).toBe(false)
    fireEvent.click(screen.getByText('Entrar'))
    await waitFor(() => expect(robots()[0].content).toBe('index, follow'))
    expect(document.head.querySelectorAll('link[rel="canonical"]')).toHaveLength(1)
    expect(document.head.contains(canonical)).toBe(true)
    expect(document.head.contains(shareUrl)).toBe(true)
    unmount()
    expect(robots()).toHaveLength(0)
  })

  it.each(['/login/', '/login///', '/'])('keeps the public entry indexable at %s', (path) => {
    render(<MemoryRouter initialEntries={[path]}><RouteMetadata /></MemoryRouter>)
    expect(document.head.querySelector('meta[name="robots"]').content).toBe('index, follow')
  })

  it.each(['/app', '/app/perfil', '/plataforma', '/convites/aceitar', '/redefinir-senha', '/recuperar-senha///', '/inexistente'])(
    'excludes %s from indexing', (path) => {
      render(<MemoryRouter initialEntries={[path]}><RouteMetadata /></MemoryRouter>)
      expect(document.head.querySelector('meta[name="robots"]').content).toBe('noindex, follow')
    },
  )
})

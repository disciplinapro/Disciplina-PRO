import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

const titles = {
  '/login': 'Disciplina PRO | Programas de desenvolvimento',
  '/recuperar-senha': 'Recuperar senha | Disciplina PRO',
  '/redefinir-senha': 'Nova senha | Disciplina PRO',
  '/convites/aceitar': 'Aceitar convite | Disciplina PRO',
}

export function RouteMetadata() {
  const { pathname } = useLocation()

  useEffect(() => {
    let end = pathname.length
    while (end > 1 && pathname[end - 1] === '/') end -= 1
    const path = pathname.slice(0, end) || '/'
    const indexable = path === '/login' || path === '/'
    document.title = titles[path] ?? 'Disciplina PRO'
    // The static shell advertises the public login URL. Other routes are not
    // duplicates of that page, so do not retain its canonical/share URL there.
    const publicUrls = indexable ? [] : [...document.head.querySelectorAll('link[rel="canonical"], meta[property="og:url"]')]
    publicUrls.forEach((element) => element.remove())
    const robots = document.createElement('meta')
    robots.name = 'robots'
    robots.content = indexable ? 'index, follow' : 'noindex, follow'
    document.head.appendChild(robots)
    return () => {
      robots.remove()
      publicUrls.forEach((element) => document.head.appendChild(element))
    }
  }, [pathname])

  return null
}

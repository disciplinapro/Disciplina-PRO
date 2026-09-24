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
    document.title = titles[path] ?? 'Disciplina PRO'
    // The SPA only serves account and authenticated routes. Its static shell
    // carries noindex so direct requests are excluded before JavaScript runs.
    const robots = document.head.querySelector('meta[name="robots"]')
    if (robots) robots.content = 'noindex, follow'
  }, [pathname])

  return null
}

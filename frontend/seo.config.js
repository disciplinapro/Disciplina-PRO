// Use the confirmed public origin; never infer a canonical host from the request.
export function seoAssets(siteUrl) {
  const url = new URL(siteUrl?.trim() || 'https://www.disciplinapro.com.br')
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('VITE_SITE_URL deve ser uma origem HTTPS, sem caminho, credenciais, query ou fragmento.')
  }
  const origin = url.origin
  const assets = {
    '/robots.txt': {
      type: 'text/plain; charset=utf-8',
      source: `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${origin}/sitemap.xml\n`,
    },
    '/sitemap.xml': {
      type: 'application/xml; charset=utf-8',
      source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${origin}/login</loc></url>\n</urlset>\n`,
    },
  }

  return {
    name: 'public-seo-assets',
    transformIndexHtml() {
      return [
        { tag: 'link', attrs: { rel: 'canonical', href: `${origin}/login` }, injectTo: 'head' },
        { tag: 'meta', attrs: { property: 'og:url', content: `${origin}/login` }, injectTo: 'head' },
      ]
    },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const path = request.url?.split('?')[0]
        const asset = Object.hasOwn(assets, path) ? assets[path] : undefined
        if (!asset || !['GET', 'HEAD'].includes(request.method)) return next()
        response.setHeader('Content-Type', asset.type)
        response.end(request.method === 'HEAD' ? undefined : asset.source)
      })
    },
    generateBundle() {
      for (const [path, asset] of Object.entries(assets)) {
        this.emitFile({ type: 'asset', fileName: path.slice(1), source: asset.source })
      }
    },
  }
}

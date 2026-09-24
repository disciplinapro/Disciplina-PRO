# SEO e HTML semântico

## Página pública preparada — 24/09/2026

O projeto agora gera uma página pública estática em `/` (`index.html`) com apresentação do Disciplina PRO, conteúdo legível sem JavaScript, título, descrição, canonical e `og:url` próprios. O sitemap passou a listar somente `https://www.disciplinapro.com.br/`. O login e as rotas de conta são `noindex`; a área autenticada continua fora da indexação. A SPA passa a ser entregue por `app.html` nas rotas de conta e autenticadas.

Esta alteração foi validada localmente, mas ainda precisa ser publicada. Após a publicação, conferir a resposta HTTP e o HTML de `/`, `/login`, `/robots.txt` e `/sitemap.xml`. No Google Search Console, inspecionar a URL canônica `/`, executar o teste ao vivo, enviar o sitemap e solicitar indexação. O relatório de indexação e a URL inspecionada são a fonte para identificar eventuais motivos de exclusão; buscas públicas, inclusive `site:`, não comprovam sozinhas o estado do índice.

O acesso à propriedade do Search Console e a publicação não fizeram parte desta alteração. A indexação e a posição nas buscas dependem do rastreamento e das decisões dos mecanismos de busca.

Arquivos atuais: `frontend/index.html` é a página pública; `frontend/app.html` é o shell da SPA com `noindex`; `frontend/seo.config.js` gera sitemap e robots; `frontend/vercel.json` encaminha as rotas da SPA para `app.html`; `frontend/src/landing.css` apresenta a página pública.

## Histórico: aceite e verificação publicada — 14/09/2026

Implementação aceita por Eduardo conforme registro da beta de 14/09/2026. Conferência HTTPS no domínio oficial comprovou título, descrição, canonical e `og:url` no login, `robots.txt` válido, sitemap XML contendo apenas o login canônico e header `noindex, follow` na recuperação. Isso supera os defeitos de entrega pública observados em 13/09 e preservados abaixo. CI `34851806069` aprovado; Search Console/indexação e os demais headers não foram revalidados nesta rodada.

Naquela publicação, o frontend era apenas uma SPA React. A entrada pública era `/login`; `/` redirecionava pelo aplicativo até o login para visitantes. Não havia página pública de apresentação. Os programas e o progresso exigem autenticação e não devem entrar no sitemap.

## Arquivos da implementação de 14/09 (histórico)

- `frontend/index.html`: idioma pt-BR, título, descrição e metadados Open Graph/Twitter disponíveis no HTML inicial.
- `robots.txt` gerado por `frontend/seo.config.js`: permite rastrear HTML e assets; exclui chamadas de API. A mesma fonte atende desenvolvimento e build, sem cópia estática divergente.
- `frontend/seo.config.js`: gera `sitemap.xml`, a indicação do sitemap no `robots.txt`, canonical e `og:url` no build. O domínio oficial padrão é `https://www.disciplinapro.com.br`, confirmado pelo responsável; `VITE_SITE_URL` permite substituí-lo. A URL canônica atual é `https://www.disciplinapro.com.br/login`.
- `frontend/src/app/RouteMetadata.jsx`: atualiza título e indexação durante a navegação React; somente `/` e `/login` são indexáveis. Remove o canonical e `og:url` do login nas demais rotas e os restaura ao voltar à entrada pública.
- `frontend/vercel.json`: também envia `X-Robots-Tag: noindex, follow` no acesso direto às áreas autenticadas, convites e recuperação de senha. Em outro host, replique esses headers.
- `AGENTS.md`: preserva a preferência por HTML semântico em futuras alterações.

## Publicação

1. O build usa `https://www.disciplinapro.com.br` por padrão, inclusive quando `VITE_SITE_URL` está vazia ou contém apenas espaços. Se definir essa variável no ambiente, use a origem HTTPS oficial, sem caminho; consulte `frontend/.env.example`. Não use o endereço de staging. O servidor de desenvolvimento também entrega os dois arquivos corretamente.
2. Execute o build e publique. Confira `/robots.txt` e `/sitemap.xml`: devem retornar texto e XML, respectivamente, e não o fallback HTML da SPA. O sitemap contém apenas a URL canônica pública.
3. No domínio oficial, confira o HTML de `/login`, canonical e ausência de `X-Robots-Tag: noindex`. Confira o header `noindex` nas rotas internas. Preview e staging devem continuar fora da indexação por configuração da hospedagem.
4. Verifique a propriedade no Google Search Console, envie `/sitemap.xml` e inspecione `/login`. Isso depende de acesso à propriedade do domínio.

## Semântica e limitações

A tela de login já usa `main`, um `h1`, `form`, labels associados aos inputs e botão de envio. O layout autenticado usa `header`, `nav` identificado e `main`. Preserve essas estruturas, a hierarquia dos títulos e links reais ao alterar páginas.

O conteúdo inicial ainda depende de JavaScript para renderizar. Não foram adicionados textos promocionais, dados estruturados ou imagens sem conteúdo correspondente. URLs inexistentes ainda seguem o redirecionamento genérico da SPA; a necessidade de uma resposta 404 apropriada deve ser avaliada a partir dos problemas observados na beta.

O aceite de 14/09 comprova a entrega pública de metadados, robots e sitemap no recorte descrito acima. Search Console, indexação e posição no Google não foram comprovados.

Na consulta pública de 13/09/2026, `https://www.disciplinapro.com.br/login` respondeu HTTP 200 com o título antigo e sem descrição/canonical. `/robots.txt` e `/sitemap.xml` retornaram o HTML da SPA. Essa falha histórica foi superada pela verificação pública de 14/09 registrada no aceite da beta.

Referências: [SEO para desenvolvedores](https://developers.google.com/search/docs/fundamentals/get-started-developers), [SEO em JavaScript](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics), [sitemaps](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap) e [headers da Vercel](https://vercel.com/docs/project-configuration/vercel-json).

## Verificação em navegador — 13/09/2026

Playwright e Chrome DevTools foram usados contra o domínio oficial e contra o build servido por `vite preview` em `http://localhost:4173`.

| Lighthouse no login | SEO | Acessibilidade | Boas práticas |
| --- | --- | --- | --- |
| Publicado, mobile | 82 | 100 | 100 |
| Build local, mobile | 100 | 100 | 100 |
| Build local após ajustes, desktop | 100 | 100 | 100 |

Em 13/09, as falhas publicadas eram ausência de meta description e `robots.txt` retornando HTML; ambas foram corrigidas na publicação conferida em 14/09. A auditoria não mediu performance/Core Web Vitals.

Verificações locais concluídas:

- Playwright + axe em `/login`, `/recuperar-senha`, `/redefinir-senha` e `/convites/aceitar`: zero violações automáticas de acessibilidade; um `main` e um `h1` por página. Redefinição e convite foram verificados sem token, no estado de link inválido.
- Viewports 320×568, 375×812, 768×1024 e 1440×900: sem overflow horizontal ou alvos de toque menores que 44 px. O link de retorno da tela de convite foi corrigido reutilizando o estilo acessível existente.
- Navegação login → recuperação → voltar: `noindex` e remoção de canonical/`og:url` nas rotas excluídas; restauração correta no login, sem duplicação. Sete testes de componente passaram, incluindo regressão dos metadados.
- Ordem de Tab: e-mail, senha, Entrar, recuperação; foco visível. Emulação de movimento reduzido e inspeção visual da captura mobile concluídas.
- `robots.txt` e `sitemap.xml`: HTTP 200 com texto e XML válidos e domínio oficial; favicons com HTTP 200 e tipos de imagem. Console DevTools sem erros/avisos e requests observados com HTTP 200. Playwright sem exceções JavaScript.
- Build, lint e `git diff --check` aprovados.

Relatórios Lighthouse temporários: `/tmp/disciplina-seo-live/report.html`, `/tmp/disciplina-seo-local/report.html` e `/tmp/disciplina-seo-final-desktop/report.html`. Captura mobile: `/tmp/disciplina-seo-final-mobile.png`.

Nenhum deploy, envio de formulário, aceite de convite ou acesso autenticado foi realizado. O preview local não aplica os headers da Vercel: `X-Robots-Tag` e a entrega dos arquivos no domínio oficial precisam ser conferidos após o deploy. Os resultados não comprovam indexação ou posição no Google.

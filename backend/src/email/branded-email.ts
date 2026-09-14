export function escapeEmailHtml(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

// All application email templates share this signature and public image source.
// Callers provide trusted HTML with dynamic values escaped before interpolation.
export function brandedEmail(input: { frontendUrl: string; text: string; html: string; welcome?: boolean }) {
  const image = input.welcome ? 'bem-vindo.jpeg' : 'main.jpeg'
  const imageUrl = escapeEmailHtml(new URL(`/email/${image}`, input.frontendUrl).href)
  const siteUrl = new URL('/login', input.frontendUrl).href
  const alt = input.welcome ? 'Bem-vindo(a) ao Disciplina PRO — Sistema de Treinamento' : 'Disciplina PRO — Spark Inteligência'
  const signature = ['Equipe Disciplina PRO', 'Spark Inteligência Corporativa',
    `Acesse: ${siteUrl}`, 'Suporte: suporte@disciplinapro.com.br', 'Privacidade: privacidade@disciplinapro.com.br']
  return {
    text: `${input.text}\n\n—\n${signature.join('\n')}`,
    html: `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;color:#202024;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;background:#ffffff">
<tr><td><img src="${imageUrl}" alt="${alt}" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0" /></td></tr>
<tr><td style="padding:24px;font-size:16px;line-height:1.6;overflow-wrap:anywhere">${input.html}</td></tr>
<tr><td style="padding:24px;border-top:1px solid #e4e4e7;font-size:13px;line-height:1.7;color:#52525b">
<strong style="color:#202024">Equipe Disciplina PRO</strong><br>Spark Inteligência Corporativa<br>
<a href="${escapeEmailHtml(siteUrl)}" style="color:#a51e27">Acessar Disciplina PRO</a><br>
Suporte: <a href="mailto:suporte@disciplinapro.com.br" style="color:#a51e27">suporte@disciplinapro.com.br</a><br>
Privacidade: <a href="mailto:privacidade@disciplinapro.com.br" style="color:#a51e27">privacidade@disciplinapro.com.br</a>
</td></tr></table></td></tr></table></body></html>`,
  }
}

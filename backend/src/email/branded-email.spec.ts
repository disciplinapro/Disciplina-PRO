import { brandedEmail, escapeEmailHtml } from './branded-email.js'

describe('Shared email identity', () => {
  it('keeps images and the signature free of private token fragments', () => {
    const result = brandedEmail({ frontendUrl: 'https://example.test/redefinir-senha?source=email#token=private', text: 'Mensagem', html: '<p>Mensagem</p>' })
    expect(result.html).toContain('src="https://example.test/email/main.jpeg"')
    expect(result.html).toContain('href="https://example.test/login"')
    expect(result.html).not.toContain('token=')
    expect(result.html).not.toContain('source=')
    expect(result.text).toContain('Mensagem\n\n—\nEquipe Disciplina PRO')
    expect(result.text).toContain('Spark Inteligência Corporativa')
    expect(result.html).toContain('mailto:suporte@disciplinapro.com.br')
    expect(result.html).toContain('mailto:privacidade@disciplinapro.com.br')
  })

  it('escapes dynamic HTML attributes and text', () => {
    expect(escapeEmailHtml('<a href="one&two">')).toBe('&lt;a href=&quot;one&amp;two&quot;&gt;')
  })
})

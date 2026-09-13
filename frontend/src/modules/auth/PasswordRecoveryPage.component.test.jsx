import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PasswordRecoveryPage } from './PasswordRecoveryPage'

const mocks = vi.hoisted(() => ({ request: vi.fn(), reset: vi.fn() }))
vi.mock('./password-recovery.client', async (original) => ({ ...await original(), requestPasswordRecovery: mocks.request, resetPassword: mocks.reset }))

function page(reset = false, hash = `#token=${'a'.repeat(43)}`) {
  render(<MemoryRouter initialEntries={[`/redefinir-senha${hash}`]}><PasswordRecoveryPage reset={reset} /></MemoryRouter>)
  return userEvent.setup()
}

describe('Password recovery', () => {
  beforeEach(() => { mocks.request.mockReset().mockResolvedValue(undefined); mocks.reset.mockReset().mockResolvedValue(undefined) })

  it('requests a link and displays a generic confirmation', async () => {
    const user = page()
    await user.type(screen.getByLabelText('E-mail'), 'person@example.test')
    await user.click(screen.getByRole('button', { name: 'Enviar link de recuperação' }))
    expect(mocks.request).toHaveBeenCalledWith('person@example.test')
    expect(screen.getByRole('status').textContent).toContain('Se houver uma conta ativa')
  })

  it('rejects missing tokens without presenting a password form', () => {
    page(true, '')
    expect(screen.getByRole('alert').textContent).toContain('Link inválido')
    expect(screen.queryByLabelText('Nova senha', { selector: 'input' })).toBeNull()
    expect(screen.getByRole('link', { name: 'Solicitar novo link' }).getAttribute('href')).toBe('/recuperar-senha')
  })

  it('checks confirmation, resets the password and returns to login', async () => {
    const user = page(true)
    await user.type(screen.getByLabelText('Nova senha', { selector: 'input' }), 'Uma senha nova bem segura')
    await user.type(screen.getByLabelText('Confirme a nova senha'), 'Outra senha bem diferente')
    await user.click(screen.getByRole('button', { name: 'Salvar nova senha' }))
    expect(mocks.reset).not.toHaveBeenCalled()
    expect(screen.getByRole('alert').textContent).toContain('iguais')
    await user.clear(screen.getByLabelText('Confirme a nova senha'))
    await user.type(screen.getByLabelText('Confirme a nova senha'), 'Uma senha nova bem segura')
    await user.click(screen.getByRole('button', { name: 'Salvar nova senha' }))
    expect(mocks.reset).toHaveBeenCalledWith('a'.repeat(43), 'Uma senha nova bem segura')
    expect(screen.getByRole('status').textContent).toContain('Senha redefinida')
  })

  it('offers a new link after an expired or consumed token', async () => {
    mocks.reset.mockRejectedValue({ code: 'INVALID_RESET_TOKEN', status: 400 })
    const user = page(true)
    for (const label of ['Nova senha', 'Confirme a nova senha']) await user.type(screen.getByLabelText(label, { selector: 'input' }), 'Uma senha nova bem segura')
    await user.click(screen.getByRole('button', { name: 'Salvar nova senha' }))
    expect(screen.getByRole('link', { name: 'Solicitar novo link' })).toBeTruthy()
  })

  it('allows retry after request failure', async () => {
    mocks.request.mockRejectedValueOnce({ status: 429 })
    const user = page()
    await user.type(screen.getByLabelText('E-mail'), 'person@example.test')
    await user.click(screen.getByRole('button', { name: 'Enviar link de recuperação' }))
    expect(screen.getByRole('alert').textContent).toContain('Aguarde um minuto')
    await user.click(screen.getByRole('button', { name: 'Enviar link de recuperação' }))
    expect(screen.getByRole('status')).toBeTruthy()
  })
})

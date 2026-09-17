import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { ProfilePage } from './ProfilePage'

const mocks = vi.hoisted(() => ({
  authorizedFetch: vi.fn(),
  context: {
    user: { email: 'participante@example.test' },
    tenant: { id: 'tenant', name: 'Empresa' },
    membership: { role: 'USER' },
    sessionClient: null,
  },
}))
mocks.context.sessionClient = { authorizedFetch: mocks.authorizedFetch }
vi.mock('../../app/providers/app-context', () => ({ useAppContext: () => mocks.context }))

beforeEach(() => {
  mocks.authorizedFetch.mockReset().mockResolvedValue({ ok: true })
  vi.spyOn(window, 'confirm').mockReturnValue(true)
})

it('lets the participant request deletion of private categories', async () => {
  const user = userEvent.setup()
  render(<ProfilePage />)
  expect(screen.getByText(/expurgados após 12 meses/i)).not.toBeNull()
  await user.click(screen.getByRole('button', { name: 'Excluir meus dados privados' }))
  await waitFor(() => expect(mocks.authorizedFetch).toHaveBeenCalledWith('/api/privacy/me/private-data', {
    method: 'DELETE',
    headers: { 'X-Tenant-Id': 'tenant' },
  }))
  expect(screen.getByRole('status').textContent).toContain('foram excluídos')
})

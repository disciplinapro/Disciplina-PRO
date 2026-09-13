import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { InvitationDeliveryAlerts } from './InvitationDeliveryAlerts'

const invitation = { id: 'invite', email: 'invite@example.test', deliveryReview: { reason: 'PERMANENT', noticeStatus: 'FAILED' } }
beforeEach(() => localStorage.clear())
describe('Dismissible delivery alerts', () => {
  it('remembers a dismissal after remount but shows a changed review and isolates administrators', async () => {
    const { unmount } = render(<InvitationDeliveryAlerts invitations={[invitation]} actorMembershipId="admin" />)
    await userEvent.click(screen.getByRole('button', { name: /Dispensar aviso/ }))
    expect(screen.queryByText(/Entrega precisa de revisão/)).toBeNull()
    unmount()
    const { rerender } = render(<InvitationDeliveryAlerts invitations={[invitation]} actorMembershipId="admin" />)
    expect(screen.queryByText(/Entrega precisa de revisão/)).toBeNull()
    rerender(<InvitationDeliveryAlerts invitations={[invitation]} actorMembershipId="another-admin" />)
    expect(screen.getByText(/Entrega precisa de revisão/)).not.toBeNull()
    rerender(<InvitationDeliveryAlerts invitations={[{ ...invitation, deliveryReview: { reason: 'EXHAUSTED', noticeStatus: 'FAILED' } }]} actorMembershipId="admin" />)
    expect(screen.getByText(/Entrega precisa de revisão/)).not.toBeNull()
  })
})

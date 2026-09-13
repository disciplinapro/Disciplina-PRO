export function deliveryAlertKey(actorMembershipId, invitation) {
  return `disciplina:delivery-alert:${actorMembershipId ?? 'current'}:${invitation.id}:${invitation.deliveryReview.reason}:${invitation.deliveryReview.noticeStatus}`
}

export function isAlertDismissed(key) {
  try { return localStorage.getItem(key) === 'dismissed' } catch { return false }
}

export function dismissAlert(key) {
  try { localStorage.setItem(key, 'dismissed') } catch { /* The current view can still dismiss the alert. */ }
}

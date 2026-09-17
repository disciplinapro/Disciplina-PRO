export function createPrivacyHttpRepository({ baseUrl = '/api', getTenantId, authorizedFetch }) {
  return {
    async deleteMyPrivateData() {
      const tenantId = getTenantId()
      if (!tenantId) throw new Error('Organização não selecionada')
      const response = await authorizedFetch(`${baseUrl}/privacy/me/private-data`, {
        method: 'DELETE',
        headers: { 'X-Tenant-Id': tenantId },
      })
      if (!response.ok) {
        const problem = await response.json().catch(() => ({}))
        throw new Error(problem.message ?? 'Não foi possível excluir os dados privados')
      }
    },
  }
}

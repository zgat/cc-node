// OAuth removed in the Node.js port — stub for build compatibility
export async function getOrganizationUUID(): Promise<string | null> { return null }
export async function refreshOAuthToken(): Promise<null> { return null }
export { refreshOAuthToken as _refreshOAuthToken }
export function isOAuthTokenExpired(): boolean { return true }
export function shouldUseClaudeAIAuth(): boolean { return false }
export async function populateOAuthAccountInfoIfNeeded(): Promise<void> {}

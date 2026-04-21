// OAuth removed in the Node.js port — this is a stub for build compatibility
export class OAuthService {
  async startOAuthFlow() { throw new Error('OAuth not available in this build') }
  cleanup() {}
  handleManualAuthCodeInput() { throw new Error('OAuth not available in this build') }
}

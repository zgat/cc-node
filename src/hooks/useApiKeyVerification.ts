import { useCallback, useState } from 'react'
import { getIsNonInteractiveSession } from '../bootstrap/state.ts'
import { verifyApiKey } from '../services/api/claude.ts'
import {
  getAnthropicApiKeyWithSource,
  getApiKeyFromApiKeyHelper,
  isClaudeAISubscriber,
} from '../utils/auth.ts'
import { isFirstPartyAnthropicBaseUrl } from '../utils/model/providers.ts'

export type VerificationStatus =
  | 'loading'
  | 'valid'
  | 'invalid'
  | 'missing'
  | 'error'

export type ApiKeyVerificationResult = {
  status: VerificationStatus
  reverify: () => Promise<void>
  error: Error | null
}

export function useApiKeyVerification(): ApiKeyVerificationResult {
  // Skip verification for non-Anthropic API endpoints (e.g. Kimi/OpenAI-compat
  // proxies). verifyApiKey uses Anthropic model names (claude-haiku-4-5) that
  // do not exist on third-party endpoints and would always fail.
  const skipVerification = !isFirstPartyAnthropicBaseUrl()

  const [status, setStatus] = useState<VerificationStatus>(() => {
    if (skipVerification || isClaudeAISubscriber()) {
      return 'valid'
    }
    const { key, source } = getAnthropicApiKeyWithSource({
      skipRetrievingKeyFromApiKeyHelper: true,
    })
    if (key) {
      return 'loading'
    }
    return 'missing'
  })
  const [error, setError] = useState<Error | null>(null)

  const verify = useCallback(async (): Promise<void> => {
    if (skipVerification || isClaudeAISubscriber()) {
      setStatus('valid')
      return
    }
    await getApiKeyFromApiKeyHelper(getIsNonInteractiveSession())
    const { key: apiKey, source } = getAnthropicApiKeyWithSource()
    if (!apiKey) {
      if (source === 'apiKeyHelper') {
        setStatus('error')
        setError(new Error('API key helper did not return a valid key'))
        return
      }
      const newStatus = 'missing'
      setStatus(newStatus)
      return
    }

    try {
      const isValid = await verifyApiKey(apiKey, false)
      const newStatus = isValid ? 'valid' : 'invalid'
      setStatus(newStatus)
      return
    } catch (error) {
      setError(error as Error)
      const newStatus = 'error'
      setStatus(newStatus)
      return
    }
  }, [skipVerification])

  return {
    status,
    reverify: verify,
    error,
  }
}

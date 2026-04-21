/**
 * Simplified auth module — API key only.
 *
 * This build uses ANTHROPIC_API_KEY exclusively. All OAuth, Bedrock/Vertex,
 * apiKeyHelper, and keychain code paths have been removed.
 */

import {
  type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
  logEvent,
} from 'src/services/analytics/index.js'
import { getAPIProvider } from 'src/utils/model/providers.js'
import {
  type AccountInfo,
  getGlobalConfig,
} from './config.ts'
import { logForDebugging } from './debug.ts'
import { isEnvTruthy } from './envUtils.ts'
import { errorMessage } from './errors.ts'
import { logError } from './log.ts'

// ── Types ────────────────────────────────────────────────────────────────

type SubscriptionType = 'pro' | 'max' | 'team' | 'enterprise' | null

export type ApiKeySource = 'ANTHROPIC_API_KEY' | 'none'

export type UserAccountInfo = {
  subscription?: string
  tokenSource?: string
  apiKeySource?: ApiKeySource
  organization?: string
  email?: string
}

export type OrgValidationResult =
  | { valid: true }
  | { valid: false; message: string }

// ── Core API key ─────────────────────────────────────────────────────────

/** Whether we are supporting direct 1P auth. Always false in this build. */
export function isAnthropicAuthEnabled(): boolean {
  return false
}

/** Where the auth token is being sourced from, if any. */
export function getAuthTokenSource() {
  if (process.env.ANTHROPIC_AUTH_TOKEN) {
    return { source: 'ANTHROPIC_AUTH_TOKEN' as const, hasToken: true }
  }
  return { source: 'none' as const, hasToken: false }
}

export function getAnthropicApiKey(): null | string {
  const { key } = getAnthropicApiKeyWithSource()
  return key
}

export function hasAnthropicApiKeyAuth(): boolean {
  const { key, source } = getAnthropicApiKeyWithSource()
  return key !== null && source !== 'none'
}

export function getAnthropicApiKeyWithSource(
  _opts: { skipRetrievingKeyFromApiKeyHelper?: boolean } = {},
): {
  key: null | string
  source: ApiKeySource
} {
  if (process.env.ANTHROPIC_API_KEY) {
    return { key: process.env.ANTHROPIC_API_KEY, source: 'ANTHROPIC_API_KEY' }
  }
  // Support ANTHROPIC_AUTH_TOKEN as alias
  if (process.env.ANTHROPIC_AUTH_TOKEN) {
    return { key: process.env.ANTHROPIC_AUTH_TOKEN, source: 'ANTHROPIC_API_KEY' }
  }
  return { key: null, source: 'none' }
}

// ── apiKeyHelper — removed, stubs for callers ────────────────────────────

export function getConfiguredApiKeyHelper(): undefined {
  return undefined
}

export function getApiKeyHelperElapsedMs(): number {
  return 0
}

export async function getApiKeyFromApiKeyHelper(): Promise<null> {
  return null
}

export function getApiKeyFromApiKeyHelperCached(): null {
  return null
}

export function clearApiKeyHelperCache(): void {}

export function prefetchApiKeyFromApiKeyHelperIfSafe(): void {}

// ── AWS / GCP / Bedrock / Vertex — removed ───────────────────────────────

export function isAwsAuthRefreshFromProjectSettings(): boolean {
  return false
}

export function isAwsCredentialExportFromProjectSettings(): boolean {
  return false
}

export function refreshAwsAuth(): Promise<boolean> {
  return Promise.resolve(false)
}

export const refreshAndGetAwsCredentials = async (): Promise<null> => null

export function clearAwsCredentialsCache(): void {}

export function prefetchAwsCredentialsAndBedRockInfoIfSafe(): void {}

export function isGcpAuthRefreshFromProjectSettings(): boolean {
  return false
}

export function checkGcpCredentialsValid(): Promise<boolean> {
  return Promise.resolve(false)
}

export function refreshGcpAuth(): Promise<boolean> {
  return Promise.resolve(false)
}

export const refreshGcpCredentialsIfNeeded = async (): Promise<boolean> => false

export function clearGcpCredentialsCache(): void {}

export function prefetchGcpCredentialsIfSafe(): void {}

// ── 3P services — removed ────────────────────────────────────────────────

export function isUsing3PServices(): boolean {
  return false
}

// ── OAuth / subscription — all removed, trivial returns ──────────────────

export function saveOAuthTokensIfNeeded(_tokens: unknown): {
  success: boolean
  warning?: string
} {
  return { success: true }
}

export function getClaudeAIOAuthTokens(): null {
  return null
}

export function clearOAuthTokenCache(): void {}

export function handleOAuth401Error(): Promise<boolean> {
  return Promise.resolve(false)
}

export function checkAndRefreshOAuthTokenIfNeeded(): Promise<boolean> {
  return Promise.resolve(false)
}

export function isClaudeAISubscriber(): boolean {
  return false
}

export function hasProfileScope(): boolean {
  return false
}

export function is1PApiCustomer(): boolean {
  return true
}

export function isOverageProvisioningAllowed(): boolean {
  return false
}

export function getOauthAccountInfo(): undefined {
  return undefined
}

export function isClaudeAISubscriberAsync(): Promise<boolean> {
  return Promise.resolve(false)
}

export function getSubscriptionType(): SubscriptionType {
  return null
}

export function isMaxSubscriber(): boolean {
  return false
}

export function isTeamSubscriber(): boolean {
  return false
}

export function isTeamPremiumSubscriber(): boolean {
  return false
}

export function isEnterpriseSubscriber(): boolean {
  return false
}

export function isProSubscriber(): boolean {
  return false
}

export function getRateLimitTier(): null {
  return null
}

export function getSubscriptionName(): string {
  return 'Claude API'
}

function isConsumerPlan(_plan: SubscriptionType): _plan is 'max' | 'pro' {
  return false
}

export function isConsumerSubscriber(): boolean {
  return false
}

export function validateForceLoginOrg(): Promise<OrgValidationResult> {
  return Promise.resolve({ valid: true })
}

// ── Account info ─────────────────────────────────────────────────────────

export function getAccountInformation(): UserAccountInfo {
  const accountInfo: UserAccountInfo = {}
  const { source: authTokenSource } = getAuthTokenSource()
  accountInfo.tokenSource = authTokenSource
  const { key: apiKey, source: apiKeySource } = getAnthropicApiKeyWithSource()
  if (apiKey) {
    accountInfo.apiKeySource = apiKeySource
  }
  return accountInfo
}

// ── API key storage — removed (keychain / config-based) ──────────────────

export function isCustomApiKeyApproved(_apiKey: string): boolean {
  return false
}

export async function saveApiKey(_apiKey: string): Promise<void> {
  throw new Error(
    'API key storage is not available in this build. Set ANTHROPIC_API_KEY environment variable instead.',
  )
}

export async function removeApiKey(): Promise<void> {}

export function getApiKeyFromConfigOrMacOSKeychain(): null {
  return null
}

// ── Otel headers helper ──────────────────────────────────────────────────

function getConfiguredOtelHeadersHelper(): string | undefined {
  const mergedSettings = getGlobalConfig()
  return (mergedSettings as Record<string, unknown>)?.otelHeadersHelper as string | undefined
}

export function isOtelHeadersHelperFromProjectOrLocalSettings(): boolean {
  return false
}

let cachedOtelHeaders: Record<string, string> | null = null
let cachedOtelHeadersTimestamp = 0
const DEFAULT_OTEL_HEADERS_DEBOUNCE_MS = 29 * 60 * 1000

export function getOtelHeadersFromHelper(): Record<string, string> {
  const otelHeadersHelper = getConfiguredOtelHeadersHelper()

  if (!otelHeadersHelper) {
    return {}
  }

  const debounceMs = parseInt(
    process.env.CLAUDE_CODE_OTEL_HEADERS_HELPER_DEBOUNCE_MS ||
      DEFAULT_OTEL_HEADERS_DEBOUNCE_MS.toString(),
  )
  if (
    cachedOtelHeaders &&
    Date.now() - cachedOtelHeadersTimestamp < debounceMs
  ) {
    return cachedOtelHeaders
  }

  // otelHeadersHelper requires trust check — skipped in this build
  return {}
}

export function calculateApiKeyHelperTTL(): number {
  return 5 * 60 * 1000
}

// ── OAuth async reader stub ──────────────────────────────────────────────

export async function getClaudeAIOAuthTokensAsync(): Promise<null> {
  return null
}

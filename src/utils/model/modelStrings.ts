import {
  getModelStrings as getModelStringsState,
  setModelStrings as setModelStringsState,
} from 'src/bootstrap/state.js'
import { getInitialSettings } from '../settings/settings.ts'
import {
  ALL_MODEL_CONFIGS,
  CANONICAL_ID_TO_KEY,
  type CanonicalModelId,
  type ModelKey,
} from './configs.ts'

/**
 * Maps each model version to its provider-specific model ID string.
 * Derived from ALL_MODEL_CONFIGS — adding a model there extends this type.
 */
export type ModelStrings = Record<ModelKey, string>

const MODEL_KEYS = Object.keys(ALL_MODEL_CONFIGS) as ModelKey[]

function getBuiltinModelStrings(): ModelStrings {
  const out = {} as ModelStrings
  for (const key of MODEL_KEYS) {
    out[key] = ALL_MODEL_CONFIGS[key]['firstParty']
  }
  return out
}

/**
 * Layer user-configured modelOverrides (from settings.json) on top of the
 * default model strings. Overrides are keyed by canonical first-party
 * model ID (e.g. "claude-opus-4-6").
 */
function applyModelOverrides(ms: ModelStrings): ModelStrings {
  const overrides = getInitialSettings().modelOverrides
  if (!overrides) {
    return ms
  }
  const out = { ...ms }
  for (const [canonicalId, override] of Object.entries(overrides)) {
    const key = CANONICAL_ID_TO_KEY[canonicalId as CanonicalModelId]
    if (key && override) {
      out[key] = override
    }
  }
  return out
}

/**
 * Resolve an overridden model ID back to its canonical first-party model ID.
 * If the input doesn't match any current override value, it is returned unchanged.
 * Safe to call during module init (no-ops if settings aren't loaded yet).
 */
export function resolveOverriddenModel(modelId: string): string {
  let overrides: Record<string, string> | undefined
  try {
    overrides = getInitialSettings().modelOverrides
  } catch {
    return modelId
  }
  if (!overrides) {
    return modelId
  }
  for (const [canonicalId, override] of Object.entries(overrides)) {
    if (override === modelId) {
      return canonicalId
    }
  }
  return modelId
}

function initModelStrings(): void {
  const ms = getModelStringsState()
  if (ms !== null) {
    return
  }
  setModelStringsState(getBuiltinModelStrings())
}

export function getModelStrings(): ModelStrings {
  const ms = getModelStringsState()
  if (ms === null) {
    initModelStrings()
    return applyModelOverrides(getBuiltinModelStrings())
  }
  return applyModelOverrides(ms)
}

/**
 * Ensure model strings are fully initialized.
 */
export async function ensureModelStringsInitialized(): Promise<void> {
  const ms = getModelStringsState()
  if (ms !== null) {
    return
  }
  setModelStringsState(getBuiltinModelStrings())
}

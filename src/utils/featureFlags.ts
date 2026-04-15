/**
 * Feature flags system - Node.js replacement for bun:bundle
 *
 * This module replaces the Bun bundler's compile-time feature flag system.
 * In production builds, these are replaced by esbuild's define option.
 * In development, they read from process.env.
 */

// Feature flag definitions
// In production builds, esbuild will replace these with literal boolean values
export const FEATURE_FLAGS: Record<string, boolean> = {
  PROACTIVE: (globalThis as any).FEATURE_PROACTIVE ?? process.env.FEATURE_PROACTIVE === 'true' ?? false,
  KAIROS: (globalThis as any).FEATURE_KAIROS ?? process.env.FEATURE_KAIROS === 'true' ?? false,
  BRIDGE_MODE: (globalThis as any).FEATURE_BRIDGE_MODE ?? process.env.FEATURE_BRIDGE_MODE === 'true' ?? false,
  DAEMON: (globalThis as any).FEATURE_DAEMON ?? process.env.FEATURE_DAEMON === 'true' ?? false,
  VOICE_MODE: (globalThis as any).FEATURE_VOICE_MODE ?? process.env.FEATURE_VOICE_MODE === 'true' ?? false,
  AGENT_TRIGGERS: (globalThis as any).FEATURE_AGENT_TRIGGERS ?? process.env.FEATURE_AGENT_TRIGGERS === 'true' ?? false,
  MONITOR_TOOL: (globalThis as any).FEATURE_MONITOR_TOOL ?? process.env.FEATURE_MONITOR_TOOL === 'true' ?? false,
  COORDINATOR_MODE: (globalThis as any).FEATURE_COORDINATOR_MODE ?? process.env.FEATURE_COORDINATOR_MODE === 'true' ?? false,
};

/**
 * Check if a feature is enabled.
 * This function is designed to be compatible with bun:bundle's feature() function.
 *
 * @param flag - The feature flag name
 * @returns true if the feature is enabled
 *
 * @example
 * if (feature('PROACTIVE')) {
 *   // This code will be dead-code eliminated if PROACTIVE is false
 * }
 */
export function feature(flag: string): boolean {
  return FEATURE_FLAGS[flag] ?? false;
}

// Re-export as default for compatibility
export default feature;

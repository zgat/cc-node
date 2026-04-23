/**
 * Stubbed Bedrock helpers.
 *
 * Third-party provider support (Bedrock/Vertex/Foundry) has been removed.
 * These functions are kept as no-ops for backward compatibility with
 * existing callers that import them.
 */

export function getBedrockInferenceProfiles(): Promise<string[]> {
  return Promise.resolve([])
}

export function findFirstMatch(
  profiles: string[],
  substring: string,
): string | null {
  return profiles.find(p => p.includes(substring)) ?? null
}

export async function createBedrockRuntimeClient(): Promise<never> {
  throw new Error('Bedrock support has been removed')
}

export function getInferenceProfileBackingModel(
  _profileId: string,
): Promise<string | null> {
  return Promise.resolve(null)
}

export function isFoundationModel(_modelId: string): boolean {
  return false
}

export function extractModelIdFromArn(modelId: string): string {
  if (!modelId.startsWith('arn:')) {
    return modelId
  }
  const lastSlashIndex = modelId.lastIndexOf('/')
  if (lastSlashIndex === -1) {
    return modelId
  }
  return modelId.substring(lastSlashIndex + 1)
}

export type BedrockRegionPrefix = 'us' | 'eu' | 'apac' | 'global'

export function getBedrockRegionPrefix(
  _modelId: string,
): BedrockRegionPrefix | undefined {
  return undefined
}

export function applyBedrockRegionPrefix(
  modelId: string,
  _prefix: BedrockRegionPrefix,
): string {
  return modelId
}

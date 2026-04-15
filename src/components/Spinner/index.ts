export { FlashingChar } from './FlashingChar.tsx'
export { GlimmerMessage } from './GlimmerMessage.tsx'
export { ShimmerChar } from './ShimmerChar.tsx'
export { SpinnerGlyph } from './SpinnerGlyph.tsx'
export type { SpinnerMode } from './types.js'
export { useShimmerAnimation } from './useShimmerAnimation.ts'
export { useStalledAnimation } from './useStalledAnimation.ts'
export { getDefaultCharacters, interpolateColor } from './utils.ts'
// Teammate components are NOT exported here - use dynamic require() to enable dead code elimination
// See REPL.tsx and Spinner.tsx for the correct import pattern

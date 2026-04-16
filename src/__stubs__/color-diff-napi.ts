// Stub for color-diff-napi
// The npm package is a placeholder with no real native module.
export interface SyntaxTheme {
  name: string;
  colors: Record<string, string>;
}
export const colorDiff = () => ({ added: [], removed: [] });
export const ColorDiff = class {};
export const ColorFile = class {};
export const getSyntaxTheme = (_themeName: string): SyntaxTheme => ({ name: 'stub', colors: {} });
export default colorDiff;

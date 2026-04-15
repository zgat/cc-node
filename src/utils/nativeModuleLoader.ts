/**
 * Native module loader with automatic fallback to stubs
 * Handles platform differences (x64, ARM, RISC-V)
 */

import { arch, platform } from 'os';

const SUPPORTED_ARCHS = ['x64', 'arm64', 'arm'];

function isNativeModuleSupported(): boolean {
  const currentArch = arch();
  return SUPPORTED_ARCHS.includes(currentArch);
}

/**
 * Load a native module with fallback
 */
export async function loadNativeModule<T>(
  moduleName: string,
  stubModule: () => Promise<T>
): Promise<T> {
  if (!isNativeModuleSupported()) {
    console.warn(
      `[native-loader] ${moduleName} not available on ${arch()}/${platform()}, using stub`
    );
    return stubModule();
  }

  try {
    // Try to load the native module
    const module = await import(moduleName);
    return module.default || module;
  } catch (error) {
    console.warn(
      `[native-loader] Failed to load ${moduleName}: ${(error as Error).message}, using stub`
    );
    return stubModule();
  }
}

/**
 * Platform information
 */
export function getPlatformInfo() {
  return {
    arch: arch(),
    platform: platform(),
    nativeSupported: isNativeModuleSupported(),
  };
}

/**
 * Smart image processor loader with automatic fallback
 * Tries native sharp first, falls back to jimp for unsupported platforms (RISC-V)
 */

import type { Buffer } from 'buffer';

// Re-export the same types from imageProcessor.ts for compatibility
export type SharpInstance = {
  metadata(): Promise<{ width: number; height: number; format: string }>;
  resize(
    width: number,
    height: number,
    options?: { fit?: string; withoutEnlargement?: boolean },
  ): SharpInstance;
  jpeg(options?: { quality?: number }): SharpInstance;
  png(options?: {
    compressionLevel?: number;
    palette?: boolean;
    colors?: number;
  }): SharpInstance;
  webp(options?: { quality?: number }): SharpInstance;
  toBuffer(): Promise<Buffer>;
};

export type SharpFunction = (input: Buffer) => SharpInstance;

// jimp v1.x type
type JimpClass = typeof import('jimp').Jimp;
type JimpImage = InstanceType<JimpClass>;

let sharpModule: SharpFunction | null = null;
let useJimp = false;

/**
 * Check if we're on a platform that likely doesn't support sharp
 * RISC-V, some ARM variants, etc.
 */
function isUnsupportedPlatform(): boolean {
  const arch = process.arch;
  // RISC-V is not supported by sharp prebuilds
  if (arch === 'riscv64' || arch === 'riscv') {
    return true;
  }
  // Could add other platforms here
  return false;
}

/**
 * Create a Sharp-compatible wrapper around Jimp v1.x
 */
function createJimpWrapper(Jimp: JimpClass): SharpFunction {
  const defaultQuality = 80;

  return function sharp(input: Buffer): SharpInstance {
    // Internal state
    let imagePromise: Promise<JimpImage> = Jimp.read(input);
    let targetWidth: number | null = null;
    let targetHeight: number | null = null;
    let resizeOptions: { fit?: string; withoutEnlargement?: boolean } | null = null;
    let jpegQuality: number | null = null;
    let pngOptions: { compressionLevel?: number; palette?: boolean; colors?: number } | null = null;
    let webpQuality: number | null = null;

    const instance: SharpInstance = {
      async metadata() {
        const img = await imagePromise;
        return {
          width: img.width,
          height: img.height,
          format: 'png', // Jimp defaults to PNG
        };
      },

      resize(width: number, height: number, options?: { fit?: string; withoutEnlargement?: boolean }): SharpInstance {
        targetWidth = width;
        targetHeight = height;
        resizeOptions = options || {};
        return instance;
      },

      jpeg(options?: { quality?: number }): SharpInstance {
        jpegQuality = options?.quality ?? defaultQuality;
        return instance;
      },

      png(options?: { compressionLevel?: number; palette?: boolean; colors?: number }): SharpInstance {
        pngOptions = options || {};
        return instance;
      },

      webp(options?: { quality?: number }): SharpInstance {
        // Jimp doesn't support WebP, treat as JPEG
        webpQuality = options?.quality ?? defaultQuality;
        return instance;
      },

      async toBuffer(): Promise<Buffer> {
        let img = await imagePromise;

        const originalWidth = img.width;
        const originalHeight = img.height;

        // Apply resize if specified
        if (targetWidth !== null && targetHeight !== null) {
          let newWidth = targetWidth;
          let newHeight = targetHeight;

          // Handle 'inside' fit (maintain aspect ratio)
          if (resizeOptions?.fit === 'inside' || !resizeOptions?.fit) {
            const aspectRatio = originalWidth / originalHeight;
            if (newWidth / newHeight > aspectRatio) {
              newWidth = Math.round(newHeight * aspectRatio);
            } else {
              newHeight = Math.round(newWidth / aspectRatio);
            }
          }

          // Respect withoutEnlargement
          if (resizeOptions?.withoutEnlargement) {
            if (newWidth > originalWidth) newWidth = originalWidth;
            if (newHeight > originalHeight) newHeight = originalHeight;
          }

          img = img.resize({ w: newWidth, h: newHeight });
        }

        // Determine output format and quality
        const mimeType = jpegQuality !== null || webpQuality !== null
          ? 'image/jpeg'
          : 'image/png';

        // Note: jimp v1.x doesn't have per-format quality settings in getBuffer
        // Quality is set during processing
        return img.getBuffer(mimeType);
      },
    };

    return instance;
  };
}

/**
 * Try to load sharp, fall back to jimp on unsupported platforms
 */
async function loadImageProcessor(): Promise<SharpFunction> {
  if (sharpModule) {
    return sharpModule;
  }

  // On unsupported platforms, skip straight to jimp
  if (isUnsupportedPlatform()) {
    console.warn(`[Image Processor] ${process.arch} detected, using jimp fallback (slower)`);
    try {
      const jimp = await import('jimp');
      sharpModule = createJimpWrapper(jimp.Jimp);
      useJimp = true;
      return sharpModule;
    } catch (error) {
      throw new Error(`Failed to load jimp fallback: ${error}`);
    }
  }

  // Try to load sharp first
  try {
    const sharpImport = await import('sharp');
    const sharp = (sharpImport as { default?: SharpFunction } & { sharp?: SharpFunction }).default
      || (sharpImport as { sharp?: SharpFunction }).sharp
      || sharpImport as SharpFunction;

    if (typeof sharp !== 'function') {
      throw new Error('sharp is not a function');
    }

    sharpModule = sharp;
    return sharpModule;
  } catch (sharpError) {
    // Sharp failed, try jimp as fallback
    console.warn('[Image Processor] sharp not available, falling back to jimp (slower)');
    try {
      const jimp = await import('jimp');
      sharpModule = createJimpWrapper(jimp.Jimp);
      useJimp = true;
      return sharpModule;
    } catch (jimpError) {
      throw new Error(
        `Failed to load image processor. Sharp error: ${sharpError}. Jimp error: ${jimpError}`
      );
    }
  }
}

/**
 * Get the image processor (sharp or jimp fallback)
 */
export async function getImageProcessor(): Promise<SharpFunction> {
  return loadImageProcessor();
}

/**
 * Check if we're using jimp fallback
 */
export function isUsingJimpFallback(): boolean {
  return useJimp;
}

// Default export for direct usage
export default loadImageProcessor;

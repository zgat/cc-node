/**
 * Sharp-compatible API using pure JavaScript (jimp)
 * For platforms without native module support (RISC-V, etc.)
 */

import Jimp from 'jimp';

export interface SharpOptions {
  width?: number;
  height?: number;
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
  withoutEnlargement?: boolean;
}

export interface PngOptions {
  compressionLevel?: number;
  palette?: boolean;
}

export interface JpegOptions {
  quality?: number;
}

export class SharpJimp {
  private image: Jimp | null = null;
  private inputPath?: string;

  constructor(input: Buffer | string) {
    if (typeof input === 'string') {
      this.inputPath = input;
    }
    this.load(input);
  }

  private async load(input: Buffer | string): Promise<void> {
    try {
      if (typeof input === 'string') {
        this.image = await Jimp.read(input);
      } else {
        this.image = await Jimp.read(input);
      }
    } catch (error) {
      throw new Error(`Failed to load image: ${error}`);
    }
  }

  resize(width?: number, height?: number, options: SharpOptions = {}): this {
    if (!this.image) return this;

    const imgWidth = this.image.getWidth();
    const imgHeight = this.image.getHeight();

    if (!width && !height) return this;

    let targetWidth = width || imgWidth;
    let targetHeight = height || imgHeight;

    // Handle 'inside' fit (default behavior like sharp)
    if (options.fit === 'inside' || !options.fit) {
      const aspectRatio = imgWidth / imgHeight;
      if (targetWidth / targetHeight > aspectRatio) {
        targetWidth = Math.round(targetHeight * aspectRatio);
      } else {
        targetHeight = Math.round(targetWidth / aspectRatio);
      }
    }

    // Respect withoutEnlargement
    if (options.withoutEnlargement) {
      if (targetWidth > imgWidth) targetWidth = imgWidth;
      if (targetHeight > imgHeight) targetHeight = imgHeight;
    }

    this.image.resize(targetWidth, targetHeight);
    return this;
  }

  png(options: PngOptions = {}): this {
    // Jimp doesn't support compressionLevel or palette options
    // PNG format is used by default
    return this;
  }

  jpeg(options: JpegOptions = {}): this {
    if (this.image) {
      this.image.quality(options.quality || 80);
    }
    return this;
  }

  async toBuffer(): Promise<Buffer> {
    if (!this.image) {
      throw new Error('No image loaded');
    }
    return await this.image.getBufferAsync(Jimp.MIME_PNG);
  }

  async metadata(): Promise<{ width: number; height: number; format: string }> {
    if (!this.image) {
      throw new Error('No image loaded');
    }
    return {
      width: this.image.getWidth(),
      height: this.image.getHeight(),
      format: this.image.getExtension(),
    };
  }
}

export default function sharp(input: Buffer | string): SharpJimp {
  return new SharpJimp(input);
}

// Compatibility exports
export const pipeline = async () => {
  throw new Error('Pipeline not implemented in jimp fallback');
};

export const versions = {
  vips: 'jimp-fallback',
  sharp: 'jimp-fallback',
};

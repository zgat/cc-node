/**
 * Sharp image processing stub for platforms without native support (RISC-V, etc.)
 * Falls back to pure JavaScript or returns placeholder
 */

export interface SharpOptions {
  width?: number;
  height?: number;
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
}

export class SharpStub {
  private input: Buffer | string;

  constructor(input: Buffer | string) {
    this.input = input;
  }

  resize(width?: number, height?: number, options: SharpOptions = {}) {
    console.warn('[sharp-stub] Resize not implemented on this platform');
    return this;
  }

  png() {
    console.warn('[sharp-stub] PNG conversion not implemented on this platform');
    return this;
  }

  jpeg() {
    console.warn('[sharp-stub] JPEG conversion not implemented on this platform');
    return this;
  }

  async toBuffer(): Promise<Buffer> {
    console.warn('[sharp-stub] Returning original buffer');
    if (typeof this.input === 'string') {
      return Buffer.from(this.input);
    }
    return this.input;
  }

  async metadata() {
    return {
      width: 0,
      height: 0,
      format: 'unknown',
    };
  }
}

export default function sharp(input: Buffer | string): SharpStub {
  return new SharpStub(input);
}

// Common exports
export const pipeline = async () => {
  throw new Error('Sharp pipeline not available on this platform');
};

export const versions = {
  vips: 'stub',
  sharp: 'stub',
};

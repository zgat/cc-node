// Stub for @anthropic-ai/sandbox-runtime
export class Sandbox {
  static create() {
    return Promise.resolve({});
  }
}

export class SandboxManager {
  constructor() {}
  async init() { return {}; }
  async createSandbox() { return {}; }
  async destroy() {}
  static isSupportedPlatform() {
    return false;
  }
  static checkDependencies() {
    return { errors: [], warnings: [] };
  }
  static getFsReadConfig() { return {}; }
  static getFsWriteConfig() { return {}; }
  static getNetworkRestrictionConfig() { return {}; }
  static getIgnoreViolations() { return false; }
  static getAllowUnixSockets() { return false; }
  static getAllowLocalBinding() { return false; }
  static getEnableWeakerNestedSandbox() { return false; }
  static getProxyPort() { return 0; }
  static getSocksProxyPort() { return 0; }
  static getLinuxHttpSocketPath() { return ''; }
  static getLinuxSocksSocketPath() { return ''; }
  static async waitForNetworkInitialization() {}
  static getSandboxViolationStore() { return null; }
  static annotateStderrWithSandboxFailures(stderr: string) { return stderr; }
  static cleanupAfterCommand() {}
}

export const SandboxViolationStore = {
  getInstance() {
    return {
      recordViolation() {},
      getViolations() { return []; },
      clearViolations() {},
    };
  },
};

export const SandboxRuntimeConfigSchema = {
  safeParse() {
    return { success: true, data: {} };
  },
};

export default Sandbox;

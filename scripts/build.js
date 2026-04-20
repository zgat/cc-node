#!/usr/bin/env node
import * as esbuild from 'esbuild';
import { execSync } from 'child_process';
import { readFileSync, existsSync, mkdirSync, statSync } from 'fs';
import { join, dirname, extname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const srcDir = join(rootDir, 'src');
const distDir = join(rootDir, 'dist');

// Ensure dist directory exists
if (!existsSync(distDir)) {
  mkdirSync(distDir, { recursive: true });
}

// Feature flags - mirror the Bun:bundle feature system
const featureFlags = {
  'PROACTIVE': 'false',
  'KAIROS': 'false',
  'BRIDGE_MODE': 'false',
  'DAEMON': 'false',
  'VOICE_MODE': 'false',
  'AGENT_TRIGGERS': 'false',
  'MONITOR_TOOL': 'false',
  'COORDINATOR_MODE': 'false',
};

// Read version from package.json
const packageJson = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf-8'));
const VERSION = packageJson.version || '1.0.0';

// Read current git commit id (falls back to empty string if not in a git repo)
const COMMIT_ID = (() => {
  try {
    return execSync('git rev-parse HEAD', { cwd: rootDir, encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
})();

// MACRO constants - injected at build time (Bun compatibility)
const MACRO = {
  VERSION: `"${VERSION}"`,
  COMMIT_ID: `"${COMMIT_ID}"`,
  BUILD_TIME: `"${new Date().toISOString()}"`,
  FEEDBACK_CHANNEL: '"github"',  // 'github' or 'slack' for ant builds
  ISSUES_EXPLAINER: '""',
  NATIVE_PACKAGE_URL: '""',
  PACKAGE_URL: '""',
  VERSION_CHANGELOG: '""',
};

// Parse command line arguments
const args = process.argv.slice(2);
const isWatch = args.includes('--watch');

/**
 * Esbuild plugin to resolve .js imports to .ts files
 */
const tsExtensionPlugin = {
  name: 'ts-extension',
  setup(build) {
    // Intercept all .js imports and try to resolve to .ts or .tsx
    build.onResolve({ filter: /\.js$/ }, async (args) => {
      // Skip node_modules
      if (args.path.includes('node_modules')) {
        return undefined;
      }

      // Resolve relative to the importing file
      const resolveDir = args.resolveDir || srcDir;
      const basePath = args.path.replace(/\.js$/, '');

      // Try .ts first
      const tsPath = join(resolveDir, basePath + '.ts');
      if (existsSync(tsPath)) {
        return { path: tsPath };
      }

      // Try .tsx
      const tsxPath = join(resolveDir, basePath + '.tsx');
      if (existsSync(tsxPath)) {
        return { path: tsxPath };
      }

      // Try as directory with index.ts
      const indexTsPath = join(resolveDir, basePath, 'index.ts');
      if (existsSync(indexTsPath)) {
        return { path: indexTsPath };
      }

      // Try as directory with index.tsx
      const indexTsxPath = join(resolveDir, basePath, 'index.tsx');
      if (existsSync(indexTsxPath)) {
        return { path: indexTsxPath };
      }

      // Let esbuild try default resolution (for actual .js files)
      return undefined;
    });

    // Handle bun:bundle alias
    build.onResolve({ filter: /^bun:bundle$/ }, () => {
      return { path: join(srcDir, 'utils', 'featureFlags.ts') };
    });

    // Handle react/compiler-runtime alias
    build.onResolve({ filter: /^react\/compiler-runtime$/ }, () => {
      return { path: join(rootDir, 'node_modules', 'react-compiler-runtime', 'dist', 'index.js') };
    });

    // Handle @anthropic-ai stub modules - bundle them instead of external
    build.onResolve({ filter: /^@anthropic-ai\/sandbox-runtime$/ }, () => {
      return { path: join(srcDir, '__stubs__', '@anthropic-ai', 'sandbox-runtime.ts') };
    });
    build.onResolve({ filter: /^@anthropic-ai\/mcpb$/ }, () => {
      return { path: join(srcDir, '__stubs__', '@anthropic-ai', 'mcpb.ts') };
    });

    // Handle @ant stub modules
    build.onResolve({ filter: /^@ant\/claude-for-chrome-mcp$/ }, () => {
      return { path: join(srcDir, '__stubs__', '@ant', 'claude-for-chrome-mcp.ts') };
    });
    build.onResolve({ filter: /^@ant\/computer-use-input$/ }, () => {
      return { path: join(srcDir, '__stubs__', '@ant', 'computer-use-input.ts') };
    });
    build.onResolve({ filter: /^@ant\/computer-use-mcp$/ }, () => {
      return { path: join(srcDir, '__stubs__', '@ant', 'computer-use-mcp.ts') };
    });
    build.onResolve({ filter: /^@ant\/computer-use-mcp\/sentinelApps$/ }, () => {
      return { path: join(srcDir, '__stubs__', '@ant', 'computer-use-mcp', 'sentinelApps.ts') };
    });
    build.onResolve({ filter: /^@ant\/computer-use-mcp\/types$/ }, () => {
      return { path: join(srcDir, '__stubs__', '@ant', 'computer-use-mcp', 'types.ts') };
    });
    build.onResolve({ filter: /^@ant\/computer-use-swift$/ }, () => {
      return { path: join(srcDir, '__stubs__', '@ant', 'computer-use-swift.ts') };
    });

  },
};

/**
 * Plugin to load text files as strings
 */
const textLoaderPlugin = {
  name: 'text-loader',
  setup(build) {
    build.onLoad({ filter: /\.(txt|md)$/ }, async (args) => {
      const contents = readFileSync(args.path, 'utf-8');
      return {
        contents: JSON.stringify(contents),
        loader: 'json',
      };
    });
  },
};

/**
 * Plugin to replace compile-time constants like "external" === 'ant'
 * This eliminates dead code and build warnings
 */
const buildTargetPlugin = {
  name: 'build-target',
  setup(build) {
    build.onLoad({ filter: /\.(ts|tsx|js|jsx)$/ }, async (args) => {
      // Skip node_modules
      if (args.path.includes('node_modules')) {
        return undefined;
      }

      let contents = readFileSync(args.path, 'utf-8');
      let modified = false;

      // Replace patterns that compare "external" with 'ant'
      // For external builds, "external" !== 'ant' is always true
      const patterns = [
        { regex: /"external"\s*===\s*'ant'/g, replacement: 'false' },
        { regex: /'ant'\s*===\s*"external"/g, replacement: 'false' },
        { regex: /"external"\s*!==\s*'ant'/g, replacement: 'true' },
        { regex: /'ant'\s*!==\s*"external"/g, replacement: 'true' },
      ];

      for (const { regex, replacement } of patterns) {
        if (regex.test(contents)) {
          contents = contents.replace(regex, replacement);
          modified = true;
        }
      }

      if (modified) {
        return {
          contents,
          loader: args.path.endsWith('x') ? 'tsx' : 'ts',
        };
      }

      return undefined;
    });
  },
};

// Common build options
const commonOptions = {
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'esm',
  sourcemap: true,
  banner: {
    js: `#!/usr/bin/env node\nimport { createRequire } from 'module';const require = createRequire(import.meta.url);`,
  },
  plugins: [tsExtensionPlugin, textLoaderPlugin, buildTargetPlugin],
  define: {
    ...Object.fromEntries(
      Object.entries(featureFlags).map(([k, v]) => [
        `FEATURE_${k}`,
        v
      ])
    ),
    'globalThis.FEATURE_FLAGS': JSON.stringify(featureFlags),
    // MACRO constants for Bun compatibility
    ...Object.fromEntries(
      Object.entries(MACRO).map(([k, v]) => [`MACRO.${k}`, v])
    ),
  },
  external: [
    // Native modules
    'node:stream',
    'node:util',
    'node:path',
    'node:fs',
    'node:os',
    'node:crypto',
    'node:events',
    'node:http',
    'node:https',
    'node:net',
    'node:tls',
    'node:zlib',
    'node:buffer',
    'node:process',
    'node:url',
    'node:querystring',
    'node:dns',
    // Internal anthropic packages - now stubbed and bundled
    '@ant/*',
    // AWS SDK - optional
    '@aws-sdk/client-bedrock',
    '@aws-sdk/client-sts',
    '@aws-sdk/*',
    // Anthropic SDK variants
    '@anthropic-ai/bedrock-sdk',
    '@anthropic-ai/foundry-sdk',
    '@anthropic-ai/vertex-sdk',
    // Azure
    '@azure/identity',
    // OpenTelemetry exporters (optional)
    '@opentelemetry/exporter-metrics-otlp-grpc',
    '@opentelemetry/exporter-metrics-otlp-http',
    '@opentelemetry/exporter-metrics-otlp-proto',
    '@opentelemetry/exporter-prometheus',
    '@opentelemetry/exporter-logs-otlp-grpc',
    '@opentelemetry/exporter-logs-otlp-http',
    '@opentelemetry/exporter-logs-otlp-proto',
    '@opentelemetry/exporter-trace-otlp-grpc',
    '@opentelemetry/exporter-trace-otlp-http',
    '@opentelemetry/exporter-trace-otlp-proto',
    '@opentelemetry/exporter-jaeger',
    '@opentelemetry/exporter-zipkin',
    // React compiler runtime - handled separately
    'react/compiler-runtime',
    // Native modules that cannot be bundled
    'modifiers-napi',
  ],
  logLevel: 'info',
  resolveExtensions: ['.tsx', '.ts', '.jsx', '.js', '.css', '.json'],
  tsconfig: join(rootDir, 'tsconfig.json'),
};

// Entry points
const entryPoints = [
  { in: join(srcDir, 'main.tsx'), out: 'main' },
  { in: join(srcDir, 'entrypoints', 'cli.tsx'), out: 'cli' },
  { in: join(srcDir, 'entrypoints', 'mcp.ts'), out: 'mcp' },
  { in: join(srcDir, 'entrypoints', 'init.ts'), out: 'init' },
];

async function build() {
  console.log('Building Claude Code (Node.js version)...');
  console.log('Entry points:', entryPoints.map(e => e.in).join(', '));

  try {
    if (isWatch) {
      const ctx = await esbuild.context({
        ...commonOptions,
        entryPoints: entryPoints.map(e => e.in),
        outdir: distDir,
        outExtension: { '.js': '.js' },
      });

      await ctx.watch();
      console.log('Watching for changes...');
    } else {
      for (const { in: input, out: output } of entryPoints) {
        if (!existsSync(input)) {
          console.warn(`Warning: Entry point ${input} does not exist, skipping...`);
          continue;
        }

        try {
          await esbuild.build({
            ...commonOptions,
            entryPoints: [input],
            outfile: join(distDir, `${output}.js`),
          });
          console.log(`Built: ${input} -> ${output}.js`);
        } catch (error) {
          console.error(`Failed to build ${input}:`, error.message);
        }
      }

      console.log('\nBuild completed!');
    }
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

build();

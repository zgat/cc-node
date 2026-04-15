#!/usr/bin/env node
/**
 * Fix import extensions in TypeScript files
 * Converts .js extensions to .ts for internal imports
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, extname, dirname, relative } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcDir = join(__dirname, '..', 'src');

const extensions = ['.ts', '.tsx', '.js', '.jsx'];

function getAllFiles(dir) {
  const files = [];
  const items = readdirSync(dir);

  for (const item of items) {
    const fullPath = join(dir, item);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      files.push(...getAllFiles(fullPath));
    } else if (extensions.includes(extname(item))) {
      files.push(fullPath);
    }
  }

  return files;
}

function isInternalImport(importPath) {
  // Internal imports start with ./ or ../
  return importPath.startsWith('./') || importPath.startsWith('../');
}

function resolveImport(fromFile, importPath) {
  const fromDir = dirname(fromFile);
  const resolvedPath = join(fromDir, importPath);

  // Check if .ts file exists
  if (statSync(resolvedPath + '.ts', { throwIfNoEntry: false })) {
    return importPath + '.ts';
  }

  // Check if .tsx file exists
  if (statSync(resolvedPath + '.tsx', { throwIfNoEntry: false })) {
    return importPath + '.tsx';
  }

  // Check if it's a directory with index.ts
  if (statSync(resolvedPath, { throwIfNoEntry: false })?.isDirectory()) {
    if (statSync(join(resolvedPath, 'index.ts'), { throwIfNoEntry: false })) {
      return importPath + '/index.ts';
    }
    if (statSync(join(resolvedPath, 'index.tsx'), { throwIfNoEntry: false })) {
      return importPath + '/index.tsx';
    }
  }

  return null;
}

function processFile(filePath) {
  let content = readFileSync(filePath, 'utf-8');
  let modified = false;

  // Match various import patterns
  const patterns = [
    // ES6 imports: from './path.js'
    /from\s+['"]([^'"]+\.js)['"]/g,
    // Dynamic imports: import('./path.js')
    /import\(['"]([^'"]+\.js)['"]\)/g,
    // require: require('./path.js')
    /require\(['"]([^'"]+\.js)['"]\)/g,
  ];

  for (const pattern of patterns) {
    content = content.replace(pattern, (match, importPath) => {
      if (!isInternalImport(importPath)) {
        return match;
      }

      const newPath = resolveImport(filePath, importPath.replace(/\.js$/, ''));
      if (newPath) {
        modified = true;
        return match.replace(importPath, newPath);
      }

      return match;
    });
  }

  if (modified) {
    writeFileSync(filePath, content, 'utf-8');
    console.log(`  Fixed: ${relative(srcDir, filePath)}`);
    return true;
  }

  return false;
}

// Main
console.log('Fixing import extensions...\n');
const files = getAllFiles(srcDir);
console.log(`Found ${files.length} source files\n`);

let fixedCount = 0;
for (const file of files) {
  if (processFile(file)) {
    fixedCount++;
  }
}

console.log(`\nFixed ${fixedCount} files`);

#!/usr/bin/env node
/**
 * Fix featureFlags import paths
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, extname, dirname, relative } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcDir = join(__dirname, '..', 'src');

const extensions = ['.ts', '.tsx'];

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

function getRelativePath(fromFile, toFile) {
  const rel = relative(dirname(fromFile), toFile);
  // Remove .ts extension and add .js for ES modules compatibility
  return rel.replace(/\.ts$/, '.js');
}

function processFile(filePath, featureFlagsPath) {
  let content = readFileSync(filePath, 'utf-8');
  let modified = false;

  // Match featureFlags imports
  const pattern = /from\s+['"]([^'"]*featureFlags\.js)['"]/g;

  content = content.replace(pattern, (match, importPath) => {
    const correctPath = getRelativePath(filePath, featureFlagsPath);
    modified = true;
    return match.replace(importPath, correctPath);
  });

  if (modified) {
    writeFileSync(filePath, content, 'utf-8');
    console.log(`  Fixed: ${relative(srcDir, filePath)}`);
    return true;
  }

  return false;
}

// Main
console.log('Fixing featureFlags imports...\n');
const files = getAllFiles(srcDir);
const featureFlagsPath = join(srcDir, 'utils', 'featureFlags.ts');

console.log(`Found ${files.length} source files`);
console.log(`FeatureFlags path: ${featureFlagsPath}\n`);

let fixedCount = 0;
for (const file of files) {
  if (processFile(file, featureFlagsPath)) {
    fixedCount++;
  }
}

console.log(`\nFixed ${fixedCount} files`);

#!/usr/bin/env node
/**
 * Migration script to replace Bun-specific APIs with Node.js compatible versions
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

const srcDir = process.argv[2] || './src';

// File extensions to process
const extensions = ['.ts', '.tsx', '.js', '.jsx'];

// Get all source files recursively
function getFiles(dir) {
  const files = [];
  const items = readdirSync(dir);

  for (const item of items) {
    const fullPath = join(dir, item);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      files.push(...getFiles(fullPath));
    } else if (extensions.includes(extname(item))) {
      files.push(fullPath);
    }
  }

  return files;
}

// Process a single file
function processFile(filePath) {
  let content = readFileSync(filePath, 'utf-8');
  let modified = false;

  // Replace bun:bundle import
  if (content.includes("from 'bun:bundle'") || content.includes('from "bun:bundle"')) {
    content = content.replace(
      /from ['"]bun:bundle['"]/g,
      "from '../utils/featureFlags.js'"
    );
    modified = true;
    console.log(`  Replaced bun:bundle import in ${filePath}`);
  }

  // Replace Bun.hash with bunHash from bun-compat
  // Only if not already handled by typeof Bun check
  if (content.includes('Bun.hash') && !content.includes('typeof Bun')) {
    // Add import if needed
    if (!content.includes('from \'../utils/bun-compat.js\'') &&
        !content.includes('from "../utils/bun-compat.js"')) {
      // Find last import and add after it
      const lastImport = content.lastIndexOf('import ');
      if (lastImport !== -1) {
        const importEnd = content.indexOf(';', lastImport);
        if (importEnd !== -1) {
          content = content.slice(0, importEnd + 1) +
            "\nimport { bunHash, bunHashString } from '../utils/bun-compat.js';" +
            content.slice(importEnd + 1);
        }
      }
    }

    // Replace usage - but be careful not to replace inside comments or strings
    content = content.replace(/Bun\.hash\(/g, 'bunHash(');
    content = content.replace(/Bun\.hash\b/g, 'bunHashString');
    modified = true;
    console.log(`  Replaced Bun.hash in ${filePath}`);
  }

  // Replace Bun.YAML with bunYaml
  if (content.includes('Bun.YAML') && !content.includes('typeof Bun')) {
    if (!content.includes('from \'../utils/bun-compat.js\'')) {
      const lastImport = content.lastIndexOf('import ');
      if (lastImport !== -1) {
        const importEnd = content.indexOf(';', lastImport);
        if (importEnd !== -1) {
          content = content.slice(0, importEnd + 1) +
            "\nimport { bunYamlParse, bunYamlStringify } from '../utils/bun-compat.js';" +
            content.slice(importEnd + 1);
        }
      }
    }

    content = content.replace(/Bun\.YAML\.parse/g, 'bunYamlParse');
    content = content.replace(/Bun\.YAML\.stringify/g, 'bunYamlStringify');
    content = content.replace(/Bun\.YAML/g, '{ parse: bunYamlParse, stringify: bunYamlStringify }');
    modified = true;
    console.log(`  Replaced Bun.YAML in ${filePath}`);
  }

  // Replace Bun.gc with bunGc
  if (content.includes('Bun.gc') && !content.includes('typeof Bun')) {
    if (!content.includes('from \'../utils/bun-compat.js\'')) {
      const lastImport = content.lastIndexOf('import ');
      if (lastImport !== -1) {
        const importEnd = content.indexOf(';', lastImport);
        if (importEnd !== -1) {
          content = content.slice(0, importEnd + 1) +
            "\nimport { bunGc } from '../utils/bun-compat.js';" +
            content.slice(importEnd + 1);
        }
      }
    }
    content = content.replace(/Bun\.gc\(/g, 'bunGc(');
    content = content.replace(/Bun\.gc\b/g, 'bunGc');
    modified = true;
    console.log(`  Replaced Bun.gc in ${filePath}`);
  }

  // Replace Bun.semver with bunSemver
  if (content.includes('Bun.semver') && !content.includes('typeof Bun')) {
    if (!content.includes('from \'../utils/bun-compat.js\'')) {
      const lastImport = content.lastIndexOf('import ');
      if (lastImport !== -1) {
        const importEnd = content.indexOf(';', lastImport);
        if (importEnd !== -1) {
          content = content.slice(0, importEnd + 1) +
            "\nimport { bunSemver } from '../utils/bun-compat.js';" +
            content.slice(importEnd + 1);
        }
      }
    }
    content = content.replace(/Bun\.semver/g, 'bunSemver');
    modified = true;
    console.log(`  Replaced Bun.semver in ${filePath}`);
  }

  if (modified) {
    writeFileSync(filePath, content, 'utf-8');
    return true;
  }

  return false;
}

// Main
console.log('Scanning for Bun-specific APIs...\n');
const files = getFiles(srcDir);
console.log(`Found ${files.length} source files\n`);

let modifiedCount = 0;
for (const file of files) {
  if (processFile(file)) {
    modifiedCount++;
  }
}

console.log(`\nModified ${modifiedCount} files`);

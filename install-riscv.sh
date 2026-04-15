#!/bin/bash
# RISC-V install script for claude-code-node

set -e

echo "=== Claude Code Node.js - RISC-V Install Script ==="
echo "Architecture: $(uname -m)"
echo ""

# Check if running on RISC-V
if [[ $(uname -m) != riscv* ]]; then
    echo "Warning: Not running on RISC-V, but continuing anyway..."
fi

# Install system dependencies
echo "[1/4] Installing system dependencies..."
if command -v apt-get &> /dev/null; then
    sudo apt-get update
    sudo apt-get install -y build-essential python3 libvips-dev pkg-config
elif command -v yum &> /dev/null; then
    sudo yum install -y gcc-c++ python3 vips-devel pkgconfig
elif command -v pacman &> /dev/null; then
    sudo pacman -S --needed base-devel python3 libvips pkgconf
else
    echo "Warning: Unknown package manager, please install build tools manually"
fi

# Clean install with native compilation
echo ""
echo "[2/4] Installing npm dependencies (with native compilation)..."
npm ci || npm install

echo ""
echo "[3/4] Building from source for RISC-V..."

# Force rebuild native modules
npm rebuild sharp --build-from-source 2>/dev/null || echo "sharp rebuild skipped"
npm rebuild color-diff-napi --build-from-source 2>/dev/null || echo "color-diff-napi rebuild skipped"
npm rebuild modifiers-napi --build-from-source 2>/dev/null || echo "modifiers-napi rebuild skipped"

echo ""
echo "[4/4] Building project..."
npm run build

echo ""
echo "=== Installation complete! ==="
echo "Run: node dist/main.js --help"


#!/bin/bash
# CC Node universal install script

set -e

ARCH=$(uname -m)
OS=$(uname -s | tr '[:upper:]' '[:lower:]')

echo "=== CC Node Install Script ==="
echo "OS: ${OS}"
echo "Architecture: ${ARCH}"
echo ""

# Check Node.js version
NODE_VERSION=$(node --version 2>/dev/null | sed 's/v//' || true)
if [ -z "$NODE_VERSION" ]; then
    echo "Error: Node.js is not installed. Please install Node.js >= 18 first."
    exit 1
fi
NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d. -f1)
if [ "$NODE_MAJOR" -lt 18 ]; then
    echo "Error: Node.js ${NODE_VERSION} is too old. Please upgrade to >= 18."
    exit 1
fi
echo "Node.js: ${NODE_VERSION}"
echo ""

# Install system dependencies
echo "[1/4] Installing system dependencies..."
if command -v apt-get &> /dev/null; then
    sudo apt-get update
    sudo apt-get install -y build-essential python3 libvips-dev pkg-config
elif command -v yum &> /dev/null; then
    sudo yum install -y gcc-c++ python3 vips-devel pkgconfig
elif command -v dnf &> /dev/null; then
    sudo dnf install -y gcc-c++ python3 vips-devel pkgconfig
elif command -v pacman &> /dev/null; then
    sudo pacman -S --needed base-devel python3 libvips pkgconf
elif command -v brew &> /dev/null; then
    brew install vips pkg-config 2>/dev/null || echo "Some packages may already be installed"
else
    echo "Warning: Unknown package manager. Please install build tools manually:"
    echo "  - C++ compiler (g++/clang++)"
    echo "  - Python 3"
    echo "  - libvips + pkg-config"
fi

# Install npm dependencies
echo ""
echo "[2/4] Installing npm dependencies..."
npm ci || npm install

# Rebuild native modules if needed (especially on non-x64 platforms)
echo ""
echo "[3/4] Rebuilding native modules for ${ARCH}..."
npm rebuild sharp --build-from-source 2>/dev/null || echo "sharp rebuild skipped"

# Build project
echo ""
echo "[4/4] Building project..."
npm run build

# Link binary globally
echo ""
echo "[5/5] Linking ccnode binary globally..."
npm link

echo ""
echo "=== Installation complete! ==="
echo "Run: ccnode         (global command)"
echo "Run: npm run dev    (development)"
echo "Run: npm start      (production)"

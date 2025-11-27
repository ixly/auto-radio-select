#!/bin/bash

# Exit on error
set -e

# Get the version from manifest.json
VERSION=$(grep '"version"' src/manifest.json | sed -E 's/.*"version": "([^"]+)".*/\1/')

# Create release filename
RELEASE_FILE="releases/auto-radio-select-v$VERSION.zip"

# Create releases directory if it doesn't exist
mkdir -p releases

# Create zip file
echo "Creating release v$VERSION..."
cd src && zip -r "../$RELEASE_FILE" * -x "*.DS_Store" && cd ..

# Make the file executable
chmod +x release.sh

echo "✅ Release created: $RELEASE_FILE"
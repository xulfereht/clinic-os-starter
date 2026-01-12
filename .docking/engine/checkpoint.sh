#!/bin/bash

# Project Checkpoint Script
# Usage: ./.docking/engine/checkpoint.sh "A brief description of the checkpoint"

DESCRIPTION=$1
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
LABEL=${DESCRIPTION// /_}
CHECKPOINT_DIR=".docking/checkpoints/${TIMESTAMP}_${LABEL}"

echo "🚀 Creating checkpoint: ${CHECKPOINT_DIR}..."

mkdir -p "${CHECKPOINT_DIR}"

# Copy files excluding node_modules, .git, .wrangler, and the .docking folder itself to avoid recursion
# However, we might want to keep some parts of .docking? 
# Let's just exclude the checkpoints folder to avoid infinite recursion.
rsync -av --progress ./ "${CHECKPOINT_DIR}" \
  --exclude "node_modules" \
  --exclude ".git" \
  --exclude ".wrangler" \
  --exclude ".docking/checkpoints" \
  --exclude ".docking/versions" \
  --exclude ".agent" \
  --exclude "*.log"

echo "✅ Checkpoint created successfully at ${CHECKPOINT_DIR}"

# Create a small metadata file
echo "Timestamp: $(date)" > "${CHECKPOINT_DIR}/metadata.txt"
echo "Description: ${DESCRIPTION}" >> "${CHECKPOINT_DIR}/metadata.txt"
echo "Base Version: $(cat .docking/.applied 2>/dev/null || echo 'unknown')" >> "${CHECKPOINT_DIR}/metadata.txt"

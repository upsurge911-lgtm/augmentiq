#!/usr/bin/env bash
# AugmentIQ+ MCP server launcher for Cursor (Tier 3)
# Usage: cursor.sh [--check]
#
# Cursor does not auto-launch MCP servers via Skills. The user must run
# this script manually before running AugmentIQ commands. Cursor's
# MCP support is being added; check the latest Cursor docs.
set -euo pipefail

IMAGE_NAME="augmentiq-engine"
CONTAINER_NAME="augmentiq-engine-${RANDOM}"

if [[ "${1:-}" == "--check" ]]; then
  echo "AugmentIQ+ launch script OK."
  echo "  Image: ${IMAGE_NAME}:latest"
  echo "  Note: Cursor does not auto-launch. Run this manually in a separate terminal."
  if command -v docker >/dev/null 2>&1; then
    if docker images --format "{{.Repository}}" 2>/dev/null | grep -q "^${IMAGE_NAME}$"; then
      echo "  Docker image: present"
    else
      echo "  Docker image: MISSING"
      exit 1
    fi
  else
    echo "  Docker: NOT FOUND ON PATH"
    exit 1
  fi
  exit 0
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "Error: Docker not found on PATH." >&2
  exit 1
fi

if ! docker images --format "{{.Repository}}" 2>/dev/null | grep -q "^${IMAGE_NAME}$"; then
  echo "Error: Docker image '${IMAGE_NAME}' not found." >&2
  exit 1
fi

exec docker run -i --rm --name "${CONTAINER_NAME}" "${IMAGE_NAME}"

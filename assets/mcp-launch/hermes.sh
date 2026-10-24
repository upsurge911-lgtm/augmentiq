#!/usr/bin/env bash
# AugmentIQ+ MCP server launcher for Hermes (primary dev/test target)
# Usage: hermes.sh [--check]
#
# This script launches the AugmentIQ+ Docker container and pipes its
# stdio to the calling process (the Skill). The Skill holds the
# foreground process for the duration of the session.
#
# Install path: ~/.hermes/skills/augmentiq/assets/mcp-launch/hermes.sh
# Contract: see references/mcp-integration.md §3
set -euo pipefail

IMAGE_NAME="augmentiq-engine"
CONTAINER_NAME="augmentiq-engine-${RANDOM}"

# Parse --check flag for pre-flight verification
if [[ "${1:-}" == "--check" ]]; then
  echo "AugmentIQ+ launch script OK."
  echo "  Image: ${IMAGE_NAME}:latest"
  echo "  Will run: docker run -i --rm ${IMAGE_NAME}"
  if command -v docker >/dev/null 2>&1; then
    if docker images --format "{{.Repository}}" 2>/dev/null | grep -q "^${IMAGE_NAME}$"; then
      echo "  Docker image: present"
    else
      echo "  Docker image: MISSING (build with: docker build -t ${IMAGE_NAME} /path/to/augmentiq-plus)"
      exit 1
    fi
  else
    echo "  Docker: NOT FOUND ON PATH (install Docker to use the Custom backend)"
    exit 1
  fi
  exit 0
fi

# Verify Docker is available
if ! command -v docker >/dev/null 2>&1; then
  echo "Error: Docker not found on PATH." >&2
  echo "Install Docker Desktop (macOS/Windows) or Docker Engine (Linux) to use the Custom backend." >&2
  echo "See https://docs.docker.com/engine/install/ for instructions." >&2
  exit 1
fi

# Verify the image exists
if ! docker images --format "{{.Repository}}" 2>/dev/null | grep -q "^${IMAGE_NAME}$"; then
  echo "Error: Docker image '${IMAGE_NAME}' not found." >&2
  echo "Build with:" >&2
  echo "  git clone https://github.com/upsurge911-lgtm/augmentiq-plus.git" >&2
  echo "  cd augmentiq-plus" >&2
  echo "  docker build -t ${IMAGE_NAME} ." >&2
  exit 1
fi

# Launch the container with stdio
# -i: keep stdin open (required for MCP stdio communication)
# --rm: clean up the container when it exits
# The container's stdio becomes the MCP channel
exec docker run -i --rm --name "${CONTAINER_NAME}" "${IMAGE_NAME}"

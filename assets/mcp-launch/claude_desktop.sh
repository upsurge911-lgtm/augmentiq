#!/usr/bin/env bash
# AugmentIQ+ MCP server launcher for Claude Desktop (Tier 2)
# Usage: claude_desktop.sh [--check]
#
# Claude Desktop launches MCP servers itself via claude_desktop_config.json.
# Point the mcpServers entry at this script so the container lifecycle is
# managed by the Desktop app. The container's stdio is exposed via this
# script for piping.
#
# claude_desktop_config.json entry (macOS path:
# ~/Library/Application Support/Claude/claude_desktop_config.json):
#   "mcpServers": {
#     "augmentiq": {
#       "command": "/path/to/skills/augmentiq/assets/mcp-launch/claude_desktop.sh"
#     }
#   }
set -euo pipefail

IMAGE_NAME="augmentiq-engine"
CONTAINER_NAME="augmentiq-engine-${RANDOM}"

if [[ "${1:-}" == "--check" ]]; then
  echo "AugmentIQ+ launch script OK."
  echo "  Image: ${IMAGE_NAME}:latest"
  echo "  Note: Claude Desktop launches this script via claude_desktop_config.json."
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
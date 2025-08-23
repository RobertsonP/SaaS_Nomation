#!/bin/bash
set -e

echo "🖥️ Starting virtual display server..."

# Start Xvfb (X Virtual Framebuffer) in background
Xvfb ${XVFB_DISPLAY} -screen 0 ${SCREEN_WIDTH}x${SCREEN_HEIGHT}x${SCREEN_DEPTH} -ac -nolisten tcp -dpi 96 +extension GLX +render -noreset &
XVFB_PID=$!

# Wait for Xvfb to start
sleep 2

echo "✅ Virtual display started on ${DISPLAY} (${SCREEN_WIDTH}x${SCREEN_HEIGHT}x${SCREEN_DEPTH})"

# Virtual display is ready for headless browser execution
echo "✅ Virtual display ready for Playwright browser execution"

# Function to cleanup on exit
cleanup() {
    echo "🧹 Cleaning up virtual display..."
    kill $XVFB_PID 2>/dev/null || true
    exit
}

# Set trap to cleanup on exit
trap cleanup EXIT INT TERM

# Start the main application
echo "🚀 Starting Nomation backend with virtual display support..."
exec "$@"
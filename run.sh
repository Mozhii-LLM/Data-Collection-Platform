#!/bin/bash
# Mozhii.AI — Start Script
echo "🚀 Starting Mozhii.AI Data Collection Platform..."
cd "$(dirname "$0")"
PORT=${PORT:-8000}
python3 -m uvicorn backend.main:app --host 0.0.0.0 --port $PORT

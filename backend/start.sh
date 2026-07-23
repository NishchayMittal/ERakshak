#!/bin/bash
set -e

# Start FastAPI in the foreground
# We bypass Celery entirely to stay under the 512MB Render free tier limit.
# The app will automatically fall back to local background execution via threading.
echo "Starting FastAPI on port ${PORT:-8000}..."
exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}

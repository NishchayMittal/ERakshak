#!/bin/bash
set -e

# Start Celery Worker in the background
echo "Starting Celery Worker..."
celery -A app.worker.celery_app worker --loglevel=info --pool=solo &

# Start Celery Beat in the background
echo "Starting Celery Beat..."
celery -A app.worker.celery_app beat --loglevel=info &

# Wait for Redis to be fully ready before starting Uvicorn (optional but safe)
sleep 2

# Start FastAPI in the foreground
# Render automatically injects the $PORT environment variable (usually 10000)
echo "Starting FastAPI on port ${PORT:-8000}..."
exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}

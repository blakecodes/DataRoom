#!/usr/bin/env bash
set -e

# Run DB migrations to head, then start the API.
echo "Running migrations..."
alembic upgrade head

echo "Starting API..."
exec gunicorn --bind 0.0.0.0:8000 --workers 2 --timeout 120 wsgi:app

#!/bin/bash
set -e

echo "Pulling latest code..."
git pull

echo "Building and starting containers..."
docker compose up --build -d

echo ""
echo "Done! Services:"
docker compose ps

echo ""
echo "Useful commands:"
echo "  View logs:    docker compose logs -f"
echo "  Stop:         docker compose down"
echo "  Seed DB:      docker compose exec backend python seed.py"

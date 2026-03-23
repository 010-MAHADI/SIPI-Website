#!/bin/bash
# Run this on the production server to activate the chat feature
# Usage: bash scripts/deploy-chat.sh

set -e

REPO_DIR="/home/flypick/SIPI-Website"
SERVER_DIR="$REPO_DIR/server"

echo "==> Pulling latest code..."
cd $REPO_DIR
git pull origin main

echo "==> Running migrations..."
cd $SERVER_DIR
source venv/bin/activate
python manage.py migrate

echo "==> Restarting Django service..."
sudo systemctl restart flypick

echo "==> Done! Chat endpoints should now be working."
echo "    Test: curl http://localhost:8000/api/chat/session/ -X POST -H 'Content-Type: application/json' -d '{\"session_id\":\"test\"}'"

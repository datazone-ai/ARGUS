#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=== ARGUS API Setup ==="

# Create virtual environment
if [ ! -d "venv" ]; then
  python3 -m venv venv
  echo "Created virtual environment."
fi

source venv/bin/activate
pip install --upgrade pip -q
pip install -r requirements.txt -q

echo "=== Dependencies installed ==="

# Init DB (creates tables + seeds data)
echo "=== Initialising database ==="
python init_db.py

echo ""
echo "=== Setup complete! ==="
echo "Run the API with:  source venv/bin/activate && uvicorn app.main:app --reload --port 8000"

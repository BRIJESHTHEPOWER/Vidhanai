#!/bin/bash
# MongoDB Setup Helper for AI Legal System

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║  MongoDB Setup for AI Legal System                             ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Check if mongod is available
if ! command -v mongod &> /dev/null; then
    echo "❌ MongoDB is not installed on this system."
    echo ""
    echo "📦 INSTALLATION OPTIONS:"
    echo ""
    echo "1️⃣  Windows (via Chocolatey):"
    echo "   choco install mongodb-community"
    echo ""
    echo "2️⃣  macOS (via Homebrew):"
    echo "   brew tap mongodb/brew"
    echo "   brew install mongodb-community"
    echo ""
    echo "3️⃣  Linux (Ubuntu/Debian):"
    echo "   curl https://www.mongodb.org/static/pgp/server-7.0.asc | apt-key add -"
    echo "   echo 'deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/7.0 multiverse' | tee /etc/apt/sources.list.d/mongodb-org-7.0.list"
    echo "   apt-get update && apt-get install -y mongodb-org"
    echo ""
    echo "4️⃣  Docker (Recommended):"
    echo "   docker run -d -p 27017:27017 --name mongodb-legal mongo:latest"
    echo ""
    exit 1
fi

echo "✓ MongoDB found at: $(command -v mongod)"
echo ""
echo "🚀 Starting MongoDB..."
echo ""

# Try to start MongoDB with standard locations
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
    # Windows
    net start MongoDB 2>/dev/null || mongod --config "C:\Program Files\MongoDB\Server\7.0\bin\mongod.cfg" &
    MONGO_PID=$!
else
    # Linux/macOS
    mongod --logpath /tmp/mongodb.log --fork 2>/dev/null || mongod --fork &
    MONGO_PID=$!
fi

echo "⏳ Waiting for MongoDB to start..."
sleep 3

# Check if MongoDB is running
if mongo --eval "db.adminCommand('ping')" &>/dev/null; then
    echo "✅ MongoDB is now running on mongodb://127.0.0.1:27017"
    echo ""
    echo "📋 Next Steps:"
    echo "  1. Install Python dependencies:  pip install -r requirements.txt"
    echo "  2. Start the backend:            python -m uvicorn main:app --reload"
    echo "  3. Start the frontend:           cd ../frontend && npm run dev"
    echo ""
    exit 0
else
    echo "❌ MongoDB failed to start"
    echo ""
    echo "💡 Troubleshooting:"
    echo "  - Check if port 27017 is in use: lsof -i :27017"
    echo "  - Check MongoDB logs for errors"
    echo "  - Try starting MongoDB manually in another terminal: mongod"
    echo ""
    exit 1
fi

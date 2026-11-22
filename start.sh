#!/bin/bash
# Real Estate & Construction Multi-Site Inventory Management System Launcher

cd "$(dirname "$0")"

echo "=========================================================="
echo "🏗️  Starting Construction Inventory Management System..."
echo "=========================================================="

# Check if node is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is required but not found. Please install Node.js."
    exit 1
fi

# Run the server
node server.js

#!/bin/bash

# Start both applications concurrently

echo "🚀 Starting Basic Automation Projects..."
echo ""

# Check if dependencies are installed
if [ ! -d "CV-Generator/node_modules" ]; then
    echo "CV-Generator dependencies not found. Run install-all.sh first"
    exit 1
fi

if [ ! -d "Business-App/node_modules" ]; then
    echo "Business-App dependencies not found. Run install-all.sh first"
    exit 1
fi

echo "Starting CV Generator (port 3000)..."
cd CV-Generator
npm run dev &
CV_PID=$!

echo "Starting Business App (port 3001)..."
cd ../Business-App
npm run dev &
BUSINESS_PID=$!

echo ""
echo "✅ Both applications started!"
echo ""
echo "📍 CV Generator: http://localhost:3000"
echo "📍 Business App: http://localhost:3001"
echo ""
echo "Press Ctrl+C to stop all servers"
echo ""

# Wait for both processes
wait $CV_PID $BUSINESS_PID

#!/bin/bash

# Basic Automation - Quick Start Script
# This script sets up and starts both applications

echo "🚀 Basic Automation - Quick Start"
echo "=================================="
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed!"
    echo "Please install Node.js 18+ from https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js version: $(node --version)"
echo ""

# Install CV Generator
echo "📦 Installing CV Generator..."
cd CV-Generator
npm install
if [ $? -ne 0 ]; then
    echo "❌ Failed to install CV Generator"
    exit 1
fi
cd ..
echo "✅ CV Generator installed"
echo ""

# Install Business App
echo "📦 Installing Business App..."
cd Business-App
npm install
if [ $? -ne 0 ]; then
    echo "❌ Failed to install Business App"
    exit 1
fi
cd ..
echo "✅ Business App installed"
echo ""

echo "🎉 Installation complete!"
echo ""
echo "To start the applications:"
echo ""
echo "  CV Generator:"
echo "    cd CV-Generator && npm run dev"
echo "    Access at http://localhost:3000"
echo ""
echo "  Business App:"
echo "    cd Business-App && npm run dev"
echo "    Access at http://localhost:3001"
echo ""
echo "Or use: npm run dev in each directory"

#!/bin/bash
# Clinic-OS Setup Helper
echo "🚀 Starting Clinic-OS Setup..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js v18+"
    exit 1
fi
node scripts/setup-clinic.js

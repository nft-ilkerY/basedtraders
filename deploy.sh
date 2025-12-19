#!/bin/bash

# VDS Deployment Script for Based Traders

echo "Starting deployment process..."

# 1. Install dependencies
echo "Installing dependencies..."
npm install

# 2. Build the frontend
echo "Building frontend..."
npm run build

# 3. Start the server in production mode
echo "Starting server on port 3000..."
npm start

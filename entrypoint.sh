#!/bin/sh
set -e

echo "Initializing database..."
npx tsx src/db/init.ts

echo "Running model scanner..."
npx tsx src/scanner/cli.ts || echo "Scanner failed, starting anyway..."

echo "Starting server..."
exec node server.js

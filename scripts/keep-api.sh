#!/bin/bash
# PomagierGT — keep API alive
cd /pomagier
while true; do
  echo "[$(date)] Starting API server..."
  npx tsx src/api/server.ts
  echo "[$(date)] API crashed — restarting in 3s..."
  sleep 3
done

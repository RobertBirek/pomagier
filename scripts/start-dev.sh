#!/bin/bash
# Start PomagierGT dev servers
cd /pomagier

echo "Starting API server..."
npx tsx src/api/server.ts &
API_PID=$!
echo "API PID: $API_PID"

echo "Starting Vite dev server..."
npx vite dev --host 0.0.0.0 &
VITE_PID=$!
echo "Vite PID: $VITE_PID"

echo ""
echo "Waiting for servers to be ready..."
for i in $(seq 1 30); do
  sleep 2
  API_OK=$(curl -s -m 1 http://localhost:3000/api/health >/dev/null 2>&1 && echo 1 || echo 0)
  VITE_OK=$(curl -s -m 1 -o /dev/null -w "%{http_code}" http://localhost:5173/ 2>/dev/null)
  echo "  check $i: API=$([ $API_OK = 1 ] && echo OK || echo waiting) Vite=$([ "$VITE_OK" = "200" ] && echo OK || echo waiting)"
  if [ $API_OK = 1 ] && [ "$VITE_OK" = "200" ]; then
    echo ""
    echo "=== All servers ready ==="
    echo "Frontend: http://10.10.254.131:5173"
    echo "API:      http://10.10.254.131:3000"
    echo ""
    wait
    exit 0
  fi
done

echo "Timeout waiting for servers"
exit 1

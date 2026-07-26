#!/bin/bash
# VPN health check — verifies WireGuard tunnel is active
LOG="/var/log/pomagier-vpn.log"

STATUS=$(wg show wg0 2>/dev/null | grep -c "latest handshake")
if [ "$STATUS" -gt 0 ]; then
  HANDSHAKE=$(wg show wg0 | grep "latest handshake" | awk '{print $3, $4, $5}')
  TRANSFER=$(wg show wg0 | grep "transfer:" | awk '{print $2, $3, $5, $6}')
  echo "[$(date)] ✅ VPN OK | handshake: $HANDSHAKE | transfer: $TRANSFER" >> "$LOG"
else
  echo "[$(date)] ❌ VPN DOWN — restarting..." >> "$LOG"
  systemctl restart wg-quick@wg0 2>&1 >> "$LOG"
fi

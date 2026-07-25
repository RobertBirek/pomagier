#!/bin/bash
# PomagierGT — one-shot production setup
set -e

echo "=== PomagierGT Production Setup ==="
echo ""

# 1. Install system packages
echo "[1/6] Installing system packages..."
apt-get update -qq
apt-get install -y -qq avahi-daemon caddy

# 2. mDNS hostname
echo "[2/6] Configuring mDNS (pomagier.local)..."
hostnamectl set-hostname pomagier 2>/dev/null || true
systemctl enable --now avahi-daemon

# 3. mkcert CA + domain certificate
echo "[3/6] Generating HTTPS certificates..."
if ! command -v mkcert &>/dev/null; then
    curl -sLo /usr/local/bin/mkcert https://dl.filippo.io/mkcert/latest?for=linux/amd64
    chmod +x /usr/local/bin/mkcert
fi
mkcert -install
mkdir -p /root/certs && cd /root/certs
mkcert -cert-file pomagier.local.pem -key-file pomagier.local-key.pem pomagier.local localhost
# Copy certs to Caddy-accessible location
mkdir -p /etc/caddy/certs
cp /root/certs/pomagier.local.pem /root/certs/pomagier.local-key.pem /etc/caddy/certs/
chown -R caddy:caddy /etc/caddy/certs/
chmod 600 /etc/caddy/certs/*.pem

# 4. Caddy reverse proxy
echo "[4/6] Configuring Caddy reverse proxy..."
cat > /etc/caddy/Caddyfile << 'CADDYEOF'
pomagier.local, localhost {
    tls /etc/caddy/certs/pomagier.local.pem /etc/caddy/certs/pomagier.local-key.pem
    handle /api/* { reverse_proxy localhost:3000 }
    handle { reverse_proxy localhost:5173 }
}
:443 {
    tls /etc/caddy/certs/pomagier.local.pem /etc/caddy/certs/pomagier.local-key.pem
    handle /api/* { reverse_proxy localhost:3000 }
    handle { reverse_proxy localhost:5173 }
}
CADDYEOF
systemctl enable --now caddy

# 5. Systemd services for API + Vite
echo "[5/6] Installing systemd services..."
cat > /etc/systemd/system/pomagier-api.service << 'UNITEOF'
[Unit]
Description=PomagierGT API
After=network.target
[Service]
Type=simple
WorkingDirectory=/pomagier
ExecStart=/usr/bin/npx tsx src/api/server.ts
Restart=always
RestartSec=3
Environment=NODE_ENV=production
[Install]
WantedBy=multi-user.target
UNITEOF

cat > /etc/systemd/system/pomagier-vite.service << 'UNITEOF'
[Unit]
Description=PomagierGT Vite
After=network.target
[Service]
Type=simple
WorkingDirectory=/pomagier
ExecStart=/usr/bin/npx vite dev --host 0.0.0.0
Restart=always
RestartSec=3
[Install]
WantedBy=multi-user.target
UNITEOF

systemctl daemon-reload
systemctl enable --now pomagier-api pomagier-vite

# 6. Build frontend
echo "[6/6] Building frontend..."
cd /pomagier
npm run build 2>&1 | tail -3

echo ""
echo "=== Setup complete ==="
echo ""
echo "  App:  https://pomagier.local"
echo "  CA:   https://pomagier.local/api/ca  (install on devices)"
echo ""
echo "  Services:"
echo "    systemctl status pomagier-api"
echo "    systemctl status pomagier-vite"
echo "    systemctl status caddy"
echo "    systemctl status avahi-daemon"

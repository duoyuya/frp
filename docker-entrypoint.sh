#!/bin/sh
set -e

# Create FRP config if not exists
if [ ! -f /app/frp/frps.toml ]; then
  cat > /app/frp/frps.toml << EOF
bindPort = ${FRP_BIND_PORT:-7000}
auth.token = "${FRP_TOKEN:-change-this-token}"

webServer.addr = "0.0.0.0"
webServer.port = ${FRP_DASHBOARD_PORT:-7500}
webServer.user = "admin"
webServer.password = "${ADMIN_PASSWORD:-admin123456}"

log.to = "/app/frp/frps.log"
log.level = "info"
log.maxDays = 3

allowPorts = [
  { start = ${USER_PORT_MIN:-10000}, end = ${USER_PORT_MAX:-60000} }
]

transport.maxPoolCount = 5
transport.tcpMux = true
EOF
fi

# Start FRP server in background
echo "Starting FRP server..."
/usr/local/bin/frps -c /app/frp/frps.toml &

# Wait for FRP to start
sleep 2

# Start Node.js application
echo "Starting FRP Panel..."
exec "$@"

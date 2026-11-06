#!/bin/sh
# Generate a development self-signed TLS certificate at container startup.
#
# This keeps `docker compose up` working out of the box without any manual
# certificate provisioning. For production, mount a real certificate and key
# pair at /etc/nginx/certs/fullchain.pem and /etc/nginx/certs/privkey.pem and
# this script will detect them and skip generation.
set -eu

CERT_DIR=/etc/nginx/certs
CERT_FILE="$CERT_DIR/fullchain.pem"
KEY_FILE="$CERT_DIR/privkey.pem"

if [ -f "$CERT_FILE" ] && [ -f "$KEY_FILE" ]; then
    echo "TLS certificate already present in $CERT_DIR, skipping self-signed generation."
    exit 0
fi

mkdir -p "$CERT_DIR"

echo "No TLS certificate found in $CERT_DIR; generating a DEVELOPMENT self-signed certificate (valid 3650 days)."
echo "Do not use this certificate in production."

openssl req -x509 -nodes -newkey rsa:2048 -days 3650 \
    -keyout "$KEY_FILE" \
    -out "$CERT_FILE" \
    -subj "/CN=localhost" \
    -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"

chmod 600 "$KEY_FILE"

echo "Development self-signed certificate generated at $CERT_FILE (key: $KEY_FILE)."

#!/usr/bin/env bash
# Generates a locally-trusted HTTPS certificate for localhost + your LAN IP using mkcert.
# Afterwards, install the mkcert root CA on your phone (see README) for warning-free camera access.
set -euo pipefail
cd "$(dirname "$0")/.."

if ! command -v mkcert >/dev/null 2>&1; then
  if command -v brew >/dev/null 2>&1; then
    echo "Installing mkcert with Homebrew…"
    brew install mkcert
  else
    echo "Please install mkcert: https://github.com/FiloSottile/mkcert#installation" && exit 1
  fi
fi

mkcert -install
IP=$(ipconfig getifaddr en0 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}' || true)
mkdir -p certs
mkcert -cert-file certs/cert.pem -key-file certs/key.pem localhost 127.0.0.1 ::1 ${IP:+"$IP"}

CAROOT=$(mkcert -CAROOT)
echo ""
echo "✅ Certificate created for: localhost ${IP:-}"
echo "📱 Now install this root CA on your phone: $CAROOT/rootCA.pem"
echo "   (AirDrop/email it, then follow the README section 'Testing on your phone')."

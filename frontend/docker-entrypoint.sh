#!/bin/sh
# ============================================================
# Nginx entrypoint — substitutes DOMAIN_NAME into nginx.conf
# and starts Nginx.
# ============================================================
set -e

# Substitute environment variables in nginx config
envsubst '${DOMAIN_NAME}' < /etc/nginx/conf.d/default.conf > /tmp/nginx.conf
mv /tmp/nginx.conf /etc/nginx/conf.d/default.conf

# Start Nginx
exec nginx -g 'daemon off;'

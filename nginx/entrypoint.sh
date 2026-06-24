#!/bin/sh
# nginx entrypoint — substitute ${DOMAIN} placeholder and start nginx
set -e

if [ -z "${DOMAIN:-}" ]; then
    echo "ERROR: DOMAIN environment variable is not set."
    echo "Set it in .env or pass -e DOMAIN=yourstore.com to docker run."
    exit 1
fi

echo "Starting nginx for domain: ${DOMAIN}"

# Replace ${DOMAIN} in the config template
envsubst '${DOMAIN}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf

exec nginx -g "daemon off;"

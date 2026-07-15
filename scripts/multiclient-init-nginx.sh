#!/usr/bin/env bash
# multiclient-init-nginx.sh — One-time bootstrap of the SHARED nginx stack
# for running multiple CommerceForce clients on one VPS.
#
# Automates docs/multi-client-vps-setup.md Section 4.1/4.2/4.5: creates
# /opt/commerceforce/shared-nginx/, writes its (fixed, client-independent)
# docker-compose.yml, starts it, and installs the one-time renewal cron that
# covers every client's certificate.
#
# Run this ONCE per VPS, before the first scripts/multiclient-add-client.sh.
# Safe to re-run — detects an existing setup and skips re-creating it.
#
# Usage:
#   bash scripts/multiclient-init-nginx.sh [--shared-dir /opt/commerceforce/shared-nginx]
#     [--yes] [--test] [--dry-run]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/https-common.sh
source "${SCRIPT_DIR}/lib/https-common.sh"

SHARED_DIR="/opt/commerceforce/shared-nginx"
TEST_MODE=false
DRY_RUN=false
ASSUME_YES=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        --shared-dir) SHARED_DIR="$2"; shift 2 ;;
        --yes)        ASSUME_YES=true; shift ;;
        --test)       TEST_MODE=true; shift ;;
        --dry-run)    DRY_RUN=true; shift ;;
        -h|--help)    sed -n '2,17p' "$0"; exit 0 ;;
        *) die "Unknown argument: $1 (see --help)" ;;
    esac
done

COMPOSE_FILE="${SHARED_DIR}/docker-compose.yml"

# ── Step 1: directories ───────────────────────────────────────────────────────

step "1  Creating shared-nginx directories"
if [[ "$DRY_RUN" == "true" || "$TEST_MODE" == "true" ]]; then
    info "[dry-run/test] Would create: ${SHARED_DIR}/{conf.d,certbot-www,letsencrypt}"
else
    mkdir -p "${SHARED_DIR}/conf.d" "${SHARED_DIR}/certbot-www" "${SHARED_DIR}/letsencrypt"
    ok "Directories ready at ${SHARED_DIR}"
fi

# ── Step 2: write the static shared docker-compose.yml ───────────────────────

step "2  Writing shared nginx docker-compose.yml"
# This content never varies per client — see docs/multi-client-vps-setup.md
# Section 4.2. network_mode: host is what lets this nginx reach each client's
# loopback-bound ports (127.0.0.1:<port>, set up by multiclient-add-client.sh).
SHARED_COMPOSE_CONTENT='services:
  nginx:
    image: nginx:1.27-alpine
    network_mode: host
    volumes:
      - ./conf.d:/etc/nginx/conf.d:ro
      - ./letsencrypt:/etc/letsencrypt:ro
      - ./certbot-www:/var/www/certbot:ro
    restart: unless-stopped

  certbot:
    image: certbot/certbot
    volumes:
      - ./letsencrypt:/etc/letsencrypt
      - ./certbot-www:/var/www/certbot
'
# No entrypoint/command override on the certbot service, on purpose —
# "docker compose run --rm certbot <args>" (e.g. renew, or certonly --webroot)
# then runs certbot's own image entrypoint directly with your args. A fixed
# custom entrypoint (e.g. a sleep loop) would silently swallow run's
# arguments instead of executing them. docker compose up leaving this
# container exited (code 0) between manual/cron run invocations is
# expected, not a bug.

if [[ -f "$COMPOSE_FILE" ]]; then
    info "docker-compose.yml already exists at ${COMPOSE_FILE} — leaving it untouched"
elif [[ "$DRY_RUN" == "true" || "$TEST_MODE" == "true" ]]; then
    info "[dry-run/test] Would write ${COMPOSE_FILE}"
else
    printf '%s' "$SHARED_COMPOSE_CONTENT" > "$COMPOSE_FILE"
    ok "Wrote ${COMPOSE_FILE}"
fi

# ── Step 3: start the shared nginx ────────────────────────────────────────────

step "3  Starting shared nginx"
if [[ "$DRY_RUN" == "true" || "$TEST_MODE" == "true" ]]; then
    info "[dry-run/test] Would run: docker compose -f ${COMPOSE_FILE} up -d"
else
    command -v docker >/dev/null 2>&1 || die "docker not found."
    (cd "$SHARED_DIR" && docker compose up -d) \
        || die "Failed to start shared nginx — check: docker compose -f ${COMPOSE_FILE} logs"
    ok "Shared nginx running (no client configs yet — that's expected until the first add-client run)"
fi

# ── Step 4: renewal cron (covers every client) ───────────────────────────────

step "4  Installing renewal cron"
# One cron entry is enough for every client: `certbot renew` walks every
# lineage under /etc/letsencrypt/live/ regardless of how many were added.
CRON_FINGERPRINT="${COMPOSE_FILE} run --rm certbot renew"
CRON_LINE="0 3 * * 1 ( docker compose -f ${COMPOSE_FILE} run --rm certbot renew --quiet && docker compose -f ${COMPOSE_FILE} exec nginx nginx -s reload ) >> /var/log/certbot-renew.log 2>&1"
if [[ "$DRY_RUN" == "true" || "$TEST_MODE" == "true" ]]; then
    info "[dry-run/test] Would ensure crontab contains: ${CRON_LINE}"
else
    cron_add_idempotent "$CRON_FINGERPRINT" "$CRON_LINE"
fi

# ── Summary ────────────────────────────────────────────────────────────────────

step "Done"
echo ""
echo -e "${GREEN}${BOLD}Shared nginx initialized at ${SHARED_DIR}${RESET}"
echo ""
echo -e "  Next: for each client, run scripts/multiclient-add-client.sh"
echo -e "  (see docs/multi-client-vps-setup.md for the full model)"
echo ""
if [[ "$DRY_RUN" == "true" ]]; then
    warn "This was a DRY RUN — no changes were made."
fi
exit 0

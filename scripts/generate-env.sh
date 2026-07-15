#!/usr/bin/env bash
# generate-env.sh — Interactive generator for CommerceForce .env files.
# Writes:  .env (root)         — SERVER_IP used by docker-compose
#          backend/.env        — all secrets and per-client config
#
# Usage:
#   bash scripts/generate-env.sh             # interactive mode
#   bash scripts/generate-env.sh --test      # non-interactive (CI / testing)
#   bash scripts/generate-env.sh --domain myshop.com --server-ip 1.2.3.4  # partial overrides
#   bash scripts/generate-env.sh --domain clientb.com --server-ip 1.2.3.4 \
#     --backend-port 8001 --storefront-port 3002 --admin-port 3003  # multi-client on one VPS

set -euo pipefail

# ── Helpers ──────────────────────────────────────────────────────────────────

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; RESET='\033[0m'

ask() {
    local prompt="$1" default="$2" var_name="$3"
    if [[ "${TEST_MODE:-false}" == "true" ]]; then
        eval "$var_name=\"$default\""
        return
    fi
    printf "${CYAN}%s${RESET} [%s]: " "$prompt" "$default"
    read -r input
    eval "$var_name=\"${input:-$default}\""
}

ask_secret() {
    local prompt="$1" default="$2" var_name="$3"
    if [[ "${TEST_MODE:-false}" == "true" ]]; then
        eval "$var_name=\"$default\""
        return
    fi
    printf "${CYAN}%s${RESET} [press Enter to leave blank]: " "$prompt"
    read -rs input
    echo
    eval "$var_name=\"${input:-$default}\""
}

gen_secret_key() {
    if command -v openssl &>/dev/null; then
        openssl rand -hex 32
    elif command -v python3 &>/dev/null; then
        python3 -c "import secrets; print(secrets.token_hex(32))"
    else
        # Fallback: timestamp + random-ish string
        echo "$(date +%s%N | sha256sum | head -c 64)" 2>/dev/null || echo "CHANGE_ME_$(date +%s)"
    fi
}

check_placeholder() {
    if grep -q "YOUR\.\|CHANGE_ME\|your-key-here\|your@gmail" "${1:-/dev/null}" 2>/dev/null; then
        echo -e "${YELLOW}Warning: some placeholder values remain in $1${RESET}"
        return 1
    fi
    return 0
}

# ── Parse args ────────────────────────────────────────────────────────────────

TEST_MODE=false
OVERRIDE_DOMAIN=""
OVERRIDE_IP=""
OVERRIDE_BACKEND_PORT=""
OVERRIDE_STOREFRONT_PORT=""
OVERRIDE_ADMIN_PORT=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --test)             TEST_MODE=true; shift ;;
        --domain)           OVERRIDE_DOMAIN="$2"; shift 2 ;;
        --server-ip)        OVERRIDE_IP="$2"; shift 2 ;;
        --backend-port)     OVERRIDE_BACKEND_PORT="$2"; shift 2 ;;
        --storefront-port)  OVERRIDE_STOREFRONT_PORT="$2"; shift 2 ;;
        --admin-port)       OVERRIDE_ADMIN_PORT="$2"; shift 2 ;;
        *)              echo "Unknown arg: $1"; exit 1 ;;
    esac
done

# ── Resolve script location (always write relative to project root) ───────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# ── Banner ────────────────────────────────────────────────────────────────────

if [[ "$TEST_MODE" == "false" ]]; then
    echo
    echo -e "${GREEN}CommerceForce — Environment Setup${RESET}"
    echo "This script generates the .env files needed to run the platform."
    echo "Press Enter to accept the [default] for each value."
    echo "Sensitive fields (passwords, API keys) are hidden as you type."
    echo
fi

# ── Collect values ────────────────────────────────────────────────────────────

# Infrastructure
if [[ -n "$OVERRIDE_IP" ]]; then SERVER_IP="$OVERRIDE_IP"
else ask "Server IP address" "YOUR.SERVER.IP.HERE" SERVER_IP; fi

if [[ -n "$OVERRIDE_DOMAIN" ]]; then DOMAIN="$OVERRIDE_DOMAIN"
else ask "Domain name (e.g. myshop.com, or leave as IP)" "$SERVER_IP" DOMAIN; fi

# Ports (only matters when running more than one client on the same VPS —
# see docs/multi-client-vps-setup.md. First client on a box: just accept the defaults.)
if [[ -n "$OVERRIDE_BACKEND_PORT" ]]; then BACKEND_PORT="$OVERRIDE_BACKEND_PORT"
else ask "Backend host port" "8000" BACKEND_PORT; fi

if [[ -n "$OVERRIDE_STOREFRONT_PORT" ]]; then STOREFRONT_PORT="$OVERRIDE_STOREFRONT_PORT"
else ask "Storefront host port" "3000" STOREFRONT_PORT; fi

if [[ -n "$OVERRIDE_ADMIN_PORT" ]]; then ADMIN_PORT="$OVERRIDE_ADMIN_PORT"
else ask "Admin panel host port" "3001" ADMIN_PORT; fi

# Client identity
ask "Store name" "My CommerceForce Store" STORE_NAME
ask "Store tagline" "Quality products, fast delivery" STORE_TAGLINE
ask "Admin email (store owner login)" "admin@${DOMAIN:-example.com}" ADMIN_EMAIL
ask_secret "Admin temporary password (store owner)" "ChangeMe123!" ADMIN_TEMP_PASSWORD
ask "Contact / notification email" "info@${DOMAIN:-example.com}" CONTACT_EMAIL

# Agency superadmin (same across all clients)
ask "Superadmin email (your agency account)" "superadmin@youragency.com" SUPERADMIN_EMAIL
ask_secret "Superadmin password" "SuperSecureAgency123!" SUPERADMIN_PASSWORD

# SMTP
ask "SMTP host" "smtp.gmail.com" SMTP_HOST
ask "SMTP port" "587" SMTP_PORT
ask "SMTP username (your sending email)" "${ADMIN_EMAIL}" SMTP_USER
ask_secret "SMTP password / app password" "" SMTP_PASSWORD
ask "SMTP From address" "${SMTP_USER}" SMTP_FROM

# Stripe (optional)
ask_secret "Stripe secret key (sk_live_... or leave blank for cash-only)" "" STRIPE_SECRET_KEY
ask_secret "Stripe webhook secret (whsec_... or leave blank)" "" STRIPE_WEBHOOK_SECRET

# AI (optional)
ask_secret "OpenRouter API key (for AI Chat, or leave blank to disable)" "" OPENROUTER_API_KEY

# Plugins
DEFAULT_PLUGINS="auth,categories,products,cart,orders,checkout,coupons,loyalty,newsletter,branding,landing_page,ai_chat,rfq,credit,inventory,contact,addresses,wishlist,reviews,discount_rules"
ask "Enabled plugins (comma-separated)" "$DEFAULT_PLUGINS" ENABLED_PLUGINS

# Auto-generate secret key
SECRET_KEY="$(gen_secret_key)"
if [[ "$TEST_MODE" == "false" ]]; then
    echo
    echo -e "${YELLOW}Generated SECRET_KEY:${RESET} ${SECRET_KEY}"
    echo "(Keep this secret — it signs all JWT tokens)"
fi

# ── Compute public URLs (domain if one was given, IP:port otherwise) ──────────
#
# A "real" domain was given if DOMAIN differs from SERVER_IP (the default when
# left blank). This decides whether the frontends are built to call the site
# over HTTPS-by-domain (routed through nginx, Section 11) or HTTP-by-IP:port
# directly (no nginx yet / testing). Getting this wrong is what silently broke
# API calls on every HTTPS deployment before — see docs/new-client-setup.md
# Section 11.6.
if [[ "$DOMAIN" != "$SERVER_IP" ]]; then
    NEXT_PUBLIC_API_URL_STOREFRONT="https://${DOMAIN}"
    NEXT_PUBLIC_API_URL_ADMIN="https://admin.${DOMAIN}"
    NEXT_PUBLIC_STOREFRONT_URL="https://${DOMAIN}"
    CORS_ORIGINS_VALUE="https://${DOMAIN},https://admin.${DOMAIN},http://${SERVER_IP}:${STOREFRONT_PORT},http://${SERVER_IP}:${ADMIN_PORT}"
else
    NEXT_PUBLIC_API_URL_STOREFRONT="http://${SERVER_IP}:${BACKEND_PORT}"
    NEXT_PUBLIC_API_URL_ADMIN="http://${SERVER_IP}:${BACKEND_PORT}"
    NEXT_PUBLIC_STOREFRONT_URL="http://${SERVER_IP}:${STOREFRONT_PORT}"
    CORS_ORIGINS_VALUE="http://${SERVER_IP}:${STOREFRONT_PORT},http://${SERVER_IP}:${ADMIN_PORT}"
fi

# ── Write root .env ───────────────────────────────────────────────────────────

ROOT_ENV="${PROJECT_ROOT}/.env"
cat > "$ROOT_ENV" <<EOF
SERVER_IP=${SERVER_IP}
DOMAIN=${DOMAIN}
BACKEND_PORT=${BACKEND_PORT}
STOREFRONT_PORT=${STOREFRONT_PORT}
ADMIN_PORT=${ADMIN_PORT}
STOREFRONT_URL=https://${DOMAIN}
NEXT_PUBLIC_API_URL_STOREFRONT=${NEXT_PUBLIC_API_URL_STOREFRONT}
NEXT_PUBLIC_API_URL_ADMIN=${NEXT_PUBLIC_API_URL_ADMIN}
NEXT_PUBLIC_STOREFRONT_URL=${NEXT_PUBLIC_STOREFRONT_URL}
EOF
echo -e "${GREEN}✓${RESET} Written: ${ROOT_ENV}"

# ── Write backend/.env ────────────────────────────────────────────────────────

BACKEND_ENV="${PROJECT_ROOT}/backend/.env"
cat > "$BACKEND_ENV" <<EOF
# ── Security ──────────────────────────────────────────────────────────────────
SECRET_KEY=${SECRET_KEY}
ENVIRONMENT=production

# ── Database ──────────────────────────────────────────────────────────────────
DATABASE_URL=sqlite+aiosqlite:///./commerceforce.db

# ── Plugins ───────────────────────────────────────────────────────────────────
ENABLED_PLUGINS=${ENABLED_PLUGINS}

# ── Tokens ────────────────────────────────────────────────────────────────────
ACCESS_TOKEN_EXPIRE_MINUTES=60
REFRESH_TOKEN_EXPIRE_DAYS=7

# ── Redis (not used in SQLite mode) ───────────────────────────────────────────
REDIS_URL=redis://localhost:6379/0

# ── CORS ──────────────────────────────────────────────────────────────────────
CORS_ORIGINS=${CORS_ORIGINS_VALUE}

# ── Storefront / Admin URLs (used in email links) ─────────────────────────────
STOREFRONT_URL=https://${DOMAIN}
ADMIN_URL=https://admin.${DOMAIN}

# ── Email / SMTP ──────────────────────────────────────────────────────────────
SMTP_HOST=${SMTP_HOST}
SMTP_PORT=${SMTP_PORT}
SMTP_USER=${SMTP_USER}
SMTP_PASSWORD=${SMTP_PASSWORD}
SMTP_FROM=${SMTP_FROM}
SMTP_TLS=true

# ── AI Chat ───────────────────────────────────────────────────────────────────
OPENROUTER_API_KEY=${OPENROUTER_API_KEY}
OPENROUTER_MODEL=anthropic/claude-haiku-4.5

# ── Payments ──────────────────────────────────────────────────────────────────
STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY}
STRIPE_WEBHOOK_SECRET=${STRIPE_WEBHOOK_SECRET}

# ── Agency superadmin ─────────────────────────────────────────────────────────
SUPERADMIN_EMAIL=${SUPERADMIN_EMAIL}
SUPERADMIN_PASSWORD=${SUPERADMIN_PASSWORD}

# ── Client identity ───────────────────────────────────────────────────────────
ADMIN_EMAIL=${ADMIN_EMAIL}
ADMIN_TEMP_PASSWORD=${ADMIN_TEMP_PASSWORD}
STORE_NAME=${STORE_NAME}
STORE_TAGLINE=${STORE_TAGLINE}
CONTACT_EMAIL=${CONTACT_EMAIL}
EOF
echo -e "${GREEN}✓${RESET} Written: ${BACKEND_ENV}"

# ── Verify ────────────────────────────────────────────────────────────────────

if [[ "$TEST_MODE" == "true" ]]; then
    # In test mode, verify required keys are present
    MISSING=0
    for key in SECRET_KEY DATABASE_URL ENABLED_PLUGINS SMTP_HOST; do
        if ! grep -q "^${key}=" "$BACKEND_ENV"; then
            echo "MISSING key in backend/.env: $key"
            MISSING=1
        fi
    done
    if ! grep -q "^SERVER_IP=" "$ROOT_ENV"; then
        echo "MISSING key in .env: SERVER_IP"
        MISSING=1
    fi
    if [[ $MISSING -eq 1 ]]; then exit 1; fi
    echo "Test mode: both .env files verified OK"
else
    echo
    echo -e "${GREEN}Done!${RESET} Both .env files written."
    echo "Next steps:"
    echo "  1. Review:  cat backend/.env"
    echo "  2. Build:   docker compose up --build -d"
    echo "  3. Migrate: docker compose exec backend alembic upgrade head"
    echo "  4. Seed:    docker compose exec backend python seed.py"
    echo
fi

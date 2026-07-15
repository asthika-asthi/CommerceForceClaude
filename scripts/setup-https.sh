#!/usr/bin/env bash
# setup-https.sh — Automates docs/new-client-setup.md Section 11 for a
# SINGLE-CLIENT deployment: DNS preflight, certbot cert issuance, enabling
# the bundled nginx/certbot services in docker-compose.yml, verification,
# and renewal cron.
#
# Run this ON THE VPS, inside the deployed project directory (same style as
# scripts/generate-env.sh — not SSH-wrapped like scripts/deploy-client.sh).
#
# Refuses to run on a multi-client VPS (see docs/multi-client-vps-setup.md) —
# use scripts/multiclient-init-nginx.sh / scripts/multiclient-add-client.sh
# for that case instead.
#
# Usage:
#   bash scripts/setup-https.sh [--domain d] [--email e] [--server-ip ip]
#     [--yes] [--test] [--staging] [--skip-dns-check] [--force-single-client]
#     [--dry-run]
#
# Defaults for --domain/--email/--server-ip are read from the project's
# .env / backend/.env if not passed explicitly.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
# shellcheck source=lib/https-common.sh
source "${SCRIPT_DIR}/lib/https-common.sh"

# ── Argument parsing ──────────────────────────────────────────────────────────

DOMAIN=""
EMAIL=""
SERVER_IP=""
ASSUME_YES=false
TEST_MODE=false
STAGING=false
SKIP_DNS=false
FORCE_SINGLE=false
DRY_RUN=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        --domain)               DOMAIN="$2"; shift 2 ;;
        --email)                EMAIL="$2"; shift 2 ;;
        --server-ip)            SERVER_IP="$2"; shift 2 ;;
        --yes)                  ASSUME_YES=true; shift ;;
        --test)                 TEST_MODE=true; shift ;;
        --staging)               STAGING=true; shift ;;
        --skip-dns-check)       SKIP_DNS=true; shift ;;
        --force-single-client)  FORCE_SINGLE=true; shift ;;
        --dry-run)              DRY_RUN=true; shift ;;
        -h|--help)
            sed -n '2,20p' "$0"; exit 0 ;;
        *) die "Unknown argument: $1 (see --help)" ;;
    esac
done

STAGING_FLAG=""
[[ "$STAGING" == "true" ]] && STAGING_FLAG="--staging"

ROOT_ENV="${PROJECT_ROOT}/.env"
BACKEND_ENV="${PROJECT_ROOT}/backend/.env"
COMPOSE_FILE="${PROJECT_ROOT}/docker-compose.yml"

# ── Step 1: multi-client guard ────────────────────────────────────────────────

step "1  Multi-client safety check"
if [[ "$FORCE_SINGLE" != "true" ]]; then
    if [[ -d "${PROJECT_ROOT}/../shared-nginx" ]]; then
        die "A sibling 'shared-nginx' directory exists next to this project — this looks
     like a multi-client VPS (docs/multi-client-vps-setup.md). Use
     scripts/multiclient-add-client.sh instead. Pass --force-single-client to override."
    fi
    if grep -qE '^\s*-\s*"127\.0\.0\.1:' "$COMPOSE_FILE" 2>/dev/null; then
        die "docker-compose.yml already binds ports to 127.0.0.1 — that's the
     multi-client pattern (docs/multi-client-vps-setup.md Section 3.3). Use
     scripts/multiclient-add-client.sh instead. Pass --force-single-client to override."
    fi
fi
ok "Single-client checks passed"

# ── Step 2: load configuration ────────────────────────────────────────────────

step "2  Load configuration"
[[ -f "$ROOT_ENV" ]]    || die "Root .env not found at ${ROOT_ENV} — run scripts/generate-env.sh first."
[[ -f "$BACKEND_ENV" ]] || die "backend/.env not found — run scripts/generate-env.sh first."

[[ -z "$DOMAIN" ]]     && DOMAIN="$(env_get "$ROOT_ENV" DOMAIN)"
[[ -z "$SERVER_IP" ]]  && SERVER_IP="$(env_get "$ROOT_ENV" SERVER_IP)"
[[ -z "$EMAIL" ]]      && EMAIL="$(env_get "$BACKEND_ENV" ADMIN_EMAIL)"
[[ -z "$EMAIL" ]]      && EMAIL="$(env_get "$BACKEND_ENV" CONTACT_EMAIL)"

if [[ -z "$SERVER_IP" ]]; then
    info "SERVER_IP not set — auto-detecting public IP…"
    SERVER_IP="$(curl -s --max-time 5 https://api.ipify.org || true)"
    [[ -n "$SERVER_IP" ]] || die "Could not auto-detect SERVER_IP. Pass --server-ip explicitly."
fi

[[ -n "$DOMAIN" ]] || die "No domain configured. Pass --domain, or re-run scripts/generate-env.sh with a real domain (not the IP)."
[[ "$DOMAIN" != "$SERVER_IP" ]] || die "DOMAIN is the same as SERVER_IP (${SERVER_IP}) — this script is for real-domain HTTPS. Re-run scripts/generate-env.sh with your actual domain first."
[[ -n "$EMAIL" ]] || die "No email available for certbot registration. Pass --email."

ok "Domain: ${DOMAIN}   Server IP: ${SERVER_IP}   Cert email: ${EMAIL}"

# ── Step 3: local preflight ───────────────────────────────────────────────────

step "3  Local preflight"
if command -v docker >/dev/null 2>&1; then
    :
elif [[ "$TEST_MODE" == "true" ]]; then
    warn "docker not found — continuing anyway ([test mode] never calls it)"
else
    die "docker not found."
fi
command -v dig >/dev/null 2>&1 || command -v nslookup >/dev/null 2>&1 \
    || warn "Neither 'dig' nor 'nslookup' found — DNS preflight may be unreliable (apt-get install -y dnsutils)."
ok "Local preflight passed"

# ── Step 4: DNS preflight ─────────────────────────────────────────────────────

if [[ "$SKIP_DNS" == "true" ]]; then
    warn "Skipping DNS preflight (--skip-dns-check)"
elif [[ "$TEST_MODE" == "true" ]]; then
    info "[test mode] Skipping real DNS lookups"
else
    step "4  DNS preflight"
    dns_preflight "$DOMAIN" "$SERVER_IP"
fi

# ── Step 5: backend/.env drift check ─────────────────────────────────────────

step "5  Checking backend/.env for domain drift"
EXPECTED_STOREFRONT="https://${DOMAIN}"
EXPECTED_ADMIN="https://admin.${DOMAIN}"
CURRENT_STOREFRONT="$(env_get "$BACKEND_ENV" STOREFRONT_URL)"
CURRENT_ADMIN="$(env_get "$BACKEND_ENV" ADMIN_URL)"
CURRENT_CORS="$(env_get "$BACKEND_ENV" CORS_ORIGINS)"
CURRENT_COOKIE="$(env_get "$BACKEND_ENV" COOKIE_SECURE)"

NEEDS_FIX=false
[[ "$CURRENT_STOREFRONT" != "$EXPECTED_STOREFRONT" ]] && NEEDS_FIX=true
[[ "$CURRENT_ADMIN" != "$EXPECTED_ADMIN" ]] && NEEDS_FIX=true
[[ "$CURRENT_COOKIE" != "true" ]] && NEEDS_FIX=true
case "$CURRENT_CORS" in
    *"$EXPECTED_STOREFRONT"*"$EXPECTED_ADMIN"*) ;;
    *) NEEDS_FIX=true ;;
esac

if [[ "$NEEDS_FIX" == "true" ]]; then
    warn "backend/.env doesn't fully match the HTTPS domain yet (STOREFRONT_URL/ADMIN_URL/CORS_ORIGINS/COOKIE_SECURE)."
    APPLY=true
    if [[ "$ASSUME_YES" != "true" && "$DRY_RUN" != "true" && "$TEST_MODE" != "true" ]]; then
        read -rp "Fix these now? [Y/n] " ans
        [[ "$ans" =~ ^[Nn] ]] && APPLY=false
    fi
    if [[ "$APPLY" == "true" && "$DRY_RUN" != "true" && "$TEST_MODE" != "true" ]]; then
        set_env_key "$BACKEND_ENV" STOREFRONT_URL "$EXPECTED_STOREFRONT"
        set_env_key "$BACKEND_ENV" ADMIN_URL "$EXPECTED_ADMIN"
        set_env_key "$BACKEND_ENV" CORS_ORIGINS "${EXPECTED_STOREFRONT},${EXPECTED_ADMIN}"
        set_env_key "$BACKEND_ENV" COOKIE_SECURE "true"
        ok "backend/.env updated"
    elif [[ "$DRY_RUN" == "true" || "$TEST_MODE" == "true" ]]; then
        info "[dry-run/test] Would set STOREFRONT_URL/ADMIN_URL/CORS_ORIGINS/COOKIE_SECURE"
    else
        warn "Skipping backend/.env fix — you'll need to do this manually before HTTPS works end-to-end."
    fi
else
    ok "backend/.env already matches the HTTPS domain"
fi

CURRENT_FE_STOREFRONT="$(env_get "$ROOT_ENV" NEXT_PUBLIC_API_URL_STOREFRONT)"
if [[ "$CURRENT_FE_STOREFRONT" != "$EXPECTED_STOREFRONT" ]]; then
    warn "Root .env's NEXT_PUBLIC_API_URL_* still look IP-based, not domain-based.
     These are baked into the frontend at BUILD time. If the storefront/admin
     still call the IP after this script finishes, re-run scripts/generate-env.sh
     with the domain, then: docker compose build frontend-starter frontend-admin
     && docker compose up -d --force-recreate frontend-starter frontend-admin"
fi

# ── Step 6: uncomment nginx/certbot in docker-compose.yml ────────────────────
#
# This runs BEFORE cert issuance (not after) for a specific reason: cert
# issuance below uses `docker compose run` (not bare `docker run`) so its
# named volumes resolve to the *same* project-prefixed volumes (e.g.
# `commerceforceclaude_cf_letsencrypt`) that `docker compose up` mounts into
# nginx. `docker compose run` needs the `certbot` service to already be
# defined in the file, which means it has to be uncommented first. Using
# bare `docker run -v cf_letsencrypt:...` here would silently write the cert
# into an unrelated, unprefixed volume that nginx never sees — a real bug
# this ordering exists to avoid.

enable_nginx_compose_block() {
    local compose_file="$1"
    local tmp="${compose_file}.tmp.$$"
    cp "$compose_file" "$tmp"

    if ! grep -qE '^  nginx:' "$tmp"; then
        # POSIX-awk-compatible (no gensub/bracket-classes) — Ubuntu's default
        # /usr/bin/awk is mawk, which doesn't have gawk's gensub() extension.
        awk '
            /^  # nginx:$/ { on=1 }
            on && /^  #$/ { print ""; next }
            on && /entrypoint: \/bin\/sh/ {
                line=$0; sub(/^  # ?/, "  ", line); print line; on=0; next
            }
            on { line=$0; sub(/^  # ?/, "  ", line); print line; next }
            { print }
        ' "$tmp" > "${tmp}.awk" && mv "${tmp}.awk" "$tmp"
    fi

    if ! grep -qE '^  cf_letsencrypt:' "$tmp"; then
        sed -i -E 's/^  # cf_letsencrypt:/  cf_letsencrypt:/' "$tmp"
        sed -i -E 's/^  # cf_certbot_www:/  cf_certbot_www:/' "$tmp"
    fi

    if diff -q "$compose_file" "$tmp" >/dev/null 2>&1; then
        info "docker-compose.yml already fully enabled — nothing to change"
        rm -f "$tmp"
        return 0
    fi

    if [[ "$DRY_RUN" == "true" ]]; then
        info "[dry-run] Would apply this diff to docker-compose.yml:"
        diff -u "$compose_file" "$tmp" || true
        rm -f "$tmp"
        return 0
    fi

    local errfile="${compose_file}.validate-err.$$"
    if ! docker compose -f "$tmp" config -q 2>"$errfile"; then
        local err
        err="$(cat "$errfile" 2>/dev/null)" || true
        rm -f "$tmp" "$errfile"
        die "The nginx/certbot edit produced an invalid docker-compose.yml — aborted, original file untouched.
${err}"
    fi
    rm -f "$errfile"

    cp "$compose_file" "${compose_file}.bak"
    mv "$tmp" "$compose_file"
    ok "Uncommented nginx/certbot service + volumes (backup: ${compose_file}.bak)"
}

step "6  Enabling nginx/certbot in docker-compose.yml"
if [[ "$TEST_MODE" == "true" ]]; then
    info "[test mode] Skipping docker-compose.yml edit"
else
    enable_nginx_compose_block "$COMPOSE_FILE"
fi

# ── Step 7: issue certificate ─────────────────────────────────────────────────
#
# Uses `docker compose run` (not bare `docker run`) so `cf_letsencrypt` /
# `cf_certbot_www` resolve to the same project-prefixed volumes `docker
# compose up` (step 8) mounts into nginx — see the note on step 6 above.

step "7  Issue SSL certificate"
if [[ "$TEST_MODE" == "true" || "$DRY_RUN" == "true" ]]; then
    info "[dry-run/test] Would run: docker compose run --rm -p 80:80 certbot certonly --standalone -d ${DOMAIN} -d admin.${DOMAIN} --email ${EMAIL} --agree-tos --no-eff-email --non-interactive --keep-until-expiring ${STAGING_FLAG}"
else
    ALREADY_ISSUED=false
    if (cd "$PROJECT_ROOT" && docker compose run --rm certbot certificates 2>/dev/null) | grep -q "$DOMAIN"; then
        ALREADY_ISSUED=true
    fi
    if [[ "$ALREADY_ISSUED" == "true" ]]; then
        info "Certificate for ${DOMAIN} already exists — skipping issuance."
    else
        (cd "$PROJECT_ROOT" && docker compose stop nginx 2>/dev/null) || true
        # shellcheck disable=SC2086
        (cd "$PROJECT_ROOT" && docker compose run --rm -p 80:80 certbot certonly --standalone \
            -d "$DOMAIN" -d "admin.$DOMAIN" \
            --email "$EMAIL" --agree-tos --no-eff-email \
            --non-interactive --keep-until-expiring $STAGING_FLAG) \
            || die "Certificate issuance failed. Common causes: DNS not fully propagated yet, or port 80 blocked (ufw allow 80)."
        ok "Certificate issued"
    fi
fi

# ── Step 8: build/start ───────────────────────────────────────────────────────

step "8  Build and start containers"
if [[ "$DRY_RUN" == "true" || "$TEST_MODE" == "true" ]]; then
    info "[dry-run/test] Would run: docker compose up --build -d, then restart nginx"
else
    (cd "$PROJECT_ROOT" && docker compose up --build -d) \
        || die "docker compose up --build -d failed — check: docker compose logs"
    ok "Containers up"

    # nginx resolves its upstream (backend/frontend) hostnames to IPs once, at
    # its own startup. Since backend/frontend just got recreated above (new
    # container IPs) while nginx's own image is unchanged — so `up` doesn't
    # restart it — nginx would otherwise keep proxying to the old IPs and
    # every request would 502 with "Connection refused" until something
    # restarts it. Restart it explicitly so it re-resolves.
    (cd "$PROJECT_ROOT" && docker compose restart nginx) \
        || die "Failed to restart nginx after rebuild — check: docker compose logs nginx"
    ok "nginx restarted (re-resolved upstream IPs)"
fi

# ── Step 9: switch renewal authenticator to webroot ──────────────────────────

step "9  Switching cert renewal to webroot mode"
# Issuance (step 7) must use --standalone, since nginx can't start without a
# cert that doesn't exist yet. But the renewal cron (step 11) just runs
# `certbot renew`, which replays whichever authenticator was last used —
# standalone would need port 80 free, which the now-running nginx occupies.
# Re-issuing once via --webroot switches the saved renewal config so future
# `certbot renew` calls work without stopping nginx.
if [[ "$DRY_RUN" == "true" || "$TEST_MODE" == "true" ]]; then
    info "[dry-run/test] Would re-issue via --webroot to switch the renewal authenticator"
else
    sleep 5   # give nginx a moment to come up
    # shellcheck disable=SC2086
    if (cd "$PROJECT_ROOT" && docker compose run --rm certbot certonly --webroot -w /var/www/certbot \
        -d "$DOMAIN" -d "admin.$DOMAIN" --cert-name "$DOMAIN" \
        --email "$EMAIL" --agree-tos --no-eff-email \
        --non-interactive --force-renewal $STAGING_FLAG); then
        # nginx only reads certificate files at its own startup/reload — it has
        # no idea the files on disk just changed. Without this, nginx keeps
        # serving whatever cert (e.g. a stale --staging one) it loaded last,
        # regardless of what certbot just wrote.
        (cd "$PROJECT_ROOT" && docker compose exec nginx nginx -s reload) \
            || warn "Cert renewed but nginx reload failed — restart nginx manually: docker compose restart nginx"
    else
        warn "Could not switch renewal to webroot mode. Renewal will still work, but the cron may need port 80 freed manually. Not fatal right now."
    fi
fi

# ── Step 10: verification ─────────────────────────────────────────────────────

step "10  Verifying HTTPS"
VERIFY_CURL_ARGS=""
[[ "$STAGING" == "true" ]] && VERIFY_CURL_ARGS="-k"
if [[ "$DRY_RUN" == "true" || "$TEST_MODE" == "true" ]]; then
    info "[dry-run/test] Would verify http://${DOMAIN} (301), https://${DOMAIN} (200), https://admin.${DOMAIN} (200)"
else
    [[ "$STAGING" == "true" ]] && info "Using curl -k for verification — expected with --staging (the cert is deliberately untrusted)"
    check_url "http://${DOMAIN}" 301 12 10 ""                    || warn "HTTP redirect check failed — see: docker compose logs nginx"
    check_url "https://${DOMAIN}" 200 12 10 "$VERIFY_CURL_ARGS"       || warn "HTTPS storefront check failed — see: docker compose logs nginx"
    check_url "https://admin.${DOMAIN}" 200 12 10 "$VERIFY_CURL_ARGS" || warn "HTTPS admin check failed — see: docker compose logs nginx"
fi

# ── Step 11: renewal cron ─────────────────────────────────────────────────────

step "11  Installing renewal cron"
CRON_FINGERPRINT="${PROJECT_ROOT}/docker-compose.yml run --rm certbot renew"
CRON_LINE="0 3 * * 1 ( docker compose -f ${PROJECT_ROOT}/docker-compose.yml run --rm certbot renew --quiet && docker compose -f ${PROJECT_ROOT}/docker-compose.yml exec nginx nginx -s reload ) >> /var/log/certbot-renew.log 2>&1"
if [[ "$DRY_RUN" == "true" || "$TEST_MODE" == "true" ]]; then
    info "[dry-run/test] Would ensure crontab contains: ${CRON_LINE}"
else
    cron_add_idempotent "$CRON_FINGERPRINT" "$CRON_LINE"
fi

# ── Summary ────────────────────────────────────────────────────────────────────

step "Done"
echo ""
echo -e "${GREEN}${BOLD}HTTPS setup complete for ${DOMAIN}${RESET}"
echo ""
echo -e "  Storefront:  https://${DOMAIN}"
echo -e "  Admin panel: https://admin.${DOMAIN}"
echo -e "  Renewal:     weekly via cron; test any time with:"
echo -e "    docker compose -f ${PROJECT_ROOT}/docker-compose.yml run --rm certbot renew --dry-run"
echo ""
if [[ "$DRY_RUN" == "true" ]]; then
    warn "This was a DRY RUN — no changes were made."
fi
exit 0

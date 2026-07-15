#!/usr/bin/env bash
# multiclient-add-client.sh — Add one client to a multi-client VPS that
# already has the shared nginx set up (scripts/multiclient-init-nginx.sh).
#
# Automates docs/multi-client-vps-setup.md Sections 3 and 4 for a single
# client: clone/generate-env with distinct ports, bind those ports to
# 127.0.0.1, build/migrate/seed, bootstrap + issue its certificate via the
# shared nginx's webroot, write its full HTTPS server block, and reload.
#
# Run this ON THE VPS (not SSH-wrapped). Re-running for the same --client is
# safe (idempotent) and is how you'd pick up a config change later.
#
# Usage:
#   bash scripts/multiclient-add-client.sh \
#     --client acme --domain clienta.com --server-ip 1.2.3.4 \
#     --backend-port 8000 --storefront-port 3000 --admin-port 3001 \
#     --admin-email owner@acme.com --store-name "Acme Store" \
#     --email you@youragency.com \
#     [--repo-url https://...] [--shared-dir /opt/commerceforce/shared-nginx] \
#     [--yes] [--test] [--dry-run] [--staging] [--skip-dns-check]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
# shellcheck source=lib/https-common.sh
source "${SCRIPT_DIR}/lib/https-common.sh"

# ── Argument parsing ──────────────────────────────────────────────────────────

CLIENT=""; DOMAIN=""; SERVER_IP=""
BACKEND_PORT=""; STOREFRONT_PORT=""; ADMIN_PORT=""
ADMIN_EMAIL=""; STORE_NAME=""; CERT_EMAIL=""
REPO_URL="${CF_REPO_URL:-}"
SHARED_DIR="/opt/commerceforce/shared-nginx"
ASSUME_YES=false; TEST_MODE=false; DRY_RUN=false; STAGING=false; SKIP_DNS=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        --client)           CLIENT="$2"; shift 2 ;;
        --domain)           DOMAIN="$2"; shift 2 ;;
        --server-ip)        SERVER_IP="$2"; shift 2 ;;
        --backend-port)     BACKEND_PORT="$2"; shift 2 ;;
        --storefront-port)  STOREFRONT_PORT="$2"; shift 2 ;;
        --admin-port)       ADMIN_PORT="$2"; shift 2 ;;
        --admin-email)      ADMIN_EMAIL="$2"; shift 2 ;;
        --store-name)       STORE_NAME="$2"; shift 2 ;;
        --email)            CERT_EMAIL="$2"; shift 2 ;;
        --repo-url)         REPO_URL="$2"; shift 2 ;;
        --shared-dir)       SHARED_DIR="$2"; shift 2 ;;
        --yes)              ASSUME_YES=true; shift ;;
        --test)             TEST_MODE=true; shift ;;
        --dry-run)          DRY_RUN=true; shift ;;
        --staging)          STAGING=true; shift ;;
        --skip-dns-check)   SKIP_DNS=true; shift ;;
        -h|--help)          sed -n '2,20p' "$0"; exit 0 ;;
        *) die "Unknown argument: $1 (see --help)" ;;
    esac
done

[[ -n "$CLIENT" ]]        || die "--client is required (short slug, e.g. acme)"
[[ -n "$DOMAIN" ]]        || die "--domain is required"
[[ -n "$SERVER_IP" ]]     || die "--server-ip is required"
[[ -n "$BACKEND_PORT" ]]  || die "--backend-port is required"
[[ -n "$STOREFRONT_PORT" ]] || die "--storefront-port is required"
[[ -n "$ADMIN_PORT" ]]    || die "--admin-port is required"
[[ -n "$ADMIN_EMAIL" ]]   || die "--admin-email is required"
[[ -n "$STORE_NAME" ]]    || die "--store-name is required"
[[ -z "$CERT_EMAIL" ]]    && CERT_EMAIL="$ADMIN_EMAIL"

STAGING_FLAG=""
[[ "$STAGING" == "true" ]] && STAGING_FLAG="--staging"

CLIENT_DIR="/opt/commerceforce/${CLIENT}"
CLIENT_COMPOSE="${CLIENT_DIR}/docker-compose.yml"
SHARED_COMPOSE="${SHARED_DIR}/docker-compose.yml"
CONF_FILE="${SHARED_DIR}/conf.d/${CLIENT}.conf"

# ── Step 1: shared nginx must already be initialized ─────────────────────────

step "1  Checking shared nginx is initialized"
[[ -f "$SHARED_COMPOSE" ]] || die "Shared nginx not found at ${SHARED_COMPOSE}.
     Run scripts/multiclient-init-nginx.sh first (one-time per VPS)."
ok "Shared nginx found at ${SHARED_DIR}"

# ── Step 2: port collision check ──────────────────────────────────────────────

step "2  Checking for port collisions with other clients"
for other in "${SHARED_DIR}/conf.d"/*.conf; do
    [[ -f "$other" ]] || continue
    [[ "$(basename "$other")" == "${CLIENT}.conf" ]] && continue
    if grep -qE "127\.0\.0\.1:(${BACKEND_PORT}|${STOREFRONT_PORT}|${ADMIN_PORT})\\b" "$other"; then
        die "Port collision: $(basename "$other") already uses one of ports ${BACKEND_PORT}/${STOREFRONT_PORT}/${ADMIN_PORT}.
     Pick different ports for '${CLIENT}' (docs/multi-client-vps-setup.md Section 1)."
    fi
done
ok "No port collisions"

# ── Step 3: DNS preflight ─────────────────────────────────────────────────────

if [[ "$SKIP_DNS" == "true" ]]; then
    warn "Skipping DNS preflight (--skip-dns-check)"
elif [[ "$TEST_MODE" == "true" ]]; then
    info "[test mode] Skipping real DNS lookups"
else
    step "3  DNS preflight"
    dns_preflight "$DOMAIN" "$SERVER_IP"
fi

# ── Step 4: clone or update the client's repo ────────────────────────────────

step "4  Clone / update ${CLIENT}'s repository"
if [[ -z "$REPO_URL" ]]; then
    REPO_URL="$(git -C "$PROJECT_ROOT" config --get remote.origin.url 2>/dev/null || true)"
    [[ -n "$REPO_URL" ]] || die "Cannot determine repo URL. Pass --repo-url or set CF_REPO_URL."
fi

if [[ "$DRY_RUN" == "true" || "$TEST_MODE" == "true" ]]; then
    info "[dry-run/test] Would clone/pull ${REPO_URL} → ${CLIENT_DIR}"
elif [[ -d "${CLIENT_DIR}/.git" ]]; then
    info "Repo already cloned — pulling latest…"
    (cd "$CLIENT_DIR" && git pull --ff-only)
    ok "Repository updated"
else
    info "Cloning ${REPO_URL} → ${CLIENT_DIR}…"
    mkdir -p "$CLIENT_DIR"
    git clone "$REPO_URL" "$CLIENT_DIR"
    ok "Repository cloned"
fi

# ── Step 5: generate this client's .env files with its own ports ────────────

step "5  Generating ${CLIENT}'s .env files"
GEN_ARGS=(--domain "$DOMAIN" --server-ip "$SERVER_IP"
          --backend-port "$BACKEND_PORT" --storefront-port "$STOREFRONT_PORT" --admin-port "$ADMIN_PORT")

if [[ "$DRY_RUN" == "true" || "$TEST_MODE" == "true" ]]; then
    info "[dry-run/test] Would run: bash ${CLIENT_DIR}/scripts/generate-env.sh ${GEN_ARGS[*]}"
else
    (cd "$CLIENT_DIR" && bash scripts/generate-env.sh "${GEN_ARGS[@]}")
    ok ".env files generated"
fi

# ── Step 6: guard — this client's own nginx must stay disabled ──────────────

step "6  Checking ${CLIENT}'s own nginx service stays disabled"
if grep -qE '^  nginx:' "$CLIENT_COMPOSE" 2>/dev/null; then
    die "${CLIENT_DIR}/docker-compose.yml already has its own 'nginx:' service enabled —
     that conflicts with the shared nginx model. Use scripts/setup-https.sh
     instead if this client is meant to be single-tenant on its own VPS."
fi
ok "Client's bundled nginx is disabled, as required"

# ── Step 7: bind this client's ports to loopback ─────────────────────────────

bind_loopback_ports() {
    local compose_file="$1"
    if grep -qE '^\s*-\s*"127\.0\.0\.1:' "$compose_file"; then
        info "Ports already loopback-bound — skipping"
        return 0
    fi

    local tmp="${compose_file}.tmp.$$"
    sed -E 's|^([[:space:]]*-[[:space:]]*)"(\$\{[A-Z_]+:-[0-9]+\}:[0-9]+)"|\1"127.0.0.1:\2"|' \
        "$compose_file" > "$tmp"

    if diff -q "$compose_file" "$tmp" >/dev/null 2>&1; then
        info "No port-mapping lines matched — nothing to change"
        rm -f "$tmp"
        return 0
    fi

    if [[ "$DRY_RUN" == "true" ]]; then
        info "[dry-run] Would apply this diff to ${compose_file}:"
        diff -u "$compose_file" "$tmp" || true
        rm -f "$tmp"
        return 0
    fi

    local errfile="${compose_file}.validate-err.$$"
    if ! docker compose -f "$tmp" config -q 2>"$errfile"; then
        local err
        err="$(cat "$errfile" 2>/dev/null)" || true
        rm -f "$tmp" "$errfile"
        die "The loopback-binding edit produced an invalid docker-compose.yml — aborted.
${err}"
    fi
    rm -f "$errfile"

    cp "$compose_file" "${compose_file}.bak"
    mv "$tmp" "$compose_file"
    ok "Bound backend/storefront/admin ports to 127.0.0.1 (backup: ${compose_file}.bak)"
}

step "7  Binding ${CLIENT}'s ports to 127.0.0.1"
if [[ "$TEST_MODE" == "true" ]]; then
    info "[test mode] Skipping docker-compose.yml edit"
else
    bind_loopback_ports "$CLIENT_COMPOSE"
fi

# ── Step 8: build, migrate, seed ──────────────────────────────────────────────

step "8  Build, migrate, seed"
if [[ "$DRY_RUN" == "true" || "$TEST_MODE" == "true" ]]; then
    info "[dry-run/test] Would run: docker compose up --build -d ; alembic upgrade head ; python seed.py"
else
    (cd "$CLIENT_DIR" && docker compose up --build -d) \
        || die "docker compose up --build -d failed for ${CLIENT} — check: docker compose logs"

    HEALTH_URL="http://127.0.0.1:${BACKEND_PORT}/api/health"
    info "Waiting for backend health at ${HEALTH_URL} (up to 3 min)…"
    HEALTHY=false
    for i in $(seq 1 36); do
        STATUS=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$HEALTH_URL" 2>/dev/null || echo 000)
        if [[ "$STATUS" == "200" ]]; then
            ok "Backend healthy (attempt ${i})"
            HEALTHY=true
            break
        fi
        sleep 5
    done
    [[ "$HEALTHY" == "true" ]] || die "Backend did not become healthy after 3 minutes. Check: docker compose -f ${CLIENT_COMPOSE} logs backend"

    (cd "$CLIENT_DIR" && docker compose exec -T backend alembic upgrade head) || die "Migrations failed"
    (cd "$CLIENT_DIR" && docker compose exec -T backend python seed.py) || die "Seeding failed"
    ok "Migrations applied and database seeded"
fi

# ── Step 9: bootstrap cert (HTTP-only conf, then webroot certbot) ───────────

write_bootstrap_conf() {
    cat > "$CONF_FILE" <<NGINXEOF
server {
    listen 80;
    listen [::]:80;
    server_name __DOMAIN__ admin.__DOMAIN__${WWW_SERVER_NAME:+ $WWW_SERVER_NAME};

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 404;
    }
}
NGINXEOF
    sed -i "s|__DOMAIN__|${DOMAIN}|g" "$CONF_FILE"
}

step "9  Bootstrapping certificate for ${DOMAIN}"
# www is optional — most clients never set up that A record, and requiring it
# would break issuance for all of them. Only fold it into the cert/nginx config
# when it already resolves here (common when a registrar auto-adds it). See
# https-common.sh's www_cert_arg for why this check is non-fatal, unlike
# dns_preflight above for the apex/admin records.
WWW_CERT_ARG=""
WWW_SERVER_NAME=""
if [[ "$DRY_RUN" != "true" && "$TEST_MODE" != "true" ]]; then
    WWW_CERT_ARG="$(www_cert_arg "$DOMAIN" "$SERVER_IP")"
    [[ -n "$WWW_CERT_ARG" ]] && WWW_SERVER_NAME="www.${DOMAIN}"
fi
if [[ "$DRY_RUN" == "true" || "$TEST_MODE" == "true" ]]; then
    info "[dry-run/test] Would write bootstrap conf.d/${CLIENT}.conf, reload shared nginx, and run certbot --webroot"
else
    ALREADY_ISSUED=false
    if docker compose -f "$SHARED_COMPOSE" run --rm certbot certificates 2>/dev/null | grep -q "$DOMAIN"; then
        ALREADY_ISSUED=true
    fi

    if [[ "$ALREADY_ISSUED" == "true" ]]; then
        info "Certificate for ${DOMAIN} already exists — skipping bootstrap issuance."
    else
        write_bootstrap_conf
        (cd "$SHARED_DIR" && docker compose up -d nginx) || die "Failed to (re)start shared nginx"
        (cd "$SHARED_DIR" && docker compose exec nginx nginx -s reload) || true

        # shellcheck disable=SC2086
        docker compose -f "$SHARED_COMPOSE" run --rm certbot certonly --webroot -w /var/www/certbot \
            -d "$DOMAIN" -d "admin.$DOMAIN" $WWW_CERT_ARG \
            --email "$CERT_EMAIL" --agree-tos --no-eff-email \
            --non-interactive $STAGING_FLAG \
            || die "Certificate issuance failed. Common causes: DNS not fully propagated, or the shared nginx isn't reachable on port 80 yet."
        ok "Certificate issued for ${DOMAIN}"
    fi
fi

# ── Step 10: write full HTTPS server block, validate, reload ────────────────

write_full_conf() {
    cat > "${CONF_FILE}.new" <<'NGINXEOF'
upstream __CLIENT___backend    { server 127.0.0.1:__BACKEND_PORT__; }
upstream __CLIENT___storefront { server 127.0.0.1:__STOREFRONT_PORT__; }
upstream __CLIENT___admin      { server 127.0.0.1:__ADMIN_PORT__; }

server {
    listen 80;
    listen [::]:80;
    server_name __DOMAIN__ admin.__DOMAIN__ __WWW_SERVER_NAME__;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}
__WWW_HTTPS_BLOCK__

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    http2 on;
    server_name __DOMAIN__;

    ssl_certificate     /etc/letsencrypt/live/__DOMAIN__/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/__DOMAIN__/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;

    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains" always;
    add_header X-Frame-Options SAMEORIGIN always;
    add_header X-Content-Type-Options nosniff always;
    client_max_body_size 20M;

    location /api/ {
        proxy_pass http://__CLIENT___backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /uploads/ {
        proxy_pass http://__CLIENT___backend;
        proxy_set_header Host $host;
        proxy_cache_valid 200 7d;
        add_header Cache-Control "public, max-age=604800, immutable";
    }

    location / {
        proxy_pass http://__CLIENT___storefront;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    http2 on;
    server_name admin.__DOMAIN__;

    ssl_certificate     /etc/letsencrypt/live/__DOMAIN__/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/__DOMAIN__/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;

    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains" always;
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-Robots-Tag "noindex, nofollow" always;
    client_max_body_size 20M;

    location /api/ {
        proxy_pass http://__CLIENT___backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /uploads/ {
        proxy_pass http://__CLIENT___backend;
        proxy_set_header Host $host;
    }

    location / {
        proxy_pass http://__CLIENT___admin;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
NGINXEOF
    sed -i \
        -e "s|__CLIENT__|${CLIENT}|g" \
        -e "s|__DOMAIN__|${DOMAIN}|g" \
        -e "s|__BACKEND_PORT__|${BACKEND_PORT}|g" \
        -e "s|__STOREFRONT_PORT__|${STOREFRONT_PORT}|g" \
        -e "s|__ADMIN_PORT__|${ADMIN_PORT}|g" \
        -e "s|__WWW_SERVER_NAME__|${WWW_SERVER_NAME}|g" \
        "${CONF_FILE}.new"

    # __WWW_HTTPS_BLOCK__ is only filled in when www.$DOMAIN already resolved
    # here (see step 9 above) — the cert only covers www when that happened,
    # so this block must stay in lockstep with WWW_CERT_ARG or nginx would
    # serve a cert missing the SAN for whatever server_name this block claims.
    if [[ -n "$WWW_SERVER_NAME" ]]; then
        WWW_BLOCK_TMP="$(mktemp)"
        cat > "$WWW_BLOCK_TMP" <<NGINXEOF2
server {
    listen 443 ssl;
    listen [::]:443 ssl;
    http2 on;
    server_name ${WWW_SERVER_NAME};

    ssl_certificate     /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    return 301 https://${DOMAIN}\$request_uri;
}
NGINXEOF2
        sed -i -e "/__WWW_HTTPS_BLOCK__/r ${WWW_BLOCK_TMP}" -e "/__WWW_HTTPS_BLOCK__/d" "${CONF_FILE}.new"
        rm -f "$WWW_BLOCK_TMP"
    else
        sed -i "/__WWW_HTTPS_BLOCK__/d" "${CONF_FILE}.new"
    fi
}

step "10  Writing full HTTPS config and reloading shared nginx"
if [[ "$DRY_RUN" == "true" || "$TEST_MODE" == "true" ]]; then
    info "[dry-run/test] Would write full conf.d/${CLIENT}.conf and reload shared nginx after nginx -t validation"
else
    write_full_conf
    [[ -f "$CONF_FILE" ]] && cp "$CONF_FILE" "${CONF_FILE}.bak"
    mv "${CONF_FILE}.new" "$CONF_FILE"

    if ! (cd "$SHARED_DIR" && docker compose exec nginx nginx -t) 2>/tmp/nginx-t-err.$$; then
        ERR="$(cat /tmp/nginx-t-err.$$ 2>/dev/null)" || true
        rm -f /tmp/nginx-t-err.$$
        if [[ -f "${CONF_FILE}.bak" ]]; then
            mv "${CONF_FILE}.bak" "$CONF_FILE"
            warn "Restored previous conf.d/${CLIENT}.conf after validation failure."
        else
            rm -f "$CONF_FILE"
        fi
        die "nginx -t failed for the new config — not reloaded, other clients unaffected.
${ERR}"
    fi
    rm -f /tmp/nginx-t-err.$$ "${CONF_FILE}.bak"

    (cd "$SHARED_DIR" && docker compose exec nginx nginx -s reload) \
        || die "nginx -s reload failed after a config that passed nginx -t — investigate manually."
    ok "Shared nginx reloaded with ${CLIENT}'s config"
fi

# ── Step 11: verification ─────────────────────────────────────────────────────

step "11  Verifying HTTPS"
if [[ "$DRY_RUN" == "true" || "$TEST_MODE" == "true" ]]; then
    info "[dry-run/test] Would verify https://${DOMAIN} (200) and https://admin.${DOMAIN} (200)"
else
    check_url "https://${DOMAIN}" 200 12 10       || warn "HTTPS storefront check failed — see: docker compose -f ${SHARED_COMPOSE} logs nginx"
    check_url "https://admin.${DOMAIN}" 200 12 10 || warn "HTTPS admin check failed — see: docker compose -f ${SHARED_COMPOSE} logs nginx"
fi

# ── Summary ────────────────────────────────────────────────────────────────────

step "Done"
echo ""
echo -e "${GREEN}${BOLD}${CLIENT} added successfully${RESET}"
echo ""
echo -e "  Storefront:  https://${DOMAIN}"
echo -e "  Admin panel: https://admin.${DOMAIN}"
echo -e "  Admin login: ${ADMIN_EMAIL}"
echo ""
if [[ "$DRY_RUN" == "true" ]]; then
    warn "This was a DRY RUN — no changes were made."
fi
exit 0

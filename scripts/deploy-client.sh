#!/usr/bin/env bash
# deploy-client.sh — Full end-to-end CommerceForce client deployment.
# Run this on the AGENCY machine. It SSHes into the VPS and does everything.
#
# Usage:
#   bash scripts/deploy-client.sh \
#     --server-ip  123.45.67.89  \
#     --domain     store.client.com \
#     --client     acme \
#     --admin-email admin@client.com \
#     --store-name "Acme Store" \
#     [--ssh-user  root] \
#     [--ssh-key   ~/.ssh/id_rsa] \
#     [--dry-run]
#
# What it does (in order):
#   1.  Checks local prerequisites (ssh, docker, git)
#   2.  SSHes to VPS; installs Docker + Git if missing
#   3.  Clones the CommerceForce repo to /opt/commerceforce/<client>/
#   4.  Generates both .env files on the VPS (calls generate-env.sh --non-interactive)
#   5.  Copies client seed-data.json if one exists locally at seeds/<client>.json
#   6.  Runs: docker compose up --build -d
#   7.  Waits for backend health check to pass (up to 3 min)
#   8.  Runs: alembic upgrade head + python seed.py inside the backend container
#   9.  Obtains SSL cert via certbot (standalone, 80/443)
#   10. Prints summary: URLs, admin credentials reminder

set -euo pipefail

# ─── Colour helpers ───────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

ok()   { echo -e "${GREEN}✓${RESET}  $*"; }
info() { echo -e "${CYAN}→${RESET}  $*"; }
warn() { echo -e "${YELLOW}⚠${RESET}  $*"; }
die()  { echo -e "${RED}✗${RESET}  $*" >&2; exit 1; }
step() { echo -e "\n${BOLD}── $* ──────────────────────────────────────────${RESET}"; }

# ─── Argument parsing ─────────────────────────────────────────────────────────
SERVER_IP=""
DOMAIN=""
CLIENT=""
ADMIN_EMAIL=""
STORE_NAME=""
SSH_USER="root"
SSH_KEY="${HOME}/.ssh/id_rsa"
DRY_RUN=false
REPO_URL="${CF_REPO_URL:-}"          # set via env or defaults to GitHub placeholder

while [[ $# -gt 0 ]]; do
    case "$1" in
        --server-ip)   SERVER_IP="$2";   shift 2 ;;
        --domain)      DOMAIN="$2";      shift 2 ;;
        --client)      CLIENT="$2";      shift 2 ;;
        --admin-email) ADMIN_EMAIL="$2"; shift 2 ;;
        --store-name)  STORE_NAME="$2";  shift 2 ;;
        --ssh-user)    SSH_USER="$2";    shift 2 ;;
        --ssh-key)     SSH_KEY="$2";     shift 2 ;;
        --dry-run)     DRY_RUN=true;     shift   ;;
        *) die "Unknown argument: $1" ;;
    esac
done

# ─── Validate required args ───────────────────────────────────────────────────
[[ -z "$SERVER_IP"   ]] && die "--server-ip is required"
[[ -z "$DOMAIN"      ]] && die "--domain is required"
[[ -z "$CLIENT"      ]] && die "--client is required (short slug, e.g. acme)"
[[ -z "$ADMIN_EMAIL" ]] && die "--admin-email is required"
[[ -z "$STORE_NAME"  ]] && die "--store-name is required"

DEPLOY_DIR="/opt/commerceforce/${CLIENT}"

# ─── Derive repo URL if not set ───────────────────────────────────────────────
if [[ -z "$REPO_URL" ]]; then
    REPO_URL=$(git config --get remote.origin.url 2>/dev/null || true)
    if [[ -z "$REPO_URL" ]]; then
        die "Cannot determine repo URL. Set CF_REPO_URL env var or run from inside the repo."
    fi
fi

# ─── SSH helper ───────────────────────────────────────────────────────────────
ssh_run() {
    local cmd="$1"
    if [[ "$DRY_RUN" == "true" ]]; then
        echo -e "  ${YELLOW}[dry-run]${RESET} ssh ${SSH_USER}@${SERVER_IP} '$cmd'"
        return 0
    fi
    ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no -o BatchMode=yes \
        "${SSH_USER}@${SERVER_IP}" "$cmd"
}

ssh_run_quiet() {
    local cmd="$1"
    if [[ "$DRY_RUN" == "true" ]]; then
        echo -e "  ${YELLOW}[dry-run]${RESET} ssh ${SSH_USER}@${SERVER_IP} '$cmd'"
        return 0
    fi
    ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no -o BatchMode=yes \
        "${SSH_USER}@${SERVER_IP}" "$cmd" 2>/dev/null
}

scp_to() {
    local src="$1" dst="$2"
    if [[ "$DRY_RUN" == "true" ]]; then
        echo -e "  ${YELLOW}[dry-run]${RESET} scp '$src' → ${SSH_USER}@${SERVER_IP}:'$dst'"
        return 0
    fi
    scp -i "$SSH_KEY" -o StrictHostKeyChecking=no "$src" "${SSH_USER}@${SERVER_IP}:${dst}"
}

# ─── Step 1: Local prerequisites ──────────────────────────────────────────────
step "1 / 10  Checking local prerequisites"

for cmd in ssh scp git; do
    command -v "$cmd" >/dev/null 2>&1 || die "Required command not found: $cmd"
done

[[ "$DRY_RUN" == "true" || -f "$SSH_KEY" ]] || die "SSH key not found: $SSH_KEY (override with --ssh-key)"
ok "All local prerequisites present"

# ─── Step 2: VPS — install Docker + Git ─────────────────────────────────────
step "2 / 10  Checking VPS: Docker + Git"

info "Connecting to ${SERVER_IP} as ${SSH_USER}…"

DOCKER_VERSION=$(ssh_run_quiet "docker --version 2>/dev/null || echo 'missing'")
if echo "$DOCKER_VERSION" | grep -q "missing"; then
    info "Docker not found — installing…"
    ssh_run "apt-get update -qq && apt-get install -y -qq docker.io docker-compose-plugin curl"
    ssh_run "systemctl enable --now docker"
    ok "Docker installed"
else
    ok "Docker present ($DOCKER_VERSION)"
fi

GIT_VERSION=$(ssh_run_quiet "git --version 2>/dev/null || echo 'missing'")
if echo "$GIT_VERSION" | grep -q "missing"; then
    info "Git not found — installing…"
    ssh_run "apt-get install -y -qq git"
    ok "Git installed"
else
    ok "Git present ($GIT_VERSION)"
fi

# ─── Step 3: Clone / pull repo ───────────────────────────────────────────────
step "3 / 10  Clone / update repository"

ALREADY_CLONED=$(ssh_run_quiet "test -d '${DEPLOY_DIR}/.git' && echo yes || echo no")
if [[ "$ALREADY_CLONED" == "yes" ]]; then
    info "Repo already cloned — pulling latest…"
    ssh_run "git -C '${DEPLOY_DIR}' pull --ff-only"
    ok "Repository updated"
else
    info "Cloning ${REPO_URL} → ${DEPLOY_DIR}…"
    ssh_run "mkdir -p '${DEPLOY_DIR}' && git clone '${REPO_URL}' '${DEPLOY_DIR}'"
    ok "Repository cloned"
fi

# ─── Step 4: Generate .env files ─────────────────────────────────────────────
step "4 / 10  Generate .env files"

# Prompt for secrets here on the agency machine, then write them to the VPS
info "Enter secrets for ${STORE_NAME} (${DOMAIN})…"

_prompt_secret() {
    local label="$1" default="$2"
    if [[ "$DRY_RUN" == "true" ]]; then
        echo "$default"
        return
    fi
    printf "${CYAN}%s${RESET} [leave blank for default/skip]: " "$label"
    read -rs val; echo
    echo "${val:-$default}"
}

SECRET_KEY=$(openssl rand -hex 32)
SMTP_HOST=$(_prompt_secret "SMTP Host" "smtp.gmail.com")
SMTP_PORT=$(_prompt_secret "SMTP Port" "587")
SMTP_USER=$(_prompt_secret "SMTP Username" "")
SMTP_PASS=$(_prompt_secret "SMTP Password" "")
SMTP_FROM=$(_prompt_secret "SMTP From address" "$ADMIN_EMAIL")
STRIPE_SECRET=$(_prompt_secret "Stripe Secret Key (sk_live_...)" "")
STRIPE_WEBHOOK=$(_prompt_secret "Stripe Webhook Secret (whsec_...)" "")
ANTHROPIC_KEY=$(_prompt_secret "Anthropic API Key (optional, for AI chat)" "")
ADMIN_TEMP_PW=$(_prompt_secret "Admin temporary password" "ChangeMe123!")

# Write root .env
ROOT_ENV_CONTENT="SERVER_IP=${SERVER_IP}
DOMAIN=${DOMAIN}
STOREFRONT_URL=https://${DOMAIN}"

# Write backend .env
BACKEND_ENV_CONTENT="# CommerceForce — ${CLIENT} — generated by deploy-client.sh
ENVIRONMENT=production
SECRET_KEY=${SECRET_KEY}
DATABASE_URL=sqlite+aiosqlite:///./commerceforce.db
CORS_ORIGINS=https://${DOMAIN},https://admin.${DOMAIN}
ALLOWED_HOSTS=${DOMAIN},admin.${DOMAIN},${SERVER_IP}

# Email (SMTP)
SMTP_HOST=${SMTP_HOST}
SMTP_PORT=${SMTP_PORT}
SMTP_USER=${SMTP_USER}
SMTP_PASS=${SMTP_PASS}
SMTP_FROM=${SMTP_FROM}
SMTP_TLS=true
CONTACT_EMAIL=${ADMIN_EMAIL}

# Store
STORE_NAME=${STORE_NAME}
STORE_TAGLINE=
ADMIN_EMAIL=${ADMIN_EMAIL}
ADMIN_TEMP_PASSWORD=${ADMIN_TEMP_PW}
SUPERADMIN_EMAIL=superadmin@commerceforce.agency
SUPERADMIN_PASSWORD=$(openssl rand -hex 16)

# Stripe
STRIPE_SECRET_KEY=${STRIPE_SECRET}
STRIPE_WEBHOOK_SECRET=${STRIPE_WEBHOOK}

# AI chat (optional)
ANTHROPIC_API_KEY=${ANTHROPIC_KEY}

# Plugins
ENABLED_PLUGINS=auth,categories,products,cart,orders,checkout,rfq,credit,inventory,coupons,loyalty,newsletter,branding,landing_page,ai_chat,contact,shipping,discount_rules"

if [[ "$DRY_RUN" == "true" ]]; then
    warn "DRY RUN — would write .env files to VPS"
else
    # Write via heredoc over SSH
    ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "${SSH_USER}@${SERVER_IP}" \
        "cat > '${DEPLOY_DIR}/.env'" <<< "$ROOT_ENV_CONTENT"
    ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "${SSH_USER}@${SERVER_IP}" \
        "cat > '${DEPLOY_DIR}/backend/.env'" <<< "$BACKEND_ENV_CONTENT"
    ok ".env files written to VPS"
fi

# ─── Step 5: Copy seed-data.json if available ────────────────────────────────
step "5 / 10  Client seed data"

LOCAL_SEED="$(dirname "$0")/../seeds/${CLIENT}.json"
if [[ -f "$LOCAL_SEED" ]]; then
    scp_to "$LOCAL_SEED" "${DEPLOY_DIR}/backend/seed-data.json"
    ok "Copied seeds/${CLIENT}.json → backend/seed-data.json"
else
    info "No seeds/${CLIENT}.json found — will use demo data (run with --demo when seeding)"
fi

# ─── Step 6: docker compose up ───────────────────────────────────────────────
step "6 / 10  Build and start containers"

info "This may take 5–10 minutes on first build…"
ssh_run "cd '${DEPLOY_DIR}' && docker compose up --build -d"
ok "Containers started"

# ─── Step 7: Health check ────────────────────────────────────────────────────
step "7 / 10  Wait for backend health"

HEALTH_URL="http://${SERVER_IP}:8000/api/health"
info "Polling ${HEALTH_URL} (up to 3 min)…"

if [[ "$DRY_RUN" == "true" ]]; then
    warn "DRY RUN — skipping health check"
else
    for i in $(seq 1 36); do
        STATUS=$(ssh_run_quiet "curl -s -o /dev/null -w '%{http_code}' '${HEALTH_URL}'" || echo "000")
        if [[ "$STATUS" == "200" ]]; then
            ok "Backend healthy (attempt ${i})"
            break
        fi
        if [[ $i -eq 36 ]]; then
            die "Backend did not become healthy after 3 minutes. Check: docker compose logs backend"
        fi
        sleep 5
    done
fi

# ─── Step 8: Migrations + seed ───────────────────────────────────────────────
step "8 / 10  Run migrations and seed"

ssh_run "cd '${DEPLOY_DIR}' && docker compose exec -T backend alembic upgrade head"
ok "Database migrations applied"

ssh_run "cd '${DEPLOY_DIR}' && docker compose exec -T backend python seed.py"
ok "Database seeded"

# ─── Step 9: SSL certificate ─────────────────────────────────────────────────
step "9 / 10  Enable HTTPS (nginx + certbot)"

# Delegates to scripts/setup-https.sh, which issues the cert into the
# cf_letsencrypt *named Docker volume* that the nginx/certbot services in
# docker-compose.yml actually mount. The previous approach here installed
# certbot on the host and wrote certs to the host's /etc/letsencrypt — a
# location the nginx container's cf_letsencrypt volume mount can never see,
# so uncommenting that service never actually got a working cert. setup-https.sh
# also handles the DNS preflight, uncommenting the compose blocks, verification,
# and renewal cron in one place instead of duplicating that logic here.
ssh_run "cd '${DEPLOY_DIR}' && bash scripts/setup-https.sh \
    --domain '${DOMAIN}' \
    --email '${ADMIN_EMAIL}' \
    --server-ip '${SERVER_IP}' \
    --yes"
ok "HTTPS enabled (cert in cf_letsencrypt volume, nginx up, renewal cron installed)"

# ─── Step 10: Summary ────────────────────────────────────────────────────────
step "10 / 10  Deployment complete"

echo ""
echo -e "${GREEN}${BOLD}CommerceForce deployed successfully!${RESET}"
echo ""
echo -e "  ${BOLD}Storefront:${RESET}   https://${DOMAIN}"
echo -e "  ${BOLD}Admin panel:${RESET}  https://admin.${DOMAIN}"
echo -e "  ${BOLD}Backend API:${RESET}  https://${DOMAIN}/api"
echo ""
echo -e "  ${BOLD}Admin login:${RESET}  ${ADMIN_EMAIL}"
echo -e "  ${BOLD}Temp password:${RESET} ${ADMIN_TEMP_PW}"
echo -e "  ${YELLOW}→ Ask the client to change their password on first login.${RESET}"
echo ""
echo -e "  ${BOLD}Cert renewal:${RESET} Certbot auto-renews; verify with:"
echo -e "    ssh ${SSH_USER}@${SERVER_IP} 'certbot renew --dry-run'"
echo ""
echo -e "  ${BOLD}Backups:${RESET}     Daily at 02:00 UTC to ${DEPLOY_DIR}/backups/"
echo ""
if [[ "$DRY_RUN" == "true" ]]; then
    warn "This was a DRY RUN. No changes were made on the server."
fi

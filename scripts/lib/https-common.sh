#!/usr/bin/env bash
# https-common.sh — shared helpers for scripts/setup-https.sh,
# scripts/multiclient-init-nginx.sh, and scripts/multiclient-add-client.sh.
#
# Source this file; do not execute it directly:
#   source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/https-common.sh"

# ── Colour output helpers (shared style across generate-env.sh / deploy-client.sh) ──

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

ok()   { echo -e "${GREEN}✓${RESET}  $*"; }
info() { echo -e "${CYAN}→${RESET}  $*"; }
warn() { echo -e "${YELLOW}⚠${RESET}  $*"; }
die()  { echo -e "${RED}✗${RESET}  $*" >&2; exit 1; }
step() { echo -e "\n${BOLD}── $* ──────────────────────────────────────────${RESET}"; }

# ── DNS resolution ────────────────────────────────────────────────────────────

# resolve_a HOST — prints the first IPv4 A record for HOST, or nothing if none.
# Note: always returns 0 (via `|| true`) even when no record is found — under
# `set -euo pipefail`, "no A record" is the exact, expected case callers need
# to detect and react to, not a script-ending failure.
resolve_a() {
    local host="$1"
    if command -v dig >/dev/null 2>&1; then
        dig +short A "$host" 2>/dev/null | grep -E '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$' | head -n1 || true
    elif command -v nslookup >/dev/null 2>&1; then
        nslookup "$host" 2>/dev/null | awk '/^Address: /{a=$2} END{print a}' || true
    else
        warn "Neither 'dig' nor 'nslookup' is installed — cannot verify DNS. Install with: apt-get install -y dnsutils"
        return 1
    fi
}

# dns_preflight DOMAIN SERVER_IP — verifies DOMAIN and admin.DOMAIN both
# resolve to SERVER_IP. Dies with a specific diagnostic on failure.
dns_preflight() {
    local domain="$1" server_ip="$2" host got
    for host in "$domain" "admin.$domain"; do
        got="$(resolve_a "$host")" || true
        if [[ -z "$got" ]]; then
            die "No A record resolves for '$host' yet.
     Confirm you created an *A* record (not NS, CNAME, or AAAA) for '$host'
     pointing at ${server_ip} — a raw IP is only valid in an A/AAAA record.
     Also confirm DNS has propagated: dig +short A ${host}
     (Let's Encrypt rate-limits failed attempts, so this stops before wasting one.)"
        elif [[ "$got" != "$server_ip" ]]; then
            die "'$host' resolves to ${got}, but this server is ${server_ip}.
     Fix the A record's value to point at ${server_ip}."
        fi
        ok "$host → $server_ip"
    done
}

# www_cert_arg DOMAIN SERVER_IP — prints "-d www.DOMAIN" (for splicing into a
# certbot command) if www.DOMAIN already resolves to SERVER_IP, otherwise
# prints nothing. Deliberately NOT part of dns_preflight (which dies on a
# missing record): unlike the apex/admin records this guide asks for, `www`
# is optional — most clients never set it up, and requiring it would break
# cert issuance for every one of them. But when a registrar HAS auto-created
# a `www` record (common default behaviour), the certificate must cover it or
# browsers show "connection not private" the moment anyone visits it — even
# though nginx only ever redirects it to the apex domain. All info/warn/ok
# output here goes to stderr so `$(www_cert_arg ...)` only captures the -d flag.
www_cert_arg() {
    local domain="$1" server_ip="$2" got
    got="$(resolve_a "www.$domain")" || true
    if [[ -z "$got" ]]; then
        info "www.$domain has no A record yet — skipping it (site works fine without it; add the record and re-run this script later if you want it covered)." >&2
        return 0
    elif [[ "$got" != "$server_ip" ]]; then
        warn "www.$domain resolves to ${got}, not this server (${server_ip}) — skipping it from the certificate." >&2
        return 0
    fi
    ok "www.$domain → $server_ip (including it in the certificate)" >&2
    echo "-d www.$domain"
}

# ── HTTP verification with retry ─────────────────────────────────────────────

# check_url URL EXPECTED_CODE ATTEMPTS SLEEP_S [EXTRA_CURL_ARGS] — retrying
# curl status check. Pass "-k" as EXTRA_CURL_ARGS when checking a Let's
# Encrypt --staging certificate — it's deliberately untrusted by every
# standard client, so a plain curl call correctly (and unhelpfully) reports
# a TLS trust failure even when nginx is serving it perfectly correctly.
check_url() {
    local url="$1" expected="$2" attempts="${3:-12}" sleep_s="${4:-10}" extra="${5:-}" code
    for ((i = 1; i <= attempts; i++)); do
        # shellcheck disable=SC2086
        code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 $extra "$url" 2>/dev/null || echo 000)
        if [[ "$code" == "$expected" ]]; then
            ok "$url → $code (attempt $i/$attempts)"
            return 0
        fi
        sleep "$sleep_s"
    done
    warn "$url → last seen $code, expected $expected (after $attempts attempts)"
    return 1
}

# ── Idempotent crontab insertion ─────────────────────────────────────────────

# cron_add_idempotent FINGERPRINT FULL_LINE — appends FULL_LINE to the current
# user's crontab unless a line already contains FINGERPRINT (a stable
# substring, not necessarily the whole line — lets the full command evolve
# without creating duplicates, and avoids matching another client's line).
cron_add_idempotent() {
    local fingerprint="$1" full_line="$2"
    if crontab -l 2>/dev/null | grep -Fq -- "$fingerprint"; then
        info "Cron entry already present (matched: ${fingerprint})"
    else
        # `crontab -l` exits non-zero when no crontab exists yet (common on a
        # fresh VPS) — `|| true` stops that from aborting the subshell under
        # `set -e` before the new line gets echoed.
        ( crontab -l 2>/dev/null || true; echo "$full_line" ) | crontab -
        ok "Cron entry installed: ${full_line}"
    fi
}

# ── .env helpers ──────────────────────────────────────────────────────────────

# env_get FILE KEY — prints the value of KEY= in FILE, or nothing if absent.
# Note: deliberately swallows grep's "no match" exit status — under
# `set -euo pipefail`, a key that's simply absent (a normal, expected case
# for every caller of this function) would otherwise kill the whole script.
env_get() {
    local file="$1" key="$2"
    [[ -f "$file" ]] || return 0
    grep -m1 "^${key}=" "$file" 2>/dev/null | cut -d= -f2- || true
}

# set_env_key FILE KEY VALUE — idempotent single-key set-or-append.
# Never rewrites the rest of the file (unlike generate-env.sh, which
# regenerates both .env files wholesale on every run).
set_env_key() {
    local file="$1" key="$2" val="$3"
    if grep -q "^${key}=" "$file" 2>/dev/null; then
        sed -i.bak "s|^${key}=.*|${key}=${val}|" "$file" && rm -f "${file}.bak"
    else
        printf '%s=%s\n' "$key" "$val" >> "$file"
    fi
}

# CommerceForce — Running Multiple Clients on One VPS

CommerceForce is deployed **single-tenant per stack** — each client gets their own backend,
database, and pair of frontends (see `docs/gap-analysis-and-roadmap.md` Part E). That doesn't
mean each client needs their own VPS. This doc covers running several independent client
stacks side by side on one server, fronted by a single shared nginx.

## The model

- Each client is a full, independent clone of the repo under `/opt/commerceforce/<client>/`,
  with its own `docker-compose.yml`, database, and `.env` files — exactly like a single-client
  deployment (`docs/new-client-setup.md` Sections 1–10), except:
  - Each client is given a **distinct set of host ports** (backend/storefront/admin), so they
    don't collide.
  - Each client's **bundled nginx/certbot service stays disabled** (never uncommented). Only
    one process can bind ports 80/443 on the machine — a per-client nginx would immediately
    conflict with every other client's.
  - Each client's raw ports are bound to `127.0.0.1` only, not exposed publicly — so the only
    way in from the internet is through the shared nginx.
- **One shared nginx** (a separate, standalone docker-compose stack, not part of any client's
  repo clone) listens on 80/443 and routes by hostname to `127.0.0.1:<client's port>`.

```
Internet ──▶ shared nginx (80/443) ──▶ 127.0.0.1:8000/3000/3001   (client A)
                                   └──▶ 127.0.0.1:8001/3002/3003   (client B)
```

DNS only gets every client's traffic to the same VPS IP on the same port (443) — it has no
idea which client that traffic is for. It's the shared nginx that then splits it back out by
which hostname was requested. See Section 2 for exactly what DNS records that requires, and
Section 4 for how nginx does the splitting.

---

## Section 1 — Plan your ports

Pick a distinct backend/storefront/admin port for each client. Suggested scheme — increment by
one per client:

| Client | Backend | Storefront | Admin | Domains |
|---|---|---|---|---|
| A (first) | 8000 | 3000 | 3001 | clienta.com, admin.clienta.com |
| B (second) | 8001 | 3002 | 3003 | clientb.com, admin.clientb.com |
| C (third) | 8002 | 3004 | 3005 | clientc.com, admin.clientc.com |

Write these down — you'll need them in Section 3 (when generating each client's `.env`) and
Section 4 (when writing that client's nginx config block).

---

## Section 2 — Point DNS at the VPS

Every client needs **two A records**, and both point to the exact same VPS IP — there's no way
to encode a port in a DNS record, and no need to: nginx (Section 4) is what tells clients apart,
not DNS.

| Type | Host / Name | Points to |
|---|---|---|
| A | `clienta.com` (root/`@`) | VPS IP |
| A | `admin.clienta.com` (`admin`) | VPS IP |
| A | `clientb.com` (root/`@`) | VPS IP |
| A | `admin.clientb.com` (`admin`) | VPS IP |

Repeat the pair for every additional client.

**Where to add these:** `clienta.com` and `clientb.com` are almost always separate domains
registered with separate registrars/DNS providers, so this is usually done in **two different
DNS control panels**, not one shared one. The `admin.` record is a subdomain of its parent
domain, so it goes in that same domain's DNS zone (e.g. `admin.clienta.com` is added alongside
`clienta.com`, not `clientb.com`).

All four records above are identical in *what* they point to (the VPS IP) — only the hostname
differs. DNS propagation can take anywhere from a few minutes to a few hours; you can move on to
Section 3 while waiting, but certbot (Section 4.3) will fail until it's actually resolving.

---

## Section 3 — Deploy each client

Follow `docs/new-client-setup.md` **Sections 1–10** for each client, cloning into its own
directory, with two differences:

### 3.1 Clone into a per-client directory

```bash
cd /opt/commerceforce
mkdir clienta && cd clienta
git clone https://github.com/asthika-asthi/CommerceForceClaude.git .
```

(Repeat under `clientb/`, `clientc/`, etc. for each additional client.)

### 3.2 Answer the port prompts with this client's ports

When you run `bash scripts/generate-env.sh` (Section 2.2 of `new-client-setup.md`), answer the
new port prompts with the values you planned in Section 1 above — e.g. for client B:

```
Backend host port [8000]: 8001
Storefront host port [3000]: 3002
Admin panel host port [3001]: 3003
Domain name (e.g. myshop.com, or leave as IP) [SERVER_IP]: clientb.com
```

This writes `BACKEND_PORT=8001`, `STOREFRONT_PORT=3002`, `ADMIN_PORT=3003`, and the correct
`NEXT_PUBLIC_API_URL_*` build args for `clientb.com` into that client's root `.env`.

### 3.3 Bind the ports to localhost only

Edit **this client's** `docker-compose.yml` and prefix each port mapping with `127.0.0.1:` so
it's only reachable from the VPS itself (the shared nginx will reach it over loopback):

```yaml
  backend:
    ports:
      - "127.0.0.1:${BACKEND_PORT:-8000}:8000"

  frontend-starter:
    ports:
      - "127.0.0.1:${STOREFRONT_PORT:-3000}:3000"

  frontend-admin:
    ports:
      - "127.0.0.1:${ADMIN_PORT:-3001}:3001"
```

**Do not** uncomment this client's `nginx`/`certbot` service block — leave Section 11 of
`new-client-setup.md` unused for every client. The shared nginx (Section 4) replaces it.

### 3.4 Build and continue as normal

```bash
docker compose up --build -d
docker compose exec backend alembic upgrade head
docker compose exec backend python seed.py
```

Continue through `new-client-setup.md` Sections 4–10 (accounts, branding, plugins, products,
backups) as usual — all of it is per-client and unaffected by sharing the VPS. **Skip Section
11** — HTTPS is handled once, centrally, in Section 4 below.

At this point `curl http://127.0.0.1:8001/api/health` (client B's backend) should work from the
VPS itself, but nothing is reachable from the internet yet — that's expected until Section 4.

Repeat Sections 3.1–3.4 for every client.

---

## Section 4 — Set up the shared nginx (one-time)

Do this once, after at least one client is deployed per Section 3.

### 4.1 Create the shared nginx directory

```bash
cd /opt/commerceforce
mkdir -p shared-nginx/conf.d shared-nginx/certbot-www shared-nginx/letsencrypt
cd shared-nginx
```

### 4.2 Write `docker-compose.yml`

```yaml
# /opt/commerceforce/shared-nginx/docker-compose.yml
services:
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
    entrypoint: /bin/sh -c "trap exit TERM; while :; do sleep 12h & wait $${!}; done"
```

`network_mode: host` is what lets this container reach each client's backend/frontends at
`127.0.0.1:<port>` — those ports are only bound to loopback (Section 3.3), and this is the one
container allowed to see loopback directly.

### 4.3 Bootstrap each client's certificate (HTTP-only first)

nginx will refuse to start if a config references a certificate file that doesn't exist yet, so
each **new** client needs a plain-HTTP config first, just to serve the ACME challenge, before
its real config can reference a cert. This step needs the DNS records from Section 2 to have
already propagated — `certbot` will fail if `clienta.com` doesn't yet resolve to this VPS.

For client A, create `conf.d/clienta.conf`:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name clienta.com admin.clienta.com;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 404;
    }
}
```

Start nginx and issue the certificate:

```bash
docker compose up -d nginx
docker compose run --rm certbot certonly --webroot -w /var/www/certbot \
  -d clienta.com -d admin.clienta.com \
  --email you@youragency.com --agree-tos --no-eff-email
```

You should see `Successfully received certificate.` — it's written to
`./letsencrypt/live/clienta.com/`.

### 4.4 Replace with the full config

Now that the cert exists, overwrite `conf.d/clienta.conf` with the full HTTP+HTTPS routing
config. This is the same routing logic as the single-client `nginx/default.conf` in the repo,
just pointed at `127.0.0.1:<client's ports>` instead of Docker service names. The `server_name`
directives in each block are what let nginx tell clients apart on the shared 80/443 — a request
for `clienta.com` only ever matches this block, never client B's:

```nginx
# /opt/commerceforce/shared-nginx/conf.d/clienta.conf
# Client A — backend 8000, storefront 3000, admin 3001

upstream clienta_backend  { server 127.0.0.1:8000; }
upstream clienta_storefront { server 127.0.0.1:3000; }
upstream clienta_admin    { server 127.0.0.1:3001; }

server {
    listen 80;
    listen [::]:80;
    server_name clienta.com admin.clienta.com;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    http2 on;
    server_name clienta.com;

    ssl_certificate     /etc/letsencrypt/live/clienta.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/clienta.com/privkey.pem;
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
        proxy_pass http://clienta_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /uploads/ {
        proxy_pass http://clienta_backend;
        proxy_set_header Host $host;
        proxy_cache_valid 200 7d;
        add_header Cache-Control "public, max-age=604800, immutable";
    }

    location / {
        proxy_pass http://clienta_storefront;
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
    server_name admin.clienta.com;

    ssl_certificate     /etc/letsencrypt/live/clienta.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/clienta.com/privkey.pem;
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
        proxy_pass http://clienta_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /uploads/ {
        proxy_pass http://clienta_backend;
        proxy_set_header Host $host;
    }

    location / {
        proxy_pass http://clienta_admin;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Reload nginx to pick it up (this does not disturb any other client's already-working config):

```bash
docker compose exec nginx nginx -s reload
```

Verify:
```bash
curl -I https://clienta.com          # 200
curl -I https://admin.clienta.com    # 200
```

### 4.5 Set up renewal (once, covers every client)

`certbot renew` automatically renews **every** certificate under `/etc/letsencrypt/live/`,
regardless of how many clients you've added — one cron entry is enough for the whole VPS:

```bash
crontab -e
```
```
0 3 * * 1 docker compose -f /opt/commerceforce/shared-nginx/docker-compose.yml run --rm certbot renew --quiet && docker compose -f /opt/commerceforce/shared-nginx/docker-compose.yml exec nginx nginx -s reload
```

Test it:
```bash
cd /opt/commerceforce/shared-nginx
docker compose run --rm certbot renew --dry-run
```

---

## Section 5 — Adding another client later

1. Point DNS at the VPS for the new client's two hostnames (Section 2).
2. Deploy the new client per Section 3 (its own directory, its own next-available ports).
3. Bootstrap its certificate per Section 4.3 (HTTP-only config → certbot → full config →
   reload), using its own domain and ports. Existing clients keep running throughout — nginx
   reload does not drop other server blocks' connections.

---

## Gotchas

- **Don't reuse ports across clients.** Docker will fail to start the second client's stack
  with `port is already allocated` if you forget to change `BACKEND_PORT`/`STOREFRONT_PORT`/
  `ADMIN_PORT` in its `.env`.
- **Don't enable any client's bundled nginx/certbot service.** Only the shared nginx in
  Section 4 should ever bind 80/443 — uncommenting a client's own nginx service will
  crash-loop fighting over the same ports.
- **Mixed-content / wrong-URL bug this doc assumes is fixed:** `generate-env.sh` and
  `docker-compose.yml` now bake the frontend's API calls to the **domain** you give at Section
  3.2, not the VPS's raw IP (see `docs/new-client-setup.md` Section 2.2's "Domain-aware build"
  note). If a client's frontend appears to call `http://SERVER_IP:PORT` instead of its own
  domain, its `.env` most likely still has the old defaults — re-run `generate-env.sh` for that
  client with the correct domain, then `docker compose up --build -d`.
- **DNS not propagated yet:** if `certbot` (Section 4.3) fails with a timeout or "Connection
  refused" while validating the domain, DNS for that client likely hasn't finished propagating.
  Check with `dig clienta.com +short` (or `nslookup clienta.com`) — it should return the VPS IP
  before certbot will succeed.
- **Resource sizing:** each client is a full backend + two Next.js frontends + SQLite DB +
  its own nightly backup cron. A small VPS (e.g. 2 vCPU / 4 GB RAM) comfortably runs 2–3
  low-traffic clients; watch `docker stats` and RAM headroom before adding more.
- **Backups stay independent** — each client's `backup` service and its nightly cron (Section
  10 of `new-client-setup.md`) only touches that client's own `cf_data` volume; nothing extra
  to configure for multi-client.

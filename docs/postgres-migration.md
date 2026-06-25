# PostgreSQL Migration Guide

SQLite is the default database and handles most client deployments comfortably. Switch to PostgreSQL when you hit one or more of these triggers:

- **Concurrent write pressure** — multiple admin users + active storefront orders competing for writes cause SQLite lock contention
- **Data volume** — catalogue exceeds ~50 000 products or order history exceeds ~500 000 rows
- **Replication** — client needs read replicas or point-in-time recovery
- **Managed hosting** — client wants a managed DB service (RDS, Supabase, Neon, etc.)

---

## What changes

| Item | SQLite (current) | PostgreSQL |
|------|-----------------|------------|
| `DATABASE_URL` | `sqlite+aiosqlite:///./commerceforce.db` | `postgresql+asyncpg://user:pass@db:5432/commerceforce` |
| Driver | `aiosqlite` (already installed) | `asyncpg` (already in `pyproject.toml`) |
| Docker service | none | add `db` service to `docker-compose.yml` |
| Alembic | `batch_alter_table` (SQLite workaround) | native `ALTER TABLE` — no change needed, `batch_alter_table` is harmless on PostgreSQL |
| Data file | `cf_data` volume → `commerceforce.db` | `cf_pgdata` volume |

---

## Step 1 — Add PostgreSQL to docker-compose.yml

Add the `db` service and update the backend's `DATABASE_URL`. Edit `docker-compose.yml`:

```yaml
services:
  db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: commerceforce
      POSTGRES_USER: cf
      POSTGRES_PASSWORD: "${POSTGRES_PASSWORD}"   # set in root .env
    volumes:
      - cf_pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U cf -d commerceforce"]
      interval: 5s
      timeout: 5s
      retries: 10

  backend:
    build: ./backend
    env_file:
      - ./backend/.env
    environment:
      DATABASE_URL: "postgresql+asyncpg://cf:${POSTGRES_PASSWORD}@db:5432/commerceforce"
    depends_on:
      db:
        condition: service_healthy
    volumes:
      - cf_uploads:/app/uploads
    # Remove cf_data volume mount — SQLite file no longer needed
    ports:
      - "8000:8000"

  # ... frontend services unchanged ...

volumes:
  cf_pgdata:        # new
  cf_uploads:
  cf_backups:
  # cf_data:        # remove or leave — SQLite data kept as backup
```

Add to root `.env`:
```
POSTGRES_PASSWORD=choose-a-strong-password-here
```

Remove from `backend/.env`:
```
# DATABASE_URL is now set via docker-compose.yml environment block — remove this line:
# DATABASE_URL=sqlite+aiosqlite:///./commerceforce.db
```

---

## Step 2 — Fresh deployment (new client, no existing data)

For a brand-new client with no existing orders or products:

```bash
docker compose up --build -d
docker compose exec backend alembic upgrade head
docker compose exec backend python seed.py
```

Done. Skip Steps 3–4.

---

## Step 3 — Migrate existing data (live client)

Use this path when the client has real orders and products in SQLite that must be preserved.

### Option A — pgloader (recommended, automated)

`pgloader` converts a SQLite file to PostgreSQL in one command and handles type coercion automatically.

```bash
# On the VPS, install pgloader
apt-get install -y pgloader

# Copy the SQLite DB out of the Docker volume
docker run --rm -v cf_data:/data alpine cp /data/commerceforce.db /tmp/commerceforce.db

# Run pgloader
pgloader /tmp/commerceforce.db \
  "postgresql://cf:YOUR_POSTGRES_PASSWORD@localhost:5432/commerceforce"
```

pgloader creates all tables and copies all rows. Then run Alembic to apply any migrations that postdate the SQLite schema:

```bash
docker compose exec backend alembic upgrade head
```

### Option B — manual CSV export/import

Use this if pgloader is unavailable.

**Export from SQLite:**
```bash
docker compose exec backend python -c "
import sqlite3, csv, os
conn = sqlite3.connect('/app/data/commerceforce.db')
for table in conn.execute(\"SELECT name FROM sqlite_master WHERE type='table'\").fetchall():
    name = table[0]
    rows = conn.execute(f'SELECT * FROM {name}').fetchall()
    cols = [d[0] for d in conn.execute(f'PRAGMA table_info({name})').fetchall()]
    with open(f'/app/data/{name}.csv', 'w', newline='') as f:
        w = csv.writer(f)
        w.writerow(cols)
        w.writerows(rows)
    print(f'Exported {len(rows)} rows from {name}')
"
```

Copy the CSVs out of the container, then import into PostgreSQL with `\COPY` via `psql`.

---

## Step 4 — Verify after migration

```bash
# Check row counts match what you had in SQLite
docker compose exec db psql -U cf commerceforce -c "
SELECT 'users' as t, COUNT(*) FROM users
UNION ALL SELECT 'products', COUNT(*) FROM products
UNION ALL SELECT 'orders', COUNT(*) FROM orders
UNION ALL SELECT 'order_items', COUNT(*) FROM order_items;
"

# Check the admin panel loads and orders are visible
curl -s http://localhost:8000/api/health
```

---

## Step 5 — Update backup script

The existing `scripts/backup.sh` copies the SQLite file. Replace with a `pg_dump` approach:

```bash
#!/usr/bin/env bash
# In scripts/backup.sh — replace the sqlite3 copy with:
BACKUP_FILE="backups/$(date +%Y-%m-%d).sql.gz"
docker compose exec -T db pg_dump -U cf commerceforce | gzip > "$BACKUP_FILE"
echo "Backup written to $BACKUP_FILE"

# Keep last 30 days
find backups/ -name "*.sql.gz" -mtime +30 -delete
```

**Restore from backup:**
```bash
gunzip -c backups/2026-06-25.sql.gz | docker compose exec -T db psql -U cf commerceforce
```

---

## Rollback

If anything goes wrong during migration, the SQLite data is untouched (you only added a new PostgreSQL volume). To roll back:

1. Revert `docker-compose.yml` to the SQLite config
2. Re-add `DATABASE_URL=sqlite+aiosqlite:///./commerceforce.db` to `backend/.env`
3. `docker compose up -d`

The SQLite volume `cf_data` still contains all original data.

---

## Alembic note

All existing migrations use `with op.batch_alter_table(...)` which was required for SQLite's limited `ALTER TABLE` support. These work correctly on PostgreSQL too — `batch_alter_table` falls through to native `ALTER TABLE` when the backend is not SQLite. No migration files need to be changed.

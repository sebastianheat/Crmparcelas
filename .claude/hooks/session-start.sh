#!/usr/bin/env bash
# SessionStart hook — provisiona el entorno de Parcelasy en sesiones efímeras
# (Claude Code on the web). Levanta Postgres, crea la base, aplica migraciones,
# el rol de aplicación y los datos demo. Idempotente y no bloqueante.
set -uo pipefail
cd "$(dirname "$0")/../.." || exit 0

log() { echo "[parcelasy:setup] $*"; }

# 1) Postgres en marcha (cluster local del contenedor).
if ! pg_isready -q 2>/dev/null; then
  log "Levantando Postgres…"
  pg_ctlcluster 16 main start >/dev/null 2>&1 || true
  for _ in $(seq 1 10); do pg_isready -q 2>/dev/null && break; sleep 1; done
fi

if ! pg_isready -q 2>/dev/null; then
  log "Postgres no disponible; omito provisión de BD."
  exit 0
fi

# 2) Credenciales + base de datos.
su - postgres -c "psql -tAc \"ALTER USER postgres PASSWORD 'postgres';\"" >/dev/null 2>&1 || true
if ! su - postgres -c "psql -tAc \"SELECT 1 FROM pg_database WHERE datname='parcelasy';\"" 2>/dev/null | grep -q 1; then
  log "Creando base parcelasy…"
  su - postgres -c "psql -tAc \"CREATE DATABASE parcelasy;\"" >/dev/null 2>&1 || true
fi

# 3) .env.local si no existe (valores locales del contenedor).
if [ ! -f .env.local ]; then
  log "Generando .env.local…"
  cat > .env.local <<'EOF'
DATABASE_URL="postgresql://app_user:app_user@localhost:5432/parcelasy"
DATABASE_ADMIN_URL="postgresql://postgres:postgres@localhost:5432/parcelasy"
AUTH_SECRET="dev-secret-no-usar-en-produccion-1234567890abcdef"
AUTH_TRUST_HOST="true"
ANTHROPIC_API_KEY=""
ANTHROPIC_MODEL="claude-opus-4-8"
DTE_PROVIDER="mock"
BANK_PROVIDER="mock"
EOF
fi

# 4) Dependencias (si falta node_modules).
if [ ! -d node_modules ]; then
  log "Instalando dependencias…"
  pnpm install --silent >/dev/null 2>&1 || true
fi

# 5) Migraciones + rol de aplicación + seed.
export DATABASE_ADMIN_URL="postgresql://postgres:postgres@localhost:5432/parcelasy"
export DATABASE_URL="postgresql://app_user:app_user@localhost:5432/parcelasy"
log "Aplicando migraciones…"
pnpm db:migrate >/dev/null 2>&1 || true
PGPASSWORD=postgres psql -U postgres -h localhost -d parcelasy -f scripts/setup-roles.sql >/dev/null 2>&1 || true
log "Sembrando datos demo…"
pnpm db:seed >/dev/null 2>&1 || true

log "Listo. Login demo: admin@parcelasy.cl / Parcelasy2026"
exit 0

-- Rol de aplicación con privilegios mínimos (NO superusuario) para que las
-- políticas Row-Level Security se apliquen de verdad en runtime.
-- Las migraciones y el seed corren con el rol owner (postgres); la app Next.js
-- conecta con app_user.
--
-- Ejecutar (dev): psql "$DATABASE_ADMIN_URL" -f scripts/setup-roles.sql
-- En producción, gestiona la contraseña vía secretos del entorno.

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user LOGIN PASSWORD 'app_user';
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- Tablas/secuencias creadas a futuro por el owner se otorgan automáticamente.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO app_user;

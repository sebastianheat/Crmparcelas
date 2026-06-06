-- Custom SQL migration file, put your code below! --

-- Row-Level Security (RLS) por tenant.
-- Aislamiento real: cada conexión ve solo las filas de su tenant activo,
-- definido por la variable de sesión `app.current_tenant_id` (la fija
-- `withTenant` en src/db/tenant.ts mediante set_config con alcance de transacción).
--
-- Usamos FORCE ROW LEVEL SECURITY para que la política aplique incluso al
-- dueño de la tabla (de lo contrario el owner la omite). El segundo argumento
-- `true` de current_setting evita error cuando la variable no está fijada.

-- Helper: tenant actual (NULL si no hay contexto → no se ve ninguna fila).
CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
$$;

-- clients
ALTER TABLE "clients" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "clients" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "clients"
  USING ("tenant_id" = current_tenant_id())
  WITH CHECK ("tenant_id" = current_tenant_id());

-- projects
ALTER TABLE "projects" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "projects" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "projects"
  USING ("tenant_id" = current_tenant_id())
  WITH CHECK ("tenant_id" = current_tenant_id());

-- parcels
ALTER TABLE "parcels" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "parcels" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "parcels"
  USING ("tenant_id" = current_tenant_id())
  WITH CHECK ("tenant_id" = current_tenant_id());

-- parcel_events (append-only: sin UPDATE ni DELETE)
ALTER TABLE "parcel_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "parcel_events" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_select ON "parcel_events" FOR SELECT
  USING ("tenant_id" = current_tenant_id());
CREATE POLICY tenant_insert ON "parcel_events" FOR INSERT
  WITH CHECK ("tenant_id" = current_tenant_id());
-- No se definen políticas de UPDATE/DELETE: el historial es inmutable.

-- money_vouchers
ALTER TABLE "money_vouchers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "money_vouchers" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "money_vouchers"
  USING ("tenant_id" = current_tenant_id())
  WITH CHECK ("tenant_id" = current_tenant_id());

-- invoices
ALTER TABLE "invoices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invoices" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "invoices"
  USING ("tenant_id" = current_tenant_id())
  WITH CHECK ("tenant_id" = current_tenant_id());

-- costs
ALTER TABLE "costs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "costs" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "costs"
  USING ("tenant_id" = current_tenant_id())
  WITH CHECK ("tenant_id" = current_tenant_id());

-- Guardia del historial inmutable: el flujo normal NUNCA edita ni borra eventos.
-- Se permite DELETE solo cuando se fija explícitamente `app.allow_event_delete`
-- (purga/offboarding de un tenant). UPDATE queda bloqueado siempre.
CREATE OR REPLACE FUNCTION forbid_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE'
     AND current_setting('app.allow_event_delete', true) = 'on' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'parcel_events es append-only: no se permite %', TG_OP;
END;
$$;

CREATE TRIGGER parcel_events_no_update
  BEFORE UPDATE OR DELETE ON "parcel_events"
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
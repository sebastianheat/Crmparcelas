CREATE TYPE "public"."access_type" AS ENUM('asfaltado', 'estabilizado', 'tierra');--> statement-breakpoint
CREATE TYPE "public"."billing_term" AS ENUM('mensual', 'anual_net90');--> statement-breakpoint
CREATE TYPE "public"."cost_category" AS ENUM('marketing', 'terreno', 'obras', 'legal', 'comisiones', 'operacional', 'otros');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('borrador', 'emitida', 'anulada');--> statement-breakpoint
CREATE TYPE "public"."parcel_event_type" AS ENUM('reserva', 'devolucion_reserva', 'promesa', 'resciliacion', 'nueva_promesa', 'escritura', 'inscripcion_cbr', 'entrega', 'reparo', 'vale_vista', 'bloqueo', 'desbloqueo', 'cambio_precio');--> statement-breakpoint
CREATE TYPE "public"."parcel_status" AS ENUM('disponible', 'reservada', 'prometida', 'resciliada', 'escriturada', 'inscrita', 'entregada', 'bloqueada');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('contado', 'credito_directo', 'pie');--> statement-breakpoint
CREATE TYPE "public"."price_unit" AS ENUM('clp', 'uf');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('proximo_lanzamiento', 'en_verde', 'etapa', 'entrega_inmediata', 'escriturable', 'nuevo', 'vendido_100');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('super_admin', 'gerente_legal', 'gerente_marketing', 'jefe_ventas', 'vendedor', 'finanzas', 'corredor');--> statement-breakpoint
CREATE TYPE "public"."voucher_status" AS ENUM('registrado', 'anulado', 'facturado');--> statement-breakpoint
CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"rut" text,
	"phone" text,
	"email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "costs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"project_id" uuid,
	"category" "cost_category" NOT NULL,
	"amount_clp" numeric(14, 2) NOT NULL,
	"description" text,
	"incurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"parcel_id" uuid NOT NULL,
	"client_id" uuid,
	"voucher_id" uuid,
	"folio" integer,
	"exempt_clp" numeric(14, 2) NOT NULL,
	"total_clp" numeric(14, 2) NOT NULL,
	"repertorio_code" text,
	"status" "invoice_status" DEFAULT 'borrador' NOT NULL,
	"dte_provider" text,
	"dte_track_id" text,
	"dte_status" text,
	"factored" boolean DEFAULT false NOT NULL,
	"issued_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"role" "role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "money_vouchers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"parcel_id" uuid NOT NULL,
	"client_id" uuid,
	"parcel_event_id" uuid,
	"folio" integer NOT NULL,
	"concept" text NOT NULL,
	"amount_clp" numeric(14, 2) NOT NULL,
	"status" "voucher_status" DEFAULT 'registrado' NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid
);
--> statement-breakpoint
CREATE TABLE "parcel_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"parcel_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"type" "parcel_event_type" NOT NULL,
	"client_id" uuid,
	"amount_clp" numeric(14, 2),
	"repertorio_code" text,
	"payload" jsonb DEFAULT '{}'::jsonb,
	"note" text,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parcels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"code" text NOT NULL,
	"prerrol" text,
	"rol" text,
	"area_m2" numeric(12, 2),
	"price" numeric(14, 2),
	"price_unit" "price_unit" DEFAULT 'clp' NOT NULL,
	"status" "parcel_status" DEFAULT 'disponible' NOT NULL,
	"current_client_id" uuid,
	"deslindes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"sub_brand" text,
	"slug" text NOT NULL,
	"comuna" text,
	"provincia" text,
	"region" text,
	"lat" numeric(10, 6),
	"lng" numeric(10, 6),
	"price_from" numeric(14, 2),
	"price_unit" "price_unit" DEFAULT 'clp' NOT NULL,
	"status" "project_status" DEFAULT 'proximo_lanzamiento' NOT NULL,
	"description" text,
	"access_type" "access_type",
	"factibilidad" jsonb DEFAULT '{}'::jsonb,
	"entorno" jsonb DEFAULT '[]'::jsonb,
	"cercanias" jsonb DEFAULT '[]'::jsonb,
	"payment_methods" jsonb DEFAULT '[]'::jsonb,
	"gallery_urls" jsonb DEFAULT '[]'::jsonb,
	"video_url" text,
	"tour_360_url" text,
	"map_kmz_url" text,
	"landing_copy" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"rut" text,
	"brand_primary" text DEFAULT '#1f7a4d' NOT NULL,
	"brand_secondary" text DEFAULT '#0f172a' NOT NULL,
	"logo_url" text,
	"is_founder" boolean DEFAULT false NOT NULL,
	"billing_term" "billing_term" DEFAULT 'mensual' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "costs" ADD CONSTRAINT "costs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "costs" ADD CONSTRAINT "costs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "costs" ADD CONSTRAINT "costs_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_parcel_id_parcels_id_fk" FOREIGN KEY ("parcel_id") REFERENCES "public"."parcels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_voucher_id_money_vouchers_id_fk" FOREIGN KEY ("voucher_id") REFERENCES "public"."money_vouchers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "money_vouchers" ADD CONSTRAINT "money_vouchers_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "money_vouchers" ADD CONSTRAINT "money_vouchers_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "money_vouchers" ADD CONSTRAINT "money_vouchers_parcel_id_parcels_id_fk" FOREIGN KEY ("parcel_id") REFERENCES "public"."parcels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "money_vouchers" ADD CONSTRAINT "money_vouchers_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "money_vouchers" ADD CONSTRAINT "money_vouchers_parcel_event_id_parcel_events_id_fk" FOREIGN KEY ("parcel_event_id") REFERENCES "public"."parcel_events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "money_vouchers" ADD CONSTRAINT "money_vouchers_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parcel_events" ADD CONSTRAINT "parcel_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parcel_events" ADD CONSTRAINT "parcel_events_parcel_id_parcels_id_fk" FOREIGN KEY ("parcel_id") REFERENCES "public"."parcels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parcel_events" ADD CONSTRAINT "parcel_events_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parcel_events" ADD CONSTRAINT "parcel_events_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parcel_events" ADD CONSTRAINT "parcel_events_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parcels" ADD CONSTRAINT "parcels_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parcels" ADD CONSTRAINT "parcels_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parcels" ADD CONSTRAINT "parcels_current_client_id_clients_id_fk" FOREIGN KEY ("current_client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "clients_tenant_idx" ON "clients" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "costs_tenant_idx" ON "costs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "costs_project_idx" ON "costs" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "invoices_tenant_idx" ON "invoices" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "invoices_project_idx" ON "invoices" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "memberships_user_tenant_uk" ON "memberships" USING btree ("user_id","tenant_id");--> statement-breakpoint
CREATE INDEX "memberships_tenant_idx" ON "memberships" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "vouchers_tenant_idx" ON "money_vouchers" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "vouchers_project_idx" ON "money_vouchers" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "vouchers_parcel_idx" ON "money_vouchers" USING btree ("parcel_id");--> statement-breakpoint
CREATE UNIQUE INDEX "vouchers_tenant_folio_uk" ON "money_vouchers" USING btree ("tenant_id","folio");--> statement-breakpoint
CREATE INDEX "parcel_events_tenant_idx" ON "parcel_events" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "parcel_events_parcel_idx" ON "parcel_events" USING btree ("parcel_id");--> statement-breakpoint
CREATE INDEX "parcel_events_project_idx" ON "parcel_events" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "parcels_tenant_idx" ON "parcels" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "parcels_project_idx" ON "parcels" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "parcels_project_code_uk" ON "parcels" USING btree ("project_id","code");--> statement-breakpoint
CREATE INDEX "projects_tenant_idx" ON "projects" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "projects_tenant_slug_uk" ON "projects" USING btree ("tenant_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "tenants_slug_uk" ON "tenants" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_uk" ON "users" USING btree ("email");
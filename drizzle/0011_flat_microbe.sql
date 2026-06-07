CREATE TYPE "public"."legal_case_status" AS ENUM('vigente', 'concluida', 'archivada', 'no_inicio');--> statement-breakpoint
CREATE TYPE "public"."legal_case_type" AS ENUM('querella', 'denuncia', 'demanda', 'otro');--> statement-breakpoint
CREATE TABLE "legal_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"project_id" uuid,
	"parcel_id" uuid,
	"client_id" uuid,
	"type" "legal_case_type" DEFAULT 'denuncia' NOT NULL,
	"status" "legal_case_status" DEFAULT 'vigente' NOT NULL,
	"person_name" text,
	"counterparty" text,
	"accused" text,
	"tribunal" text,
	"rol" text,
	"ante_quien" text,
	"abogado" text,
	"contacto_abogado" text,
	"perjuicio_clp" numeric(14, 2),
	"fecha_inicio" timestamp with time zone,
	"observacion" text,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "legal_cases" ADD CONSTRAINT "legal_cases_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_cases" ADD CONSTRAINT "legal_cases_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_cases" ADD CONSTRAINT "legal_cases_parcel_id_parcels_id_fk" FOREIGN KEY ("parcel_id") REFERENCES "public"."parcels"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_cases" ADD CONSTRAINT "legal_cases_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_cases" ADD CONSTRAINT "legal_cases_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "legal_cases_tenant_idx" ON "legal_cases" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "legal_cases_project_idx" ON "legal_cases" USING btree ("project_id");--> statement-breakpoint
ALTER TABLE "legal_cases" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "legal_cases" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY tenant_isolation ON "legal_cases"
  USING ("tenant_id" = current_tenant_id()) WITH CHECK ("tenant_id" = current_tenant_id());

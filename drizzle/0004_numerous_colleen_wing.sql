CREATE TABLE "seller_companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"razon_social" text NOT NULL,
	"rut" text,
	"rep_nombre" text,
	"rep_ci" text,
	"rep_nacionalidad" text DEFAULT 'chilena',
	"rep_estado_civil" text,
	"rep_profesion" text,
	"domicilio" text,
	"personeria_notaria" text,
	"personeria_repertorio" text,
	"personeria_fecha" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "seller_company_id" uuid;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "notaria" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "acquisition" jsonb DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "seller_companies" ADD CONSTRAINT "seller_companies_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "seller_companies_tenant_idx" ON "seller_companies" USING btree ("tenant_id");--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_seller_company_id_seller_companies_id_fk" FOREIGN KEY ("seller_company_id") REFERENCES "public"."seller_companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- Row-Level Security para la nueva tabla de tenant.
ALTER TABLE "seller_companies" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "seller_companies" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY tenant_isolation ON "seller_companies"
  USING ("tenant_id" = current_tenant_id())
  WITH CHECK ("tenant_id" = current_tenant_id());
CREATE TYPE "public"."parcel_doc_type" AS ENUM('promesa', 'escritura', 'cesion', 'resciliacion', 'comprobante', 'otro');--> statement-breakpoint
CREATE TABLE "parcel_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"parcel_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"type" "parcel_doc_type" NOT NULL,
	"title" text NOT NULL,
	"url" text NOT NULL,
	"status" text DEFAULT 'borrador' NOT NULL,
	"generated_by_ai" boolean DEFAULT false NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "parcel_documents" ADD CONSTRAINT "parcel_documents_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parcel_documents" ADD CONSTRAINT "parcel_documents_parcel_id_parcels_id_fk" FOREIGN KEY ("parcel_id") REFERENCES "public"."parcels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parcel_documents" ADD CONSTRAINT "parcel_documents_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parcel_documents" ADD CONSTRAINT "parcel_documents_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "parcel_documents_tenant_idx" ON "parcel_documents" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "parcel_documents_parcel_idx" ON "parcel_documents" USING btree ("parcel_id");--> statement-breakpoint
-- Row-Level Security para la nueva tabla de tenant.
ALTER TABLE "parcel_documents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "parcel_documents" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY tenant_isolation ON "parcel_documents"
  USING ("tenant_id" = current_tenant_id())
  WITH CHECK ("tenant_id" = current_tenant_id());
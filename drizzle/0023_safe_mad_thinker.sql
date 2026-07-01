CREATE TYPE "public"."project_update_kind" AS ENUM('avance', 'hito', 'notificacion', 'plazo');--> statement-breakpoint
CREATE TABLE "project_updates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"kind" "project_update_kind" DEFAULT 'avance' NOT NULL,
	"stage" text,
	"title" text NOT NULL,
	"body" text,
	"image_urls" jsonb DEFAULT '[]'::jsonb,
	"due_date" timestamp with time zone,
	"done_at" timestamp with time zone,
	"published" boolean DEFAULT true NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project_updates" ADD CONSTRAINT "project_updates_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_updates" ADD CONSTRAINT "project_updates_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_updates" ADD CONSTRAINT "project_updates_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_updates_tenant_idx" ON "project_updates" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "project_updates_project_idx" ON "project_updates" USING btree ("project_id");--> statement-breakpoint
ALTER TABLE "project_updates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "project_updates" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY tenant_isolation ON "project_updates"
  USING ("tenant_id" = current_tenant_id()) WITH CHECK ("tenant_id" = current_tenant_id());

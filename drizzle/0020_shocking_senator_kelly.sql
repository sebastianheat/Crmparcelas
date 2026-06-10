CREATE TABLE "ghl_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"external_id" text NOT NULL,
	"parent_id" text,
	"payload" jsonb NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ghl_snapshots" ADD CONSTRAINT "ghl_snapshots_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ghl_snapshots_tenant_kind_idx" ON "ghl_snapshots" USING btree ("tenant_id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "ghl_snapshots_uk" ON "ghl_snapshots" USING btree ("tenant_id","kind","external_id");--> statement-breakpoint
ALTER TABLE "ghl_snapshots" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ghl_snapshots" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY tenant_isolation ON "ghl_snapshots"
  USING ("tenant_id" = current_tenant_id()) WITH CHECK ("tenant_id" = current_tenant_id());

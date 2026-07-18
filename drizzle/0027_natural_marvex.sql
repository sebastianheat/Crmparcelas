CREATE TABLE "tax_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"period" text,
	"title" text NOT NULL,
	"url" text NOT NULL,
	"mime" text,
	"meta" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tax_documents" ADD CONSTRAINT "tax_documents_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tax_documents_tenant_idx" ON "tax_documents" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "tax_documents_period_idx" ON "tax_documents" USING btree ("period");--> statement-breakpoint
ALTER TABLE "tax_documents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tax_documents" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY tenant_isolation ON "tax_documents"
  USING ("tenant_id" = current_tenant_id()) WITH CHECK ("tenant_id" = current_tenant_id());

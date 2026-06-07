CREATE TYPE "public"."client_doc_type" AS ENUM('cedula', 'comprobante_pago', 'vale_vista', 'promesa', 'escritura', 'otro');--> statement-breakpoint
CREATE TABLE "client_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"type" "client_doc_type" DEFAULT 'otro' NOT NULL,
	"title" text NOT NULL,
	"url" text NOT NULL,
	"mime" text,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "client_documents" ADD CONSTRAINT "client_documents_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_documents" ADD CONSTRAINT "client_documents_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_documents" ADD CONSTRAINT "client_documents_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "client_documents_tenant_idx" ON "client_documents" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "client_documents_client_idx" ON "client_documents" USING btree ("client_id");--> statement-breakpoint
ALTER TABLE "client_documents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "client_documents" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY tenant_isolation ON "client_documents"
  USING ("tenant_id" = current_tenant_id()) WITH CHECK ("tenant_id" = current_tenant_id());

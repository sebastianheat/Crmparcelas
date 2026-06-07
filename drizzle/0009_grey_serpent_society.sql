CREATE TYPE "public"."installment_status" AS ENUM('pendiente', 'pagada', 'vencida', 'condonada');--> statement-breakpoint
CREATE TABLE "installments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"parcel_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"due_date" timestamp with time zone NOT NULL,
	"amount_clp" numeric(14, 2) NOT NULL,
	"status" "installment_status" DEFAULT 'pendiente' NOT NULL,
	"paid_at" timestamp with time zone,
	"voucher_id" uuid
);
--> statement-breakpoint
CREATE TABLE "payment_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"parcel_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"client_id" uuid,
	"total_clp" numeric(14, 2) NOT NULL,
	"pie_clp" numeric(14, 2) DEFAULT '0',
	"n_cuotas" integer NOT NULL,
	"status" text DEFAULT 'vigente' NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "parcel_documents" ADD COLUMN "docx_url" text;--> statement-breakpoint
ALTER TABLE "parcel_documents" ADD COLUMN "signature_provider" text;--> statement-breakpoint
ALTER TABLE "parcel_documents" ADD COLUMN "signature_status" text;--> statement-breakpoint
ALTER TABLE "parcel_documents" ADD COLUMN "signature_ref" text;--> statement-breakpoint
ALTER TABLE "parcel_documents" ADD COLUMN "signed_url" text;--> statement-breakpoint
ALTER TABLE "parcel_documents" ADD COLUMN "signed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "installments" ADD CONSTRAINT "installments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "installments" ADD CONSTRAINT "installments_plan_id_payment_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."payment_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "installments" ADD CONSTRAINT "installments_parcel_id_parcels_id_fk" FOREIGN KEY ("parcel_id") REFERENCES "public"."parcels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "installments" ADD CONSTRAINT "installments_voucher_id_money_vouchers_id_fk" FOREIGN KEY ("voucher_id") REFERENCES "public"."money_vouchers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_plans" ADD CONSTRAINT "payment_plans_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_plans" ADD CONSTRAINT "payment_plans_parcel_id_parcels_id_fk" FOREIGN KEY ("parcel_id") REFERENCES "public"."parcels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_plans" ADD CONSTRAINT "payment_plans_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_plans" ADD CONSTRAINT "payment_plans_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_plans" ADD CONSTRAINT "payment_plans_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "installments_tenant_idx" ON "installments" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "installments_plan_idx" ON "installments" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "installments_parcel_idx" ON "installments" USING btree ("parcel_id");--> statement-breakpoint
CREATE INDEX "payment_plans_tenant_idx" ON "payment_plans" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "payment_plans_parcel_idx" ON "payment_plans" USING btree ("parcel_id");--> statement-breakpoint
ALTER TABLE "payment_plans" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "payment_plans" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY tenant_isolation ON "payment_plans"
  USING ("tenant_id" = current_tenant_id()) WITH CHECK ("tenant_id" = current_tenant_id());--> statement-breakpoint
ALTER TABLE "installments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "installments" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY tenant_isolation ON "installments"
  USING ("tenant_id" = current_tenant_id()) WITH CHECK ("tenant_id" = current_tenant_id());

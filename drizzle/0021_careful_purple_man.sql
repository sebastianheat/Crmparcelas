CREATE TABLE "payment_intents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"provider" text DEFAULT 'fintoc' NOT NULL,
	"external_id" text,
	"installment_id" uuid,
	"parcel_id" uuid,
	"amount_clp" numeric(14, 2) NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"widget_token" text,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paid_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_installment_id_installments_id_fk" FOREIGN KEY ("installment_id") REFERENCES "public"."installments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_parcel_id_parcels_id_fk" FOREIGN KEY ("parcel_id") REFERENCES "public"."parcels"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payment_intents_tenant_idx" ON "payment_intents" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "payment_intents_external_idx" ON "payment_intents" USING btree ("external_id");--> statement-breakpoint
ALTER TABLE "payment_intents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "payment_intents" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY tenant_isolation ON "payment_intents"
  USING ("tenant_id" = current_tenant_id()) WITH CHECK ("tenant_id" = current_tenant_id());

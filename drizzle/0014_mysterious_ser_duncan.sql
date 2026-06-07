CREATE TYPE "public"."bank_movement_status" AS ENUM('pendiente', 'conciliado', 'ignorado');--> statement-breakpoint
CREATE TABLE "bank_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"provider" text DEFAULT 'mock' NOT NULL,
	"external_id" text NOT NULL,
	"posted_at" timestamp with time zone NOT NULL,
	"amount_clp" numeric(14, 2) NOT NULL,
	"description" text,
	"counterparty" text,
	"status" "bank_movement_status" DEFAULT 'pendiente' NOT NULL,
	"matched_voucher_id" uuid,
	"raw" jsonb DEFAULT '{}'::jsonb,
	"reconciled_by_user_id" uuid,
	"reconciled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bank_movements" ADD CONSTRAINT "bank_movements_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_movements" ADD CONSTRAINT "bank_movements_matched_voucher_id_money_vouchers_id_fk" FOREIGN KEY ("matched_voucher_id") REFERENCES "public"."money_vouchers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_movements" ADD CONSTRAINT "bank_movements_reconciled_by_user_id_users_id_fk" FOREIGN KEY ("reconciled_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bank_movements_tenant_idx" ON "bank_movements" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bank_movements_external_uk" ON "bank_movements" USING btree ("tenant_id","external_id");--> statement-breakpoint
ALTER TABLE "bank_movements" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "bank_movements" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY tenant_isolation ON "bank_movements"
  USING ("tenant_id" = current_tenant_id()) WITH CHECK ("tenant_id" = current_tenant_id());

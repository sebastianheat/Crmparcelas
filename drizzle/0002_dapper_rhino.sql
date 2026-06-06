ALTER TYPE "public"."role" ADD VALUE 'gerente_comercial';--> statement-breakpoint
ALTER TYPE "public"."role" ADD VALUE 'gerente_finanzas';--> statement-breakpoint
ALTER TYPE "public"."role" ADD VALUE 'contador';--> statement-breakpoint
ALTER TYPE "public"."role" ADD VALUE 'cajero';--> statement-breakpoint
ALTER TYPE "public"."voucher_status" ADD VALUE 'validado';--> statement-breakpoint
ALTER TABLE "money_vouchers" ADD COLUMN "seller_user_id" uuid;--> statement-breakpoint
ALTER TABLE "money_vouchers" ADD COLUMN "proof_url" text;--> statement-breakpoint
ALTER TABLE "money_vouchers" ADD COLUMN "pdf_url" text;--> statement-breakpoint
ALTER TABLE "money_vouchers" ADD COLUMN "validated_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "money_vouchers" ADD COLUMN "validated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "parcel_events" ADD COLUMN "seller_user_id" uuid;--> statement-breakpoint
ALTER TABLE "money_vouchers" ADD CONSTRAINT "money_vouchers_seller_user_id_users_id_fk" FOREIGN KEY ("seller_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "money_vouchers" ADD CONSTRAINT "money_vouchers_validated_by_user_id_users_id_fk" FOREIGN KEY ("validated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parcel_events" ADD CONSTRAINT "parcel_events_seller_user_id_users_id_fk" FOREIGN KEY ("seller_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "installments" ADD COLUMN "reminder_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "reminder_sent_at" timestamp with time zone;
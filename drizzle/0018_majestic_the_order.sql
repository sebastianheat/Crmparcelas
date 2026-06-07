ALTER TABLE "client_documents" ALTER COLUMN "type" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "client_documents" ALTER COLUMN "type" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "client_documents" ALTER COLUMN "type" SET DEFAULT 'otro';--> statement-breakpoint
DROP TYPE "public"."client_doc_type";

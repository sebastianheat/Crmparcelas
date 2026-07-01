ALTER TABLE "blobs" ALTER COLUMN "data" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "blobs" ADD COLUMN "pathname" text;
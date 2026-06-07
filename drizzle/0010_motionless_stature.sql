CREATE TYPE "public"."legal_status" AS ENUM('sin_definir', 'sag_ingresado', 'sag_certificado', 'en_inscripcion', 'inscrito');--> statement-breakpoint
CREATE TYPE "public"."riesgo" AS ENUM('bajo', 'medio', 'alto');--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "legal_status" "legal_status" DEFAULT 'sin_definir' NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "riesgo" "riesgo" DEFAULT 'bajo' NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "propio" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "denuncias" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "legal_notes" text;
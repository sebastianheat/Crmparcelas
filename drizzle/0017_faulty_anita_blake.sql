ALTER TABLE "leads" ALTER COLUMN "stage" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "leads" ALTER COLUMN "stage" SET DATA TYPE text;--> statement-breakpoint
UPDATE "leads" SET "stage" = CASE "stage"
  WHEN 'nuevo' THEN 'entrada'
  WHEN 'contactado' THEN 'en_conversacion'
  WHEN 'calificado' THEN 'en_conversacion'
  WHEN 'visita' THEN 'visita_agendada'
  WHEN 'negociacion' THEN 'reunion'
  WHEN 'ganado' THEN 'promesando'
  ELSE "stage" END;--> statement-breakpoint
ALTER TABLE "leads" ALTER COLUMN "stage" SET DEFAULT 'entrada';--> statement-breakpoint
DROP TYPE "public"."lead_stage";

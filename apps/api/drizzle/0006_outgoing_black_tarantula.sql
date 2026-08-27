ALTER TABLE "challenges" ADD COLUMN "minimum_samples" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
UPDATE "challenges" SET "minimum_samples" = 20 WHERE "metric" = 'delayed_accuracy';--> statement-breakpoint
ALTER TABLE "review_events" ADD COLUMN "mastery_before" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "review_events" ADD COLUMN "mastery_after" double precision DEFAULT 0 NOT NULL;

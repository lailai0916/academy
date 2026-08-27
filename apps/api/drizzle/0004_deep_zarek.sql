CREATE TYPE "public"."content_change_kind" AS ENUM('imported', 'edited', 'published', 'archived', 'restored', 'seeded');--> statement-breakpoint
CREATE TABLE "content_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"kind" "content_kind" NOT NULL,
	"grade" "grade" NOT NULL,
	"textbook" varchar(80) NOT NULL,
	"unit" varchar(120) NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"payload" jsonb NOT NULL,
	"status" "content_status" NOT NULL,
	"source" varchar(120) NOT NULL,
	"source_version" varchar(80) DEFAULT '' NOT NULL,
	"semantic_fingerprint" varchar(64) NOT NULL,
	"semantic_change" boolean DEFAULT false NOT NULL,
	"change_kind" "content_change_kind" NOT NULL,
	"change_note" varchar(300) DEFAULT '' NOT NULL,
	"created_by" uuid,
	"import_batch_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "content_imports" ADD COLUMN "rolled_back_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "content_imports" ADD COLUMN "rolled_back_by" uuid;--> statement-breakpoint
ALTER TABLE "content_imports" ADD COLUMN "rollback_reverted_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "content_imports" ADD COLUMN "rollback_skipped_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "content_items" ADD COLUMN "current_version_id" uuid;--> statement-breakpoint
ALTER TABLE "content_items" ADD COLUMN "published_version_id" uuid;--> statement-breakpoint
ALTER TABLE "review_events" ADD COLUMN "content_version_id" uuid;--> statement-breakpoint
ALTER TABLE "review_events" ADD COLUMN "counts_for_mastery" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "study_sessions" ADD COLUMN "content_version_queue" uuid[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "content_versions" ADD CONSTRAINT "content_versions_content_id_content_items_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."content_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_versions" ADD CONSTRAINT "content_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_versions" ADD CONSTRAINT "content_versions_import_batch_id_content_imports_id_fk" FOREIGN KEY ("import_batch_id") REFERENCES "public"."content_imports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
INSERT INTO "content_versions" (
	"content_id",
	"version_number",
	"kind",
	"grade",
	"textbook",
	"unit",
	"tags",
	"payload",
	"status",
	"source",
	"source_version",
	"semantic_fingerprint",
	"semantic_change",
	"change_kind",
	"change_note",
	"created_by",
	"import_batch_id",
	"created_at"
)
SELECT
	"id",
	1,
	"kind",
	"grade",
	"textbook",
	"unit",
	"tags",
	"payload",
	"status",
	"source",
	"source_version",
	'',
	false,
	CASE WHEN "import_batch_id" IS NULL THEN 'seeded'::"content_change_kind" ELSE 'imported'::"content_change_kind" END,
	'迁移既有内容',
	"imported_by",
	"import_batch_id",
	"imported_at"
FROM "content_items";--> statement-breakpoint
UPDATE "content_items" AS "item"
SET
	"current_version_id" = "version"."id",
	"published_version_id" = CASE WHEN "item"."status" = 'published' THEN "version"."id" ELSE NULL END
FROM "content_versions" AS "version"
WHERE "version"."content_id" = "item"."id" AND "version"."version_number" = 1;--> statement-breakpoint
UPDATE "review_events" AS "event"
SET "content_version_id" = "item"."current_version_id"
FROM "learning_cards" AS "card"
INNER JOIN "content_items" AS "item" ON "item"."id" = "card"."content_id"
WHERE "event"."card_id" = "card"."id";--> statement-breakpoint
ALTER TABLE "review_events" ALTER COLUMN "content_version_id" SET NOT NULL;--> statement-breakpoint
UPDATE "study_sessions" AS "session"
SET "content_version_queue" = COALESCE(
	(
		SELECT array_agg("item"."current_version_id" ORDER BY "queued"."position")
		FROM unnest("session"."content_queue") WITH ORDINALITY AS "queued"("content_id", "position")
		INNER JOIN "content_items" AS "item" ON "item"."id" = "queued"."content_id"
	),
	'{}'::uuid[]
);--> statement-breakpoint
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_current_version_id_content_versions_id_fk" FOREIGN KEY ("current_version_id") REFERENCES "public"."content_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_published_version_id_content_versions_id_fk" FOREIGN KEY ("published_version_id") REFERENCES "public"."content_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "content_versions_number_unique" ON "content_versions" USING btree ("content_id","version_number");--> statement-breakpoint
CREATE INDEX "content_versions_content_created_idx" ON "content_versions" USING btree ("content_id","created_at");--> statement-breakpoint
CREATE INDEX "content_items_published_version_idx" ON "content_items" USING btree ("published_version_id");--> statement-breakpoint
CREATE INDEX "review_events_content_version_idx" ON "review_events" USING btree ("content_version_id");--> statement-breakpoint
ALTER TABLE "content_imports" ADD CONSTRAINT "content_imports_rolled_back_by_users_id_fk" FOREIGN KEY ("rolled_back_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_events" ADD CONSTRAINT "review_events_content_version_id_content_versions_id_fk" FOREIGN KEY ("content_version_id") REFERENCES "public"."content_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
WITH "duplicates" AS (
	SELECT "id", row_number() OVER (PARTITION BY "fingerprint" ORDER BY "created_at", "id") AS "position"
	FROM "content_imports"
)
UPDATE "content_imports" AS "batch"
SET "fingerprint" = md5("batch"."fingerprint" || "batch"."id"::text)
FROM "duplicates"
WHERE "duplicates"."id" = "batch"."id" AND "duplicates"."position" > 1;--> statement-breakpoint
CREATE UNIQUE INDEX "content_imports_fingerprint_unique" ON "content_imports" USING btree ("fingerprint");

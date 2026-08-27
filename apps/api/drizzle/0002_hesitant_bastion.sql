WITH "ranked_active_sessions" AS (
	SELECT
		"id",
		row_number() OVER (
			PARTITION BY "user_id"
			ORDER BY "started_at" DESC, "id" DESC
		) AS "position"
	FROM "study_sessions"
	WHERE "status" = 'active'
)
UPDATE "study_sessions"
SET
	"status" = 'abandoned',
	"completed_at" = coalesce("completed_at", now())
FROM "ranked_active_sessions"
WHERE
	"study_sessions"."id" = "ranked_active_sessions"."id"
	AND "ranked_active_sessions"."position" > 1;--> statement-breakpoint
CREATE UNIQUE INDEX "study_sessions_user_active_unique" ON "study_sessions" USING btree ("user_id") WHERE "study_sessions"."status" = 'active';

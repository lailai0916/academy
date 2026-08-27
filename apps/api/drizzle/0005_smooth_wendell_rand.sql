ALTER TABLE "auth_sessions" ADD COLUMN "id" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "auth_sessions_id_unique" ON "auth_sessions" USING btree ("id");
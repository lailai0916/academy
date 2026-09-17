CREATE TYPE "public"."course_assistance_kind" AS ENUM('hint', 'solution');--> statement-breakpoint
CREATE TYPE "public"."course_assistance_level" AS ENUM('independent', 'hint', 'solution');--> statement-breakpoint
CREATE TYPE "public"."course_run_mode" AS ENUM('lesson', 'retest');--> statement-breakpoint
CREATE TYPE "public"."course_run_status" AS ENUM('active', 'completed');--> statement-breakpoint
CREATE TYPE "public"."course_step_phase" AS ENUM('foundation', 'lesson', 'practice', 'assessment', 'retest');--> statement-breakpoint
CREATE TABLE "course_assistance_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"step_id" varchar(80) NOT NULL,
	"kind" "course_assistance_kind" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "course_question_branches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"step_id" varchar(80) NOT NULL,
	"question" text NOT NULL,
	"answer" text NOT NULL,
	"key_points" text[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "course_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"course_slug" varchar(120) NOT NULL,
	"course_version" varchar(40) NOT NULL,
	"mode" "course_run_mode" NOT NULL,
	"status" "course_run_status" DEFAULT 'active' NOT NULL,
	"current_step" integer DEFAULT 0 NOT NULL,
	"assessment_correct" integer DEFAULT 0 NOT NULL,
	"assessment_total" integer DEFAULT 0 NOT NULL,
	"retest_due_at" timestamp with time zone,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "course_step_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"step_id" varchar(80) NOT NULL,
	"phase" "course_step_phase" NOT NULL,
	"response" text NOT NULL,
	"correct" boolean NOT NULL,
	"assistance_level" "course_assistance_level" NOT NULL,
	"feedback" varchar(600) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "course_assistance_events" ADD CONSTRAINT "course_assistance_events_run_id_course_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."course_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_assistance_events" ADD CONSTRAINT "course_assistance_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_question_branches" ADD CONSTRAINT "course_question_branches_run_id_course_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."course_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_question_branches" ADD CONSTRAINT "course_question_branches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_runs" ADD CONSTRAINT "course_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_step_attempts" ADD CONSTRAINT "course_step_attempts_run_id_course_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."course_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_step_attempts" ADD CONSTRAINT "course_step_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "course_assistance_events_run_step_idx" ON "course_assistance_events" USING btree ("run_id","step_id");--> statement-breakpoint
CREATE INDEX "course_question_branches_run_step_idx" ON "course_question_branches" USING btree ("run_id","step_id");--> statement-breakpoint
CREATE UNIQUE INDEX "course_runs_user_course_mode_unique" ON "course_runs" USING btree ("user_id","course_slug","course_version","mode");--> statement-breakpoint
CREATE INDEX "course_runs_user_status_idx" ON "course_runs" USING btree ("user_id","status","updated_at");--> statement-breakpoint
CREATE INDEX "course_step_attempts_run_step_idx" ON "course_step_attempts" USING btree ("run_id","step_id","created_at");
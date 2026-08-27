CREATE TABLE "content_imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_by" uuid,
	"source" varchar(120) NOT NULL,
	"source_version" varchar(80) DEFAULT '' NOT NULL,
	"target_status" "content_status" NOT NULL,
	"fingerprint" varchar(64) NOT NULL,
	"item_count" integer NOT NULL,
	"created_count" integer NOT NULL,
	"updated_count" integer NOT NULL,
	"unchanged_count" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "content_items" ADD COLUMN "source" varchar(120) DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "content_items" ADD COLUMN "source_version" varchar(80) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "content_items" ADD COLUMN "import_batch_id" uuid;--> statement-breakpoint
ALTER TABLE "content_items" ADD COLUMN "imported_by" uuid;--> statement-breakpoint
ALTER TABLE "content_items" ADD COLUMN "imported_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "content_imports" ADD CONSTRAINT "content_imports_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "content_imports_created_idx" ON "content_imports" USING btree ("created_at");--> statement-breakpoint
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_import_batch_id_content_imports_id_fk" FOREIGN KEY ("import_batch_id") REFERENCES "public"."content_imports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_imported_by_users_id_fk" FOREIGN KEY ("imported_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
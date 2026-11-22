CREATE TABLE IF NOT EXISTS "risk_assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"assessed_by_user_id" uuid NOT NULL,
	"status" text NOT NULL,
	"instrument_name" text DEFAULT 'MDRF-IDRS' NOT NULL,
	"instrument_version" text DEFAULT '2005.1' NOT NULL,
	"already_diagnosed" boolean DEFAULT false NOT NULL,
	"age_score" integer,
	"waist_score" integer,
	"activity_score" integer,
	"family_history_score" integer,
	"total_score" integer,
	"risk_tier" text,
	"inputs" jsonb NOT NULL,
	"factor_breakdown" jsonb NOT NULL,
	"clinical_summary" text NOT NULL,
	"assessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "risk_assessments" ADD CONSTRAINT "risk_assessments_assessed_by_user_id_users_id_fk" FOREIGN KEY ("assessed_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "risk_assessments" ADD CONSTRAINT "risk_assessments_patient_composite_fk" FOREIGN KEY ("tenant_id","patient_id") REFERENCES "public"."patients"("tenant_id","id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "clinician_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"verification_status" text DEFAULT 'unverified' NOT NULL,
	"license_number" text,
	"jurisdiction" text,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "clinician_profiles_tenant_user_unique" UNIQUE("tenant_id","user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "care_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"clinician_user_id" uuid NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"priority" text DEFAULT 'routine' NOT NULL,
	"notes" text,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "care_assignments_active_unique" UNIQUE("tenant_id","patient_id","clinician_user_id","status")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "follow_up_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"clinician_user_id" uuid NOT NULL,
	"action_type" text NOT NULL,
	"status" text DEFAULT 'completed' NOT NULL,
	"notes" text,
	"performed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "screenings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"screened_by_user_id" uuid NOT NULL,
	"screening_type" text NOT NULL,
	"value" numeric(8, 2) NOT NULL,
	"unit" text NOT NULL,
	"batch_id" uuid,
	"external_reference" text,
	"screened_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "screenings_tenant_patient_type_time_unique" UNIQUE("tenant_id","patient_id","screening_type","screened_at")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "clinician_profiles" ADD CONSTRAINT "clinician_profiles_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "clinician_profiles" ADD CONSTRAINT "clinician_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "care_assignments" ADD CONSTRAINT "care_assignments_patient_composite_fk" FOREIGN KEY ("tenant_id","patient_id") REFERENCES "public"."patients"("tenant_id","id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "care_assignments" ADD CONSTRAINT "care_assignments_clinician_user_id_users_id_fk" FOREIGN KEY ("clinician_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "follow_up_actions" ADD CONSTRAINT "follow_up_actions_patient_composite_fk" FOREIGN KEY ("tenant_id","patient_id") REFERENCES "public"."patients"("tenant_id","id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "follow_up_actions" ADD CONSTRAINT "follow_up_actions_clinician_user_id_users_id_fk" FOREIGN KEY ("clinician_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "screenings" ADD CONSTRAINT "screenings_patient_composite_fk" FOREIGN KEY ("tenant_id","patient_id") REFERENCES "public"."patients"("tenant_id","id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "screenings" ADD CONSTRAINT "screenings_screened_by_user_id_users_id_fk" FOREIGN KEY ("screened_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "care_assignments_clinician_lookup_idx" ON "care_assignments" ("tenant_id", "clinician_user_id", "status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "follow_up_actions_patient_idx" ON "follow_up_actions" ("tenant_id", "patient_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "screenings_tenant_patient_idx" ON "screenings" ("tenant_id", "patient_id");

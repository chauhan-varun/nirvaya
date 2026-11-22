CREATE TABLE "devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"external_id" text NOT NULL,
	"model" text DEFAULT 'arduino_uno_q_station' NOT NULL,
	"protocol_version" text DEFAULT '1.0' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"secret_key" text NOT NULL,
	"key_version" integer DEFAULT 1 NOT NULL,
	"last_seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "devices_external_id_unique" UNIQUE("external_id")
);
--> statement-breakpoint
CREATE TABLE "device_nonces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_id" uuid NOT NULL,
	"key_version" integer NOT NULL,
	"nonce" text NOT NULL,
	"signed_timestamp" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "device_nonces_device_key_nonce_unique" UNIQUE("device_id","key_version","nonce")
);
--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_patient_composite_fk" FOREIGN KEY ("tenant_id","patient_id") REFERENCES "public"."patients"("tenant_id","id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "device_nonces" ADD CONSTRAINT "device_nonces_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "devices_tenant_patient_idx" ON "devices" ("tenant_id", "patient_id");
--> statement-breakpoint
CREATE INDEX "device_nonces_lookup_idx" ON "device_nonces" ("device_id", "key_version", "nonce");

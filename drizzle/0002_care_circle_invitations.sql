CREATE TABLE "care_circle_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"inviter_user_id" uuid NOT NULL,
	"invitee_email" text NOT NULL,
	"relationship_label" text,
	"requested_scopes" jsonb NOT NULL,
	"purpose" text NOT NULL,
	"policy_version" text NOT NULL,
	"token_digest" text NOT NULL,
	"token_consumed" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"revoker_user_id" uuid,
	"consent_grant_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "care_circle_invitations_token_digest_unique" UNIQUE("token_digest")
);
--> statement-breakpoint
ALTER TABLE "care_circle_invitations" ADD CONSTRAINT "care_circle_invitations_inviter_user_id_users_id_fk" FOREIGN KEY ("inviter_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "care_circle_invitations" ADD CONSTRAINT "care_circle_invitations_revoker_user_id_users_id_fk" FOREIGN KEY ("revoker_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "care_circle_invitations" ADD CONSTRAINT "care_circle_invitations_patient_composite_fk" FOREIGN KEY ("tenant_id","patient_id") REFERENCES "public"."patients"("tenant_id","id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
-- Enforce single-use: once consumed the token digest cannot be reused
ALTER TABLE "care_circle_invitations" ADD CONSTRAINT "care_circle_invitations_status_check"
  CHECK (status IN ('pending', 'accepted', 'revoked', 'expired'));
--> statement-breakpoint
-- accepted_at must follow created_at
ALTER TABLE "care_circle_invitations" ADD CONSTRAINT "care_circle_invitations_accepted_after_created_check"
  CHECK (accepted_at IS NULL OR accepted_at >= created_at);
--> statement-breakpoint
-- expires_at must be after created_at
ALTER TABLE "care_circle_invitations" ADD CONSTRAINT "care_circle_invitations_expires_after_created_check"
  CHECK (expires_at > created_at);
--> statement-breakpoint
-- Indexes for common access patterns
CREATE INDEX "care_circle_invitations_tenant_patient_idx" ON "care_circle_invitations" ("tenant_id", "patient_id");
--> statement-breakpoint
CREATE INDEX "care_circle_invitations_token_digest_idx" ON "care_circle_invitations" ("token_digest");
--> statement-breakpoint
CREATE INDEX "care_circle_invitations_invitee_email_status_idx" ON "care_circle_invitations" ("invitee_email", "status");

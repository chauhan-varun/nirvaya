import { router, protectedProcedure } from "../init"
import { z } from "zod"
import { TRPCError } from "@trpc/server"
import {
  verifyClinicianMembership,
  getClinicianStatus,
  listAssignedPatients,
  recordFollowUpActionAtomic,
  getPatientFollowUpHistory,
  exportPatientSummary,
  bulkImportScreeningsAtomic,
} from "@/server/db/repositories/clinic"

export const clinicRouter = router({
  /**
   * Check if the authenticated user has a verified clinician role.
   */
  status: protectedProcedure.query(async ({ ctx }) => {
    return await getClinicianStatus(ctx.userId)
  }),

  /**
   * Return paginated list of patients explicitly assigned to the clinician.
   * Cross-tenant or unassigned patients are strictly filtered out.
   */
  worklist: protectedProcedure
    .input(
      z.object({
        clinicTenantId: z.string().uuid().optional(),
        search: z.string().optional(),
        priority: z.enum(["all", "routine", "urgent"]).optional(),
        status: z.enum(["all", "active", "completed", "cancelled"]).optional(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(50).default(10),
      })
    )
    .query(async ({ ctx, input }) => {
      const clinician = await verifyClinicianMembership(
        ctx.userId,
        input.clinicTenantId
      ).catch((err: any) => {
        throw new TRPCError({
          code: err.code === "FORBIDDEN" ? "FORBIDDEN" : "INTERNAL_SERVER_ERROR",
          message: err.message,
        })
      })

      return await listAssignedPatients({
        clinicianUserId: clinician.user.id,
        tenantId: clinician.tenant.id,
        search: input.search,
        priority: input.priority,
        status: input.status,
        page: input.page,
        pageSize: input.pageSize,
      })
    }),

  /**
   * Return follow-up action history for an assigned patient.
   */
  patientHistory: protectedProcedure
    .input(
      z.object({
        patientId: z.string().uuid(),
        clinicTenantId: z.string().uuid().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const clinician = await verifyClinicianMembership(
        ctx.userId,
        input.clinicTenantId
      ).catch((err: any) => {
        throw new TRPCError({
          code: err.code === "FORBIDDEN" ? "FORBIDDEN" : "INTERNAL_SERVER_ERROR",
          message: err.message,
        })
      })

      return await getPatientFollowUpHistory(
        clinician.user.id,
        clinician.tenant.id,
        input.patientId
      ).catch((err: any) => {
        throw new TRPCError({
          code: err.code === "FORBIDDEN" ? "FORBIDDEN" : "INTERNAL_SERVER_ERROR",
          message: err.message,
        })
      })
    }),

  /**
   * Record a clinical follow-up action with audit provenance.
   */
  recordAction: protectedProcedure
    .input(
      z.object({
        patientId: z.string().uuid(),
        clinicTenantId: z.string().uuid().optional(),
        actionType: z.enum([
          "phone_call",
          "review",
          "referral",
          "message",
          "in_person",
        ]),
        status: z.enum(["completed", "scheduled", "cancelled"]).default("completed"),
        notes: z.string().max(500).optional(),
        performedAt: z.string().datetime().optional(),
        updatePriority: z.enum(["routine", "urgent"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const clinician = await verifyClinicianMembership(
        ctx.userId,
        input.clinicTenantId
      ).catch((err: any) => {
        throw new TRPCError({
          code: err.code === "FORBIDDEN" ? "FORBIDDEN" : "INTERNAL_SERVER_ERROR",
          message: err.message,
        })
      })

      return await recordFollowUpActionAtomic({
        clinicianUserId: clinician.user.id,
        tenantId: clinician.tenant.id,
        patientId: input.patientId,
        actionType: input.actionType,
        status: input.status,
        notes: input.notes,
        performedAt: input.performedAt ? new Date(input.performedAt) : undefined,
        updatePriority: input.updatePriority,
        requestId: ctx.requestId ?? "req_unknown",
      }).catch((err: any) => {
        throw new TRPCError({
          code: err.code === "FORBIDDEN" ? "FORBIDDEN" : "INTERNAL_SERVER_ERROR",
          message: err.message,
        })
      })
    }),

  /**
   * Generate an authorized summary export with formula injection defense.
   */
  exportSummary: protectedProcedure
    .input(
      z.object({
        patientId: z.string().uuid(),
        clinicTenantId: z.string().uuid().optional(),
        purpose: z.string().min(3).max(200),
        format: z.enum(["json", "csv"]).default("csv"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const clinician = await verifyClinicianMembership(
        ctx.userId,
        input.clinicTenantId
      ).catch((err: any) => {
        throw new TRPCError({
          code: err.code === "FORBIDDEN" ? "FORBIDDEN" : "INTERNAL_SERVER_ERROR",
          message: err.message,
        })
      })

      return await exportPatientSummary({
        clinicianUserId: clinician.user.id,
        tenantId: clinician.tenant.id,
        patientId: input.patientId,
        purpose: input.purpose,
        format: input.format,
        requestId: ctx.requestId ?? "req_unknown",
      }).catch((err: any) => {
        throw new TRPCError({
          code:
            err.code === "FORBIDDEN"
              ? "FORBIDDEN"
              : err.code === "NOT_FOUND"
              ? "NOT_FOUND"
              : "BAD_REQUEST",
          message: err.message,
        })
      })
    }),

  /**
   * Bulk screening import: size bounded, schema validated, dry-run reviewed,
   * transactional, duplicate-aware.
   */
  bulkImport: protectedProcedure
    .input(
      z.object({
        clinicTenantId: z.string().uuid().optional(),
        dryRun: z.boolean().default(false),
        purpose: z.string().min(3).max(200),
        rows: z
          .array(
            z.object({
              patientId: z.string().uuid(),
              screeningType: z.enum([
                "glucose_fasting",
                "glucose_random",
                "systolic_bp",
                "diastolic_bp",
                "weight",
              ]),
              value: z.string(),
              unit: z.string().min(1),
              screenedAt: z.string().datetime(),
              externalReference: z.string().optional(),
            })
          )
          .min(1)
          .max(500),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const clinician = await verifyClinicianMembership(
        ctx.userId,
        input.clinicTenantId
      ).catch((err: any) => {
        throw new TRPCError({
          code: err.code === "FORBIDDEN" ? "FORBIDDEN" : "INTERNAL_SERVER_ERROR",
          message: err.message,
        })
      })

      return await bulkImportScreeningsAtomic({
        clinicianUserId: clinician.user.id,
        tenantId: clinician.tenant.id,
        dryRun: input.dryRun,
        purpose: input.purpose,
        rows: input.rows,
        requestId: ctx.requestId ?? "req_unknown",
      }).catch((err: any) => {
        throw new TRPCError({
          code:
            err.code === "FORBIDDEN"
              ? "FORBIDDEN"
              : err.code === "BAD_REQUEST"
              ? "BAD_REQUEST"
              : "INTERNAL_SERVER_ERROR",
          message: err.message,
        })
      })
    }),
})

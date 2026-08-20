import { z } from "zod";

export const attendanceAudienceSchema = z.enum(["staff", "member"]);
export const attendanceQuerySchema = z.object({
  clientId: z.coerce.number().optional(),
  audience: attendanceAudienceSchema.default("member"),
  personId: z.coerce.number().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional()
});
export const createAttendanceSchema = z.object({
  clientId: z.coerce.number().optional(),
  audience: attendanceAudienceSchema,
  personId: z.coerce.number(),
  attendanceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(["present", "absent", "late", "excused"]),
  notes: z.string().max(2000).optional()
});

export const createAttendanceBatchSchema = z.object({
  clientId: z.coerce.number().optional(),
  audience: attendanceAudienceSchema,
  attendanceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  records: z.array(z.object({
    personId: z.coerce.number().int().positive(),
    status: z.enum(["present", "absent", "late", "excused"]),
    notes: z.string().max(2000).optional()
  })).min(1).max(1000)
});

export type AttendanceQuery = z.infer<typeof attendanceQuerySchema>;
export type CreateAttendanceInput = z.infer<typeof createAttendanceSchema>;
export type CreateAttendanceBatchInput = z.infer<typeof createAttendanceBatchSchema>;

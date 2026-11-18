import { z } from 'zod';
export const loginSchema = z.object({ identifier: z.string().min(2), password: z.string().min(8) });
export const courseSchema = z.object({ code:z.string().min(2), title:z.string().min(2), description:z.string().optional(), programmeId:z.string(), academicYearId:z.string(), semesterId:z.string(), lecturerId:z.string().optional().nullable(), creditHours:z.coerce.number().int().positive(), objectives:z.array(z.string()).default([]) });
export const assignmentSchema = z.object({ title:z.string().min(2), description:z.string().min(2), instructions:z.string().optional(), maxMarks:z.coerce.number().positive(), dueDate:z.coerce.date(), published:z.coerce.boolean().default(false), allowResubmission:z.coerce.boolean().default(false) });
export const gradeSchema = z.object({ marks:z.coerce.number().min(0), feedback:z.string().max(5000).optional() });

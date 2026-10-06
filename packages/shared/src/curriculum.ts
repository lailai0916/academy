import { z } from 'zod';

export { courseStatusLabels, curriculumCatalog } from './catalog.js';

export const subjectCodeSchema = z.enum([
  'chinese',
  'mathematics',
  'english',
  'physics',
  'chemistry',
  'technology',
]);

export const courseStatusSchema = z.enum(['planned', 'designed', 'building', 'pilot', 'available']);

export const planTaskKindSchema = z.enum(['course', 'assessment', 'memory-review']);
export const planTaskStatusSchema = z.enum(['planned', 'active', 'completed']);

export const planTaskSchema = z.discriminatedUnion('kind', [
  z.object({
    id: z.string(),
    kind: z.literal('course'),
    subject: subjectCodeSchema,
    courseSlug: z.string(),
    title: z.string(),
    reason: z.string(),
    status: planTaskStatusSchema,
    completedSteps: z.number().int().nonnegative(),
    totalSteps: z.number().int().nonnegative(),
  }),
  z.object({
    id: z.string(),
    kind: z.literal('assessment'),
    subject: subjectCodeSchema,
    courseSlug: z.string(),
    title: z.string(),
    reason: z.string(),
    status: planTaskStatusSchema,
    dueAt: z.string().nullable(),
    completedSteps: z.number().int().nonnegative(),
    totalSteps: z.number().int().nonnegative(),
  }),
  z.object({
    id: z.string(),
    kind: z.literal('memory-review'),
    contentKind: z.enum(['word', 'poem']),
    title: z.string(),
    due: z.number().int().nonnegative(),
    newCount: z.number().int().nonnegative(),
    completed: z.number().int().nonnegative(),
    status: planTaskStatusSchema,
  }),
]);

export type SubjectCode = z.infer<typeof subjectCodeSchema>;
export type CourseStatus = z.infer<typeof courseStatusSchema>;
export type PlanTaskKind = z.infer<typeof planTaskKindSchema>;
export type PlanTask = z.infer<typeof planTaskSchema>;

export type SubjectCatalogItem = {
  code: SubjectCode;
  name: string;
  scope: string;
  status: CourseStatus;
  memoryModules: Array<'word' | 'poem'>;
};

export type CourseCatalogItem = {
  slug: string;
  subject: SubjectCode;
  grade: '高一' | '高二' | '高三';
  title: string;
  summary: string;
  status: CourseStatus;
  statusDetail: string;
  objectives: string[];
  plannedFlow: string[];
};

export type CurriculumCatalog = {
  subjects: SubjectCatalogItem[];
  courses: CourseCatalogItem[];
  currentCapabilities: string[];
  nextMilestone: string;
};

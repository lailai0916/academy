import { z } from 'zod';
import type { CourseCatalogItem } from './curriculum.js';

export const courseRunModeSchema = z.enum(['lesson', 'retest']);
export const courseRunStatusSchema = z.enum(['active', 'completed']);
export const courseStepPhaseSchema = z.enum([
  'foundation',
  'lesson',
  'practice',
  'assessment',
  'retest',
]);
export const courseAssistanceKindSchema = z.enum(['hint', 'solution']);

export const courseStepCompleteSchema = z.object({
  stepId: z.string().min(1).max(80),
});

export const courseStepAnswerSchema = z.object({
  stepId: z.string().min(1).max(80),
  answer: z.string().trim().min(1, '请先填写答案。').max(2_000),
});

export const courseAssistanceRequestSchema = z.object({
  stepId: z.string().min(1).max(80),
  kind: courseAssistanceKindSchema,
});

export const courseQuestionRequestSchema = z.object({
  stepId: z.string().min(1).max(80),
  question: z.string().trim().min(2, '问题至少需要 2 个字符。').max(1_200),
});

export type CourseRunMode = z.infer<typeof courseRunModeSchema>;
export type CourseRunStatus = z.infer<typeof courseRunStatusSchema>;
export type CourseStepPhase = z.infer<typeof courseStepPhaseSchema>;
export type CourseAssistanceKind = z.infer<typeof courseAssistanceKindSchema>;

export type CourseProgressStatus =
  | 'not-started'
  | 'lesson-in-progress'
  | 'retest-scheduled'
  | 'retest-due'
  | 'retest-in-progress'
  | 'completed';

export type CourseProgress = {
  status: CourseProgressStatus;
  runId: string | null;
  completedSteps: number;
  totalSteps: number;
  progressPercent: number;
  assessmentCorrect: number | null;
  assessmentTotal: number | null;
  retestDueAt: string | null;
};

export type CourseListItem = CourseCatalogItem & {
  progress: CourseProgress;
};

export type CourseContentBlock =
  | { kind: 'paragraph'; text: string }
  | { kind: 'formula'; expression: string }
  | { kind: 'bullets'; items: string[] }
  | { kind: 'callout'; title: string; text: string };

export type CourseStepView = {
  id: string;
  kind: 'reading' | 'question';
  phase: CourseStepPhase;
  phaseLabel: string;
  title: string;
  instruction: string;
  content: CourseContentBlock[];
  question?: string;
  responseKind?: 'choice' | 'number' | 'text';
  options?: string[];
  inputLabel?: string;
  assistanceAvailable: boolean;
  questionsAvailable: boolean;
  progress: {
    completed: number;
    total: number;
  };
};

export type CourseQuestionBranch = {
  id: string;
  stepId: string;
  question: string;
  answer: string;
  keyPoints: string[];
  createdAt: string;
};

export type CourseRunSummary = {
  mode: CourseRunMode;
  assessmentCorrect: number;
  assessmentTotal: number;
  completedAt: string;
  retestDueAt: string | null;
};

export type CourseRunView = {
  id: string;
  course: CourseCatalogItem;
  mode: CourseRunMode;
  status: CourseRunStatus;
  step: CourseStepView | null;
  progress: CourseProgress;
  branches: CourseQuestionBranch[];
  summary: CourseRunSummary | null;
};

export type CourseAnswerResult = {
  correct: boolean;
  feedback: string;
  expectedAnswer: string | null;
  assistanceLevel: 'independent' | 'hint' | 'solution';
  advanced: boolean;
  runComplete: boolean;
};

export type CourseAssistanceResponse = {
  kind: CourseAssistanceKind;
  content: string;
};

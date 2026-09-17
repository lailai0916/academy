import type {
  CourseCatalogItem,
  CourseContentBlock,
  CourseStepPhase,
} from '@lailai/academy-shared';

type BaseCourseStep = {
  id: string;
  phase: CourseStepPhase;
  title: string;
  instruction: string;
  questionsAvailable?: boolean;
};

export type ReadingCourseStep = BaseCourseStep & {
  kind: 'reading';
  content: CourseContentBlock[];
};

export type QuestionCourseStep = BaseCourseStep & {
  kind: 'question';
  content?: CourseContentBlock[];
  question: string;
  responseKind: 'choice' | 'number' | 'text';
  options?: string[];
  inputLabel?: string;
  answer:
    { kind: 'exact'; accepted: string[] } | { kind: 'number'; value: number; tolerance?: number };
  correctFeedback: string;
  incorrectFeedback: string;
  hint?: string;
  solution?: string;
  advanceOnIncorrect?: boolean;
};

export type CourseStepDefinition = ReadingCourseStep | QuestionCourseStep;

export type CourseDefinition = {
  catalog: CourseCatalogItem;
  version: string;
  lessonSteps: CourseStepDefinition[];
  retestSteps: CourseStepDefinition[];
};

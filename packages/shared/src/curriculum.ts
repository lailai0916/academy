import { z } from 'zod';

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
  }),
  z.object({
    id: z.string(),
    kind: z.literal('assessment'),
    subject: subjectCodeSchema,
    courseSlug: z.string(),
    title: z.string(),
    reason: z.string(),
    status: planTaskStatusSchema,
  }),
  z.object({
    id: z.string(),
    kind: z.literal('memory-review'),
    contentKind: z.enum(['word', 'poem']),
    title: z.string(),
    due: z.number().int().nonnegative(),
    newCount: z.number().int().nonnegative(),
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

export const courseStatusLabels: Record<CourseStatus, string> = {
  planned: '规划中',
  designed: '课程设计完成',
  building: '接入中',
  pilot: '试用中',
  available: '可学习',
};

export const curriculumCatalog: CurriculumCatalog = {
  subjects: [
    {
      code: 'chinese',
      name: '语文',
      scope: '文言与古诗词、阅读、答案组织和写作',
      status: 'planned',
      memoryModules: ['poem'],
    },
    {
      code: 'mathematics',
      name: '数学',
      scope: '概念推导、证明、方法选择和限时解题',
      status: 'planned',
      memoryModules: [],
    },
    {
      code: 'english',
      name: '英语',
      scope: '词汇、听力、阅读和写作',
      status: 'planned',
      memoryModules: ['word'],
    },
    {
      code: 'physics',
      name: '物理',
      scope: '研究对象、过程分析、建模和实验',
      status: 'building',
      memoryModules: [],
    },
    {
      code: 'chemistry',
      name: '化学',
      scope: '结构、反应条件、计算和实验推理',
      status: 'planned',
      memoryModules: [],
    },
    {
      code: 'technology',
      name: '技术',
      scope: '程序、制图、电路和设计',
      status: 'planned',
      memoryModules: [],
    },
  ],
  courses: [
    {
      slug: 'physics-momentum',
      subject: 'physics',
      grade: '高二',
      title: '动量定理',
      summary: '从研究对象和过程分析出发，完成讲解、追问、练习、独立测评与延迟复测。',
      status: 'building',
      statusDetail: '课程样例已完成，课堂运行与数据记录正在接入。',
      objectives: ['确定研究对象与正方向', '计算动量变化量', '区分合力冲量与接触力冲量'],
      plannedFlow: ['基础检查', '概念与推导', '课中追问', '分层练习', '独立测评', '延迟复测'],
    },
  ],
  currentCapabilities: [
    '英语词汇与古诗词记忆训练',
    '间隔复习、错题巩固与延迟正确率',
    '教材内容审核、版本记录与 AI 讲解',
  ],
  nextMilestone: '接入动量定理课程，跑通讲解、追问、练习、独立测评和延迟复测。',
};

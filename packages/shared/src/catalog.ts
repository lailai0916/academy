import type { CourseStatus, CurriculumCatalog } from './curriculum.js';

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
      status: 'pilot',
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
      status: 'pilot',
      statusDetail: '已接入可恢复的课堂、分步作答、提示记录、独立测评与延迟复测。',
      objectives: ['确定研究对象与正方向', '计算动量变化量', '区分合力冲量与接触力冲量'],
      plannedFlow: ['基础检查', '概念与推导', '课中追问', '分层练习', '独立测评', '延迟复测'],
    },
  ],
  currentCapabilities: [
    '动量定理连续课程、独立测评与七天延迟复测',
    '课程、复测与记忆训练的统一今日计划',
    '英语词汇与古诗词记忆训练',
    '间隔复习、错题巩固与延迟正确率',
    '教材内容审核、版本记录与 AI 讲解',
  ],
  nextMilestone:
    '用动量定理课程和今日计划完成首轮真实学习，根据作答、追问、任务负荷和复测记录继续修改。',
};

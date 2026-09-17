import { describe, expect, it } from 'vitest';
import { curriculumCatalog, planTaskSchema, subjectCodeSchema } from '@lailai/academy-shared';

describe('curriculum catalog', () => {
  it('covers each Zhejiang Gaokao subject exactly once', () => {
    const subjects = curriculumCatalog.subjects.map((subject) => subject.code);

    expect(subjects).toHaveLength(subjectCodeSchema.options.length);
    expect(new Set(subjects)).toEqual(new Set(subjectCodeSchema.options));
  });

  it('keeps current memory training separate from planned courses', () => {
    const chinese = curriculumCatalog.subjects.find((subject) => subject.code === 'chinese');
    const english = curriculumCatalog.subjects.find((subject) => subject.code === 'english');
    const momentum = curriculumCatalog.courses.find((course) => course.slug === 'physics-momentum');

    expect(chinese?.memoryModules).toEqual(['poem']);
    expect(english?.memoryModules).toEqual(['word']);
    expect(momentum).toMatchObject({ subject: 'physics', status: 'pilot' });
  });

  it('keeps course and memory tasks distinct at the planning boundary', () => {
    const courseTask = planTaskSchema.parse({
      id: 'course-1',
      kind: 'course',
      subject: 'physics',
      courseSlug: 'physics-momentum',
      title: '继续动量定理',
      reason: '完成基础检查后继续课程',
      status: 'planned',
    });
    const memoryTask = planTaskSchema.parse({
      id: 'memory-1',
      kind: 'memory-review',
      contentKind: 'word',
      title: '英语词汇复习',
      due: 8,
      newCount: 4,
      status: 'planned',
    });

    expect(courseTask).toMatchObject({ kind: 'course', subject: 'physics' });
    expect(memoryTask).toMatchObject({ kind: 'memory-review', contentKind: 'word' });
  });
});

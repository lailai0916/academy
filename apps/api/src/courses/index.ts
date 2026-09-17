import { momentumCourse } from './momentum.js';

export const courseDefinitions = [momentumCourse] as const;

export function getCourseDefinition(slug: string) {
  return courseDefinitions.find((course) => course.catalog.slug === slug) ?? null;
}

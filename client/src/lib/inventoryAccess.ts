export function canQueryInventoryOverview(schoolId: number | null, visibleSchoolIds: number[]): boolean {
  return schoolId !== null && visibleSchoolIds.includes(schoolId);
}

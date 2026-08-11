export type ChecklistBackRoute = '/check/result' | '/check';

export function getChecklistBackRoute(hasTransientAnalysis: boolean): ChecklistBackRoute {
  return hasTransientAnalysis ? '/check/result' : '/check';
}

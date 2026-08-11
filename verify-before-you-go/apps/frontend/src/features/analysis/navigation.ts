export const analysisActionRoutes = {
  checklist: { route: '/check/checklist', checkpoint: 'CP05' },
  report: { route: '/reports/new', checkpoint: 'CP10' },
  share: { route: '/share/preview', checkpoint: 'CP12' },
} as const;

export const legacyShareRoute = '/check/share' as const;

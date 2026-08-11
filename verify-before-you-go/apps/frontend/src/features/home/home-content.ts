export const primaryHomeAction = {
  title: 'Check a job offer',
  description: 'See the words, missing details and independent checks — never a scam score.',
  href: '/check',
  accessibilityLabel: 'Check a job offer',
} as const;

export const homeActionCards = [
  {
    title: 'Recruitment news',
    description: 'Market updates and scam-watch explainers',
    href: '/news',
    icon: 'newspaper-outline',
  },
  {
    title: 'Take a MIL quiz',
    description: 'Five questions · about 3 minutes',
    href: '/quiz',
    icon: 'help-circle-outline',
  },
  {
    title: 'Reviewed alerts',
    description: 'Patterns and official-source mismatches',
    href: '/alerts',
    icon: 'search-outline',
  },
  {
    title: 'Report an offer',
    description: 'Private intake · anonymous by default',
    href: '/reports/new',
    icon: 'add-outline',
  },
] as const;

export const homeFeatures = [
  {
    eyebrow: 'Latest recruitment briefing',
    title: 'Three checks before paying a fee',
    description: 'Pause before paying money or sharing an identity document. Verify through a channel the recruiter did not provide.',
    metadata: 'Synthetic demo editorial content · 03 Aug',
    href: '/news',
    tone: 'blue',
    icon: 'reader-outline',
  },
  {
    eyebrow: 'Quick practice',
    title: 'Can a polished certificate prove an offer is genuine?',
    description: 'Choose the next independent check and practise one transferable media literacy habit.',
    metadata: 'Synthetic demo question · Question 2 of 5',
    href: '/quiz',
    tone: 'purple',
    icon: 'bulb-outline',
  },
] as const;

export const homeUtilityLinks = [
  {
    title: 'My reports',
    description: 'Return with your private recovery key',
    href: '/reports',
    icon: 'folder-open-outline',
  },
  {
    title: 'Help and emergency contacts',
    description: 'Find local support and urgent options',
    href: '/help',
    icon: 'help-buoy-outline',
  },
  {
    title: 'How it works',
    description: 'Understand the evidence-first approach',
    href: '/how-it-works',
    icon: 'information-circle-outline',
  },
] as const;

export const tabRoutes = [
  { name: 'Home', href: '/' },
  { name: 'Check', href: '/check' },
  { name: 'News', href: '/news' },
  { name: 'Quiz', href: '/quiz' },
  { name: 'Help', href: '/help' },
] as const;

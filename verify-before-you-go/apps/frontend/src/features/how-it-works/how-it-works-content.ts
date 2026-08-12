export const howItWorksSteps = [
  {
    id: 'observe',
    number: '01',
    title: 'See what was observed',
    body: 'The analysis reads the submitted posting text and URL text, then marks passages that match transparent warning-signal rules.',
    note: 'A signal count is a count, not a score or a prediction.',
  },
  {
    id: 'understand',
    number: '02',
    title: 'Keep the unknowns visible',
    body: 'Each finding explains why the wording may matter and what the app still cannot know about the employer, role or sender.',
    note: 'No finding identifies an offer, company or person as safe or fraudulent.',
  },
  {
    id: 'verify',
    number: '03',
    title: 'Check independently',
    body: 'Use a source you found separately: an official registry, issuing authority, employer website or published contact channel.',
    note: 'Compare the legal name, role terms, pay, location, fees and document requests before deciding what to do.',
  },
] as const;

export const deviceAndServerFacts = [
  {
    id: 'device',
    title: 'On this device',
    icon: 'phone-portrait-outline' as const,
    body: 'Checklist and quiz progress, report drafts, selected report evidence and saved public copies remain in local device or browser storage.',
    note: 'Recovery keys are retained only after you choose. Native uses secure device storage; web asks you to save or re-enter the one-time key.',
  },
  {
    id: 'server',
    title: 'Sent when you choose',
    icon: 'swap-horizontal-outline' as const,
    body: 'Running a check sends submitted text and URL text to the backend for transient analysis. The selected checker screenshot is not uploaded or read.',
    note: 'Submitting a report sends the reviewed structured report, privacy choices and redacted preview. Local evidence files are not included in the current submission.',
  },
] as const;

export const howItWorksLinks = [
  { href: '/' as const, label: 'Back to Homepage', icon: 'home-outline' as const },
  { href: '/check' as const, label: 'Check an offer', icon: 'scan-outline' as const },
  { href: '/help' as const, label: 'Get help', icon: 'help-buoy-outline' as const },
] as const;

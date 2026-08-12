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
    body: 'Evidence images stay on this device and are not uploaded. Checklist and quiz progress, report drafts and saved public copies also use local device or browser storage.',
    note: 'After a successful submission, native automatically attempts to save a delivered recovery key in secure device storage, and the receipt reports whether this succeeded. Web does not save it automatically; copy or download it, or enter it again later.',
  },
  {
    id: 'server',
    title: 'Sent when you choose',
    icon: 'swap-horizontal-outline' as const,
    body: 'A private report sends the full identifier, factual description, selected behaviours, privacy choices and redacted preview to the backend. The server encrypts the private identifier and description.',
    note: 'A public redacted derivative is stored only when you enable the corresponding permission. For a check, the API receives submitted posting text, URL text and screenshotProvided for transient analysis. Screenshot pixels are not uploaded, OCR’d or analysed, and check content is not persisted.',
  },
] as const;

export const howItWorksLinks = [
  { href: '/' as const, label: 'Back to Homepage', icon: 'home-outline' as const },
  { href: '/check' as const, label: 'Check an offer', icon: 'scan-outline' as const },
  { href: '/help' as const, label: 'Get help', icon: 'help-buoy-outline' as const },
] as const;

export const STARTUP_ONBOARDING_CARDS = [
  {
    id: 'observe',
    label: 'Card 01 / 03',
    title: 'Paste the offer. See how it was built.',
    body: "This takes the posting apart line by line — the pay, the pressure, the paperwork that isn't there — and names each thing it found.",
  },
  {
    id: 'decide',
    label: 'Card 02 / 03',
    title: 'It will not decide for you.',
    body: 'No verdict, no score, no accusation against any company or person. Every finding comes with a way to check it yourself in about five minutes.',
  },
  {
    id: 'help',
    label: 'Card 03 / 03',
    title: 'Help works without an account.',
    body: 'Embassy, anti-trafficking hotline and local emergency numbers open from every screen, with no sign-in and no data connection.',
    callout: 'Save them before you travel.',
  },
] as const;

export type StartupOnboardingCard = (typeof STARTUP_ONBOARDING_CARDS)[number];

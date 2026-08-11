export type ScenarioChoice = 'A' | 'B' | null;

export type ScenarioPosting = {
  id: Exclude<ScenarioChoice, null>;
  title: string;
  disclosure: string;
  body: string;
  evidenceLabel: string;
  evidenceNumber: string;
  evidenceExplanation: string;
};

export const scenarioPostings: readonly ScenarioPosting[] = [
  {
    id: 'A',
    title: 'Ad A',
    disclosure: 'Synthetic demo',
    body: 'Warehouse packing, Poland. Hiring now. No interview—we hire on the spot. Weekly cash pay. Send a passport photo before the contract to reserve your place.',
    evidenceLabel: 'Send a passport photo before the contract',
    evidenceNumber: '01',
    evidenceExplanation: 'Urgency, no interview and an identity-document request appear before any contract exists.',
  },
  {
    id: 'B',
    title: 'Ad B',
    disclosure: 'Synthetic demo',
    body: 'Seasonal harvest, Korea. Contract in Vietnamese and Korean, signed before departure. Agency licence no. SYN-08/2024.',
    evidenceLabel: 'Agency licence no. SYN-08/2024',
    evidenceNumber: '02',
    evidenceExplanation: 'In this synthetic demo registry, the number resolves to a different fictional agency—not an official or live record.',
  },
] as const;

export function chooseScenarioPosting(choice: Exclude<ScenarioChoice, null>): ScenarioChoice {
  return choice;
}

export function resetScenarioChoice(): ScenarioChoice {
  return null;
}

export function getScenarioChoiceForRadioKey(
  current: Exclude<ScenarioChoice, null>,
  key: string,
): Exclude<ScenarioChoice, null> | null {
  if (key === 'Home') return 'A';
  if (key === 'End') return 'B';
  if (key === 'ArrowRight' || key === 'ArrowDown') return current === 'A' ? 'B' : 'A';
  if (key === 'ArrowLeft' || key === 'ArrowUp') return current === 'A' ? 'B' : 'A';
  return null;
}

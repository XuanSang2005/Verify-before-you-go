import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  chooseScenarioPosting,
  getScenarioChoiceForRadioKey,
  resetScenarioChoice,
  scenarioPostings,
  type ScenarioChoice,
} from './scenario-model';

const screenSource = readFileSync(new URL('./ScenarioPracticeScreen.tsx', import.meta.url), 'utf8');
const exerciseSource = readFileSync(new URL('./ScenarioExercise.tsx', import.meta.url), 'utf8');
const routeSource = readFileSync(new URL('../../../app/learn/scenario.tsx', import.meta.url), 'utf8');

test('scenario starts untouched, supports choosing A or B and resets locally', () => {
  let choice: ScenarioChoice = null;
  assert.equal(choice, null);
  choice = chooseScenarioPosting('A');
  assert.equal(choice, 'A');
  choice = chooseScenarioPosting('B');
  assert.equal(choice, 'B');
  choice = resetScenarioChoice();
  assert.equal(choice, null);
});

test('both postings are explicitly synthetic and disclose independently checkable concerns', () => {
  assert.equal(scenarioPostings.length, 2);
  assert.deepEqual(scenarioPostings.map((posting) => posting.disclosure), ['Synthetic demo', 'Synthetic demo']);
  assert.match(scenarioPostings[0].body, /Hiring now/i);
  assert.match(scenarioPostings[0].body, /No interview/i);
  assert.match(scenarioPostings[0].body, /passport photo before the contract/i);
  assert.match(scenarioPostings[1].body, /licence no\. SYN-08\/2024/i);
  assert.match(scenarioPostings[1].evidenceExplanation, /synthetic demo registry/i);
  assert.match(scenarioPostings[1].evidenceExplanation, /not an official or live record/i);
});

test('radio arrow keys wrap, while Home and End choose deterministic options', () => {
  assert.equal(getScenarioChoiceForRadioKey('A', 'ArrowRight'), 'B');
  assert.equal(getScenarioChoiceForRadioKey('B', 'ArrowRight'), 'A');
  assert.equal(getScenarioChoiceForRadioKey('A', 'ArrowLeft'), 'B');
  assert.equal(getScenarioChoiceForRadioKey('B', 'ArrowUp'), 'A');
  assert.equal(getScenarioChoiceForRadioKey('B', 'Home'), 'A');
  assert.equal(getScenarioChoiceForRadioKey('A', 'End'), 'B');
  assert.equal(getScenarioChoiceForRadioKey('A', 'Enter'), null);
});

test('scenario route replaces the placeholder and remains offline-only', () => {
  assert.match(routeSource, /ScenarioPracticeScreen/);
  assert.doesNotMatch(routeSource, /PlaceholderScreen|CP06/);
  assert.doesNotMatch(`${screenSource}\n${exerciseSource}`, /fetch\(|axios|analysisApi|AsyncStorage/);
  assert.match(screenSource, /router\.replace\('\/check'\)/);
  assert.doesNotMatch(screenSource, /router\.push\('\/check\/result'\)/);
});

test('selection exposes roving radio semantics and minimum touch targets without truncation', () => {
  assert.match(exerciseSource, /accessibilityRole="radiogroup"/);
  assert.match(exerciseSource, /accessibilityRole="radio"/);
  assert.match(exerciseSource, /aria-checked=\{selected\}/);
  assert.match(exerciseSource, /tabIndex=\{tabbable \? 0 : -1\}/);
  assert.match(exerciseSource, /onKeyDown/);
  assert.match(exerciseSource, /getScenarioChoiceForRadioKey/);
  assert.match(exerciseSource, /minHeight: 48/);
  assert.doesNotMatch(exerciseSource, /numberOfLines|ellipsizeMode/);
});

test('two full-width horizontal option rows replace the former two-column cards', () => {
  assert.match(exerciseSource, /postingGroup: \{ minWidth: 0, width: '100%', flexDirection: 'column'/);
  assert.match(exerciseSource, /postingCard: \{ position: 'relative', minWidth: 0, width: '100%'/);
  assert.match(exerciseSource, /postingMainRow: \{[\s\S]*flexDirection: 'row'/);
  assert.doesNotMatch(exerciseSource, /shouldStackScenarioCards|postingGroupStacked/);
  assert.doesNotMatch(exerciseSource, /Choose \$\{posting\.id\}|Choose A|Choose B/);
});

test('selection ring does not change card padding and evidence expands full width', () => {
  assert.match(exerciseSource, /postingSelectionRing: \{ position: 'absolute'/);
  assert.doesNotMatch(exerciseSource, /postingCardSelected/);
  assert.match(exerciseSource, /evidenceSection: \{ minWidth: 0, width: '100%'/);
  assert.match(exerciseSource, /\{picked \? \(/);
});

test('decorative texture has no label and evidence sits outside the radio accessible name', () => {
  assert.match(exerciseSource, /importantForAccessibility="no-hide-descendants"/);
  assert.match(exerciseSource, /aria-hidden/);
  assert.match(exerciseSource, /<ImageBackground[\s\S]*accessible=\{false\}/);
  assert.doesNotMatch(exerciseSource, /Annotated evidence:/);
  assert.match(exerciseSource, /accessibilityLabel=\{`\$\{posting\.title\}/);
});

test('Screen 07 asset and approved floating icon-only navigation remain local', () => {
  const illustration = readFileSync(
    new URL('../../../assets/prototype/screen07-scenario.jpg', import.meta.url),
  );

  assert.equal(
    createHash('sha256').update(illustration).digest('hex'),
    '3852f40c1371de4f9229add05c44df28ed32b9865b8afc2bb83f6f4066503981',
  );
  assert.match(screenSource, /screen07-scenario\.jpg/);
  assert.match(screenSource, /floatingTabBarContract\.webBottom/);
  assert.match(screenSource, /tabRoutes\.map/);
  assert.doesNotMatch(screenSource, /Verify Before You Go|Get help/);
});

test('scenario avoids motion and fixed-height posting content', () => {
  assert.doesNotMatch(exerciseSource, /Animated|withSpring|numberOfLines|ellipsizeMode/);
  assert.match(exerciseSource, /postingCard: \{ position: 'relative', minWidth: 0, width: '100%'/);
});

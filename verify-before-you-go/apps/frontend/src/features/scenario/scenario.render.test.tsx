import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, expect, it } from 'vitest';

import { ScenarioExercise } from './ScenarioExercise';
import { scenarioPostings } from './scenario-model';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Harness = {
  container: HTMLDivElement;
  getOption: (id: 'A' | 'B') => HTMLElement;
  onCtaCalls: () => number;
  root: Root;
};

async function renderExercise(): Promise<Harness> {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  let ctaCalls = 0;

  await act(async () => {
    root.render(
      <ScenarioExercise
        gridTextureSource={{ uri: 'decorative-grid.png' }}
        illustrationSource={{ uri: 'screen-07-illustration.jpg' }}
        onBack={() => undefined}
        onCta={() => { ctaCalls += 1; }}
        webKeyboardEnabled
      />,
    );
  });

  return {
    container,
    getOption: (id) => {
      const option = container.querySelector<HTMLElement>(`[data-testid="scenario-option-${id}"]`);
      if (!option) throw new Error(`Scenario option ${id} was not rendered`);
      return option;
    },
    onCtaCalls: () => ctaCalls,
    root,
  };
}

async function cleanup(harness: Harness) {
  await act(async () => harness.root.unmount());
  harness.container.remove();
}

function exactTextNodeCount(container: HTMLElement, expected: string) {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let count = 0;
  let node = walker.nextNode();
  while (node) {
    if (node.nodeValue === expected) count += 1;
    node = walker.nextNode();
  }
  return count;
}

describe('CP06 rendered scenario interactions', () => {
  it('selects A and B with checked state and roving tabIndex', async () => {
    const harness = await renderExercise();

    expect(harness.getOption('A').getAttribute('aria-checked')).toBe('false');
    expect(harness.getOption('A').tabIndex).toBe(0);
    expect(harness.getOption('B').tabIndex).toBe(-1);

    await act(async () => harness.getOption('A').click());
    expect(harness.getOption('A').getAttribute('aria-checked')).toBe('true');
    expect(harness.getOption('A').tabIndex).toBe(0);
    expect(harness.getOption('B').tabIndex).toBe(-1);

    await act(async () => harness.getOption('B').click());
    expect(harness.getOption('A').getAttribute('aria-checked')).toBe('false');
    expect(harness.getOption('A').tabIndex).toBe(-1);
    expect(harness.getOption('B').getAttribute('aria-checked')).toBe('true');
    expect(harness.getOption('B').tabIndex).toBe(0);

    await cleanup(harness);
  });

  it('uses arrow keys to change selection and move DOM focus', async () => {
    const harness = await renderExercise();
    const first = harness.getOption('A');
    await act(async () => first.focus());
    expect(document.activeElement).toBe(first);

    await act(async () => {
      first.dispatchEvent(new KeyboardEvent('keydown', {
        bubbles: true,
        cancelable: true,
        key: 'ArrowRight',
      }));
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    });

    expect(harness.getOption('A').tabIndex).toBe(-1);
    expect(harness.getOption('B').getAttribute('aria-checked')).toBe('true');
    expect(harness.getOption('B').tabIndex).toBe(0);
    expect(document.activeElement).toBe(harness.getOption('B'));

    await act(async () => {
      harness.getOption('B').dispatchEvent(new KeyboardEvent('keydown', {
        bubbles: true,
        cancelable: true,
        key: 'ArrowUp',
      }));
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    });
    expect(harness.getOption('A').getAttribute('aria-checked')).toBe('true');
    expect(document.activeElement).toBe(harness.getOption('A'));

    await cleanup(harness);
  });

  it('Reset clears selection, evidence and feedback', async () => {
    const harness = await renderExercise();

    await act(async () => harness.getOption('A').click());
    expect(harness.container.querySelector('[data-testid="scenario-feedback"]')).not.toBeNull();
    expect(harness.container.querySelector('[data-testid="scenario-evidence-A"]')).not.toBeNull();

    const reset = harness.container.querySelector<HTMLElement>('[data-testid="scenario-reset"]');
    if (!reset) throw new Error('Reset control was not rendered');
    expect(reset.getAttribute('aria-disabled')).not.toBe('true');
    await act(async () => reset.click());

    expect(harness.getOption('A').getAttribute('aria-checked')).toBe('false');
    expect(harness.getOption('A').tabIndex).toBe(0);
    expect(harness.getOption('B').tabIndex).toBe(-1);
    expect(harness.container.querySelector('[data-testid="scenario-feedback"]')).toBeNull();
    expect(harness.container.querySelector('[data-testid="scenario-evidence-A"]')).toBeNull();
    expect(harness.container.querySelector('[data-testid="scenario-cta"]')).toBeNull();

    await cleanup(harness);
  });

  it('CTA invokes the production navigation seam after a choice', async () => {
    const harness = await renderExercise();

    await act(async () => harness.getOption('B').click());
    const cta = harness.container.querySelector<HTMLElement>('[data-testid="scenario-cta"]');
    if (!cta) throw new Error('Scenario CTA was not rendered');
    await act(async () => cta.click());

    expect(harness.onCtaCalls()).toBe(1);
    await cleanup(harness);
  });

  it('keeps grid textures decorative and exposes each evidence text once', async () => {
    const harness = await renderExercise();
    await act(async () => harness.getOption('A').click());

    const textures = harness.container.querySelectorAll<HTMLElement>('[data-testid^="scenario-grid-texture-"]');
    expect(textures).toHaveLength(2);
    for (const texture of textures) {
      expect(texture.getAttribute('aria-label')).toBeNull();
      expect(texture.querySelector('[aria-label]')).toBeNull();
    }

    for (const posting of scenarioPostings) {
      expect(exactTextNodeCount(harness.container, posting.evidenceExplanation)).toBe(1);
      expect(exactTextNodeCount(harness.container, posting.evidenceLabel)).toBe(1);
      expect(harness.getOption(posting.id).getAttribute('aria-label')).not.toContain(posting.evidenceExplanation);
    }

    await cleanup(harness);
  });
});

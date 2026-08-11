import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  createWebFloatingTabBarKeyboardController,
  floatingTabBarKeyboardContract,
  getNativeKeyboardVisibilityEvents,
  isTextEntryElement,
  isTouchMobileWebEnvironment,
  type WebFloatingTabBarKeyboardEnvironment,
} from './floating-tab-bar-keyboard';

type Listener = () => void;

class FakeKeyboardEnvironment implements WebFloatingTabBarKeyboardEnvironment {
  touchMobile = true;
  hasVisualViewport = true;
  activeElement: unknown = { tagName: 'BODY' };
  layoutViewportHeight = 844;
  viewportOffsetTop = 0;
  viewportHeight = 844;
  hiddenChanges: boolean[] = [];
  private nextHandle = 1;
  private frames = new Map<number, Listener>();
  private timeouts = new Map<number, { callback: Listener; delay: number }>();
  private documentListeners = new Map<string, Set<Listener>>();
  private windowListeners = new Map<string, Set<Listener>>();
  private viewportListeners = new Map<string, Set<Listener>>();

  getActiveElement = () => this.activeElement;
  getLayoutViewportHeight = () => this.layoutViewportHeight;
  getViewportOffsetTop = () => this.viewportOffsetTop;
  getViewportHeight = () => this.viewportHeight;
  onHiddenChange = (hidden: boolean) => this.hiddenChanges.push(hidden);

  addDocumentListener = (type: 'focusin' | 'focusout', listener: Listener) => {
    this.addListener(this.documentListeners, type, listener);
  };

  removeDocumentListener = (type: 'focusin' | 'focusout', listener: Listener) => {
    this.documentListeners.get(type)?.delete(listener);
  };

  addWindowListener = (type: 'resize', listener: Listener) => {
    this.addListener(this.windowListeners, type, listener);
  };

  removeWindowListener = (type: 'resize', listener: Listener) => {
    this.windowListeners.get(type)?.delete(listener);
  };

  addViewportListener = (type: 'resize', listener: Listener) => {
    this.addListener(this.viewportListeners, type, listener);
  };

  removeViewportListener = (type: 'resize', listener: Listener) => {
    this.viewportListeners.get(type)?.delete(listener);
  };

  requestAnimationFrame = (callback: Listener) => {
    const handle = this.nextHandle++;
    this.frames.set(handle, callback);
    return handle;
  };

  cancelAnimationFrame = (handle: number) => {
    this.frames.delete(handle);
  };

  setTimeout = (callback: Listener, delay: number) => {
    const handle = this.nextHandle++;
    this.timeouts.set(handle, { callback, delay });
    return handle;
  };

  clearTimeout = (handle: number) => {
    this.timeouts.delete(handle);
  };

  emitDocument(type: 'focusin' | 'focusout') {
    this.emit(this.documentListeners, type);
  }

  emitWindowResize() {
    this.emit(this.windowListeners, 'resize');
  }

  emitViewport(type: 'resize' | 'scroll') {
    this.emit(this.viewportListeners, type);
  }

  flushAnimationFrame() {
    const callbacks = [...this.frames.values()];
    this.frames.clear();
    callbacks.forEach((callback) => callback());
  }

  flushTimeouts(maxDelay = Number.POSITIVE_INFINITY) {
    const entries = [...this.timeouts.entries()];
    entries.forEach(([handle, pending]) => {
      if (pending.delay > maxDelay || !this.timeouts.delete(handle)) return;
      pending.callback();
    });
  }

  pendingWork() {
    return { frames: this.frames.size, timeouts: this.timeouts.size };
  }

  listenerCount() {
    const count = (listeners: Map<string, Set<Listener>>) => (
      [...listeners.values()].reduce((total, set) => total + set.size, 0)
    );
    return count(this.documentListeners) + count(this.windowListeners) + count(this.viewportListeners);
  }

  viewportListenerCount(type: 'resize' | 'scroll') {
    return this.viewportListeners.get(type)?.size ?? 0;
  }

  private addListener(target: Map<string, Set<Listener>>, type: string, listener: Listener) {
    const listeners = target.get(type) ?? new Set<Listener>();
    listeners.add(listener);
    target.set(type, listeners);
  }

  private emit(target: Map<string, Set<Listener>>, type: string) {
    [...(target.get(type) ?? [])].forEach((listener) => listener());
  }
}

function focusInput(environment: FakeKeyboardEnvironment) {
  environment.activeElement = { tagName: 'INPUT' };
  environment.emitDocument('focusin');
}

function blurInput(environment: FakeKeyboardEnvironment) {
  environment.activeElement = { tagName: 'BODY' };
  environment.emitDocument('focusout');
  environment.flushAnimationFrame();
}

test('focus hides the bar before any visual viewport resize', () => {
  const environment = new FakeKeyboardEnvironment();
  createWebFloatingTabBarKeyboardController(environment);

  focusInput(environment);

  assert.equal(environment.viewportHeight, 844);
  assert.deepEqual(environment.hiddenChanges, [true]);
});

test('Safari toolbar resize without a focused editor does not hide the bar', () => {
  const environment = new FakeKeyboardEnvironment();
  createWebFloatingTabBarKeyboardController(environment);

  environment.viewportHeight = 760;
  environment.emitViewport('resize');
  environment.viewportHeight = 812;
  environment.emitViewport('resize');

  assert.deepEqual(environment.hiddenChanges, []);
});

test('switching directly between inputs does not flash the bar', () => {
  const environment = new FakeKeyboardEnvironment();
  createWebFloatingTabBarKeyboardController(environment);
  focusInput(environment);

  environment.activeElement = { tagName: 'BODY' };
  environment.emitDocument('focusout');
  environment.activeElement = { tagName: 'TEXTAREA' };
  environment.emitDocument('focusin');
  environment.flushAnimationFrame();

  assert.deepEqual(environment.hiddenChanges, [true]);
});

test('blur while the visual viewport is reduced keeps the bar hidden', () => {
  const environment = new FakeKeyboardEnvironment();
  createWebFloatingTabBarKeyboardController(environment);
  focusInput(environment);
  environment.viewportHeight = 560;
  environment.emitViewport('resize');

  blurInput(environment);
  environment.flushAnimationFrame();
  environment.flushAnimationFrame();

  assert.deepEqual(environment.hiddenChanges, [true]);
});

test('bar returns only after visual viewport recovery is stable', () => {
  const environment = new FakeKeyboardEnvironment();
  createWebFloatingTabBarKeyboardController(environment);
  focusInput(environment);
  environment.viewportHeight = 560;
  environment.emitViewport('resize');
  blurInput(environment);

  environment.viewportHeight = 844;
  environment.emitViewport('resize');
  assert.deepEqual(environment.hiddenChanges, [true]);

  environment.flushTimeouts(floatingTabBarKeyboardContract.viewportSettleDelayMs);
  assert.deepEqual(environment.hiddenChanges, [true]);
  environment.flushAnimationFrame();
  assert.deepEqual(environment.hiddenChanges, [true]);
  environment.flushAnimationFrame();
  assert.deepEqual(environment.hiddenChanges, [true, false]);
});

test('Safari toolbar final height waits for layout viewport recovery before showing', () => {
  const environment = new FakeKeyboardEnvironment();
  createWebFloatingTabBarKeyboardController(environment);
  focusInput(environment);
  environment.viewportHeight = 560;
  environment.emitViewport('resize');
  blurInput(environment);

  environment.viewportHeight = 782;
  environment.emitViewport('resize');
  assert.deepEqual(environment.hiddenChanges, [true]);

  environment.flushTimeouts(floatingTabBarKeyboardContract.viewportSettleDelayMs);
  environment.flushAnimationFrame();
  environment.flushAnimationFrame();
  assert.deepEqual(environment.hiddenChanges, [true]);

  environment.layoutViewportHeight = 782;
  environment.emitWindowResize();
  environment.flushTimeouts(floatingTabBarKeyboardContract.viewportSettleDelayMs);
  environment.flushAnimationFrame();
  assert.deepEqual(environment.hiddenChanges, [true]);
  environment.flushAnimationFrame();
  assert.deepEqual(environment.hiddenChanges, [true, false]);
});

test('bounded safety recovery prevents a permanent hidden bar when Safari omits window resize', () => {
  const environment = new FakeKeyboardEnvironment();
  createWebFloatingTabBarKeyboardController(environment);
  focusInput(environment);
  environment.viewportHeight = 560;
  environment.emitViewport('resize');
  blurInput(environment);
  environment.viewportHeight = 782;
  environment.emitViewport('resize');

  environment.flushTimeouts(floatingTabBarKeyboardContract.viewportSettleDelayMs);
  assert.deepEqual(environment.hiddenChanges, [true]);

  environment.flushTimeouts(floatingTabBarKeyboardContract.layoutRecoverySafetyDelayMs);
  environment.flushTimeouts(floatingTabBarKeyboardContract.viewportSettleDelayMs);
  environment.flushAnimationFrame();
  environment.flushAnimationFrame();
  assert.deepEqual(environment.hiddenChanges, [true, false]);
});

test('bounded fallback restores after blur when VisualViewport is unavailable', () => {
  const environment = new FakeKeyboardEnvironment();
  environment.hasVisualViewport = false;
  createWebFloatingTabBarKeyboardController(environment);
  focusInput(environment);

  blurInput(environment);
  assert.deepEqual(environment.hiddenChanges, [true]);
  assert.equal(environment.pendingWork().timeouts, 1);
  assert.equal(floatingTabBarKeyboardContract.fallbackRestoreDelayMs, 320);

  environment.flushTimeouts();
  assert.deepEqual(environment.hiddenChanges, [true, false]);
});

test('native iOS waits for keyboardDidHide while Android behavior stays unchanged', () => {
  assert.deepEqual(getNativeKeyboardVisibilityEvents('ios'), {
    show: 'keyboardWillShow',
    hide: 'keyboardDidHide',
  });
  assert.deepEqual(getNativeKeyboardVisibilityEvents('android'), {
    show: 'keyboardDidShow',
    hide: 'keyboardDidHide',
  });
});

test('cleanup removes listeners and cancels every pending frame and timeout', () => {
  const environment = new FakeKeyboardEnvironment();
  environment.hasVisualViewport = false;
  const cleanup = createWebFloatingTabBarKeyboardController(environment);
  focusInput(environment);
  blurInput(environment);

  assert.ok(environment.listenerCount() > 0);
  assert.equal(environment.pendingWork().timeouts, 1);
  cleanup();

  assert.equal(environment.listenerCount(), 0);
  assert.deepEqual(environment.pendingWork(), { frames: 0, timeouts: 0 });
});

test('cleanup cancels VisualViewport settlement frames', () => {
  const environment = new FakeKeyboardEnvironment();
  const cleanup = createWebFloatingTabBarKeyboardController(environment);
  focusInput(environment);
  environment.viewportHeight = 560;
  environment.emitViewport('resize');
  blurInput(environment);
  environment.viewportHeight = 782;
  environment.emitViewport('resize');
  environment.layoutViewportHeight = 782;
  environment.emitWindowResize();
  environment.flushTimeouts(floatingTabBarKeyboardContract.viewportSettleDelayMs);

  assert.equal(environment.pendingWork().frames, 1);
  cleanup();
  assert.equal(environment.listenerCount(), 0);
  assert.deepEqual(environment.pendingWork(), { frames: 0, timeouts: 0 });
});

test('touch/mobile detection includes coarse pointers and touch points', () => {
  assert.equal(isTouchMobileWebEnvironment({ coarsePointer: true, maxTouchPoints: 0, touchEventSupported: false }), true);
  assert.equal(isTouchMobileWebEnvironment({ coarsePointer: false, maxTouchPoints: 1, touchEventSupported: false }), true);
  assert.equal(isTouchMobileWebEnvironment({ coarsePointer: false, maxTouchPoints: 0, touchEventSupported: false }), false);
});

test('tab bar keyboard controller does not subscribe to visual viewport scroll', () => {
  const environment = new FakeKeyboardEnvironment();
  const cleanup = createWebFloatingTabBarKeyboardController(environment);

  assert.equal(environment.viewportListenerCount('resize'), 1);
  assert.equal(environment.viewportListenerCount('scroll'), 0);

  cleanup();
  assert.equal(environment.viewportListenerCount('resize'), 0);
});

test('input, textarea and contenteditable elements are all treated as text entry', () => {
  assert.equal(isTextEntryElement({ tagName: 'input' }), true);
  assert.equal(isTextEntryElement({ tagName: 'TEXTAREA' }), true);
  assert.equal(isTextEntryElement({ tagName: 'DIV', isContentEditable: true }), true);
  assert.equal(isTextEntryElement({ tagName: 'BUTTON' }), false);
});

test('approved absolute positioning and keyboard threshold removal stay explicit', () => {
  const layoutSource = readFileSync(new URL('../../../app/(tabs)/_layout.tsx', import.meta.url), 'utf8');
  assert.match(layoutSource, /position: 'absolute'/);
  assert.doesNotMatch(layoutSource, /position: 'fixed'/);
  assert.doesNotMatch(layoutSource, /if \(keyboardVisible\) return null/);
  assert.doesNotMatch(layoutSource, />\s*120|keyboardWillHide/);
  assert.match(layoutSource, /floatingTabBarContract\.webBottom/);
  assert.match(layoutSource, /keyboardVisible \? styles\.dockKeyboardHidden : styles\.dockInteractive/);
  assert.match(layoutSource, /dockKeyboardHidden:[\s\S]*pointerEvents: 'none'/);
  assert.match(layoutSource, /touchAction: 'none'/);
});

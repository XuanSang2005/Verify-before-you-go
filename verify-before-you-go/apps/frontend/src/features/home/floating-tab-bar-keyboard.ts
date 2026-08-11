export const floatingTabBarKeyboardContract = {
  fallbackRestoreDelayMs: 320,
  layoutRecoverySafetyDelayMs: 900,
  viewportSettleDelayMs: 240,
  viewportRecoveryTolerancePx: 8,
  viewportStabilityTolerancePx: 1,
} as const;

type KeyboardEventName = 'keyboardWillShow' | 'keyboardDidShow' | 'keyboardDidHide';

export function getNativeKeyboardVisibilityEvents(platform: 'ios' | 'android' | 'other'): {
  show: KeyboardEventName;
  hide: KeyboardEventName;
} {
  return {
    show: platform === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
    hide: 'keyboardDidHide',
  };
}

export function isTextEntryElement(element: unknown): boolean {
  if (!element || typeof element !== 'object') return false;
  const candidate = element as { isContentEditable?: boolean; tagName?: string };
  const tagName = candidate.tagName?.toUpperCase();
  return tagName === 'INPUT' || tagName === 'TEXTAREA' || candidate.isContentEditable === true;
}

export function isTouchMobileWebEnvironment({
  coarsePointer,
  maxTouchPoints,
  touchEventSupported,
}: {
  coarsePointer: boolean;
  maxTouchPoints: number;
  touchEventSupported: boolean;
}): boolean {
  return coarsePointer || maxTouchPoints > 0 || touchEventSupported;
}

type Listener = () => void;

export interface WebFloatingTabBarKeyboardEnvironment {
  touchMobile: boolean;
  hasVisualViewport: boolean;
  getActiveElement: () => unknown;
  getLayoutViewportHeight: () => number;
  getViewportOffsetTop: () => number;
  getViewportHeight: () => number;
  addDocumentListener: (type: 'focusin' | 'focusout', listener: Listener) => void;
  removeDocumentListener: (type: 'focusin' | 'focusout', listener: Listener) => void;
  addWindowListener: (type: 'resize', listener: Listener) => void;
  removeWindowListener: (type: 'resize', listener: Listener) => void;
  addViewportListener: (type: 'resize', listener: Listener) => void;
  removeViewportListener: (type: 'resize', listener: Listener) => void;
  requestAnimationFrame: (callback: () => void) => number;
  cancelAnimationFrame: (handle: number) => void;
  setTimeout: (callback: () => void, delay: number) => number;
  clearTimeout: (handle: number) => void;
  onHiddenChange: (hidden: boolean) => void;
}

export function createWebFloatingTabBarKeyboardController(
  environment: WebFloatingTabBarKeyboardEnvironment,
): () => void {
  if (!environment.touchMobile) return () => undefined;

  let disposed = false;
  let hidden = false;
  let textEntrySessionActive = false;
  let awaitingViewportRecovery = false;
  let baselineHeight = environment.getViewportHeight();
  let baselineLayoutHeight = environment.getLayoutViewportHeight();
  let layoutRecoveryGateOpen = false;
  let blurFrame: number | undefined;
  let recoveryFirstFrame: number | undefined;
  let recoverySecondFrame: number | undefined;
  let layoutRecoverySafetyTimeout: number | undefined;
  let viewportSettleTimeout: number | undefined;
  let fallbackTimeout: number | undefined;

  const emitHidden = (next: boolean) => {
    if (disposed || hidden === next) return;
    hidden = next;
    environment.onHiddenChange(next);
  };

  const cancelBlurFrame = () => {
    if (blurFrame === undefined) return;
    environment.cancelAnimationFrame(blurFrame);
    blurFrame = undefined;
  };

  const cancelRecoveryFrames = () => {
    if (recoveryFirstFrame !== undefined) {
      environment.cancelAnimationFrame(recoveryFirstFrame);
      recoveryFirstFrame = undefined;
    }
    if (recoverySecondFrame !== undefined) {
      environment.cancelAnimationFrame(recoverySecondFrame);
      recoverySecondFrame = undefined;
    }
  };

  const cancelFallbackTimeout = () => {
    if (fallbackTimeout === undefined) return;
    environment.clearTimeout(fallbackTimeout);
    fallbackTimeout = undefined;
  };

  const cancelViewportSettleTimeout = () => {
    if (viewportSettleTimeout === undefined) return;
    environment.clearTimeout(viewportSettleTimeout);
    viewportSettleTimeout = undefined;
  };

  const cancelLayoutRecoverySafetyTimeout = () => {
    if (layoutRecoverySafetyTimeout === undefined) return;
    environment.clearTimeout(layoutRecoverySafetyTimeout);
    layoutRecoverySafetyTimeout = undefined;
  };

  const cancelRestoreWork = () => {
    cancelBlurFrame();
    cancelRecoveryFrames();
    cancelLayoutRecoverySafetyTimeout();
    cancelViewportSettleTimeout();
    cancelFallbackTimeout();
  };

  const editorFocused = () => isTextEntryElement(environment.getActiveElement());
  const viewportRecovered = () => (
    environment.getViewportHeight()
      >= baselineHeight - floatingTabBarKeyboardContract.viewportRecoveryTolerancePx
  );
  const layoutViewportRecovered = () => (
    environment.getLayoutViewportHeight()
      >= baselineLayoutHeight - floatingTabBarKeyboardContract.viewportRecoveryTolerancePx
  );
  const recoveryGateOpen = () => (
    layoutRecoveryGateOpen || (viewportRecovered() && layoutViewportRecovered())
  );

  const finishRecovery = () => {
    if (disposed || editorFocused() || !awaitingViewportRecovery) return;
    cancelLayoutRecoverySafetyTimeout();
    cancelViewportSettleTimeout();
    awaitingViewportRecovery = false;
    textEntrySessionActive = false;
    layoutRecoveryGateOpen = false;
    baselineHeight = environment.getViewportHeight();
    baselineLayoutHeight = environment.getLayoutViewportHeight();
    emitHidden(false);
  };

  const scheduleStableViewportRecovery = ({
    acceptSettledToolbarHeight = false,
    expectedHeight = environment.getViewportHeight(),
    expectedLayoutHeight = environment.getLayoutViewportHeight(),
    expectedOffsetTop = environment.getViewportOffsetTop(),
  }: {
    acceptSettledToolbarHeight?: boolean;
    expectedHeight?: number;
    expectedLayoutHeight?: number;
    expectedOffsetTop?: number;
  } = {}) => {
    cancelRecoveryFrames();
    if (
      !awaitingViewportRecovery
      || editorFocused()
      || (!acceptSettledToolbarHeight && !viewportRecovered())
    ) return;

    const viewportStable = () => (
      Math.abs(environment.getViewportHeight() - expectedHeight)
        <= floatingTabBarKeyboardContract.viewportStabilityTolerancePx
      && Math.abs(environment.getLayoutViewportHeight() - expectedLayoutHeight)
        <= floatingTabBarKeyboardContract.viewportStabilityTolerancePx
      && Math.abs(environment.getViewportOffsetTop() - expectedOffsetTop)
        <= floatingTabBarKeyboardContract.viewportStabilityTolerancePx
    );

    recoveryFirstFrame = environment.requestAnimationFrame(() => {
      recoveryFirstFrame = undefined;
      if (disposed || editorFocused()) return;
      if (!viewportStable() || (!acceptSettledToolbarHeight && !viewportRecovered())) {
        scheduleViewportSettledRecovery();
        return;
      }
      recoverySecondFrame = environment.requestAnimationFrame(() => {
        recoverySecondFrame = undefined;
        if (!viewportStable()) {
          scheduleViewportSettledRecovery();
          return;
        }
        finishRecovery();
      });
    });
  };

  const scheduleViewportSettledRecovery = () => {
    cancelViewportSettleTimeout();
    cancelRecoveryFrames();
    viewportSettleTimeout = environment.setTimeout(() => {
      viewportSettleTimeout = undefined;
      if (disposed || editorFocused() || !awaitingViewportRecovery) return;
      if (!recoveryGateOpen()) return;
      scheduleStableViewportRecovery({
        acceptSettledToolbarHeight: true,
        expectedHeight: environment.getViewportHeight(),
        expectedLayoutHeight: environment.getLayoutViewportHeight(),
        expectedOffsetTop: environment.getViewportOffsetTop(),
      });
    }, floatingTabBarKeyboardContract.viewportSettleDelayMs);
  };

  const scheduleLayoutRecoverySafety = () => {
    cancelLayoutRecoverySafetyTimeout();
    layoutRecoverySafetyTimeout = environment.setTimeout(() => {
      layoutRecoverySafetyTimeout = undefined;
      if (disposed || editorFocused() || !awaitingViewportRecovery) return;
      layoutRecoveryGateOpen = true;
      scheduleViewportSettledRecovery();
    }, floatingTabBarKeyboardContract.layoutRecoverySafetyDelayMs);
  };

  const scheduleFallbackRecovery = () => {
    cancelFallbackTimeout();
    fallbackTimeout = environment.setTimeout(() => {
      fallbackTimeout = undefined;
      if (disposed || editorFocused()) return;
      awaitingViewportRecovery = false;
      textEntrySessionActive = false;
      baselineHeight = environment.getViewportHeight();
      emitHidden(false);
    }, floatingTabBarKeyboardContract.fallbackRestoreDelayMs);
  };

  const handleFocusIn = () => {
    if (!editorFocused()) return;
    cancelRestoreWork();
    awaitingViewportRecovery = false;
    textEntrySessionActive = true;
    layoutRecoveryGateOpen = false;
    baselineHeight = Math.max(baselineHeight, environment.getViewportHeight());
    baselineLayoutHeight = Math.max(
      baselineLayoutHeight,
      environment.getLayoutViewportHeight(),
    );
    emitHidden(true);
  };

  const handleFocusOut = () => {
    if (!textEntrySessionActive) return;
    cancelBlurFrame();
    blurFrame = environment.requestAnimationFrame(() => {
      blurFrame = undefined;
      if (disposed) return;
      if (editorFocused()) {
        emitHidden(true);
        return;
      }

      awaitingViewportRecovery = true;
      if (environment.hasVisualViewport) {
        scheduleLayoutRecoverySafety();
        if (recoveryGateOpen()) scheduleViewportSettledRecovery();
      } else scheduleFallbackRecovery();
    });
  };

  const handleVisualViewportChange = () => {
    if (editorFocused()) {
      cancelRecoveryFrames();
      cancelViewportSettleTimeout();
      emitHidden(true);
      return;
    }

    if (awaitingViewportRecovery) {
      scheduleViewportSettledRecovery();
      return;
    }

    if (!textEntrySessionActive) {
      baselineHeight = environment.getViewportHeight();
      baselineLayoutHeight = environment.getLayoutViewportHeight();
      emitHidden(false);
    }
  };

  const handleWindowResize = () => {
    if (awaitingViewportRecovery && !editorFocused()) layoutRecoveryGateOpen = true;
    handleVisualViewportChange();
  };

  environment.addDocumentListener('focusin', handleFocusIn);
  environment.addDocumentListener('focusout', handleFocusOut);
  environment.addWindowListener('resize', handleWindowResize);
  if (environment.hasVisualViewport) {
    environment.addViewportListener('resize', handleVisualViewportChange);
  }

  if (editorFocused()) handleFocusIn();

  return () => {
    disposed = true;
    cancelRestoreWork();
    environment.removeDocumentListener('focusin', handleFocusIn);
    environment.removeDocumentListener('focusout', handleFocusOut);
    environment.removeWindowListener('resize', handleWindowResize);
    if (environment.hasVisualViewport) {
      environment.removeViewportListener('resize', handleVisualViewportChange);
    }
  };
}

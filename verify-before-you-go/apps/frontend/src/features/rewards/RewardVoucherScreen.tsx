import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { Link, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState, type ComponentProps } from 'react';
import {
  AccessibilityInfo,
  Image,
  Platform,
  StyleSheet,
  Text,
  View,
  findNodeHandle,
  useWindowDimensions,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { InteractiveSurface } from '@/components/InteractiveSurface';
import { PrototypeTabScreen } from '@/components/prototype/PrototypeShell';
import { colors, typography } from '@/theme';

import { useReward } from './RewardContext';
import {
  copyDemoVoucherCode,
  getRewardVoucher,
  type ClipboardWriter,
  type RewardEligibility,
} from './reward-model';

const voucherMascot = require('../../../assets/mascots/receipt-highfive-screen11.png');
const voucherSceneSelector = '[data-testid="voucher-ready-screen"], [data-testid="voucher-unavailable-screen"]';
const conservativeFloatingDockClearance = 104;

export function getVoucherActionClearance({
  actionBlockHeight,
  actionRegionTop,
  viewportHeight,
}: {
  actionBlockHeight: number;
  actionRegionTop?: number;
  viewportHeight: number;
}) {
  const intersectsDockClearance = actionRegionTop !== undefined
    && actionRegionTop < viewportHeight
    && actionRegionTop + actionBlockHeight > viewportHeight - conservativeFloatingDockClearance;
  return intersectsDockClearance ? Math.max(0, viewportHeight - actionRegionTop + 8) : 0;
}

function releaseVoucherSceneFocus() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  const focusedElement = document.activeElement;
  if (!(focusedElement instanceof HTMLElement)) return;
  if (focusedElement.closest(voucherSceneSelector)) focusedElement.blur();
}

export function RewardVoucherScreen() {
  const { eligibility } = useReward();
  const [routeActive, setRouteActive] = useState(false);
  useFocusEffect(useCallback(() => {
    setRouteActive(true);
    return () => {
      releaseVoucherSceneFocus();
      setRouteActive(false);
    };
  }, []));
  return <RewardVoucherExperience eligibility={eligibility} routeActive={routeActive} />;
}

export function RewardVoucherExperience({
  copy = Clipboard.setStringAsync as ClipboardWriter,
  eligibility,
  routeActive = true,
}: {
  copy?: ClipboardWriter;
  eligibility?: RewardEligibility;
  routeActive?: boolean;
}) {
  const headingRef = useRef<Text>(null);
  const { height: viewportHeight } = useWindowDimensions();
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [headingFocused, setHeadingFocused] = useState(false);
  const [actionRegionTop, setActionRegionTop] = useState<number>();
  const [actionBlockHeight, setActionBlockHeight] = useState(0);

  useEffect(() => {
    if (!routeActive) {
      const inactiveFrame = requestAnimationFrame(() => {
        setHeadingFocused(false);
        releaseVoucherSceneFocus();
      });
      return () => cancelAnimationFrame(inactiveFrame);
    }

    let active = true;
    let headingElement: HTMLElement | null = null;
    const markFocused = () => setHeadingFocused(true);
    const markBlurred = () => setHeadingFocused(false);
    const frame = requestAnimationFrame(() => {
      if (!active) return;
      if (Platform.OS === 'web') {
        headingElement = document.getElementById('voucher-screen-heading');
        headingElement?.addEventListener('focus', markFocused);
        headingElement?.addEventListener('blur', markBlurred);
        headingElement?.focus();
        return;
      }
      const handle = findNodeHandle(headingRef.current);
      if (handle) {
        setHeadingFocused(true);
        AccessibilityInfo.setAccessibilityFocus(handle);
      }
    });
    return () => {
      active = false;
      cancelAnimationFrame(frame);
      headingElement?.removeEventListener('focus', markFocused);
      headingElement?.removeEventListener('blur', markBlurred);
    };
  }, [eligibility, routeActive]);

  const headingStyle: StyleProp<TextStyle> = [
    styles.title,
    headingFocused ? headingFocusStyle : undefined,
  ];
  const actionClearance = Platform.OS === 'web'
    ? getVoucherActionClearance({ actionBlockHeight, actionRegionTop, viewportHeight })
    : 0;

  if (!eligibility) {
    return (
      <PrototypeTabScreen contentStyle={styles.screenContent} testID="voucher-unavailable-screen">
        <StatusBar style="dark" />
        <View style={styles.headingBlock}>
          <Text style={styles.kicker}>Demo reward</Text>
          <Text
            accessibilityRole="header"
            nativeID="voucher-screen-heading"
            ref={headingRef}
            style={headingStyle}
            tabIndex={-1}
          >Voucher not available in this session</Text>
          <Text style={styles.lede}>A demo voucher appears only after a perfect five-topic quiz or a private report receipt confirmed in this open app session.</Text>
        </View>
        <View style={styles.unavailablePanel}>
          <Text style={styles.panelTitle}>Nothing has been unlocked here.</Text>
          <Text style={styles.bodyCopy}>Refreshing never creates eligibility, a receipt or a voucher. You can continue with either flow below.</Text>
        </View>
        <View style={styles.actions}>
          <RewardLink href="/quiz" label="Go to Quiz" testID="voucher-go-quiz" tone="primary" />
          <RewardLink href="/reports/new" label="Start a private report" testID="voucher-go-report" />
        </View>
      </PrototypeTabScreen>
    );
  }

  const voucher = getRewardVoucher(eligibility);
  const copyCode = async () => {
    setCopyState('idle');
    try {
      await copyDemoVoucherCode(voucher.code, copy);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
  };

  return (
    <PrototypeTabScreen contentStyle={styles.screenContent} testID="voucher-ready-screen">
      <StatusBar style="dark" />
      <View style={styles.headingBlock}>
        <Text style={styles.kicker}>Demo reward</Text>
        <Text
          accessibilityRole="header"
          nativeID="voucher-screen-heading"
          ref={headingRef}
          style={headingStyle}
          tabIndex={-1}
        >Your voucher is ready.</Text>
        <View style={styles.syntheticBadge}>
          <Text style={styles.syntheticBadgeText}>Synthetic prototype — not redeemable</Text>
        </View>
      </View>

      <View style={[styles.mascotStage, webMascotGradient]}>
        <Image
          accessibilityIgnoresInvertColors
          accessible={false}
          resizeMode="contain"
          source={voucherMascot}
          style={styles.mascot}
        />
        <View style={styles.stageCopy}>
          <Text style={styles.stageMeta}>A small acknowledgement</Text>
          <Text style={styles.stageText}>{eligibility === 'quiz-perfect'
            ? 'You completed all five MIL topics with a perfect score.'
            : 'Your private report flow reached a real backend receipt.'}</Text>
        </View>
      </View>

      <View style={[styles.voucherCard, webVoucherGradient]} testID="synthetic-voucher-card">
        <View style={styles.voucherTopRow}>
          <View style={styles.voucherLabel}>
            <Ionicons color={colors.amber} name="gift-outline" size={20} />
            <Text style={styles.voucherLabelText}>Verify Before You Go · Demo</Text>
          </View>
          <Text style={styles.voucherSource}>{eligibility === 'quiz-perfect' ? 'MIL 5/5' : 'Private report'}</Text>
        </View>
        <Text style={styles.benefit}>{voucher.benefit}</Text>
        <View style={styles.codePanel}>
          <Text style={styles.codeLabel}>Demo voucher code</Text>
          <Text
            accessibilityLabel={`Demo voucher code ${voucher.code}`}
            selectable
            style={styles.code}
            testID="voucher-code"
          >{voucher.code}</Text>
        </View>
        <Text style={styles.expiry}>Prototype only — no monetary value</Text>
      </View>

      {eligibility === 'private-report-submitted' ? (
        <View style={styles.receiptStatus} testID="voucher-report-status">
          <Ionicons color={colors.blue} name="information-circle-outline" size={19} />
          <Text style={styles.receiptStatusText}>Received — not yet reviewed. This reward does not mean the report was verified, judged true or published.</Text>
        </View>
      ) : null}

      <View style={styles.safetyPanel}>
        <Text style={styles.safetyTitle}>A flow acknowledgement, never a verdict</Text>
        <Text style={styles.safetyText}>Rewards must never depend on whether an allegation is judged true. This prototype only acknowledges completion of the safety-learning or private-report flow.</Text>
      </View>

      <View
        onLayout={({ nativeEvent }) => setActionRegionTop(nativeEvent.layout.y)}
        style={styles.actionRegion}
      >
        {actionClearance > 0 ? <View accessible={false} style={{ height: actionClearance }} /> : null}
        <View
          onLayout={({ nativeEvent }) => setActionBlockHeight(nativeEvent.layout.height)}
          style={styles.actions}
        >
          <InteractiveSurface
            accessibilityLabel="Copy demo voucher code"
            accessibilityRole="button"
            focusStyle={styles.primaryFocused}
            hoverStyle={styles.primaryHovered}
            onPress={() => void copyCode()}
            pressedStyle={styles.pressed}
            style={copyButtonStyle}
            testID="copy-voucher-code"
          >
            <Ionicons color={colors.paper} name={copyState === 'copied' ? 'checkmark' : 'copy-outline'} size={19} />
            <Text style={styles.primaryText}>{copyState === 'copied' ? 'Demo code copied' : 'Copy demo code'}</Text>
          </InteractiveSurface>
          {copyState !== 'idle' ? (
            <Text
              accessibilityLiveRegion={copyState === 'copied' ? 'polite' : 'assertive'}
              style={copyState === 'copied' ? styles.copySuccess : styles.copyFailure}
              testID="voucher-copy-status"
            >{copyState === 'copied'
              ? 'Demo code copied. It remains a non-redeemable prototype.'
              : 'Copy failed. Select the demo code and copy it manually.'}</Text>
          ) : null}
          <RewardLink href="/" label="Done" testID="voucher-done" />
          <RewardLink href="/how-it-works" label="How this app works" testID="voucher-how-rewards-work" tone="text" />
        </View>
      </View>
    </PrototypeTabScreen>
  );
}

function RewardLink({
  href,
  label,
  testID,
  tone = 'secondary',
}: {
  href: '/' | '/how-it-works' | '/quiz' | '/reports/new';
  label: string;
  testID: string;
  tone?: 'primary' | 'secondary' | 'text';
}) {
  const style = tone === 'primary' ? primaryLinkStyle : tone === 'text' ? styles.textLink : styles.secondaryLink;
  return (
    <Link asChild href={href}>
      <InteractiveSurface
        {...webSpaceActivationProps}
        accessibilityLabel={label}
        accessibilityRole="link"
        focusStyle={styles.controlFocused}
        hoverStyle={styles.linkHovered}
        pressedStyle={styles.pressed}
        style={style}
        testID={testID}
      >
        <Text style={tone === 'primary' ? styles.primaryText : styles.linkText}>{label}</Text>
        {tone !== 'text' ? <Ionicons color={tone === 'primary' ? colors.paper : colors.blue} name="arrow-forward" size={18} /> : null}
      </InteractiveSurface>
    </Link>
  );
}

const webSpaceActivationProps = Platform.OS === 'web'
  ? ({
      onKeyUp: (event: { currentTarget: { click: () => void }; key: string; preventDefault: () => void }) => {
        if (event.key !== ' ') return;
        event.preventDefault();
        event.currentTarget.click();
      },
    } as unknown as Partial<ComponentProps<typeof InteractiveSurface>>)
  : {};

const webMascotGradient = Platform.select({
  web: { backgroundImage: 'linear-gradient(105deg,#EDF5FD 0%,#FFF7E7 100%)' },
  default: {},
}) as ViewStyle;

const webVoucherGradient = Platform.select({
  web: { backgroundImage: 'linear-gradient(140deg,#00224A 0%,#003D73 68%,#005CA8 100%)' },
  default: {},
}) as ViewStyle;

const webPrimaryGradient = Platform.select({
  web: { backgroundImage: 'linear-gradient(135deg,#0077D4 0%,#7B3FE4 100%)' },
  default: {},
}) as ViewStyle;

const headingFocusStyle = Platform.select({
  web: {
    outlineColor: colors.sky,
    outlineOffset: 4,
    outlineStyle: 'solid',
    outlineWidth: 2,
    borderRadius: 4,
  },
  default: {
    borderBottomColor: colors.sky,
    borderBottomWidth: 2,
  },
}) as TextStyle;

const styles = StyleSheet.create({
  screenContent: { gap: 8, paddingTop: 14, paddingBottom: 164 },
  headingBlock: { minWidth: 0, gap: 4 },
  kicker: { color: colors.blue, fontFamily: typography.mono, fontSize: 11, lineHeight: 16, letterSpacing: 1.2, textTransform: 'uppercase' },
  title: { color: colors.navy, fontFamily: typography.heading, fontSize: 29, lineHeight: 34, letterSpacing: -0.45 },
  lede: { color: colors.body, fontFamily: typography.body, fontSize: 15, lineHeight: 23 },
  syntheticBadge: { minHeight: 28, alignSelf: 'flex-start', justifyContent: 'center', paddingHorizontal: 9, borderWidth: 1, borderColor: '#ECCB80', borderRadius: 6, backgroundColor: colors.amberSoft },
  syntheticBadgeText: { color: '#755000', fontFamily: typography.monoMedium, fontSize: 11, lineHeight: 16, letterSpacing: 0.55, textTransform: 'uppercase' },
  mascotStage: { minWidth: 0, width: '100%', maxWidth: '100%', minHeight: 96, flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 14, borderWidth: 1, borderColor: '#D6E9FA', borderRadius: 16, overflow: 'hidden', backgroundColor: colors.ice },
  mascot: { width: 128, height: 96, flexShrink: 0 },
  stageCopy: { minWidth: 0, flex: 1, gap: 4 },
  stageMeta: { color: colors.blue, fontFamily: typography.monoMedium, fontSize: 11, lineHeight: 16, letterSpacing: 0.65, textTransform: 'uppercase' },
  stageText: { color: colors.body, fontFamily: typography.body, fontSize: 13, lineHeight: 20 },
  voucherCard: { minWidth: 0, width: '100%', maxWidth: '100%', gap: 10, padding: 16, borderWidth: 1, borderColor: '#164A77', borderRadius: 20, backgroundColor: colors.navy },
  voucherTopRow: { minWidth: 0, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  voucherLabel: { minWidth: 0, flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7 },
  voucherLabelText: { minWidth: 0, flex: 1, color: colors.paleBlue, fontFamily: typography.monoMedium, fontSize: 11, lineHeight: 16, letterSpacing: 0.6, textTransform: 'uppercase' },
  voucherSource: { flexShrink: 0, color: colors.amber, fontFamily: typography.monoMedium, fontSize: 11, lineHeight: 16, letterSpacing: 0.55, textTransform: 'uppercase' },
  benefit: { color: colors.paper, fontFamily: typography.heading, fontSize: 23, lineHeight: 29 },
  codePanel: { minWidth: 0, gap: 5, padding: 12, borderWidth: 1, borderColor: 'rgba(168,211,242,0.38)', borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)' },
  codeLabel: { color: colors.paleBlue, fontFamily: typography.mono, fontSize: 11, lineHeight: 16, letterSpacing: 0.85, textTransform: 'uppercase' },
  code: { color: colors.paper, fontFamily: typography.monoMedium, fontSize: 18, lineHeight: 26, letterSpacing: 1.1 },
  expiry: { color: '#D6E9FA', fontFamily: typography.body, fontSize: 12, lineHeight: 18 },
  receiptStatus: { minWidth: 0, flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12, borderWidth: 1, borderColor: '#D6E9FA', borderRadius: 12, backgroundColor: colors.ice },
  receiptStatusText: { minWidth: 0, flex: 1, color: colors.body, fontFamily: typography.body, fontSize: 13, lineHeight: 20 },
  safetyPanel: { gap: 4, padding: 11, borderLeftWidth: 4, borderLeftColor: colors.amber, backgroundColor: colors.amberSoft },
  safetyTitle: { color: colors.navy, fontFamily: typography.bodySemiBold, fontSize: 14, lineHeight: 20 },
  safetyText: { color: colors.body, fontFamily: typography.body, fontSize: 13, lineHeight: 20 },
  unavailablePanel: { gap: 5, padding: 14, borderWidth: 1, borderColor: colors.line, borderRadius: 14, backgroundColor: colors.paper },
  panelTitle: { color: colors.navy, fontFamily: typography.bodySemiBold, fontSize: 15, lineHeight: 21 },
  bodyCopy: { color: colors.body, fontFamily: typography.body, fontSize: 13, lineHeight: 20 },
  actionRegion: { minWidth: 0, width: '100%', maxWidth: '100%' },
  actions: { minWidth: 0, gap: 6 },
  primaryButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 18, borderRadius: 999, backgroundColor: colors.brightBlue },
  primaryText: { color: colors.paper, fontFamily: typography.bodySemiBold, fontSize: 14, lineHeight: 20 },
  secondaryLink: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 16, borderWidth: 1, borderColor: colors.line, borderRadius: 999, backgroundColor: colors.paper },
  textLink: { minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, borderRadius: 999 },
  linkText: { color: colors.blue, fontFamily: typography.bodySemiBold, fontSize: 14, lineHeight: 20 },
  primaryHovered: { opacity: 0.92 },
  linkHovered: { backgroundColor: colors.ice },
  primaryFocused: { borderWidth: 3, borderColor: colors.navy },
  controlFocused: { borderWidth: 3, borderColor: colors.focus },
  pressed: { opacity: 0.72 },
  copySuccess: { color: '#1E632B', fontFamily: typography.bodyMedium, fontSize: 13, lineHeight: 20, textAlign: 'center' },
  copyFailure: { color: '#9F2525', fontFamily: typography.bodyMedium, fontSize: 13, lineHeight: 20, textAlign: 'center' },
});

const copyButtonStyle = StyleSheet.flatten([styles.primaryButton, webPrimaryGradient]);
const primaryLinkStyle = StyleSheet.flatten([styles.primaryButton, webPrimaryGradient]);

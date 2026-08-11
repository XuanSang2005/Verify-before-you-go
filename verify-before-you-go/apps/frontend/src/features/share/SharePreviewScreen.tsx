import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';

import { createSignedShareToken } from '@/api/share';
import { InteractiveSurface } from '@/components/InteractiveSurface';
import { PrototypeTabScreen } from '@/components/prototype/PrototypeShell';
import { useOfferDraft } from '@/features/offer-intake/OfferDraftContext';
import { colors, typography } from '@/theme';

import {
  createRecipientShareParams,
  createSafeShareSummary,
  getPreviewObservations,
  type SafeShareSummary,
} from './share-model';
import {
  createPrivateShareBundle,
  type PrivateShareResult,
} from './share-service';
import {
  copyPrivateSummaryWithRuntime,
  sharePrivateSummaryWithRuntime,
} from './share-runtime';

const shareMascot = require('../../../assets/mascots/share-footer-screen14.png');

type ShareUiState =
  | 'idle'
  | 'sharing'
  | 'shared'
  | 'copied'
  | 'shared-text-only'
  | 'copied-text-only'
  | 'failed';

const webPrimaryGradient = Platform.select({
  web: { backgroundImage: 'linear-gradient(135deg,#0077D4 0%,#7B3FE4 100%)' },
  default: {},
}) as ViewStyle;

const webPanelShadow = Platform.select({
  web: { boxShadow: '0 10px 28px -22px rgba(0,34,74,.58)' },
  default: {
    shadowColor: colors.navy,
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.09,
    shadowRadius: 13,
    elevation: 2,
  },
}) as ViewStyle;

export function SharePreviewScreen() {
  const { analysis } = useOfferDraft();
  const [summary] = useState(() => createSafeShareSummary(analysis));

  const prepareBundle = async () => {
    try {
      const issued = await createSignedShareToken({
        schemaVersion: summary.schemaVersion,
        findingIds: summary.findingIds,
        demo: summary.demo,
      });
      const recipientUrl = Linking.createURL('share/recipient', {
        queryParams: createRecipientShareParams(issued.token),
      });
      return createPrivateShareBundle(summary, recipientUrl);
    } catch {
      return createPrivateShareBundle(summary);
    }
  };

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace(analysis ? '/check/result' : '/check');
  };

  return (
    <SharePreviewExperience
      onBack={goBack}
      onCopy={async () => copyPrivateSummaryWithRuntime(await prepareBundle())}
      onShare={async () => sharePrivateSummaryWithRuntime(await prepareBundle())}
      summary={summary}
    />
  );
}

export function SharePreviewExperience({
  onBack,
  onCopy,
  onShare,
  summary,
}: {
  onBack: () => void;
  onCopy: () => Promise<'copied' | 'copied-text-only'>;
  onShare: () => Promise<PrivateShareResult>;
  summary: SafeShareSummary;
}) {
  const [shareState, setShareState] = useState<ShareUiState>('idle');
  const observations = getPreviewObservations(summary);

  const share = async () => {
    if (shareState === 'sharing') return;
    setShareState('sharing');
    try {
      const result = await onShare();
      setShareState(result === 'dismissed' ? 'idle' : result);
    } catch {
      setShareState('failed');
    }
  };

  const copy = async () => {
    if (shareState === 'sharing') return;
    setShareState('sharing');
    try {
      setShareState(await onCopy());
    } catch {
      setShareState('failed');
    }
  };

  return (
    <PrototypeTabScreen contentStyle={styles.screenContent} testID="share-preview-screen">
      <StatusBar style="dark" />
      <InteractiveSurface
        accessibilityLabel="Back from share preview"
        accessibilityRole="button"
        focusStyle={styles.controlFocused}
        onPress={onBack}
        pressedStyle={styles.pressed}
        style={styles.backControl}
        testID="share-preview-back"
      >
        <Ionicons color={colors.navy} name="arrow-back" size={20} />
      </InteractiveSurface>

      <View style={styles.headingBlock}>
        <Text style={styles.kicker}>{summary.demo ? 'Scan 0412 · Share preview · Demo data' : 'Share preview · Private summary'}</Text>
        <Text accessibilityRole="header" style={styles.title}>Share evidence, not an accusation.</Text>
      </View>

      <View style={[styles.navyPanel, webPanelShadow]} testID="privacy-safe-share-summary">
        <View style={styles.countRow}>
          <Text style={styles.navyCount}>{summary.findingIds.length} of {summary.checkedRuleCount}</Text>
          <Text style={styles.navyCountLabel}>signal types found</Text>
        </View>
        <View style={styles.navyRule} />
        <Text style={styles.navyPanelTitle}>Observed</Text>
        <View style={styles.list}>
          {observations.map((observation) => <BulletItem key={observation} light text={observation} />)}
        </View>
        <Text style={styles.navyPanelTitle}>Still unverified</Text>
        <Text style={styles.navyBody}>Legal employer · Visa and contract · Workplace address</Text>
        <View style={styles.navyNote}>
          <Text style={styles.navyNoteText}>This summary is not a verdict. Full identifiers and the original screenshot are hidden.</Text>
        </View>
        <Image
          accessibilityIgnoresInvertColors
          accessible={false}
          resizeMode="contain"
          source={shareMascot}
          style={styles.shareMascot}
          testID="share-preview-mascot"
        />
      </View>

      <View style={styles.hiddenPanel}>
        <View style={styles.hiddenCopy}>
          <Text style={styles.panelTitle}>Sensitive details hidden</Text>
          <Text style={styles.micro}>Name · full handle · screenshot metadata</Text>
        </View>
        <View style={styles.readyBadge}>
          <Ionicons color="#1E632B" name="checkmark-circle" size={15} />
          <Text style={styles.readyBadgeText}>Ready</Text>
        </View>
      </View>

      <View style={styles.softPanel}>
        <Text style={styles.panelTitle}>Next three checks</Text>
        <Text style={styles.body}>Company registry · Written contract · Embassy contact</Text>
      </View>

      <View style={styles.actions}>
        <InteractiveSurface
          accessibilityLabel={shareState === 'sharing' ? 'Sharing private summary' : 'Share privately'}
          accessibilityRole="button"
          accessibilityState={{ busy: shareState === 'sharing', disabled: shareState === 'sharing' }}
          disabled={shareState === 'sharing'}
          disabledStyle={styles.disabled}
          focusStyle={styles.primaryFocused}
          hoverStyle={styles.primaryHovered}
          onPress={() => void share()}
          pressedStyle={styles.pressed}
          style={[styles.primaryButton, webPrimaryGradient]}
          testID="share-privately"
        >
          {shareState === 'sharing' ? <ActivityIndicator color={colors.paper} size="small" /> : <Ionicons color={colors.paper} name="share-social-outline" size={19} />}
          <Text style={styles.primaryButtonText}>{shareState === 'sharing' ? 'Preparing private share…' : 'Share privately'}</Text>
        </InteractiveSurface>
        <InteractiveSurface
          accessibilityLabel="Copy privacy-safe summary and recipient link"
          accessibilityRole="button"
          accessibilityState={{ disabled: shareState === 'sharing' }}
          disabled={shareState === 'sharing'}
          focusStyle={styles.controlFocused}
          hoverStyle={styles.linkHovered}
          onPress={() => void copy()}
          pressedStyle={styles.pressed}
          style={styles.copyButton}
          testID="copy-share-summary"
        >
          <Ionicons color={colors.blue} name="copy-outline" size={18} />
          <Text style={styles.copyButtonText}>Copy summary</Text>
        </InteractiveSurface>
        <ShareStatus state={shareState} />
      </View>
    </PrototypeTabScreen>
  );
}

function ShareStatus({ state }: { state: ShareUiState }) {
  if (state === 'shared') return <Text accessibilityLiveRegion="polite" style={styles.successText}>Private share opened. You choose the recipient.</Text>;
  if (state === 'copied') return <Text accessibilityLiveRegion="polite" style={styles.successText}>Privacy-safe summary and link copied.</Text>;
  if (state === 'shared-text-only') return <Text accessibilityLiveRegion="polite" style={styles.warningText}>Recipient link unavailable. The privacy-safe text was shared without a link.</Text>;
  if (state === 'copied-text-only') return <Text accessibilityLiveRegion="polite" style={styles.warningText}>Recipient link unavailable. The privacy-safe text was copied without a link.</Text>;
  if (state === 'failed') return <Text accessibilityLiveRegion="assertive" style={styles.errorText}>Sharing failed. Try Copy summary instead.</Text>;
  return null;
}

function BulletItem({ light = false, text }: { light?: boolean; text: string }) {
  return (
    <View style={styles.bulletRow}>
      <View style={styles.bullet} />
      <Text style={light ? styles.navyListText : styles.listText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screenContent: { gap: 12, paddingTop: 12, paddingBottom: 122 },
  backControl: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line, borderRadius: 22, backgroundColor: colors.paper },
  headingBlock: { gap: 5 },
  kicker: { color: colors.blue, fontFamily: typography.mono, fontSize: 11, lineHeight: 16, letterSpacing: 1.15, textTransform: 'uppercase' },
  title: { color: colors.navy, fontFamily: typography.heading, fontSize: 29, lineHeight: 34, letterSpacing: -0.45 },
  navyPanel: { gap: 8, paddingTop: 14, paddingHorizontal: 14, paddingBottom: 10, borderWidth: 1, borderColor: '#164A77', borderRadius: 12, overflow: 'hidden', backgroundColor: colors.navy },
  countRow: { minWidth: 0, flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  navyCount: { color: colors.paper, fontFamily: typography.heading, fontSize: 28, lineHeight: 33 },
  navyCountLabel: { minWidth: 0, flexShrink: 1, color: colors.paleBlue, fontFamily: typography.body, fontSize: 13, lineHeight: 20 },
  navyRule: { height: 1, backgroundColor: '#164A77' },
  navyPanelTitle: { color: colors.paper, fontFamily: typography.bodySemiBold, fontSize: 14, lineHeight: 20 },
  navyBody: { color: '#EAF3FB', fontFamily: typography.body, fontSize: 13, lineHeight: 20 },
  list: { gap: 8 },
  bulletRow: { minWidth: 0, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  bullet: { width: 6, height: 6, flexShrink: 0, marginTop: 7, marginLeft: 1, borderRadius: 3, backgroundColor: colors.sky },
  navyListText: { minWidth: 0, flex: 1, color: '#EAF3FB', fontFamily: typography.body, fontSize: 13, lineHeight: 20 },
  listText: { minWidth: 0, flex: 1, color: colors.body, fontFamily: typography.body, fontSize: 13, lineHeight: 20 },
  navyNote: { paddingVertical: 9, paddingHorizontal: 11, borderLeftWidth: 3, borderLeftColor: colors.sky, backgroundColor: '#073762' },
  navyNoteText: { color: '#EAF3FB', fontFamily: typography.body, fontSize: 12, lineHeight: 18 },
  shareMascot: { width: 122, height: 82, alignSelf: 'center', marginTop: -6, marginBottom: -14 },
  hiddenPanel: { minWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingVertical: 13, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.line, borderRadius: 12, backgroundColor: colors.paper },
  hiddenCopy: { minWidth: 0, flex: 1, gap: 3 },
  panelTitle: { color: colors.ink, fontFamily: typography.bodySemiBold, fontSize: 14, lineHeight: 20 },
  micro: { color: colors.quiet, fontFamily: typography.mono, fontSize: 11, lineHeight: 17, letterSpacing: 0.25 },
  readyBadge: { minHeight: 28, flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, borderWidth: 1, borderColor: '#B8DDB0', borderRadius: 5, backgroundColor: '#EEF9EB' },
  readyBadgeText: { color: '#1E632B', fontFamily: typography.monoMedium, fontSize: 11, lineHeight: 16, letterSpacing: 0.7, textTransform: 'uppercase' },
  softPanel: { gap: 4, paddingVertical: 13, paddingHorizontal: 14, borderWidth: 1, borderColor: '#D6E9FA', borderRadius: 12, backgroundColor: colors.ice },
  body: { color: colors.muted, fontFamily: typography.body, fontSize: 13, lineHeight: 20 },
  actions: { gap: 6, paddingTop: 2 },
  primaryButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 18, borderRadius: 999, backgroundColor: colors.brightBlue },
  primaryButtonText: { color: colors.paper, fontFamily: typography.bodySemiBold, fontSize: 14, lineHeight: 20 },
  copyButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 24 },
  copyButtonText: { color: colors.blue, fontFamily: typography.bodySemiBold, fontSize: 13, lineHeight: 20 },
  successText: { color: '#1E632B', fontFamily: typography.body, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  warningText: { color: '#755000', fontFamily: typography.body, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  errorText: { color: '#8A1C1C', fontFamily: typography.body, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  pressed: { opacity: 0.72 },
  disabled: { opacity: 0.62 },
  controlFocused: { borderWidth: 2, borderColor: colors.focus },
  primaryFocused: { borderWidth: 3, borderColor: colors.paleBlue },
  primaryHovered: { opacity: 0.92 },
  linkHovered: { backgroundColor: colors.ice },
});

import { Ionicons } from '@expo/vector-icons';
import { Link, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Platform, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { ShareTokenApiError, verifySignedShareToken } from '@/api/share';
import { InteractiveSurface } from '@/components/InteractiveSurface';
import { PrototypeTabScreen } from '@/components/prototype/PrototypeShell';
import { colors, typography } from '@/theme';

import {
  formatShareExpiry,
  getRecipientChecks,
  parseRecipientShareParams,
  toVerifiedSafeShareSummary,
  type RecipientShareParams,
  type VerifiedSafeShareSummary,
} from './share-model';

const recipientMascot = require('../../../assets/mascots/recipient-companion-screen15.png');

const webPrimaryGradient = Platform.select({
  web: { backgroundImage: 'linear-gradient(135deg,#0077D4 0%,#7B3FE4 100%)' },
  default: {},
}) as ViewStyle;

export function ShareRecipientScreen() {
  const params = useLocalSearchParams() as RecipientShareParams;
  return <ShareRecipientController params={params} />;
}

type RecipientVerificationState =
  | { token: string; status: 'loading' }
  | { token: string; status: 'ready'; summary: VerifiedSafeShareSummary }
  | { token: string; status: 'expired' | 'invalid' | 'unavailable' };

export function ShareRecipientController({
  params,
  verifyToken = verifySignedShareToken,
}: {
  params: RecipientShareParams;
  verifyToken?: typeof verifySignedShareToken;
}) {
  const parsed = parseRecipientShareParams(params);
  const token = parsed.status === 'ready' ? parsed.token : undefined;
  const [verification, setVerification] = useState<RecipientVerificationState | undefined>();

  useEffect(() => {
    if (!token) return;
    let active = true;
    void verifyToken(token)
      .then((response) => {
        if (active) setVerification({ token, status: 'ready', summary: toVerifiedSafeShareSummary(response) });
      })
      .catch((error: unknown) => {
        if (!active) return;
        const status = error instanceof ShareTokenApiError && error.status === 410
          ? 'expired'
          : error instanceof ShareTokenApiError && error.status === 400
            ? 'invalid'
            : 'unavailable';
        setVerification({ token, status });
      });
    return () => { active = false; };
  }, [token, verifyToken]);

  if (!token) return <UnavailableRecipientExperience expired={false} />;
  const current = verification?.token === token
    ? verification
    : { token, status: 'loading' as const };
  if (current.status === 'loading') return <LoadingRecipientExperience />;
  if (current.status !== 'ready') return <UnavailableRecipientExperience expired={current.status === 'expired'} />;

  return (
    <ShareRecipientExperience summary={current.summary} />
  );
}

export function ShareRecipientExperience({
  summary,
}: {
  summary: VerifiedSafeShareSummary;
}) {
  const checks = getRecipientChecks(summary);
  return (
    <PrototypeTabScreen contentStyle={styles.screenContent} testID="share-recipient-screen">
      <StatusBar style="dark" />
      <View style={styles.headingBlock}>
        <Text style={styles.kicker}>{summary.demo ? 'No account needed · Demo data' : 'No account needed · Private shared check'}</Text>
        <Text accessibilityRole="header" style={styles.title}>Someone you trust shared this offer.</Text>
      </View>

      <View style={styles.verdictBadge}>
        <Ionicons color="#755000" name="information-circle-outline" size={15} />
        <Text style={styles.verdictBadgeText}>Not a verdict</Text>
      </View>

      <View style={styles.recipientSummary} testID="recipient-safe-summary">
        <Image
          accessibilityIgnoresInvertColors
          accessible={false}
          resizeMode="contain"
          source={recipientMascot}
          style={styles.recipientMascot}
          testID="share-recipient-mascot"
        />
        <View style={styles.summaryCopy}>
          <View style={styles.countRow}>
            <Text style={styles.count}>{summary.findingIds.length} of {summary.checkedRuleCount}</Text>
            <Text style={styles.countLabel}>signal types found</Text>
          </View>
          <Text style={styles.summaryText}>{checks.length === 1 ? 'One item needs a second pair of eyes.' : `${checks.length} items need a second pair of eyes.`}</Text>
        </View>
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>What needs checking</Text>
        <View style={styles.list}>
          {checks.map((item) => <BulletItem key={item} text={item} />)}
        </View>
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>How you can help</Text>
        <View style={styles.steps}>
          <Step index="1" text="Ask for the legal company name and registration." />
          <Step index="2" text="Check its address and contact independently." />
          <Step index="3" text="Save the destination embassy number together." />
        </View>
      </View>

      <View style={styles.privacyNote}>
        <Text style={styles.privacyNoteText}>The original screenshot and full identifiers were not shared.</Text>
      </View>
      <Text style={styles.micro}>Shared link expires {formatShareExpiry(summary.expiresAt)} · Report abuse</Text>

      <View style={styles.actions}>
        <Link asChild href="/check/checklist">
          <InteractiveSurface
            accessibilityLabel="Open the verification checklist"
            accessibilityRole="link"
            focusStyle={styles.primaryFocused}
            hoverStyle={styles.primaryHovered}
            pressedStyle={styles.pressed}
            style={[styles.primaryButton, webPrimaryGradient]}
            testID="recipient-open-checklist"
          >
            <Ionicons color={colors.paper} name="checkbox-outline" size={19} />
            <Text style={styles.primaryButtonText}>Open the checklist</Text>
          </InteractiveSurface>
        </Link>
        <Link asChild href="/help">
          <InteractiveSurface
            accessibilityLabel="Get help"
            accessibilityRole="link"
            focusStyle={styles.controlFocused}
            hoverStyle={styles.helpHovered}
            pressedStyle={styles.pressed}
            style={styles.helpButton}
            testID="recipient-get-help"
          >
            <Text style={styles.helpButtonText}>Get help</Text>
            <Ionicons color={colors.blue} name="arrow-forward" size={18} />
          </InteractiveSurface>
        </Link>
      </View>
    </PrototypeTabScreen>
  );
}

function LoadingRecipientExperience() {
  return (
    <PrototypeTabScreen contentStyle={styles.screenContent} testID="share-recipient-loading">
      <StatusBar style="dark" />
      <View style={styles.headingBlock}>
        <Text style={styles.kicker}>Private shared check</Text>
        <Text accessibilityRole="header" style={styles.title}>Verifying this shared summary…</Text>
        <Text style={styles.unavailableText}>No findings are displayed until the recipient link has been verified.</Text>
      </View>
      <ActivityIndicator accessibilityLabel="Verifying recipient link" color={colors.blue} size="small" />
    </PrototypeTabScreen>
  );
}

function UnavailableRecipientExperience({ expired }: { expired: boolean }) {
  return (
    <PrototypeTabScreen contentStyle={styles.screenContent} testID="share-recipient-unavailable">
      <StatusBar style="dark" />
      <View style={styles.headingBlock}>
        <Text style={styles.kicker}>Private shared check</Text>
        <Text accessibilityRole="header" style={styles.title}>{expired ? 'This shared link has expired.' : 'This shared summary is unavailable.'}</Text>
        <Text style={styles.unavailableText}>No private evidence is displayed. Ask the sender for a new privacy-safe summary, then verify the offer independently.</Text>
      </View>
      <Link asChild href="/check">
        <InteractiveSurface
          accessibilityLabel="Run a new offer check"
          accessibilityRole="link"
          focusStyle={styles.primaryFocused}
          pressedStyle={styles.pressed}
          style={[styles.primaryButton, webPrimaryGradient]}
          testID="recipient-run-new-check"
        >
          <Text style={styles.primaryButtonText}>Run a new check</Text>
        </InteractiveSurface>
      </Link>
    </PrototypeTabScreen>
  );
}

function BulletItem({ text }: { text: string }) {
  return (
    <View style={styles.bulletRow}>
      <View style={styles.bullet} />
      <Text style={styles.listText}>{text}</Text>
    </View>
  );
}

function Step({ index, text }: { index: string; text: string }) {
  return (
    <View style={styles.stepRow}>
      <View style={styles.stepIndex}><Text style={styles.stepIndexText}>{index}</Text></View>
      <Text style={styles.stepText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screenContent: { gap: 12, paddingTop: 12, paddingBottom: 122 },
  headingBlock: { gap: 5 },
  kicker: { color: colors.blue, fontFamily: typography.mono, fontSize: 11, lineHeight: 16, letterSpacing: 1.15, textTransform: 'uppercase' },
  title: { color: colors.navy, fontFamily: typography.heading, fontSize: 29, lineHeight: 34, letterSpacing: -0.45 },
  verdictBadge: { minHeight: 28, flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 5, paddingHorizontal: 8, borderWidth: 1, borderColor: '#ECCB80', borderRadius: 5, backgroundColor: colors.amberSoft },
  verdictBadgeText: { color: '#755000', fontFamily: typography.monoMedium, fontSize: 11, lineHeight: 16, letterSpacing: 0.7, textTransform: 'uppercase' },
  recipientSummary: { position: 'relative', minHeight: 96, marginLeft: 38, paddingVertical: 13, paddingRight: 14, paddingLeft: 31, justifyContent: 'center', borderWidth: 1, borderColor: '#D6E9FA', borderRadius: 12, backgroundColor: colors.ice },
  recipientMascot: { position: 'absolute', zIndex: 2, left: -48, bottom: -1, width: 70, height: 88 },
  summaryCopy: { minWidth: 0, gap: 4 },
  countRow: { minWidth: 0, flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  count: { color: colors.navy, fontFamily: typography.heading, fontSize: 28, lineHeight: 33 },
  countLabel: { minWidth: 0, flexShrink: 1, color: colors.muted, fontFamily: typography.body, fontSize: 13, lineHeight: 20 },
  summaryText: { color: colors.muted, fontFamily: typography.body, fontSize: 13, lineHeight: 20 },
  panel: { gap: 8, paddingVertical: 13, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.line, borderRadius: 12, backgroundColor: colors.paper },
  panelTitle: { color: colors.ink, fontFamily: typography.bodySemiBold, fontSize: 14, lineHeight: 20 },
  list: { gap: 8 },
  bulletRow: { minWidth: 0, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  bullet: { width: 6, height: 6, flexShrink: 0, marginTop: 7, marginLeft: 1, borderRadius: 3, backgroundColor: colors.sky },
  listText: { minWidth: 0, flex: 1, color: colors.body, fontFamily: typography.body, fontSize: 13, lineHeight: 20 },
  steps: { gap: 10 },
  stepRow: { minWidth: 0, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  stepIndex: { width: 24, height: 24, flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.navy },
  stepIndexText: { color: colors.paper, fontFamily: typography.monoMedium, fontSize: 11, lineHeight: 16 },
  stepText: { minWidth: 0, flex: 1, paddingTop: 2, color: colors.body, fontFamily: typography.body, fontSize: 13, lineHeight: 20 },
  privacyNote: { paddingVertical: 9, paddingHorizontal: 11, borderLeftWidth: 3, borderLeftColor: colors.sky, backgroundColor: colors.ice },
  privacyNoteText: { color: colors.body, fontFamily: typography.body, fontSize: 12, lineHeight: 18 },
  micro: { color: colors.quiet, fontFamily: typography.mono, fontSize: 11, lineHeight: 17, letterSpacing: 0.25 },
  actions: { gap: 6, paddingTop: 2 },
  primaryButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 18, borderRadius: 999, backgroundColor: colors.brightBlue },
  primaryButtonText: { color: colors.paper, fontFamily: typography.bodySemiBold, fontSize: 14, lineHeight: 20 },
  helpButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 24 },
  helpButtonText: { color: colors.blue, fontFamily: typography.bodySemiBold, fontSize: 13, lineHeight: 20 },
  unavailableText: { color: colors.body, fontFamily: typography.body, fontSize: 15, lineHeight: 23 },
  pressed: { opacity: 0.72 },
  controlFocused: { borderWidth: 2, borderColor: colors.focus },
  primaryFocused: { borderWidth: 3, borderColor: colors.paleBlue },
  primaryHovered: { opacity: 0.92 },
  helpHovered: { backgroundColor: colors.ice },
});

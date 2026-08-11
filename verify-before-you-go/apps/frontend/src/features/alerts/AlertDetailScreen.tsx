import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Platform, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { InteractiveSurface } from '@/components/InteractiveSurface';
import { PrototypeTabScreen } from '@/components/prototype/PrototypeShell';
import { colors, typography } from '@/theme';

import { formatAlertCacheTime, formatAlertDate } from './alerts-model';
import { useCommunityAlert, type AlertsLoaderDependencies } from './use-alerts';

const safetyStateText = 'No matching alert does not mean an offer is safe. Verify the offer independently.';

export function AlertDetailScreen({
  alertId,
  loaderDependencies,
}: {
  alertId?: string;
  loaderDependencies?: AlertsLoaderDependencies;
} = {}) {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const routeId = Array.isArray(params.id) ? params.id[0] ?? '' : params.id ?? '';
  const id = alertId ?? routeId;
  const alertState = useCommunityAlert(id, loaderDependencies);
  const alert = alertState.response?.alert;

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/alerts');
  };

  return (
    <PrototypeTabScreen contentStyle={styles.screenContent} testID="community-alert-detail-screen">
      <StatusBar style="dark" />
      <View style={styles.contentFrame}>
        <InteractiveSurface
          accessibilityLabel="Back to community alerts"
          accessibilityRole="button"
          focusStyle={styles.backFocused}
          hoverStyle={styles.backHovered}
          onPress={goBack}
          pressedStyle={styles.controlPressed}
          style={styles.backControl}
        >
          <Ionicons color={colors.body} name="chevron-back" size={20} />
          <Text style={styles.backText}>Alerts</Text>
        </InteractiveSurface>

        {alertState.status === 'loading' && !alert ? (
          <View accessibilityLabel="Loading reviewed community alert" accessibilityLiveRegion="polite" style={styles.statePanel}>
            <ActivityIndicator color={colors.brightBlue} />
            <Text accessibilityRole="header" style={styles.stateTitle}>Loading alert</Text>
            <Text style={styles.stateBody}>{safetyStateText}</Text>
          </View>
        ) : null}

        {alertState.status === 'error' ? (
          <DetailStatePanel
            body={alertState.message ?? 'This community alert could not be loaded.'}
            onPress={alertState.retry}
            title="Alert unavailable"
          />
        ) : null}

        {alertState.status === 'not-found' ? (
          <DetailStatePanel
            body={alertState.message ?? 'The reviewed alert was not found.'}
            buttonLabel="Return to alerts"
            onPress={() => router.replace('/alerts')}
            title="Not found"
          />
        ) : null}

        {(alertState.status === 'offline' || alertState.status === 'service-unavailable') && alertState.cachedAt ? (
          <View accessibilityLiveRegion="polite" style={styles.offlineNotice}>
            <Ionicons
              color={colors.blue}
              name={alertState.status === 'offline' ? 'cloud-offline-outline' : 'server-outline'}
              size={18}
            />
            <View style={styles.offlineCopy}>
              <Text style={styles.offlineTitle}>
                {alertState.status === 'offline' ? 'Offline · saved alert' : 'Service unavailable · showing saved copy'}
              </Text>
              <Text style={styles.offlineText}>Last saved {formatAlertCacheTime(alertState.cachedAt)}. Review metadata may have changed.</Text>
            </View>
            <InteractiveSurface
              accessibilityLabel={alertState.refreshing ? 'Refreshing saved alert' : 'Retry alert connection'}
              accessibilityRole="button"
              accessibilityState={{ disabled: Boolean(alertState.refreshing) }}
              disabled={Boolean(alertState.refreshing)}
              disabledStyle={styles.retryDisabled}
              onPress={alertState.retry}
              pressedStyle={styles.controlPressed}
              style={styles.iconRetry}
            >
              {alertState.refreshing
                ? <ActivityIndicator color={colors.blue} size="small" />
                : <Ionicons color={colors.blue} name="refresh" size={18} />}
            </InteractiveSurface>
          </View>
        ) : null}

        {alert ? (
          <>
            <View style={styles.intro}>
              <Text style={styles.kicker}>Alert {alert.id} · Synthetic demo data</Text>
              <Text accessibilityRole="header" style={styles.title}>{alert.title}.</Text>
              <View style={styles.badgeRow}>
                <View style={[styles.badge, alert.moderationStatus === 'corroborated-pattern' && styles.badgeAmber]}>
                  <Text style={[styles.badgeText, alert.moderationStatus === 'corroborated-pattern' && styles.badgeTextAmber]}>{alert.moderationStatusLabel}</Text>
                </View>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>Not a verdict</Text>
                </View>
              </View>
            </View>

            <View style={styles.warningPanel}>
              <Ionicons color="#755000" name="alert-circle-outline" size={20} />
              <View style={styles.warningCopy}>
                <Text style={styles.warningTitle}>This is not a finding of fraud.</Text>
                <Text style={styles.warningText}>{alert.safetyStatement}</Text>
              </View>
            </View>

            <DetailSection title="What was observed">
              <BulletList items={alert.observedEvidence} />
            </DetailSection>

            <DetailSection title="What remains unconfirmed">
              <BulletList items={alert.unknownInformation} />
            </DetailSection>

            <View style={styles.verificationPanel}>
              <Text style={styles.sectionTitle}>Verify your own offer</Text>
              <View style={styles.steps}>
                {alert.verificationSteps.map((step, index) => (
                  <View key={step} style={styles.stepRow}>
                    <View style={styles.stepNumber}><Text style={styles.stepNumberText}>{index + 1}</Text></View>
                    <Text style={styles.stepText}>{step}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.metadataPanel}>
              <Text style={styles.metadataLabel}>Review record</Text>
              <Text style={styles.metadataText}>First reported {formatAlertDate(alert.firstReportedAt)} · Last reviewed {formatAlertDate(alert.reviewedAt)}</Text>
              <Text style={styles.metadataText}>Public ID {alert.maskedIdentifiers.join(' · ')}</Text>
              <Text style={styles.metadataText}>{alert.compatibleReportCount} compatible synthetic reports</Text>
            </View>

            <View style={styles.sourcePanel}>
              <Text style={styles.sectionTitle}>About this demo record</Text>
              {alert.sourceNotes.map((note) => <Text key={note} style={styles.sourceText}>{note}</Text>)}
            </View>

            <View style={styles.actions}>
              <InteractiveSurface
                accessibilityLabel="Check my offer"
                accessibilityRole="link"
                focusStyle={styles.primaryFocused}
                hoverStyle={styles.primaryHovered}
                onPress={() => router.push('/check')}
                pressedStyle={styles.controlPressed}
                style={[styles.primaryAction, webPrimaryGradient]}
                testID="alert-detail-check-offer"
              >
                <Text style={styles.primaryText}>Check my offer</Text>
              </InteractiveSurface>
              <InteractiveSurface
                accessibilityLabel="Add factual evidence to a new report"
                accessibilityRole="link"
                focusStyle={styles.secondaryFocused}
                hoverStyle={styles.secondaryHovered}
                onPress={() => router.push('/reports/new')}
                pressedStyle={styles.controlPressed}
                style={styles.secondaryAction}
                testID="alert-detail-add-evidence"
              >
                <Text style={styles.secondaryText}>Add evidence</Text>
              </InteractiveSurface>
            </View>
          </>
        ) : null}
      </View>
    </PrototypeTabScreen>
  );
}

function DetailSection({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <View style={styles.sectionPanel}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function BulletList({ items }: { items: readonly string[] }) {
  return (
    <View style={styles.bulletList}>
      {items.map((item) => (
        <View key={item} style={styles.bulletRow}>
          <View accessibilityElementsHidden style={styles.bullet} />
          <Text style={styles.bulletText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

function DetailStatePanel({
  body,
  buttonLabel = 'Retry',
  onPress,
  title,
}: {
  body: string;
  buttonLabel?: string;
  onPress: () => void;
  title: string;
}) {
  return (
    <View accessibilityLiveRegion="polite" style={styles.statePanel}>
      <Ionicons color={colors.blue} name="alert-circle-outline" size={24} />
      <Text accessibilityRole="header" style={styles.stateTitle}>{title}</Text>
      <Text style={styles.stateBody}>{body}</Text>
      <Text style={styles.stateBody}>{safetyStateText}</Text>
      <InteractiveSurface
        accessibilityLabel={buttonLabel}
        accessibilityRole="button"
        focusStyle={styles.secondaryFocused}
        hoverStyle={styles.secondaryHovered}
        onPress={onPress}
        pressedStyle={styles.controlPressed}
        style={styles.stateButton}
      >
        <Text style={styles.stateButtonText}>{buttonLabel}</Text>
      </InteractiveSurface>
    </View>
  );
}

const webPrimaryGradient = Platform.select({
  web: { backgroundImage: 'linear-gradient(135deg,#0077D4,#7B3FE4)' },
  default: {},
}) as ViewStyle;

const styles = StyleSheet.create({
  screenContent: { paddingTop: 12, paddingBottom: 36 },
  contentFrame: { minWidth: 0, width: '100%', maxWidth: 720, alignSelf: 'center', gap: 12 },
  backControl: { minWidth: 0, minHeight: 44, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 3, marginLeft: -8, paddingHorizontal: 8, borderRadius: 999 },
  backText: { color: colors.body, fontFamily: typography.bodyMedium, fontSize: 13, lineHeight: 19 },
  backHovered: { backgroundColor: colors.paper },
  backFocused: { borderWidth: 2, borderColor: colors.focus },
  intro: { minWidth: 0, gap: 8 },
  kicker: { color: colors.blue, fontFamily: typography.mono, fontSize: 11, lineHeight: 16, letterSpacing: 1.1, textTransform: 'uppercase' },
  title: { color: colors.navy, fontFamily: typography.heading, fontSize: 29, fontWeight: '700', lineHeight: 34, letterSpacing: -0.4 },
  badgeRow: { minWidth: 0, flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  badge: { minHeight: 24, justifyContent: 'center', paddingVertical: 3, paddingHorizontal: 8, borderWidth: 1, borderColor: colors.paleBlue, borderRadius: 5, backgroundColor: colors.ice },
  badgeAmber: { borderColor: '#ECCB80', backgroundColor: colors.amberSoft },
  badgeText: { color: colors.blue, fontFamily: typography.monoMedium, fontSize: 11, lineHeight: 15, letterSpacing: 0.6, textTransform: 'uppercase' },
  badgeTextAmber: { color: '#755000' },
  warningPanel: { minWidth: 0, flexDirection: 'row', alignItems: 'flex-start', gap: 9, paddingVertical: 12, paddingHorizontal: 13, borderWidth: 1, borderColor: '#F2D28D', borderRadius: 12, backgroundColor: colors.amberSoft },
  warningCopy: { minWidth: 0, flex: 1, gap: 3 },
  warningTitle: { color: '#654500', fontFamily: typography.bodySemiBold, fontSize: 14, lineHeight: 20 },
  warningText: { color: '#654500', fontFamily: typography.body, fontSize: 13, lineHeight: 20 },
  sectionPanel: { minWidth: 0, gap: 9, paddingVertical: 13, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.line, borderRadius: 12, backgroundColor: colors.paper },
  sectionTitle: { color: colors.ink, fontFamily: typography.bodySemiBold, fontSize: 14, lineHeight: 20 },
  bulletList: { minWidth: 0, gap: 8 },
  bulletRow: { minWidth: 0, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  bullet: { width: 6, height: 6, flexShrink: 0, marginTop: 7, marginLeft: 1, borderRadius: 3, backgroundColor: colors.sky },
  bulletText: { minWidth: 0, flex: 1, color: colors.body, fontFamily: typography.body, fontSize: 13, lineHeight: 20 },
  verificationPanel: { minWidth: 0, gap: 10, paddingVertical: 13, paddingHorizontal: 14, borderWidth: 1, borderColor: '#D6E9FA', borderRadius: 12, backgroundColor: colors.ice },
  steps: { minWidth: 0, gap: 10 },
  stepRow: { minWidth: 0, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  stepNumber: { width: 24, height: 24, flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.navy },
  stepNumberText: { color: colors.paper, fontFamily: typography.monoMedium, fontSize: 11, lineHeight: 15 },
  stepText: { minWidth: 0, flex: 1, paddingTop: 1, color: colors.body, fontFamily: typography.body, fontSize: 13, lineHeight: 20 },
  metadataPanel: { minWidth: 0, gap: 4, paddingVertical: 11, paddingHorizontal: 12, borderLeftWidth: 3, borderLeftColor: colors.sky, backgroundColor: colors.ice },
  metadataLabel: { color: colors.blue, fontFamily: typography.monoMedium, fontSize: 11, lineHeight: 16, letterSpacing: 0.9, textTransform: 'uppercase' },
  metadataText: { color: colors.muted, fontFamily: typography.mono, fontSize: 11, lineHeight: 17, letterSpacing: 0.2 },
  sourcePanel: { minWidth: 0, gap: 5, paddingVertical: 13, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.line, borderRadius: 12, backgroundColor: colors.paper },
  sourceText: { color: colors.muted, fontFamily: typography.body, fontSize: 12, lineHeight: 18 },
  actions: { minWidth: 0, gap: 8 },
  primaryAction: { minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, borderRadius: 999, backgroundColor: colors.brightBlue },
  primaryText: { color: colors.paper, fontFamily: typography.bodySemiBold, fontSize: 14, lineHeight: 20 },
  secondaryAction: { minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, borderWidth: 1, borderColor: colors.line, borderRadius: 999, backgroundColor: colors.paper },
  secondaryText: { color: colors.blue, fontFamily: typography.bodySemiBold, fontSize: 14, lineHeight: 20 },
  primaryHovered: { opacity: 0.92 },
  primaryFocused: { borderWidth: 2, borderColor: colors.navy },
  secondaryHovered: { borderColor: colors.paleBlue, backgroundColor: colors.ice },
  secondaryFocused: { borderWidth: 2, borderColor: colors.focus },
  statePanel: { minWidth: 0, alignItems: 'flex-start', gap: 8, padding: 14, borderWidth: 1, borderColor: colors.line, borderRadius: 12, backgroundColor: colors.paper },
  stateTitle: { color: colors.navy, fontFamily: typography.bodySemiBold, fontSize: 15, lineHeight: 21 },
  stateBody: { color: colors.muted, fontFamily: typography.body, fontSize: 13, lineHeight: 20 },
  stateButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 13, borderWidth: 1, borderColor: colors.paleBlue, borderRadius: 999, backgroundColor: colors.ice },
  stateButtonText: { color: colors.blue, fontFamily: typography.bodySemiBold, fontSize: 13, lineHeight: 19 },
  offlineNotice: { minWidth: 0, flexDirection: 'row', alignItems: 'flex-start', gap: 9, padding: 12, borderWidth: 1, borderColor: '#D6E9FA', borderRadius: 12, backgroundColor: colors.ice },
  offlineCopy: { minWidth: 0, flex: 1, gap: 2 },
  offlineTitle: { color: colors.navy, fontFamily: typography.bodySemiBold, fontSize: 13, lineHeight: 19 },
  offlineText: { color: colors.muted, fontFamily: typography.body, fontSize: 12, lineHeight: 18 },
  iconRetry: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: colors.paper },
  retryDisabled: { opacity: 0.55 },
  controlPressed: { opacity: 0.72 },
});

import { Ionicons } from '@expo/vector-icons';
import type { AlertSummary } from '@vbyg/contracts';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState, type ComponentProps } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ViewStyle,
} from 'react-native';

import { InteractiveSurface } from '@/components/InteractiveSurface';
import { PrototypeTabScreen } from '@/components/prototype/PrototypeShell';
import { colors, typography } from '@/theme';

import {
  alertLocationFilters,
  filterCommunityAlerts,
  formatAlertCacheTime,
  formatAlertDate,
  type AlertLocationFilter,
} from './alerts-model';
import { useCommunityAlerts } from './use-alerts';

const alertsGuideMascot = require('../../../assets/mascots/alerts-guide-screen12.png');
const emptyAlerts: readonly AlertSummary[] = [];
type IconName = ComponentProps<typeof Ionicons>['name'];

const cardShadow = Platform.select({
  web: { boxShadow: '0 1px 2px rgba(34,30,31,.05)' },
  default: {
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
}) as ViewStyle;

export function CommunityAlertsScreen() {
  const [search, setSearch] = useState('');
  const [location, setLocation] = useState<AlertLocationFilter>('all');
  const alertsState = useCommunityAlerts();
  const allAlerts = alertsState.response?.alerts ?? emptyAlerts;
  const alerts = useMemo(
    () => filterCommunityAlerts(allAlerts, { location, search }),
    [allAlerts, location, search],
  );
  const hasResponse = Boolean(alertsState.response);
  const apiIsEmpty = hasResponse && allAlerts.length === 0;

  return (
    <PrototypeTabScreen contentStyle={styles.screenContent} testID="community-alerts-screen">
      <StatusBar style="dark" />
      <View style={styles.contentFrame}>
        <View style={styles.intro}>
          <Text style={styles.kicker}>Community · Reviewed records</Text>
          <Text accessibilityRole="header" style={styles.title}>Check an alert.</Text>
        </View>

        <View style={styles.searchField} testID="alerts-search-control">
          <Ionicons color={colors.quiet} name="search-outline" size={18} />
          <TextInput
            accessibilityLabel="Search reviewed alerts by masked identifier, location or claimed entity"
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setSearch}
            placeholder="Phone, handle, domain or entity"
            placeholderTextColor={colors.quiet}
            returnKeyType="search"
            style={styles.searchInput}
            testID="alerts-search-input"
            value={search}
          />
          {search ? (
            <InteractiveSurface
              accessibilityLabel="Clear alert search"
              accessibilityRole="button"
              onPress={() => setSearch('')}
              pressedStyle={styles.controlPressed}
              style={styles.searchClear}
              testID="alerts-search-clear"
            >
              <Ionicons color={colors.blue} name="close-circle" size={20} />
            </InteractiveSurface>
          ) : null}
        </View>

        <View style={styles.editorialCard} testID="alerts-patterns-panel">
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.editorialMascotFrame}>
            <Image
              accessibilityIgnoresInvertColors
              accessible={false}
              resizeMode="contain"
              source={alertsGuideMascot}
              style={styles.editorialMascot}
              testID="alerts-guide-mascot"
            />
          </View>
          <View style={styles.editorialCopy}>
            <Text style={styles.editorialTitle}>Patterns, not verdicts.</Text>
            <Text style={styles.editorialText}>Only moderated and redacted records appear here.</Text>
          </View>
        </View>

        <AlertFilterControls
          location={location}
          onLocationChange={setLocation}
        />

        {alertsState.status === 'loading' && !hasResponse ? <AlertsLoadingState /> : null}
        {alertsState.status === 'error' ? (
          <AlertsStatePanel
            body={alertsState.message ?? 'Community alerts could not be loaded.'}
            icon="alert-circle-outline"
            onRetry={alertsState.retry}
            title="Alerts unavailable"
          />
        ) : null}

        {(alertsState.status === 'offline' || alertsState.status === 'service-unavailable') && alertsState.cachedAt ? (
          <SavedAlertsNotice
            cachedAt={alertsState.cachedAt}
            mode={alertsState.status}
            onRetry={alertsState.retry}
            refreshing={Boolean(alertsState.refreshing)}
          />
        ) : null}

        {hasResponse ? (
          <>
            {alerts.length ? (
              <View accessibilityLabel="Reviewed synthetic community alerts" style={styles.alertList}>
                {alerts.map((alert) => <AlertResultCard alert={alert} key={alert.id} />)}
              </View>
            ) : (
              <AlertsStatePanel
                body={apiIsEmpty
                  ? 'No reviewed synthetic alerts are currently available. Check again later.'
                  : 'Try a different search or place. A missing entry does not establish safety.'}
                icon={apiIsEmpty ? 'file-tray-outline' : 'search-outline'}
                onRetry={apiIsEmpty ? undefined : () => {
                    setSearch('');
                    setLocation('all');
                  }}
                retryLabel={apiIsEmpty ? undefined : 'Clear filters'}
                title={apiIsEmpty ? 'No reviewed alerts available' : 'No matching reviewed record'}
              />
            )}

            <View style={styles.syntheticNotice}>
              <Ionicons color={colors.blue} name="shield-checkmark-outline" size={18} />
              <Text style={styles.syntheticNoticeText}>{alertsState.response?.syntheticContentNotice}</Text>
            </View>

            <InteractiveSurface
              accessibilityLabel="Report an offer"
              accessibilityRole="link"
              focusStyle={styles.primaryFocused}
              hoverStyle={styles.primaryHovered}
              onPress={() => router.push('/reports/new')}
              pressedStyle={styles.controlPressed}
              style={[styles.primaryAction, webPrimaryGradient]}
            >
              <Text style={styles.primaryActionText}>Report an offer</Text>
              <Ionicons color={colors.paper} name="arrow-forward" size={18} />
            </InteractiveSurface>
          </>
        ) : null}

        <View style={styles.noMatchPanel}>
          <Ionicons color="#755000" name="information-circle-outline" size={20} />
          <Text style={styles.noMatchText}>No match does not mean an offer is safe.</Text>
        </View>
      </View>
    </PrototypeTabScreen>
  );
}

export function AlertFilterControls({
  location,
  onLocationChange,
}: {
  location: AlertLocationFilter;
  onLocationChange: (value: AlertLocationFilter) => void;
}) {
  return (
    <View style={styles.filters}>
      <FilterGroup
        label="Place"
        onChange={onLocationChange}
        options={alertLocationFilters}
        testPrefix="alerts-location"
        value={location}
      />
    </View>
  );
}

function FilterGroup<T extends string>({
  label,
  onChange,
  options,
  testPrefix,
  value,
}: {
  label: string;
  onChange: (value: T) => void;
  options: readonly { id: T; label: string }[];
  testPrefix: string;
  value: T;
}) {
  return (
    <View accessibilityLabel={`${label} filters`} style={styles.filterGroup}>
      <Text style={styles.filterLabel}>{label}</Text>
      <View style={styles.filterRow}>
        {options.map((option) => {
          const selected = option.id === value;
          const select = () => onChange(option.id);
          const webToggleProps = Platform.OS === 'web'
            ? {
                'aria-pressed': selected,
                onKeyDown: (event: { key: string; preventDefault: () => void }) => {
                  if (event.key !== 'Enter' && event.key !== ' ') return;
                  event.preventDefault();
                  select();
                },
              }
            : {};
          return (
            <InteractiveSurface
              {...webToggleProps}
              accessibilityLabel={`${label}: ${option.label}`}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              focusStyle={styles.filterFocused}
              hoverStyle={styles.filterHovered}
              key={option.id}
              onPress={select}
              pressedStyle={styles.controlPressed}
              style={[styles.filterChip, selected && styles.filterChipSelected]}
              testID={`${testPrefix}-${option.id}`}
            >
              <Text style={[styles.filterText, selected && styles.filterTextSelected]}>{option.label}</Text>
            </InteractiveSurface>
          );
        })}
      </View>
    </View>
  );
}

function AlertResultCard({ alert }: { alert: AlertSummary }) {
  const amber = alert.moderationStatus === 'corroborated-pattern';
  return (
    <InteractiveSurface
      accessibilityLabel={`${alert.moderationStatusLabel}. ${alert.title}. ${alert.locationLabel}. ${alert.summary}. ${alert.compatibleReportCount} compatible reports. Synthetic demo.`}
      accessibilityRole="link"
      focusStyle={styles.cardFocused}
      hoverStyle={styles.cardHovered}
      onPress={() => router.push({ pathname: '/alerts/[id]', params: { id: alert.id } })}
      pressedStyle={styles.controlPressed}
      style={[styles.alertCard, cardShadow]}
      testID={`alert-card-${alert.id}`}
    >
      <View style={styles.cardTopRow}>
        <View style={[styles.badge, amber && styles.badgeAmber]}>
          <Text style={[styles.badgeText, amber && styles.badgeTextAmber]}>{alert.moderationStatusLabel}</Text>
        </View>
        <Text style={styles.syntheticLabel}>Synthetic demo</Text>
      </View>
      <Text style={styles.cardTitle}>{alert.title}</Text>
      <Text style={styles.cardSummary}>{alert.locationLabel} · {alert.summary}</Text>
      <View style={styles.cardMetaRow}>
        <Text style={styles.cardMeta}>Reviewed {formatAlertDate(alert.reviewedAt)} · Identifier masked</Text>
        <Ionicons color={colors.blue} name="arrow-forward" size={17} />
      </View>
    </InteractiveSurface>
  );
}

function AlertsLoadingState() {
  return (
    <View accessibilityLabel="Loading reviewed community alerts" accessibilityLiveRegion="polite" style={styles.statePanel}>
      <ActivityIndicator color={colors.brightBlue} />
      <Text style={styles.stateTitle}>Loading reviewed alerts</Text>
      <Text style={styles.stateBody}>Retrieving moderated, redacted synthetic records.</Text>
    </View>
  );
}

function AlertsStatePanel({
  body,
  icon,
  onRetry,
  retryLabel,
  title,
}: {
  body: string;
  icon: IconName;
  onRetry?: () => void;
  retryLabel?: string;
  title: string;
}) {
  return (
    <View accessibilityLiveRegion="polite" style={styles.statePanel}>
      <Ionicons color={colors.blue} name={icon} size={24} />
      <Text style={styles.stateTitle}>{title}</Text>
      <Text style={styles.stateBody}>{body}</Text>
      {onRetry ? (
        <InteractiveSurface
          accessibilityLabel={retryLabel ?? 'Retry'}
          accessibilityRole="button"
          focusStyle={styles.retryFocused}
          hoverStyle={styles.retryHovered}
          onPress={onRetry}
          pressedStyle={styles.controlPressed}
          style={styles.retryButton}
        >
          <Ionicons color={colors.blue} name={retryLabel === 'Clear filters' ? 'close' : 'refresh'} size={17} />
          <Text style={styles.retryText}>{retryLabel ?? 'Retry'}</Text>
        </InteractiveSurface>
      ) : null}
    </View>
  );
}

function SavedAlertsNotice({
  cachedAt,
  mode,
  onRetry,
  refreshing,
}: {
  cachedAt: string;
  mode: 'offline' | 'service-unavailable';
  onRetry: () => void;
  refreshing: boolean;
}) {
  const offline = mode === 'offline';
  return (
    <View accessibilityLiveRegion="polite" style={styles.offlineNotice}>
      <Ionicons color={colors.blue} name={offline ? 'cloud-offline-outline' : 'server-outline'} size={18} />
      <View style={styles.offlineCopy}>
        <Text style={styles.offlineTitle}>
          {offline ? 'Offline · showing saved alerts' : 'Service unavailable · showing saved copy'}
        </Text>
        <Text style={styles.offlineText}>Last saved {formatAlertCacheTime(cachedAt)}. Review status may have changed.</Text>
      </View>
      <InteractiveSurface
        accessibilityLabel={refreshing ? 'Refreshing saved alerts' : 'Retry alerts connection'}
        accessibilityRole="button"
        accessibilityState={{ disabled: refreshing }}
        disabled={refreshing}
        disabledStyle={styles.offlineRetryDisabled}
        onPress={onRetry}
        pressedStyle={styles.controlPressed}
        style={styles.offlineRetry}
      >
        {refreshing
          ? <ActivityIndicator color={colors.blue} size="small" />
          : <Ionicons color={colors.blue} name="refresh" size={18} />}
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
  intro: { minWidth: 0, gap: 6 },
  kicker: { color: colors.blue, fontFamily: typography.mono, fontSize: 11, lineHeight: 16, letterSpacing: 1.2, textTransform: 'uppercase' },
  title: { color: colors.navy, fontFamily: typography.heading, fontSize: 29, fontWeight: '700', lineHeight: 34, letterSpacing: -0.4 },
  searchField: { minWidth: 0, width: '100%', minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 7, paddingLeft: 13, borderWidth: 1, borderColor: colors.line, borderRadius: 999, backgroundColor: colors.paper },
  searchInput: { minWidth: 0, minHeight: 46, flex: 1, paddingVertical: 0, color: colors.body, fontFamily: typography.body, fontSize: 13, lineHeight: 19 },
  searchClear: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 24 },
  editorialCard: { minWidth: 0, width: '100%', minHeight: 88, flexDirection: 'row', alignItems: 'flex-end', gap: 12, paddingVertical: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.line, borderLeftWidth: 3, borderLeftColor: colors.sky, borderRadius: 12, backgroundColor: colors.paper, overflow: 'hidden' },
  editorialMascotFrame: { width: 112, height: 84, flexShrink: 0, alignSelf: 'flex-end' },
  editorialMascot: { width: 112, height: 84 },
  editorialCopy: { minWidth: 0, flex: 1, alignSelf: 'center', gap: 3 },
  editorialTitle: { color: colors.navy, fontFamily: typography.bodySemiBold, fontSize: 14, lineHeight: 20 },
  editorialText: { color: colors.body, fontFamily: typography.body, fontSize: 13, lineHeight: 19 },
  filters: { minWidth: 0, gap: 9 },
  filterGroup: { minWidth: 0, gap: 5 },
  filterLabel: { color: colors.quiet, fontFamily: typography.monoMedium, fontSize: 11, lineHeight: 16, letterSpacing: 1.1, textTransform: 'uppercase' },
  filterRow: { minWidth: 0, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  filterChip: { minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 11, borderWidth: 1, borderColor: colors.line, borderRadius: 999, backgroundColor: colors.paper },
  filterChipSelected: { borderColor: colors.blue, backgroundColor: colors.ice },
  filterText: { color: colors.muted, fontFamily: typography.bodyMedium, fontSize: 12, lineHeight: 18 },
  filterTextSelected: { color: colors.blue, fontFamily: typography.bodySemiBold },
  filterHovered: { borderColor: colors.paleBlue },
  filterFocused: { borderWidth: 2, borderColor: colors.focus },
  alertList: { minWidth: 0, gap: 10 },
  alertCard: { minWidth: 0, minHeight: 48, gap: 7, paddingVertical: 13, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.line, borderRadius: 12, backgroundColor: colors.paper },
  cardTopRow: { minWidth: 0, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  badge: { minHeight: 24, justifyContent: 'center', paddingVertical: 3, paddingHorizontal: 8, borderWidth: 1, borderColor: colors.paleBlue, borderRadius: 5, backgroundColor: colors.ice },
  badgeAmber: { borderColor: '#ECCB80', backgroundColor: colors.amberSoft },
  badgeText: { color: colors.blue, fontFamily: typography.monoMedium, fontSize: 11, lineHeight: 15, letterSpacing: 0.6, textTransform: 'uppercase' },
  badgeTextAmber: { color: '#755000' },
  syntheticLabel: { flexShrink: 1, color: colors.quiet, fontFamily: typography.mono, fontSize: 11, lineHeight: 15, letterSpacing: 0.6, textAlign: 'right', textTransform: 'uppercase' },
  cardTitle: { color: colors.ink, fontFamily: typography.bodySemiBold, fontSize: 15, lineHeight: 21 },
  cardSummary: { color: colors.muted, fontFamily: typography.body, fontSize: 13, lineHeight: 20 },
  cardMetaRow: { minWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cardMeta: { minWidth: 0, flex: 1, color: colors.quiet, fontFamily: typography.mono, fontSize: 11, lineHeight: 17, letterSpacing: 0.35, textTransform: 'uppercase' },
  cardHovered: { borderColor: colors.paleBlue, backgroundColor: '#FAFCFE' },
  cardFocused: { borderWidth: 2, borderColor: colors.focus },
  noMatchPanel: { minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 12, paddingHorizontal: 13, borderWidth: 1, borderColor: '#F2D28D', borderRadius: 12, backgroundColor: colors.amberSoft },
  noMatchText: { minWidth: 0, flex: 1, color: '#654500', fontFamily: typography.bodySemiBold, fontSize: 13, lineHeight: 20 },
  syntheticNotice: { minWidth: 0, flexDirection: 'row', alignItems: 'flex-start', gap: 9, padding: 12, borderWidth: 1, borderColor: '#D6E9FA', borderRadius: 12, backgroundColor: colors.ice },
  syntheticNoticeText: { minWidth: 0, flex: 1, color: colors.body, fontFamily: typography.body, fontSize: 12, lineHeight: 18 },
  primaryAction: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, paddingHorizontal: 18, borderRadius: 999, backgroundColor: colors.brightBlue },
  primaryActionText: { color: colors.paper, fontFamily: typography.bodySemiBold, fontSize: 14, lineHeight: 20 },
  primaryHovered: { opacity: 0.92 },
  primaryFocused: { borderWidth: 2, borderColor: colors.navy },
  statePanel: { minWidth: 0, alignItems: 'flex-start', gap: 8, padding: 14, borderWidth: 1, borderColor: colors.line, borderRadius: 12, backgroundColor: colors.paper },
  stateTitle: { color: colors.navy, fontFamily: typography.bodySemiBold, fontSize: 15, lineHeight: 21 },
  stateBody: { color: colors.muted, fontFamily: typography.body, fontSize: 13, lineHeight: 20 },
  retryButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 13, borderWidth: 1, borderColor: colors.paleBlue, borderRadius: 999, backgroundColor: colors.ice },
  retryText: { color: colors.blue, fontFamily: typography.bodySemiBold, fontSize: 13, lineHeight: 19 },
  retryHovered: { borderColor: colors.blue },
  retryFocused: { borderWidth: 2, borderColor: colors.focus },
  offlineNotice: { minWidth: 0, flexDirection: 'row', alignItems: 'flex-start', gap: 9, padding: 12, borderWidth: 1, borderColor: '#D6E9FA', borderRadius: 12, backgroundColor: colors.ice },
  offlineCopy: { minWidth: 0, flex: 1, gap: 2 },
  offlineTitle: { color: colors.navy, fontFamily: typography.bodySemiBold, fontSize: 13, lineHeight: 19 },
  offlineText: { color: colors.muted, fontFamily: typography.body, fontSize: 12, lineHeight: 18 },
  offlineRetry: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: colors.paper },
  offlineRetryDisabled: { opacity: 0.55 },
  controlPressed: { opacity: 0.72 },
});

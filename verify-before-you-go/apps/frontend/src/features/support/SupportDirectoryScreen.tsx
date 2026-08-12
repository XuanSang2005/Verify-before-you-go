import { Ionicons } from '@expo/vector-icons';
import type { SupportContact, SupportCountry } from '@vbyg/contracts';
import * as Clipboard from 'expo-clipboard';
import { Link } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Platform,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
  type ViewStyle,
} from 'react-native';

import { InteractiveSurface } from '@/components/InteractiveSurface';
import { PrototypeTabScreen } from '@/components/prototype/PrototypeShell';
import { colors, typography } from '@/theme';

import {
  filterSupportContacts,
  formatSupportCacheTime,
  formatSupportReviewDate,
  isSupportReviewDue,
  supportCountries,
} from './support-model';
import { useSupportDirectory } from './use-support-directory';

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

const saveGradient = Platform.select({
  web: { backgroundImage: 'linear-gradient(105deg,#0077D4 0%,#7B3FE4 100%)' },
  default: {},
}) as ViewStyle;

const howItWorksLinkStyle = StyleSheet.flatten<ViewStyle>({
  minWidth: 0,
  minHeight: 48,
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  paddingHorizontal: 4,
  borderTopWidth: 1,
  borderTopColor: '#E9EDF1',
});

export function SupportDirectoryScreen({
  mascotSource = require('../../../assets/mascots/help-wheelchair-screen08.jpg'),
}: {
  mascotSource?: ImageSourcePropType;
} = {}) {
  const [country, setCountry] = useState<SupportCountry>('cambodia');
  const [actionMessage, setActionMessage] = useState<string>();
  const directory = useSupportDirectory();
  const contacts = useMemo(
    () => filterSupportContacts(directory.response?.contacts ?? [], country),
    [country, directory.response?.contacts],
  );
  const phoneContacts = contacts.filter((contact) => contact.accessMode === 'cellular');
  const organizations = contacts.filter((contact) => contact.kind === 'organization');
  const hasResponse = Boolean(directory.response);

  const openUri = async (contact: SupportContact) => {
    setActionMessage(undefined);
    try {
      const supported = await Linking.canOpenURL(contact.actionUri);
      if (!supported) throw new Error('unsupported');
      await Linking.openURL(contact.actionUri);
    } catch {
      setActionMessage(`Could not open ${contact.actionLabel.toLowerCase()} on this device.`);
    }
  };

  const copyValue = async (contact: SupportContact) => {
    setActionMessage(undefined);
    try {
      const result = await Clipboard.setStringAsync(contact.displayValue) as boolean | void;
      if (result === false) throw new Error('copy failed');
      setActionMessage(`${contact.displayValue} copied.`);
    } catch {
      setActionMessage('Could not copy this contact.');
    }
  };

  return (
    <PrototypeTabScreen contentStyle={styles.screenContent} testID="support-directory-screen">
      <StatusBar style="dark" />
      <View style={styles.contentFrame}>
        <View style={styles.intro}>
          <Text style={styles.kicker}>Help · Offline-ready directory</Text>
          <Text accessibilityRole="header" style={styles.title}>Get help</Text>
          <Text style={styles.lede}>These work without an account. Save them before you travel.</Text>
        </View>

        <View style={styles.mascotStage} testID="support-screen08-mascot-stage">
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.rainbowRule}>
            <View style={[styles.rainbowSegment, styles.rainbowYellow]} />
            <View style={[styles.rainbowSegment, styles.rainbowGreen]} />
            <View style={[styles.rainbowSegment, styles.rainbowBlue]} />
            <View style={[styles.rainbowSegment, styles.rainbowPurple]} />
          </View>
          <Image
            accessibilityIgnoresInvertColors
            accessible={false}
            resizeMode="contain"
            source={mascotSource}
            style={styles.mascot}
          />
        </View>

        <View style={styles.countrySection}>
          <Text style={styles.sectionLabel}>Country</Text>
          <View accessibilityLabel="Choose a support country" style={styles.countryRow}>
            {supportCountries.map((option) => {
              const selected = option.id === country;
              const select = () => setCountry(option.id);
              const webToggleProps = Platform.OS === 'web'
                ? { 'aria-pressed': selected }
                : {};
              return (
                <InteractiveSurface
                  {...webToggleProps}
                  accessibilityLabel={`Show contacts for ${option.label}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  focusStyle={styles.controlFocused}
                  hoverStyle={styles.controlHovered}
                  key={option.id}
                  onPress={select}
                  pressedStyle={styles.controlPressed}
                  style={[styles.countryChip, selected && styles.countryChipSelected]}
                  testID={`support-country-${option.id}`}
                >
                  <Text style={[styles.countryChipText, selected && styles.countryChipTextSelected]}>{option.label}</Text>
                </InteractiveSurface>
              );
            })}
          </View>
        </View>

        {directory.status === 'loading' && !hasResponse ? <LoadingState /> : null}
        {directory.status === 'error' ? (
          <StatePanel
            body={directory.message ?? 'The support directory could not be loaded.'}
            onRetry={directory.retry}
            title="Support directory unavailable"
          />
        ) : null}
        {(directory.status === 'offline' || directory.status === 'service-unavailable') && directory.cachedAt ? (
          <SavedCopyNotice
            cachedAt={directory.cachedAt}
            message={directory.message ?? 'Showing saved contacts'}
            onRetry={directory.retry}
            refreshing={Boolean(directory.refreshing)}
          />
        ) : null}

        {hasResponse ? (
          <>
            <View style={styles.statusGuide}>
              <Ionicons color={colors.blue} name="information-circle-outline" size={19} />
              <Text style={styles.statusGuideText}>
                Reviewed references show a dated source check. Synthetic summaries describe prototype scenarios only. Calls need cellular service; organization pages need internet.
              </Text>
            </View>

            {phoneContacts.length ? (
              <View accessibilityLabel={`${country === 'cambodia' ? 'Cambodia' : 'Viet Nam'} phone contacts`} style={styles.contactList}>
                {phoneContacts.map((contact) => (
                  <PhoneContactCard
                    contact={contact}
                    key={contact.id}
                    onCopy={() => void copyValue(contact)}
                    onOpen={() => void openUri(contact)}
                  />
                ))}
              </View>
            ) : (
              <StatePanel body="No phone contacts are available in this country pack." title="No saved phone contacts" />
            )}

            <View style={styles.travelNote}>
              <Ionicons color={colors.blue} name="airplane-outline" size={18} />
              <Text style={styles.travelNoteText}>Going abroad? Save the destination numbers too, and verify them again before travel.</Text>
            </View>

            <View style={styles.organizationsSection}>
              <Text style={styles.sectionLabel}>Organizations · Needs a connection</Text>
              {organizations.map((contact) => (
                <OrganizationCard
                  contact={contact}
                  key={contact.id}
                  onOpen={() => void openUri(contact)}
                />
              ))}
            </View>

            <View style={styles.savePanel}>
              <InteractiveSurface
                accessibilityLabel={directory.savingOffline
                  ? 'Saving contacts offline'
                  : directory.savedOffline
                    ? 'Save contacts offline again'
                    : 'Save contacts offline'}
                accessibilityRole="button"
                accessibilityState={{ disabled: Boolean(directory.savingOffline) }}
                disabled={Boolean(directory.savingOffline)}
                disabledStyle={styles.controlDisabled}
                focusStyle={styles.saveButtonFocused}
                hoverStyle={styles.saveButtonHovered}
                onPress={() => void directory.saveOffline()}
                pressedStyle={styles.controlPressed}
                style={[styles.saveButton, saveGradient]}
              >
                {directory.savingOffline
                  ? <ActivityIndicator color={colors.paper} size="small" />
                  : <Ionicons color={colors.paper} name="download-outline" size={18} />}
                <Text style={styles.saveButtonText}>{directory.savingOffline ? 'Saving…' : 'Save offline'}</Text>
              </InteractiveSurface>
              <View style={styles.savedState}>
                <Ionicons
                  color={directory.savedOffline ? '#2B7A35' : colors.quiet}
                  name={directory.savedOffline ? 'checkmark-circle-outline' : 'cloud-offline-outline'}
                  size={18}
                />
                <Text style={styles.savedStateText}>
                  {directory.savedOffline ? 'Saved on this device' : 'Offline copy not confirmed'}
                </Text>
              </View>
              {directory.storageMessage ? (
                <Text accessibilityLiveRegion="polite" style={styles.storageMessage}>{directory.storageMessage}</Text>
              ) : null}
            </View>

            <View style={styles.privacyNotice}>
              <Ionicons color={colors.navy} name="shield-checkmark-outline" size={20} />
              <Text style={styles.privacyNoticeText}>{directory.response?.directoryNotice}</Text>
            </View>

            <Link asChild href="/how-it-works">
              <InteractiveSurface
                accessibilityLabel="How the support directory works"
                accessibilityRole="link"
                focusStyle={styles.controlFocused}
                hoverStyle={styles.linkHovered}
                pressedStyle={styles.controlPressed}
                style={howItWorksLinkStyle}
              >
                <Text style={styles.howItWorksText}>How this directory works</Text>
                <Ionicons color={colors.blue} name="chevron-forward" size={18} />
              </InteractiveSurface>
            </Link>
          </>
        ) : null}

        {actionMessage ? (
          <Text accessibilityLiveRegion="polite" style={styles.actionMessage}>{actionMessage}</Text>
        ) : null}
      </View>
    </PrototypeTabScreen>
  );
}

function PhoneContactCard({
  contact,
  onCopy,
  onOpen,
}: {
  contact: SupportContact;
  onCopy: () => void;
  onOpen: () => void;
}) {
  const reviewDue = isSupportReviewDue(contact);
  return (
    <View style={[styles.contactCard, cardShadow]} testID={`support-contact-${contact.id}`}>
      <View style={styles.contactHeadingRow}>
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.phoneIcon}>
          <Ionicons color={colors.blue} name={contact.kind === 'embassy' ? 'business-outline' : 'call-outline'} size={21} />
        </View>
        <View style={styles.contactCopy}>
          <Text style={styles.contactValue}>{contact.displayValue}</Text>
          <Text style={styles.contactTitle}>{contact.title}</Text>
        </View>
        <View style={styles.noDataPill}>
          <Ionicons color={colors.blue} name="cloud-offline-outline" size={13} />
          <Text style={styles.noDataText}>No data</Text>
        </View>
      </View>
      <Text style={styles.contactDescription}>{contact.description}</Text>
      <ContactMetadata contact={contact} reviewDue={reviewDue} />
      <View style={styles.contactActions}>
        <InteractiveSurface
          accessibilityLabel={contact.actionLabel}
          accessibilityRole="link"
          focusStyle={styles.controlFocused}
          hoverStyle={styles.secondaryActionHovered}
          onPress={onOpen}
          pressedStyle={styles.controlPressed}
          style={styles.primaryContactAction}
        >
          <Ionicons color={colors.paper} name="call-outline" size={17} />
          <Text style={styles.primaryContactActionText}>{contact.actionLabel}</Text>
        </InteractiveSurface>
        <InteractiveSurface
          accessibilityLabel={`Copy ${contact.displayValue}`}
          accessibilityRole="button"
          focusStyle={styles.controlFocused}
          hoverStyle={styles.secondaryActionHovered}
          onPress={onCopy}
          pressedStyle={styles.controlPressed}
          style={styles.secondaryContactAction}
        >
          <Ionicons color={colors.blue} name="copy-outline" size={17} />
          <Text style={styles.secondaryContactActionText}>Copy</Text>
        </InteractiveSurface>
      </View>
    </View>
  );
}

function OrganizationCard({ contact, onOpen }: { contact: SupportContact; onOpen: () => void }) {
  const reviewDue = isSupportReviewDue(contact);
  return (
    <View style={[styles.organizationCard, cardShadow]} testID={`support-contact-${contact.id}`}>
      <View style={styles.organizationTopRow}>
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.organizationIcon}>
          <Ionicons color={colors.purple} name="people-outline" size={19} />
        </View>
        <View style={styles.organizationCopy}>
          <Text style={styles.organizationTitle}>{contact.title}</Text>
          <Text style={styles.organizationDescription}>{contact.description}</Text>
        </View>
      </View>
      <View style={styles.internetPill}>
        <Ionicons color={colors.purple} name="globe-outline" size={14} />
        <Text style={styles.internetPillText}>Internet required · Synthetic summary</Text>
      </View>
      <ContactMetadata contact={contact} reviewDue={reviewDue} />
      <InteractiveSurface
        accessibilityLabel={contact.actionLabel}
        accessibilityRole="link"
        focusStyle={styles.controlFocused}
        hoverStyle={styles.organizationActionHovered}
        onPress={onOpen}
        pressedStyle={styles.controlPressed}
        style={styles.organizationAction}
      >
        <Text style={styles.organizationActionText}>{contact.actionLabel}</Text>
        <Ionicons color={colors.blue} name="open-outline" size={17} />
      </InteractiveSurface>
    </View>
  );
}

function ContactMetadata({ contact, reviewDue }: { contact: SupportContact; reviewDue: boolean }) {
  return (
    <View style={[styles.metadataPanel, reviewDue && styles.metadataPanelDue]}>
      <Text style={[styles.metadataStatus, reviewDue && styles.metadataStatusDue]}>
        {reviewDue ? 'Review due · confirm before relying' : contact.dataStatusLabel}
      </Text>
      <Text style={styles.metadataText}>Source · {contact.sourceOwner}</Text>
      <Text style={styles.metadataText}>Language · {contact.languages.join(' / ')} · {contact.hours}</Text>
      <Text style={styles.metadataText}>
        Reviewed {formatSupportReviewDate(contact.lastReviewedAt)} · Next review {formatSupportReviewDate(contact.nextReviewAt)}
      </Text>
    </View>
  );
}

function LoadingState() {
  return (
    <View accessibilityRole="progressbar" style={styles.loadingPanel}>
      <ActivityIndicator color={colors.blue} />
      <Text style={styles.loadingText}>Loading the support directory…</Text>
    </View>
  );
}

function StatePanel({
  body,
  onRetry,
  title,
}: {
  body: string;
  onRetry?: () => void;
  title: string;
}) {
  return (
    <View style={styles.statePanel}>
      <Text accessibilityRole="header" style={styles.stateTitle}>{title}</Text>
      <Text style={styles.stateBody}>{body}</Text>
      <Text style={styles.stateSafety}>If someone is in immediate danger, use a locally verified emergency service.</Text>
      {onRetry ? (
        <InteractiveSurface
          accessibilityLabel="Retry support directory"
          accessibilityRole="button"
          focusStyle={styles.controlFocused}
          hoverStyle={styles.secondaryActionHovered}
          onPress={onRetry}
          pressedStyle={styles.controlPressed}
          style={styles.retryButton}
        >
          <Ionicons color={colors.blue} name="refresh-outline" size={17} />
          <Text style={styles.retryButtonText}>Try again</Text>
        </InteractiveSurface>
      ) : null}
    </View>
  );
}

function SavedCopyNotice({
  cachedAt,
  message,
  onRetry,
  refreshing,
}: {
  cachedAt: string;
  message: string;
  onRetry: () => void;
  refreshing: boolean;
}) {
  return (
    <View style={styles.savedCopyNotice}>
      <View style={styles.savedCopyTextWrap}>
        <Text style={styles.savedCopyTitle}>{message}</Text>
        <Text style={styles.savedCopyMeta}>Saved {formatSupportCacheTime(cachedAt)}</Text>
      </View>
      <InteractiveSurface
        accessibilityLabel={refreshing ? 'Refreshing support directory' : 'Retry support directory'}
        accessibilityRole="button"
        accessibilityState={{ disabled: refreshing }}
        disabled={refreshing}
        disabledStyle={styles.controlDisabled}
        focusStyle={styles.controlFocused}
        hoverStyle={styles.secondaryActionHovered}
        onPress={onRetry}
        pressedStyle={styles.controlPressed}
        style={styles.noticeRetry}
      >
        {refreshing ? <ActivityIndicator color={colors.blue} size="small" /> : <Ionicons color={colors.blue} name="refresh-outline" size={17} />}
        <Text style={styles.noticeRetryText}>{refreshing ? 'Refreshing' : 'Retry'}</Text>
      </InteractiveSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  screenContent: { paddingTop: 12, paddingHorizontal: 18, gap: 14 },
  contentFrame: { minWidth: 0, width: '100%', maxWidth: 620, alignSelf: 'center', gap: 14 },
  intro: { minWidth: 0, gap: 4 },
  kicker: { color: colors.blue, fontFamily: typography.monoMedium, fontSize: 11, lineHeight: 16, letterSpacing: 1.1, textTransform: 'uppercase' },
  title: { color: colors.navy, fontFamily: typography.heading, fontSize: 29, fontWeight: '700', lineHeight: 34 },
  lede: { color: colors.body, fontFamily: typography.body, fontSize: 15, lineHeight: 23 },
  mascotStage: { position: 'relative', height: 184, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 1, borderColor: colors.line, borderRadius: 20, backgroundColor: colors.paper },
  rainbowRule: { position: 'absolute', top: 0, right: 0, left: 0, height: 4, flexDirection: 'row' },
  rainbowSegment: { flex: 1 },
  rainbowYellow: { backgroundColor: colors.amber },
  rainbowGreen: { backgroundColor: '#7ACB91' },
  rainbowBlue: { backgroundColor: colors.sky },
  rainbowPurple: { backgroundColor: '#8A5CF6' },
  mascot: { width: 154, height: 166 },
  countrySection: { gap: 8 },
  sectionLabel: { color: colors.quiet, fontFamily: typography.mono, fontSize: 11, lineHeight: 16, letterSpacing: 1.35, textTransform: 'uppercase' },
  countryRow: { minWidth: 0, flexDirection: 'row', gap: 10 },
  countryChip: { minWidth: 0, minHeight: 48, flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, borderWidth: 1, borderColor: colors.line, borderRadius: 999, backgroundColor: colors.paper },
  countryChipSelected: { borderColor: colors.brightBlue, backgroundColor: colors.brightBlue },
  countryChipText: { color: colors.blue, fontFamily: typography.bodySemiBold, fontSize: 15, lineHeight: 21 },
  countryChipTextSelected: { color: colors.paper },
  controlFocused: { borderWidth: 2, borderColor: colors.focus },
  controlHovered: { borderColor: colors.sky, backgroundColor: colors.ice },
  controlPressed: { opacity: 0.72 },
  controlDisabled: { opacity: 0.58 },
  statusGuide: { minWidth: 0, flexDirection: 'row', alignItems: 'flex-start', gap: 9, padding: 12, borderWidth: 1, borderColor: '#D6E9FA', borderRadius: 12, backgroundColor: colors.ice },
  statusGuideText: { minWidth: 0, flex: 1, color: colors.body, fontFamily: typography.body, fontSize: 13, lineHeight: 20 },
  contactList: { minWidth: 0, gap: 10 },
  contactCard: { minWidth: 0, gap: 9, padding: 14, borderWidth: 1, borderColor: colors.line, borderRadius: 14, backgroundColor: colors.paper },
  contactHeadingRow: { minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10 },
  phoneIcon: { width: 36, height: 36, flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: colors.ice },
  contactCopy: { minWidth: 0, flex: 1 },
  contactValue: { color: colors.ink, fontFamily: typography.bodySemiBold, fontSize: 21, lineHeight: 27 },
  contactTitle: { color: colors.body, fontFamily: typography.body, fontSize: 14, lineHeight: 20 },
  noDataPill: { minHeight: 28, flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, borderWidth: 1, borderColor: colors.paleBlue, borderRadius: 7, backgroundColor: '#F8FCFF' },
  noDataText: { color: colors.blue, fontFamily: typography.monoMedium, fontSize: 11, lineHeight: 15, letterSpacing: 0.7, textTransform: 'uppercase' },
  contactDescription: { color: colors.body, fontFamily: typography.body, fontSize: 13, lineHeight: 20 },
  metadataPanel: { minWidth: 0, gap: 2, padding: 9, borderRadius: 9, backgroundColor: colors.canvas },
  metadataPanelDue: { backgroundColor: colors.amberSoft },
  metadataStatus: { color: colors.blue, fontFamily: typography.monoMedium, fontSize: 11, lineHeight: 16, letterSpacing: 0.2, textTransform: 'uppercase' },
  metadataStatusDue: { color: '#7A4D00' },
  metadataText: { color: colors.muted, fontFamily: typography.body, fontSize: 12, lineHeight: 18 },
  contactActions: { minWidth: 0, flexDirection: 'row', gap: 8 },
  primaryContactAction: { minWidth: 0, minHeight: 48, flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 12, borderWidth: 2, borderColor: colors.navy, borderRadius: 999, backgroundColor: colors.navy },
  primaryContactActionText: { color: colors.paper, fontFamily: typography.bodySemiBold, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  secondaryContactAction: { minWidth: 88, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.line, borderRadius: 999, backgroundColor: colors.paper },
  secondaryContactActionText: { color: colors.blue, fontFamily: typography.bodySemiBold, fontSize: 13, lineHeight: 19 },
  secondaryActionHovered: { borderColor: colors.sky, backgroundColor: colors.ice },
  travelNote: { minWidth: 0, flexDirection: 'row', alignItems: 'flex-start', gap: 9, padding: 12, borderRadius: 12, backgroundColor: colors.ice },
  travelNoteText: { minWidth: 0, flex: 1, color: colors.body, fontFamily: typography.body, fontSize: 13, lineHeight: 20 },
  organizationsSection: { minWidth: 0, gap: 10, marginTop: 4 },
  organizationCard: { minWidth: 0, gap: 9, padding: 13, borderWidth: 1, borderColor: colors.line, borderRadius: 14, backgroundColor: colors.paper },
  organizationTopRow: { minWidth: 0, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  organizationIcon: { width: 38, height: 38, flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: '#F4EEFF' },
  organizationCopy: { minWidth: 0, flex: 1, gap: 2 },
  organizationTitle: { color: colors.navy, fontFamily: typography.bodySemiBold, fontSize: 15, lineHeight: 21 },
  organizationDescription: { color: colors.body, fontFamily: typography.body, fontSize: 13, lineHeight: 20 },
  internetPill: { minWidth: 0, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 5, paddingHorizontal: 8, borderRadius: 7, backgroundColor: '#F4EEFF' },
  internetPillText: { color: '#5C35AA', fontFamily: typography.monoMedium, fontSize: 11, lineHeight: 15, letterSpacing: 0.25, textTransform: 'uppercase' },
  organizationAction: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 13, borderWidth: 1, borderColor: colors.paleBlue, borderRadius: 999, backgroundColor: '#F8FCFF' },
  organizationActionHovered: { borderColor: colors.blue, backgroundColor: colors.ice },
  organizationActionText: { minWidth: 0, flex: 1, color: colors.blue, fontFamily: typography.bodySemiBold, fontSize: 13, lineHeight: 19 },
  savePanel: { minWidth: 0, gap: 8, padding: 13, borderWidth: 1, borderColor: colors.line, borderRadius: 14, backgroundColor: colors.paper },
  saveButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 2, borderColor: colors.brightBlue, borderRadius: 999, backgroundColor: colors.brightBlue },
  saveButtonHovered: { opacity: 0.9 },
  saveButtonFocused: { borderColor: colors.navy },
  saveButtonText: { color: colors.paper, fontFamily: typography.bodySemiBold, fontSize: 14, lineHeight: 20 },
  savedState: { minHeight: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  savedStateText: { color: colors.body, fontFamily: typography.bodyMedium, fontSize: 13, lineHeight: 19 },
  storageMessage: { color: colors.muted, fontFamily: typography.body, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  privacyNotice: { minWidth: 0, flexDirection: 'row', alignItems: 'flex-start', gap: 9, padding: 12, borderRadius: 12, backgroundColor: colors.amberSoft },
  privacyNoticeText: { minWidth: 0, flex: 1, color: colors.body, fontFamily: typography.body, fontSize: 12, lineHeight: 19 },
  howItWorksText: { color: colors.blue, fontFamily: typography.bodySemiBold, fontSize: 14, lineHeight: 21 },
  linkHovered: { backgroundColor: colors.ice },
  actionMessage: { padding: 10, color: colors.body, fontFamily: typography.bodyMedium, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  loadingPanel: { minHeight: 120, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 16, borderWidth: 1, borderColor: colors.line, borderRadius: 14, backgroundColor: colors.paper },
  loadingText: { color: colors.body, fontFamily: typography.body, fontSize: 13, lineHeight: 20 },
  statePanel: { minWidth: 0, gap: 8, padding: 14, borderWidth: 1, borderColor: colors.line, borderRadius: 14, backgroundColor: colors.paper },
  stateTitle: { color: colors.navy, fontFamily: typography.bodySemiBold, fontSize: 17, lineHeight: 23 },
  stateBody: { color: colors.body, fontFamily: typography.body, fontSize: 13, lineHeight: 20 },
  stateSafety: { color: colors.muted, fontFamily: typography.body, fontSize: 12, lineHeight: 18 },
  retryButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderWidth: 1, borderColor: colors.paleBlue, borderRadius: 999, backgroundColor: colors.ice },
  retryButtonText: { color: colors.blue, fontFamily: typography.bodySemiBold, fontSize: 13, lineHeight: 19 },
  savedCopyNotice: { minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderWidth: 1, borderColor: colors.paleBlue, borderRadius: 12, backgroundColor: colors.ice },
  savedCopyTextWrap: { minWidth: 0, flex: 1 },
  savedCopyTitle: { color: colors.navy, fontFamily: typography.bodySemiBold, fontSize: 13, lineHeight: 19 },
  savedCopyMeta: { color: colors.muted, fontFamily: typography.mono, fontSize: 11, lineHeight: 16 },
  noticeRetry: { minWidth: 92, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 10, borderWidth: 1, borderColor: colors.paleBlue, borderRadius: 999, backgroundColor: colors.paper },
  noticeRetryText: { color: colors.blue, fontFamily: typography.bodySemiBold, fontSize: 12, lineHeight: 18 },
});

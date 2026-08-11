import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type ViewStyle,
} from 'react-native';

import { InteractiveSurface } from '@/components/InteractiveSurface';
import { PrototypeTabScreen } from '@/components/prototype/PrototypeShell';
import { colors, layout, typography } from '@/theme';

import { checkedRuleCount, examplePostings } from './examples';
import {
  MAX_POSTING_TEXT_LENGTH,
  hasOfferDraftErrors,
  prepareOfferDraft,
  validateOfferDraft,
  type OfferDraftErrors,
  type ScreenshotDraft,
} from './model';
import { useOfferDraft } from './OfferDraftContext';
import type { RecentCheckMetadata } from './recent-model';
import { clearRecentChecks, loadRecentChecks, saveRecentCheckMetadata } from './recent-storage';

const checkMascot = require('../../../assets/mascots/home-wheelchair.png');
const practiceThumbnail = require('../../../assets/prototype/screen02-practice-thumbnail.jpg');

const webGradientButton = Platform.select({
  web: { backgroundImage: 'linear-gradient(135deg,#0077D4 0%,#7B3FE4 100%)' },
  default: {},
}) as ViewStyle;

const resultCardShadow = Platform.select({
  web: { boxShadow: '0 1px 2px rgba(34,30,31,.05)' },
  default: {
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
}) as ViewStyle;

export function OfferCheckScreen() {
  const { draft, setAnalysis, setDraft, setRecentSaveNotice } = useOfferDraft();
  const textInputRef = useRef<TextInput>(null);
  const [errors, setErrors] = useState<OfferDraftErrors>({});
  const [recentChecks, setRecentChecks] = useState<RecentCheckMetadata[]>([]);
  const [recentLoading, setRecentLoading] = useState(true);
  const [storageError, setStorageError] = useState<string>();
  const [pickingImage, setPickingImage] = useState(false);
  const [showLinkInput, setShowLinkInput] = useState(Boolean(draft.link));
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    void loadRecentChecks()
      .then((items) => {
        if (active) setRecentChecks(items);
      })
      .catch(() => {
        if (active) setStorageError('Recent activity is unavailable on this device. Your draft is still private and usable.');
      })
      .finally(() => {
        if (active) setRecentLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const updateDraft = (patch: Partial<typeof draft>) => {
    setAnalysis(undefined);
    setDraft((current) => ({ ...current, ...patch }));
  };

  const pastePosting = async () => {
    textInputRef.current?.focus();
    if (Platform.OS !== 'web' || !globalThis.navigator?.clipboard?.readText) return;
    try {
      const text = await globalThis.navigator.clipboard.readText();
      if (!text) return;
      updateDraft({ text: text.slice(0, MAX_POSTING_TEXT_LENGTH), exampleId: undefined });
      setErrors((current) => ({ ...current, general: undefined, text: undefined }));
    } catch {
      // Clipboard permission is optional; the focused textarea remains ready for a manual paste.
    }
  };

  const pickScreenshot = async () => {
    setPickingImage(true);
    setErrors((current) => ({ ...current, screenshot: undefined }));
    try {
      if (Platform.OS !== 'web') {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          setErrors((current) => ({
            ...current,
            screenshot: 'Photo-library access is needed to select a screenshot. You can continue with text or a link instead.',
          }));
          return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: false,
        base64: false,
        exif: false,
        mediaTypes: ['images'],
        quality: 0.9,
        selectionLimit: 1,
      });
      if (result.canceled || !result.assets[0]) return;

      const asset = result.assets[0];
      const screenshot: ScreenshotDraft = {
        uri: asset.uri,
        width: asset.width,
        height: asset.height,
        fileName: asset.fileName ?? undefined,
        fileSize: asset.fileSize,
        mimeType: asset.mimeType,
      };
      const screenshotError = validateOfferDraft({ ...draft, screenshot }).screenshot;
      if (screenshotError) {
        setErrors((current) => ({ ...current, screenshot: screenshotError }));
        return;
      }
      updateDraft({ screenshot, exampleId: undefined });
    } catch {
      setErrors((current) => ({
        ...current,
        screenshot: 'The screenshot could not be selected. Try another image or continue with text or a link.',
      }));
    } finally {
      setPickingImage(false);
    }
  };

  const chooseExample = (example: (typeof examplePostings)[number]) => {
    setErrors({});
    setAnalysis(undefined);
    setShowLinkInput(true);
    setDraft((current) => ({
      ...current,
      text: example.text,
      link: example.link,
      screenshot: undefined,
      exampleId: example.id,
    }));
    textInputRef.current?.focus();
  };

  const reviewPosting = async () => {
    const prepared = prepareOfferDraft(draft);
    const nextErrors = validateOfferDraft(prepared);
    setErrors(nextErrors);
    if (hasOfferDraftErrors(nextErrors)) return;

    setSubmitting(true);
    setRecentSaveNotice(undefined);
    setDraft(prepared);
    if (prepared.saveRecentMetadata) {
      try {
        const nextRecent = await saveRecentCheckMetadata(prepared);
        setRecentChecks(nextRecent);
      } catch {
        setRecentSaveNotice('The preview is ready, but recent metadata could not be saved on this device. No offer content was persisted.');
      }
    }
    setSubmitting(false);
    router.push('/check/preview');
  };

  const clearHistory = async () => {
    try {
      await clearRecentChecks();
      setRecentChecks([]);
      setStorageError(undefined);
    } catch {
      setStorageError('Recent activity could not be cleared. Try again from this device.');
    }
  };

  return (
    <PrototypeTabScreen testID="offer-checker">
      <StatusBar style="dark" />
      <View style={styles.identityBlock}>
        <Text style={styles.identityKicker}>Media &amp; information literacy assistant</Text>
        <Text accessibilityRole="header" style={styles.identityTitle}>Verify Before You Go</Text>
        <View accessibilityElementsHidden style={styles.rainbowRule}>
          <View style={[styles.rainbowSegment, styles.rainbowYellow]} />
          <View style={[styles.rainbowSegment, styles.rainbowGreen]} />
          <View style={[styles.rainbowSegment, styles.rainbowBlue]} />
          <View style={[styles.rainbowSegment, styles.rainbowPurple]} />
        </View>
      </View>
      <View style={[styles.postingArea, errors.text && styles.inputError]}>
        {draft.screenshot ? (
          <View style={styles.screenshotPreview}>
            <Image
              accessibilityLabel="Selected recruitment screenshot preview"
              resizeMode="cover"
              source={{ uri: draft.screenshot.uri }}
              style={styles.screenshotImage}
            />
            <View style={styles.screenshotCopy}>
              <Text numberOfLines={1} style={styles.screenshotName}>{draft.screenshot.fileName || 'Selected screenshot'}</Text>
              <Text style={styles.screenshotMeta}>{formatImageMetadata(draft.screenshot)}</Text>
              <Text style={styles.ocrNote}>Local preview · no OCR or upload</Text>
            </View>
            <InteractiveSurface
              accessibilityLabel="Remove selected screenshot"
              accessibilityRole="button"
              focusStyle={styles.controlFocused}
              hoverStyle={styles.controlHovered}
              onPress={() => updateDraft({ screenshot: undefined })}
              pressedStyle={styles.pressed}
              style={styles.removeScreenshot}
            >
              <Ionicons color={colors.blue} name="close" size={20} />
            </InteractiveSurface>
          </View>
        ) : null}
        <TextInput
          accessibilityLabel="Posting text or screenshot transcription"
          maxLength={MAX_POSTING_TEXT_LENGTH}
          multiline
          onChangeText={(text) => {
            updateDraft({ text, exampleId: undefined });
            setErrors((current) => ({ ...current, general: undefined, text: undefined }));
          }}
          placeholder="Paste the job ad — a Facebook post, a Telegram message, or a link. Screenshots work too."
          placeholderTextColor={colors.quiet}
          ref={textInputRef}
          style={styles.postingInput}
          textAlignVertical="top"
          value={draft.text}
        />
        <Text style={styles.characterCount}>{draft.text.length.toLocaleString('en-US')} / {MAX_POSTING_TEXT_LENGTH.toLocaleString('en-US')}</Text>
        <View style={styles.checkMascotAnchor}>
          <Image
            accessibilityIgnoresInvertColors
            accessible={false}
            resizeMode="contain"
            source={checkMascot}
            style={styles.checkMascot}
          />
        </View>
      </View>
      {errors.text ? <Text accessibilityLiveRegion="polite" style={styles.fieldError}>{errors.text}</Text> : null}

      <View style={styles.inputActions}>
        <InputAction icon="clipboard-outline" label="Paste" onPress={() => void pastePosting()} />
        <InputAction icon="image-outline" label="Screenshot" loading={pickingImage} onPress={() => void pickScreenshot()} />
        <InputAction icon="link-outline" label="Link" onPress={() => setShowLinkInput((visible) => !visible)} selected={showLinkInput} />
      </View>

      {showLinkInput ? (
        <View style={styles.linkPanel}>
          <TextInput
            accessibilityLabel="Recruitment link"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            onChangeText={(link) => {
              updateDraft({ link, exampleId: undefined });
              setErrors((current) => ({ ...current, general: undefined, link: undefined }));
            }}
            placeholder="https://example.org/job-posting"
            placeholderTextColor={colors.quiet}
            style={[styles.linkInput, errors.link && styles.inputError]}
            value={draft.link}
          />
          <Text style={styles.linkHelper}>The analysis reads the URL text only. It does not open, fetch or verify the destination page.</Text>
          {errors.link ? <Text accessibilityLiveRegion="polite" style={styles.fieldError}>{errors.link}</Text> : null}
        </View>
      ) : null}

      {errors.screenshot ? <Text accessibilityLiveRegion="polite" style={styles.fieldError}>{errors.screenshot}</Text> : null}
      {errors.general ? (
        <View accessibilityLiveRegion="polite" style={styles.errorNotice}>
          <Ionicons color="#A82A2A" name="alert-circle-outline" size={19} />
          <Text style={styles.errorNoticeText}>{errors.general}</Text>
        </View>
      ) : null}

      <InteractiveSurface
        accessibilityLabel="Review posting before analysis"
        accessibilityRole="button"
        disabled={submitting}
        disabledStyle={styles.disabled}
        focusStyle={styles.reviewFocused}
        hoverStyle={styles.reviewHovered}
        onPress={() => void reviewPosting()}
        pressedStyle={styles.pressed}
        style={[styles.reviewButton, webGradientButton]}
      >
        {submitting ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Ionicons color="#FFFFFF" name="scan-outline" size={18} />}
        <Text style={styles.reviewButtonText}>Review posting</Text>
      </InteractiveSurface>

      <View style={styles.consentRow}>
        <View style={styles.consentCopy}>
          <Text style={styles.consentTitle}>Remember metadata in Recent</Text>
          <Text style={styles.consentBody}>Optional. Saves time and input types only—not offer content.</Text>
        </View>
        <Switch
          accessibilityLabel="Remember non-sensitive metadata in Recent"
          onValueChange={(saveRecentMetadata) => updateDraft({ saveRecentMetadata })}
          thumbColor={colors.paper}
          trackColor={{ false: colors.line, true: colors.blue }}
          value={draft.saveRecentMetadata}
        />
      </View>

      <View style={styles.divider} />
      <View style={styles.recentSection}>
        <View style={styles.recentHeader}>
          <Text style={styles.sectionLabel}>Recent</Text>
          {recentChecks.length ? (
            <InteractiveSurface
              accessibilityLabel="Clear recent activity metadata"
              accessibilityRole="button"
              focusStyle={styles.controlFocused}
              hitSlop={10}
              hoverStyle={styles.controlHovered}
              onPress={() => void clearHistory()}
              pressedStyle={styles.pressed}
              style={styles.clearButton}
            >
              <Text style={styles.clearText}>Clear</Text>
            </InteractiveSurface>
          ) : null}
        </View>

        <View style={styles.resultCardList}>
          {examplePostings.map((example) => {
            const observedSignalCount = example.observedFindingIds.length;
            const hasObservedSignals = observedSignalCount > 0;
            const statusLabel = hasObservedSignals ? 'Several warning signs' : 'No observed signals';

            return (
              <InteractiveSurface
                accessibilityLabel={`Use synthetic example: ${example.title}. ${statusLabel}. ${observedSignalCount} of ${checkedRuleCount} signals observed. This is not a safety verdict.`}
                accessibilityRole="button"
                focusStyle={styles.cardFocused}
                hoverStyle={styles.cardHovered}
                key={example.id}
                onPress={() => chooseExample(example)}
                pressedStyle={styles.pressed}
                style={[styles.resultCard, resultCardShadow, draft.exampleId === example.id && styles.exampleSelected]}
              >
                <View style={styles.resultTopRow}>
                  <Text style={styles.resultTitle}>{example.title}</Text>
                  <Text style={styles.resultMeta}>Synthetic demo</Text>
                </View>
                <View style={[styles.statusPill, hasObservedSignals ? styles.statusPillWarning : styles.statusPillClear]}>
                  <Ionicons
                    color={hasObservedSignals ? colors.paper : colors.navy}
                    name={hasObservedSignals ? 'warning-outline' : 'search-outline'}
                    size={16}
                  />
                  <Text style={[styles.statusLabel, hasObservedSignals ? styles.statusLabelWarning : styles.statusLabelClear]}>
                    {statusLabel}
                  </Text>
                  <Text style={[styles.statusCount, hasObservedSignals ? styles.statusCountWarning : styles.statusCountClear]}>
                    {observedSignalCount}/{checkedRuleCount}
                  </Text>
                </View>
              </InteractiveSurface>
            );
          })}

          {recentLoading ? <Text style={styles.recentSupportingText}>Loading saved metadata…</Text> : null}
          {!recentLoading && recentChecks.length ? recentChecks.map((item) => (
            <View
              accessibilityLabel={`Local preview metadata saved ${formatRecentDate(item.savedAt)}. Inputs: ${formatKinds(item.inputKinds)}`}
              key={item.id}
              style={[styles.resultCard, resultCardShadow]}
            >
              <View style={styles.resultTopRow}>
                <Text style={styles.resultTitle}>Local preview metadata</Text>
                <Text style={styles.resultMeta}>{formatRecentDate(item.savedAt)}</Text>
              </View>
              <View style={[styles.statusPill, styles.statusPillSaved]}>
                <Ionicons color={colors.blue} name="time-outline" size={16} />
                <Text style={[styles.statusLabel, styles.statusLabelSaved]}>Saved · {formatKinds(item.inputKinds)}</Text>
                <Text style={[styles.statusCount, styles.statusCountSaved]}>{item.inputKinds.length} {item.inputKinds.length === 1 ? 'input' : 'inputs'}</Text>
              </View>
            </View>
          )) : null}
          {storageError ? <Text accessibilityLiveRegion="polite" style={styles.recentErrorText}>{storageError}</Text> : null}
        </View>

        <View accessibilityElementsHidden style={styles.recentSpacer} />

        <InteractiveSurface
          accessibilityLabel="Practice spotting them. Two synthetic postings, side by side."
          accessibilityRole="link"
          focusStyle={styles.cardFocused}
          hoverStyle={styles.cardHovered}
          onPress={() => router.push('/learn/scenario')}
          pressedStyle={styles.pressed}
          style={[styles.practiceCard, resultCardShadow]}
        >
          <View style={styles.practiceThumbnail}>
            <Image
              accessibilityIgnoresInvertColors
              accessible={false}
              resizeMode="stretch"
              source={practiceThumbnail}
              style={styles.practiceThumbnailImage}
            />
          </View>
          <View style={styles.practiceCopy}>
            <Text style={styles.practiceTitle}>Practice spotting them</Text>
            <Text style={styles.practiceDescription}>Two synthetic postings, side by side.</Text>
          </View>
          <Ionicons color={colors.quiet} name="chevron-forward" size={18} />
        </InteractiveSurface>

        <InteractiveSurface
          accessibilityLabel="View reviewed reports and alerts"
          accessibilityRole="link"
          focusStyle={styles.reportRowFocused}
          hoverStyle={styles.reportRowHovered}
          onPress={() => router.push('/alerts')}
          pressedStyle={styles.pressed}
          style={styles.reportsRow}
        >
          <Text style={styles.reportsLabel}>View reviewed reports and alerts</Text>
          <Ionicons color={colors.quiet} name="chevron-forward" size={18} />
        </InteractiveSurface>
      </View>
    </PrototypeTabScreen>
  );
}

function InputAction({
  icon,
  label,
  loading = false,
  onPress,
  selected = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  loading?: boolean;
  onPress: () => void;
  selected?: boolean;
}) {
  return (
    <InteractiveSurface
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      focusStyle={styles.controlFocused}
      hoverStyle={styles.controlHovered}
      onPress={onPress}
      pressedStyle={styles.pressed}
      style={[styles.inputAction, selected && styles.inputActionSelected]}
    >
      {loading ? <ActivityIndicator color={colors.blue} size="small" /> : <Ionicons color={colors.blue} name={icon} size={16} />}
      <Text style={styles.inputActionText}>{label}</Text>
    </InteractiveSurface>
  );
}

function formatImageMetadata(screenshot: ScreenshotDraft): string {
  const dimensions = screenshot.width && screenshot.height ? `${screenshot.width} × ${screenshot.height}` : 'Image';
  if (!screenshot.fileSize) return dimensions;
  const megabytes = screenshot.fileSize / (1024 * 1024);
  return `${dimensions} · ${megabytes.toFixed(megabytes >= 1 ? 1 : 2)} MB`;
}

function formatKinds(kinds: RecentCheckMetadata['inputKinds']): string {
  return kinds.map((kind) => kind[0].toUpperCase() + kind.slice(1)).join(' + ');
}

function formatRecentDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown time';
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

const styles = StyleSheet.create({
  identityBlock: { alignItems: 'flex-start', gap: 5, paddingBottom: 2 },
  identityKicker: { color: colors.quiet, fontFamily: typography.mono, fontSize: 11, lineHeight: 15, letterSpacing: 1.2, textTransform: 'uppercase' },
  identityTitle: { color: colors.blue, fontFamily: typography.heading, fontSize: 27, fontWeight: '700', lineHeight: 32, letterSpacing: -0.4 },
  rainbowRule: { width: 56, height: 3, flexDirection: 'row', overflow: 'hidden', borderRadius: 999 },
  rainbowSegment: { flex: 1 },
  rainbowYellow: { backgroundColor: '#FFC24D' },
  rainbowGreen: { backgroundColor: '#8ED97F' },
  rainbowBlue: { backgroundColor: '#3FB6E8' },
  rainbowPurple: { backgroundColor: '#A855F7' },
  checkMascotAnchor: { position: 'absolute', right: 8, bottom: -6, zIndex: 2, width: 44, height: 56, pointerEvents: 'none' },
  checkMascot: { width: 44, height: 56 },
  postingArea: { position: 'relative', minHeight: 168, gap: 8, padding: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.line, borderRadius: 8, backgroundColor: colors.paper },
  postingInput: { minHeight: 118, flex: 1, padding: 4, paddingRight: 48, color: colors.body, fontFamily: typography.body, fontSize: 15, lineHeight: 24 },
  characterCount: { alignSelf: 'flex-end', marginRight: 48, color: colors.quiet, fontFamily: typography.mono, fontSize: 8, lineHeight: 13 },
  screenshotPreview: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#E9EDF1' },
  screenshotImage: { width: 58, height: 56, flexShrink: 0, borderRadius: 9, backgroundColor: colors.ice },
  screenshotCopy: { minWidth: 0, flex: 1 },
  screenshotName: { color: colors.navy, fontFamily: typography.bodySemiBold, fontSize: 12, lineHeight: 17 },
  screenshotMeta: { color: colors.muted, fontFamily: typography.body, fontSize: 9, lineHeight: 14 },
  ocrNote: { color: colors.blue, fontFamily: typography.mono, fontSize: 8, lineHeight: 13, textTransform: 'uppercase' },
  removeScreenshot: { width: layout.minTouchTarget, height: layout.minTouchTarget, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  inputActions: { flexDirection: 'row', gap: 8 },
  inputAction: { minHeight: layout.minTouchTarget, flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 6, borderWidth: 1, borderColor: colors.line, borderRadius: 4, backgroundColor: colors.paper },
  inputActionSelected: { borderColor: colors.paleBlue, backgroundColor: colors.ice },
  inputActionText: { color: colors.blue, fontFamily: typography.bodyMedium, fontSize: 13, lineHeight: 19 },
  linkPanel: { gap: 5, padding: 10, borderWidth: 1, borderColor: '#D6E9FA', borderRadius: 8, backgroundColor: colors.ice },
  linkInput: { minHeight: layout.minTouchTarget, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.line, borderRadius: 6, backgroundColor: colors.paper, color: colors.body, fontFamily: typography.body, fontSize: 13 },
  linkHelper: { color: colors.muted, fontFamily: typography.body, fontSize: 9, lineHeight: 14 },
  inputError: { borderColor: '#C54A4A' },
  fieldError: { color: '#A82A2A', fontFamily: typography.bodyMedium, fontSize: 10, lineHeight: 16 },
  errorNotice: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 10, borderWidth: 1, borderColor: '#E8B5B5', borderRadius: 8, backgroundColor: '#FFF3F3' },
  errorNoticeText: { minWidth: 0, flex: 1, color: '#7D2020', fontFamily: typography.body, fontSize: 11, lineHeight: 17 },
  reviewButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 4, paddingHorizontal: 24, borderRadius: 999, backgroundColor: '#0077D4' },
  reviewHovered: { opacity: 0.9 },
  reviewFocused: { borderWidth: 3, borderColor: colors.focus },
  reviewButtonText: { color: '#FFFFFF', fontFamily: typography.bodySemiBold, fontSize: 16, lineHeight: 23 },
  disabled: { opacity: 0.45 },
  consentRow: { minHeight: layout.minTouchTarget, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: colors.line, borderRadius: 8, backgroundColor: colors.paper },
  consentCopy: { minWidth: 0, flex: 1 },
  consentTitle: { color: colors.navy, fontFamily: typography.bodySemiBold, fontSize: 11, lineHeight: 16 },
  consentBody: { color: colors.quiet, fontFamily: typography.body, fontSize: 9, lineHeight: 14 },
  divider: { height: 1, marginTop: 12, marginBottom: 4, backgroundColor: colors.line },
  recentSection: { minWidth: 0, width: '100%', maxWidth: '100%', gap: 12 },
  recentHeader: { minWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  sectionLabel: { color: colors.quiet, fontFamily: typography.mono, fontSize: 11, lineHeight: 16, letterSpacing: 1.2, textTransform: 'uppercase' },
  clearButton: { minHeight: 24, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5, borderRadius: 4 },
  clearText: { color: colors.blue, fontFamily: typography.bodyMedium, fontSize: 13, lineHeight: 19 },
  resultCardList: { minWidth: 0, width: '100%', maxWidth: '100%', gap: 12 },
  resultCard: { minWidth: 0, width: '100%', maxWidth: '100%', gap: 8, padding: 14, borderWidth: 1, borderColor: '#D8DDE2', borderRadius: 12, backgroundColor: colors.paper },
  resultTopRow: { minWidth: 0, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  resultTitle: { minWidth: 0, flex: 1, color: colors.ink, fontFamily: typography.bodySemiBold, fontSize: 15, lineHeight: 21 },
  resultMeta: { maxWidth: '44%', flexShrink: 1, color: colors.quiet, fontFamily: typography.mono, fontSize: 11, lineHeight: 15, letterSpacing: 1.2, textAlign: 'right', textTransform: 'uppercase' },
  statusPill: { minWidth: 0, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderRadius: 4 },
  statusPillWarning: { borderColor: colors.brightBlue, backgroundColor: colors.brightBlue },
  statusPillClear: { borderColor: colors.paleBlue, backgroundColor: '#D6E9FA' },
  statusPillSaved: { borderColor: colors.paleBlue, backgroundColor: colors.ice },
  statusLabel: { minWidth: 0, flexShrink: 1, fontFamily: typography.bodyMedium, fontSize: 13, lineHeight: 19 },
  statusLabelWarning: { color: colors.paper },
  statusLabelClear: { color: colors.navy },
  statusLabelSaved: { color: colors.blue },
  statusCount: { flexShrink: 0, fontFamily: typography.mono, fontSize: 11, lineHeight: 15, letterSpacing: 1 },
  statusCountWarning: { color: 'rgba(255,255,255,.82)' },
  statusCountClear: { color: colors.navy },
  statusCountSaved: { color: colors.blue },
  recentSupportingText: { color: colors.muted, fontFamily: typography.body, fontSize: 13, lineHeight: 19 },
  recentErrorText: { color: '#A82A2A', fontFamily: typography.bodyMedium, fontSize: 13, lineHeight: 19 },
  exampleSelected: { borderColor: colors.paleBlue, backgroundColor: colors.ice },
  recentSpacer: { minHeight: 16, flexGrow: 1 },
  practiceCard: { minWidth: 0, width: '100%', maxWidth: '100%', minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.line, borderRadius: 20, backgroundColor: colors.paper },
  practiceThumbnail: { position: 'relative', width: 64, height: 56, flexShrink: 0, overflow: 'hidden', borderRadius: 14, backgroundColor: colors.ice },
  practiceThumbnailImage: { position: 'absolute', top: 0, left: -1.23, width: 68.4, height: 56 },
  practiceCopy: { minWidth: 0, flex: 1 },
  practiceTitle: { color: colors.ink, fontFamily: typography.bodySemiBold, fontSize: 15, lineHeight: 21 },
  practiceDescription: { color: colors.muted, fontFamily: typography.body, fontSize: 13, lineHeight: 19 },
  reportsRow: { minWidth: 0, width: '100%', maxWidth: '100%', minHeight: layout.minTouchTarget, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#E9EDF1' },
  reportsLabel: { minWidth: 0, flex: 1, color: colors.blue, fontFamily: typography.body, fontSize: 15, lineHeight: 24 },
  reportRowHovered: { backgroundColor: colors.ice },
  reportRowFocused: { borderWidth: 2, borderColor: colors.blue },
  cardHovered: { borderColor: colors.paleBlue, backgroundColor: colors.ice },
  cardFocused: { borderWidth: 2, borderColor: colors.blue },
  controlHovered: { backgroundColor: colors.ice },
  controlFocused: { borderWidth: 2, borderColor: colors.blue },
  pressed: { opacity: 0.72 },
});

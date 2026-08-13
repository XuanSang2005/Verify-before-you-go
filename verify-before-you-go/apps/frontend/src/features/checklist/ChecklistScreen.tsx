import { Ionicons } from '@expo/vector-icons';
import { Link, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';

import { InteractiveSurface } from '@/components/InteractiveSurface';
import { PrototypeTabScreen } from '@/components/prototype/PrototypeShell';
import { useOfferDraft } from '@/features/offer-intake/OfferDraftContext';
import { colors, typography } from '@/theme';

import { requestChecklistResetConfirmation } from './checklist-confirmation';
import { CHECKLIST_ITEM_IDS, verificationChecklistItems, type ChecklistItemId, type VerificationChecklistItem } from './checklist-items';
import { getChecklistBackRoute } from './checklist-navigation';
import {
  createEmptyChecklistProgress,
  getChecklistReviewedCount,
  getChecklistUnverifiedCount,
  getChecklistVerifiedCount,
  resetChecklistProgress,
  toggleChecklistItemState,
  type ChecklistItemState,
  type ChecklistProgress,
} from './checklist-model';
import { runConfirmedChecklistReset } from './checklist-reset';
import {
  loadChecklistProgress,
  retryChecklistReadAndMergeSession,
  saveChecklistProgressAfterConfirmedRead,
} from './checklist-storage';

const checklistMascot = require('../../../assets/mascots/screen06-checklist.png');

type StorageIssue = {
  operation: 'read' | 'write';
  message: string;
};

const progressShadow = Platform.select({
  web: { boxShadow: '0 1px 2px rgba(34,30,31,.05)' },
  default: {
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
}) as ViewStyle;

function getRecoveryNotice(status: 'empty' | 'valid' | 'migrated' | 'recovered') {
  if (status === 'recovered') return 'Invalid saved checklist data was ignored. A new local checklist was started.';
  if (status === 'migrated') return 'Your earlier checklist was updated to the current local format.';
  return undefined;
}

export function ChecklistScreen() {
  const { analysis } = useOfferDraft();
  const [progress, setProgress] = useState<ChecklistProgress>(() => createEmptyChecklistProgress());
  const progressRef = useRef(progress);
  const storageReadSucceededRef = useRef(false);
  const pendingSessionEditsRef = useRef(new Set<ChecklistItemId>());
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const latestSave = useRef(0);
  const [loading, setLoading] = useState(true);
  const [storageIssue, setStorageIssue] = useState<StorageIssue>();
  const [recoveryNotice, setRecoveryNotice] = useState<string>();

  const hasTransientAnalysis = Boolean(analysis);
  const backRoute = getChecklistBackRoute(hasTransientAnalysis);
  const reviewedCount = getChecklistReviewedCount(progress);
  const verifiedCount = getChecklistVerifiedCount(progress);
  const unverifiedCount = getChecklistUnverifiedCount(progress);
  const complete = reviewedCount === CHECKLIST_ITEM_IDS.length;

  const commitProgress = useCallback((next: ChecklistProgress) => {
    progressRef.current = next;
    setProgress(next);
  }, []);

  useEffect(() => {
    let active = true;
    void loadChecklistProgress()
      .then((result) => {
        if (!active) return;
        storageReadSucceededRef.current = true;
        commitProgress(result.progress);
        setRecoveryNotice(getRecoveryNotice(result.status));
      })
      .catch(() => {
        if (!active) return;
        storageReadSucceededRef.current = false;
        setStorageIssue({
          operation: 'read',
          message: 'Saved progress could not be read. Session changes will not overwrite existing saved data. Retry to merge them safely.',
        });
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [commitProgress]);

  const persistProgress = useCallback((next: ChecklistProgress) => {
    if (!storageReadSucceededRef.current) return;

    const saveId = latestSave.current + 1;
    latestSave.current = saveId;
    const queuedSave = saveQueue.current
      .catch(() => undefined)
      .then(async () => {
        await saveChecklistProgressAfterConfirmedRead(next, storageReadSucceededRef.current);
      });
    saveQueue.current = queuedSave.catch(() => undefined);

    void queuedSave
      .then(() => {
        if (latestSave.current === saveId) setStorageIssue(undefined);
      })
      .catch(() => {
        if (latestSave.current !== saveId) return;
        setStorageIssue({
          operation: 'write',
          message: 'This change remains in the current session but could not be saved on this device.',
        });
      });
  }, []);

  const chooseItemState = (id: ChecklistItemId, state: Exclude<ChecklistItemState, 'untouched'>) => {
    const next = toggleChecklistItemState(progressRef.current, id, state);
    if (!storageReadSucceededRef.current) pendingSessionEditsRef.current.add(id);
    commitProgress(next);
    persistProgress(next);
  };

  const resetAll = async () => {
    await runConfirmedChecklistReset(requestChecklistResetConfirmation, () => {
      const next = resetChecklistProgress(progressRef.current);
      if (!storageReadSucceededRef.current) {
        CHECKLIST_ITEM_IDS.forEach((id) => pendingSessionEditsRef.current.add(id));
      }
      commitProgress(next);
      persistProgress(next);
      setRecoveryNotice(undefined);
    });
  };

  const retryStorage = async () => {
    if (storageIssue?.operation === 'read') {
      setLoading(true);
      try {
        const result = await retryChecklistReadAndMergeSession(
          progressRef.current,
          pendingSessionEditsRef.current,
        );
        storageReadSucceededRef.current = true;
        pendingSessionEditsRef.current.clear();
        commitProgress(result.progress);
        setRecoveryNotice(getRecoveryNotice(result.status));
        setStorageIssue(undefined);
      } catch {
        storageReadSucceededRef.current = false;
        setStorageIssue({
          operation: 'read',
          message: 'Storage is still unavailable. Session changes remain here and existing saved data has not been replaced.',
        });
      } finally {
        setLoading(false);
      }
      return;
    }

    persistProgress(progressRef.current);
  };

  return (
    <PrototypeTabScreen
      contentStyle={styles.screenContent}
      scrollToEndKey={complete ? 'complete' : undefined}
      testID="verification-checklist"
    >
      <StatusBar style="dark" />

      <View style={styles.backRow}>
        <InteractiveSurface
          accessibilityLabel={hasTransientAnalysis ? 'Back to analysis result' : 'Back to new check'}
          accessibilityRole="link"
          focusStyle={styles.controlFocused}
          hoverStyle={styles.controlHovered}
          onPress={() => router.replace(backRoute)}
          pressedStyle={styles.pressed}
          style={styles.backControl}
        >
          <Ionicons color={colors.body} name="chevron-back" size={20} />
          <Text style={styles.backText}>{hasTransientAnalysis ? 'Back to result' : 'Back to check'}</Text>
        </InteractiveSurface>
      </View>

      <View style={styles.intro}>
        <Text style={styles.kicker}>Independent verification</Text>
        <Text accessibilityRole="header" style={styles.title}>Your checklist</Text>
        <Text style={styles.introText}>Review five checks in any order, online or offline.</Text>
        <Image
          accessibilityIgnoresInvertColors
          accessible={false}
          resizeMode="contain"
          source={checklistMascot}
          style={styles.mascot}
        />
      </View>

      <View style={[styles.progressCard, progressShadow]}>
        <View style={styles.progressMetaRow}>
          <Text style={styles.progressKicker}>Checklist · progress</Text>
          <Text accessibilityLiveRegion="polite" style={styles.progressCount}>{reviewedCount}/5</Text>
        </View>
        <Text style={styles.progressHeadline}>
          {complete
            ? `All five reviewed · ${verifiedCount} verified · ${unverifiedCount} couldn’t verify`
            : `${reviewedCount} of 5 reviewed · ${verifiedCount} verified · ${unverifiedCount} couldn’t verify`}
        </Text>
        <View
          aria-valuemax={5}
          aria-valuemin={0}
          aria-valuenow={reviewedCount}
          aria-valuetext={`${reviewedCount} of 5 reviewed`}
          accessibilityLabel={`Checklist progress: ${reviewedCount} of 5 reviewed`}
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: 5, now: reviewedCount, text: `${reviewedCount} of 5 reviewed` }}
          style={styles.progressTrack}
        >
          <View style={[styles.progressFill, { width: `${(reviewedCount / 5) * 100}%` }]} />
        </View>
      </View>

      <View style={styles.offlineNotice}>
        <Ionicons color={colors.blue} name="cloud-offline-outline" size={18} />
        <Text style={styles.offlineText}>Works offline. Answers stay on this device.</Text>
      </View>

      <Text style={styles.guidanceText}>Independent verification guidance—not a verdict or a guarantee.</Text>

      {recoveryNotice ? (
        <View accessibilityLiveRegion="polite" style={styles.recoveryNotice}>
          <Ionicons color="#8B5C00" name="refresh-circle-outline" size={18} />
          <Text style={styles.recoveryText}>{recoveryNotice}</Text>
        </View>
      ) : null}

      {storageIssue ? (
        <View accessibilityLiveRegion="assertive" style={styles.storageError}>
          <Ionicons color="#A82A2A" name="alert-circle-outline" size={19} />
          <View style={styles.storageErrorCopy}>
            <Text style={styles.storageErrorText}>{storageIssue.message}</Text>
            <InteractiveSurface
              accessibilityLabel="Retry checklist storage"
              accessibilityRole="button"
              focusStyle={styles.inlineControlFocused}
              hoverStyle={styles.inlineControlHovered}
              onPress={() => void retryStorage()}
              pressedStyle={styles.pressed}
              style={styles.retryButton}
            >
              <Text style={styles.retryText}>Retry storage</Text>
            </InteractiveSurface>
          </View>
        </View>
      ) : null}

      {loading ? (
        <View accessibilityLiveRegion="polite" style={styles.loadingRow}>
          <ActivityIndicator color={colors.blue} size="small" />
          <Text style={styles.loadingText}>Loading local checklist…</Text>
        </View>
      ) : null}

      <View accessibilityLabel="Five verification items" style={styles.checklistPanel}>
        {verificationChecklistItems.map((item, index) => {
          const state = progress.items.find((candidate) => candidate.id === item.id)?.state ?? 'untouched';
          return (
            <ChecklistItemRow
              disabled={loading}
              index={index}
              item={item}
              key={item.id}
              onChoose={(nextState) => chooseItemState(item.id, nextState)}
              state={state}
            />
          );
        })}
      </View>

      <Text style={styles.flagHelp}>“Couldn’t verify” means you tried but could not independently confirm the item. Keep it recorded.</Text>

      {complete ? (
        <View accessibilityLiveRegion="polite" style={styles.completedRow}>
          <Ionicons color={colors.blue} name="checkmark-done-circle-outline" size={22} />
          <View style={styles.completedCopy}>
            <Text style={styles.completedTitle}>All items reviewed</Text>
            <Text style={styles.completedText}>This record is not a verdict. Revisit anything that changes or remains unverified.</Text>
          </View>
        </View>
      ) : null}

      <View style={styles.actRow}>
        <View style={styles.competencyChip}><View style={styles.competencyMark} /><Text style={styles.competencyText}>Act</Text></View>
        <Text style={styles.actText}>Choosing a next step you control.</Text>
      </View>

      {complete ? (
        <Link asChild href="/learn/scenario">
          <InteractiveSurface
            accessibilityLabel="Continue to scenario practice"
            accessibilityRole="link"
            focusStyle={styles.continueFocused}
            hoverStyle={styles.continueHovered}
            pressedStyle={styles.pressed}
            style={styles.continueButton}
            testID="checklist-continue"
          >
            <Text style={styles.continueText}>Continue to scenario practice</Text>
            <Ionicons color={colors.paper} name="arrow-forward" size={18} />
          </InteractiveSurface>
        </Link>
      ) : null}

      <InteractiveSurface
        accessibilityLabel="Reset checklist"
        accessibilityRole="button"
        accessibilityState={{ disabled: reviewedCount === 0 }}
        disabled={reviewedCount === 0}
        disabledStyle={styles.resetDisabled}
        focusStyle={styles.resetFocused}
        hoverStyle={styles.resetHovered}
        onPress={() => void resetAll()}
        pressedStyle={styles.pressed}
        style={styles.resetButton}
      >
        <Ionicons color={colors.blue} name="refresh-outline" size={18} />
        <Text style={styles.resetText}>Reset checklist</Text>
      </InteractiveSurface>
    </PrototypeTabScreen>
  );
}

function ChecklistItemRow({
  disabled,
  index,
  item,
  onChoose,
  state,
}: {
  disabled: boolean;
  index: number;
  item: VerificationChecklistItem;
  onChoose: (state: 'verified' | 'unverified') => void;
  state: ChecklistItemState;
}) {
  return (
    <View style={[styles.itemRow, index < CHECKLIST_ITEM_IDS.length - 1 && styles.itemDivider]}>
      <View style={styles.itemHeadingRow}>
        <Text style={styles.itemNumber}>{String(index + 1).padStart(2, '0')}</Text>
        <Text style={styles.itemTitle}>{item.title}</Text>
      </View>
      <Text style={styles.itemBody}><Text style={styles.itemLabel}>Why this matters: </Text>{item.whyItMatters}</Text>
      <Text style={styles.itemBody}><Text style={styles.itemLabel}>Check independently: </Text>{item.independentCheck}</Text>
      <View accessibilityLabel={`Review item ${index + 1}`} style={styles.itemControls}>
        <ChecklistStateControl
          active={state === 'verified'}
          accessibilityLabel={`Item ${index + 1} of 5. Verify. ${item.title}. ${state === 'verified' ? 'Selected' : 'Not selected'}.`}
          disabled={disabled}
          icon="checkmark"
          label="Verify"
          onPress={() => onChoose('verified')}
          tone="verified"
        />
        <ChecklistStateControl
          active={state === 'unverified'}
          accessibilityLabel={`Item ${index + 1} of 5. Couldn’t verify. ${item.title}. ${state === 'unverified' ? 'Selected' : 'Not selected'}.`}
          disabled={disabled}
          icon="flag-outline"
          label="Couldn’t verify"
          onPress={() => onChoose('unverified')}
          tone="unverified"
        />
      </View>
    </View>
  );
}

function ChecklistStateControl({
  accessibilityLabel,
  active,
  disabled,
  icon,
  label,
  onPress,
  tone,
}: {
  accessibilityLabel: string;
  active: boolean;
  disabled: boolean;
  icon: 'checkmark' | 'flag-outline';
  label: string;
  onPress: () => void;
  tone: 'verified' | 'unverified';
}) {
  const unverified = tone === 'unverified';
  const activeColor = unverified ? '#8B5C00' : colors.blue;

  return (
    <InteractiveSurface
      aria-checked={active}
      aria-disabled={disabled}
      accessibilityHint={active ? 'Activate again to return this item to untouched' : `Activate to mark this item ${label.toLowerCase()}`}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: active, disabled }}
      disabled={disabled}
      disabledStyle={styles.stateControlDisabled}
      focusStyle={styles.stateControlFocused}
      hoverStyle={styles.stateControlHovered}
      onPress={onPress}
      pressedStyle={styles.pressed}
      style={[
        styles.stateControl,
        active && (unverified ? styles.stateControlUnverified : styles.stateControlVerified),
      ]}
    >
      <Ionicons color={active ? activeColor : colors.quiet} name={icon} size={17} />
      <Text style={[styles.stateControlText, active && { color: activeColor }]}>{label}</Text>
    </InteractiveSurface>
  );
}

const styles = StyleSheet.create({
  screenContent: { paddingTop: 14 },
  backRow: { minWidth: 0, width: '100%', maxWidth: '100%', flexDirection: 'row' },
  backControl: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, borderWidth: 1, borderColor: colors.line, borderRadius: 999, backgroundColor: colors.paper },
  backText: { color: colors.body, fontFamily: typography.bodyMedium, fontSize: 13, lineHeight: 19 },
  intro: { position: 'relative', minWidth: 0, minHeight: 80, width: '100%', maxWidth: '100%', gap: 4, paddingRight: 52 },
  kicker: { color: colors.blue, fontFamily: typography.mono, fontSize: 11, lineHeight: 16, letterSpacing: 1.2, textTransform: 'uppercase' },
  title: { color: colors.ink, fontFamily: typography.heading, fontSize: 29, fontWeight: '700', lineHeight: 34, letterSpacing: -0.4 },
  introText: { color: colors.muted, fontFamily: typography.body, fontSize: 13, lineHeight: 19 },
  mascot: { position: 'absolute', top: 0, right: 6, width: 32, height: 44 },
  progressCard: { minWidth: 0, width: '100%', maxWidth: '100%', gap: 7, padding: 14, borderWidth: 1, borderColor: colors.line, borderRadius: 12, backgroundColor: colors.paper },
  progressMetaRow: { minWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  progressKicker: { minWidth: 0, flex: 1, color: colors.quiet, fontFamily: typography.mono, fontSize: 11, lineHeight: 16, letterSpacing: 1.2, textTransform: 'uppercase' },
  progressCount: { flexShrink: 0, color: colors.blue, fontFamily: typography.monoMedium, fontSize: 12, lineHeight: 18, letterSpacing: 1 },
  progressHeadline: { color: colors.ink, fontFamily: typography.body, fontSize: 14, lineHeight: 21 },
  progressTrack: { width: '100%', maxWidth: '100%', height: 8, overflow: 'hidden', borderRadius: 4, backgroundColor: '#D6E9FA' },
  progressFill: { height: '100%', borderRadius: 4, backgroundColor: colors.brightBlue },
  offlineNotice: { minWidth: 0, width: '100%', maxWidth: '100%', flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, paddingHorizontal: 14, borderWidth: 1, borderColor: '#D6E9FA', borderRadius: 12, backgroundColor: colors.ice },
  offlineText: { minWidth: 0, flex: 1, color: colors.body, fontFamily: typography.body, fontSize: 13, lineHeight: 19 },
  guidanceText: { color: colors.muted, fontFamily: typography.body, fontSize: 13, lineHeight: 19 },
  recoveryNotice: { minWidth: 0, flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12, borderWidth: 1, borderColor: colors.amber, borderRadius: 10, backgroundColor: colors.amberSoft },
  recoveryText: { minWidth: 0, flex: 1, color: '#6F4A00', fontFamily: typography.body, fontSize: 13, lineHeight: 19 },
  storageError: { minWidth: 0, flexDirection: 'row', alignItems: 'flex-start', gap: 9, padding: 12, borderWidth: 1, borderColor: '#E8B5B5', borderRadius: 10, backgroundColor: '#FFF3F3' },
  storageErrorCopy: { minWidth: 0, flex: 1, gap: 6 },
  storageErrorText: { color: '#7D2020', fontFamily: typography.body, fontSize: 13, lineHeight: 19 },
  retryButton: { minHeight: 48, alignSelf: 'flex-start', justifyContent: 'center', paddingHorizontal: 10, borderRadius: 6 },
  retryText: { color: colors.blue, fontFamily: typography.bodySemiBold, fontSize: 13, lineHeight: 19 },
  loadingRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { color: colors.muted, fontFamily: typography.body, fontSize: 13, lineHeight: 19 },
  checklistPanel: { minWidth: 0, width: '100%', maxWidth: '100%', overflow: 'hidden', paddingHorizontal: 12, borderWidth: 1, borderColor: colors.line, borderRadius: 12, backgroundColor: colors.paper },
  itemRow: { minWidth: 0, width: '100%', maxWidth: '100%', gap: 6, paddingVertical: 11 },
  itemDivider: { borderBottomWidth: 1, borderBottomColor: '#E9EDF1' },
  itemHeadingRow: { minWidth: 0, flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  itemNumber: { width: 22, flexShrink: 0, paddingTop: 2, color: colors.blue, fontFamily: typography.mono, fontSize: 11, lineHeight: 16, letterSpacing: 0.8 },
  itemTitle: { minWidth: 0, flex: 1, color: colors.ink, fontFamily: typography.bodySemiBold, fontSize: 15, lineHeight: 21 },
  itemBody: { color: colors.body, fontFamily: typography.body, fontSize: 12, lineHeight: 18 },
  itemLabel: { color: colors.blue, fontFamily: typography.bodySemiBold },
  itemControls: { minWidth: 0, width: '100%', maxWidth: '100%', flexDirection: 'row', gap: 8, paddingTop: 2 },
  stateControl: { minWidth: 0, minHeight: 48, flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 9, borderWidth: 1, borderColor: colors.line, borderRadius: 8, backgroundColor: colors.paper },
  stateControlVerified: { borderColor: colors.brightBlue, backgroundColor: colors.ice },
  stateControlUnverified: { borderColor: colors.amber, backgroundColor: colors.amberSoft },
  stateControlDisabled: { opacity: 0.6 },
  stateControlText: { flexShrink: 1, color: colors.quiet, fontFamily: typography.bodyMedium, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  flagHelp: { color: colors.muted, fontFamily: typography.body, fontSize: 13, lineHeight: 19 },
  completedRow: { minWidth: 0, flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 13, borderWidth: 1, borderColor: colors.paleBlue, borderRadius: 12, backgroundColor: colors.ice },
  completedCopy: { minWidth: 0, flex: 1 },
  completedTitle: { color: colors.navy, fontFamily: typography.bodySemiBold, fontSize: 15, lineHeight: 21 },
  completedText: { marginTop: 2, color: colors.body, fontFamily: typography.body, fontSize: 13, lineHeight: 19 },
  actRow: { minWidth: 0, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  competencyChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 5, paddingHorizontal: 10, borderRadius: 4, backgroundColor: '#D6E9FA' },
  competencyMark: { width: 6, height: 6, borderRadius: 1, backgroundColor: colors.amber },
  competencyText: { color: colors.blue, fontFamily: typography.bodySemiBold, fontSize: 13, lineHeight: 19 },
  actText: { minWidth: 0, flexShrink: 1, color: colors.muted, fontFamily: typography.body, fontSize: 13, lineHeight: 19 },
  continueButton: { minWidth: 0, width: '100%', minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, paddingHorizontal: 18, borderWidth: 2, borderColor: colors.brightBlue, borderRadius: 999, backgroundColor: colors.brightBlue },
  continueText: { minWidth: 0, flexShrink: 1, color: colors.paper, fontFamily: typography.bodySemiBold, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  continueHovered: { borderColor: colors.blue, backgroundColor: colors.blue },
  continueFocused: { borderColor: colors.focus },
  resetButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 18, borderWidth: 1, borderColor: colors.line, borderRadius: 999, backgroundColor: colors.paper },
  resetText: { color: colors.blue, fontFamily: typography.bodySemiBold, fontSize: 14, lineHeight: 20 },
  resetDisabled: { opacity: 0.45 },
  resetHovered: { borderColor: colors.paleBlue, backgroundColor: colors.ice },
  resetFocused: { borderWidth: 3, borderColor: colors.focus },
  stateControlHovered: { borderColor: colors.paleBlue },
  stateControlFocused: { borderWidth: 3, borderColor: colors.focus },
  controlHovered: { backgroundColor: colors.ice },
  controlFocused: { borderWidth: 3, borderColor: colors.focus },
  inlineControlHovered: { backgroundColor: 'rgba(0,92,168,.08)' },
  inlineControlFocused: { borderWidth: 2, borderColor: colors.focus },
  pressed: { opacity: 0.72 },
});

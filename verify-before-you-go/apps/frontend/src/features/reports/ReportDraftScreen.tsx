import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState, type ComponentProps } from 'react';
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
  localPrivateReportAttachmentPicker,
} from './report-attachment-picker';
import {
  releaseResolvedReportEvidenceUri,
  resolveLocalReportEvidenceUri,
} from './local-report-evidence-storage';
import { useReportDraft } from './ReportDraftContext';
import {
  hasReportDraftErrors,
  MAX_REPORT_DESCRIPTION_LENGTH,
  prepareReportDraft,
  reportBehaviourOptions,
  reportIdentifierOptions,
  reportSubjectOptions,
  toggleReportBehaviour,
  updateReportDraft,
  validateReportDraftForPrivacy,
  type ReportBehaviourId,
  type ReportDraft,
  type ReportDraftErrors,
  type ReportEvidenceDraft,
  type ReportIdentifierType,
  type ReportSubjectType,
} from './report-model';

const reportMascot = require('../../../assets/mascots/report-phone-screen09.png');
type IconName = ComponentProps<typeof Ionicons>['name'];

const webGradient = Platform.select({
  web: { backgroundImage: 'linear-gradient(135deg,#0077D4 0%,#7B3FE4 100%)' },
  default: {},
}) as ViewStyle;

export function ReportDraftScreen() {
  const report = useReportDraft();
  const [errors, setErrors] = useState<ReportDraftErrors>({});
  const [evidencePending, setEvidencePending] = useState(false);
  const [evidenceError, setEvidenceError] = useState<string>();

  const update = (updater: (current: ReportDraft) => ReportDraft) => {
    report.updateDraft(updater);
    setErrors({});
  };

  const addEvidence = async () => {
    setEvidencePending(true);
    setEvidenceError(undefined);
    const result = await localPrivateReportAttachmentPicker.pick(report.draft.evidence.length);
    if (result.status === 'selected') {
      try {
        await report.addEvidence(result.evidence);
      } catch {
        setEvidenceError('The image could not be safely added to this private local draft. Nothing was attached.');
      }
    } else if (result.status === 'error') {
      setEvidenceError(result.message);
    }
    setEvidencePending(false);
  };

  const removeEvidence = async (id: string) => {
    if (!report.draft.evidence.some((item) => item.id === id)) return;
    setEvidencePending(true);
    setEvidenceError(undefined);
    try {
      await report.removeEvidence(id);
    } catch {
      setEvidenceError('This image could not be removed from private local storage. Try again.');
    } finally {
      setEvidencePending(false);
    }
  };

  const reviewPrivacy = () => {
    const prepared = prepareReportDraft(report.draft);
    const nextErrors = validateReportDraftForPrivacy(prepared);
    setErrors(nextErrors);
    if (hasReportDraftErrors(nextErrors)) return;
    report.updateDraft(() => prepared);
    router.push('/reports/privacy');
  };

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  return (
    <ReportDraftExperience
      draft={report.draft}
      errors={errors}
      evidenceError={evidenceError}
      evidencePending={evidencePending}
      loading={report.loading}
      onAddEvidence={() => void addEvidence()}
      onBack={goBack}
      onBehaviourToggle={(id) => update((current) => toggleReportBehaviour(current, id))}
      onDescriptionChange={(description) => update((current) => updateReportDraft(current, { description }))}
      onIdentifierChange={(identifier) => update((current) => updateReportDraft(current, { identifier, redactedPreview: undefined }))}
      onIdentifierTypeChange={(identifierType) => update((current) => updateReportDraft(current, { identifierType, redactedPreview: undefined }))}
      onRemoveEvidence={(id) => void removeEvidence(id)}
      onRetryStorage={() => void report.retryStorage()}
      onReviewPrivacy={reviewPrivacy}
      onSubjectTypeChange={(subjectType) => update((current) => updateReportDraft(current, { subjectType }))}
      recoveryNotice={report.recoveryNotice}
      retryPending={report.retryPending}
      storageIssue={report.storageIssue?.message}
    />
  );
}

export function ReportDraftExperience({
  draft,
  errors,
  evidenceError,
  evidencePending,
  loading,
  onAddEvidence,
  onBack,
  onBehaviourToggle,
  onDescriptionChange,
  onIdentifierChange,
  onIdentifierTypeChange,
  onRemoveEvidence,
  onRetryStorage,
  onReviewPrivacy,
  onSubjectTypeChange,
  recoveryNotice,
  retryPending,
  storageIssue,
}: {
  draft: ReportDraft;
  errors: ReportDraftErrors;
  evidenceError?: string;
  evidencePending: boolean;
  loading: boolean;
  onAddEvidence: () => void;
  onBack: () => void;
  onBehaviourToggle: (id: ReportBehaviourId) => void;
  onDescriptionChange: (value: string) => void;
  onIdentifierChange: (value: string) => void;
  onIdentifierTypeChange: (value: ReportIdentifierType) => void;
  onRemoveEvidence: (id: string) => void;
  onRetryStorage: () => void;
  onReviewPrivacy: () => void;
  onSubjectTypeChange: (value: ReportSubjectType) => void;
  recoveryNotice?: string;
  retryPending: boolean;
  storageIssue?: string;
}) {
  const disabled = loading || Boolean(storageIssue?.includes('could not be read'));
  const identifierOption = reportIdentifierOptions.find((option) => option.id === draft.identifierType) ?? reportIdentifierOptions[0];

  return (
    <PrototypeTabScreen contentStyle={styles.screenContent} testID="report-draft-screen">
      <StatusBar style="dark" />
      <View style={styles.backRow}>
        <TextButton icon="chevron-back" label="Back" onPress={onBack} testID="report-draft-back" />
        <View style={styles.privateBadge}>
          <Ionicons color={colors.blue} name="lock-closed-outline" size={14} />
          <Text style={styles.privateBadgeText}>Private draft</Text>
        </View>
      </View>

      <View style={styles.headingBlock}>
        <Text style={styles.kicker}>Community report · Local draft</Text>
        <Text accessibilityRole="header" style={styles.title}>Report what you observed.</Text>
      </View>

      <View style={styles.introPanel}>
        <Image accessible={false} resizeMode="contain" source={reportMascot} style={styles.reportMascot} />
        <Text style={styles.introText}>A report starts a private review. It is not a public accusation.</Text>
      </View>

      <StorageState
        loading={loading}
        onRetry={onRetryStorage}
        recoveryNotice={recoveryNotice}
        retryPending={retryPending}
        storageIssue={storageIssue}
      />

      <FieldSection label="Report subject">
        <ChoiceRadioGroup
          accessibilityLabel="Report subject"
          onChange={onSubjectTypeChange}
          options={reportSubjectOptions}
          testPrefix="report-subject"
          value={draft.subjectType}
        />
      </FieldSection>

      <FieldSection label="Searchable identifier or source">
        <Text style={styles.helperText}>Add one detail reviewers could use for private matching.</Text>
        <ChoiceRadioGroup
          accessibilityLabel="Identifier type"
          onChange={onIdentifierTypeChange}
          options={reportIdentifierOptions}
          testPrefix="report-identifier-type"
          value={draft.identifierType}
        />
        <TextInput
          accessibilityLabel={`${identifierOption.label} for private report matching`}
          autoCapitalize={draft.identifierType === 'url' || draft.identifierType === 'handle' ? 'none' : 'sentences'}
          autoCorrect={false}
          editable={!disabled}
          onChangeText={onIdentifierChange}
          placeholder={identifierOption.placeholder}
          placeholderTextColor={colors.quiet}
          style={[styles.textInput, errors.identifier && styles.fieldError]}
          testID="report-identifier-input"
          value={draft.identifier}
        />
        <FieldError message={errors.identifier} />
      </FieldSection>

      <FieldSection label="What happened?">
        <Text style={styles.helperText}>Select every behaviour you personally observed.</Text>
        <View style={styles.behaviourList}>
          {reportBehaviourOptions.map((option, index) => {
            const selected = draft.behaviourIds.includes(option.id);
            const webKeyboardProps = Platform.OS === 'web'
              ? ({
                  onKeyDown: (event: { key: string; preventDefault: () => void }) => {
                    if (event.key !== ' ') return;
                    event.preventDefault();
                    onBehaviourToggle(option.id);
                  },
                } as unknown as Partial<ComponentProps<typeof InteractiveSurface>>)
              : {};
            return (
              <View key={option.id}>
                {index ? <View style={styles.rule} /> : null}
                <InteractiveSurface
                  {...webKeyboardProps}
                  aria-checked={selected}
                  accessibilityLabel={`${option.title}. ${selected ? 'Selected' : 'Not selected'}`}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected, disabled }}
                  disabled={disabled}
                  focusStyle={styles.controlFocused}
                  hoverStyle={styles.rowHovered}
                  onPress={() => onBehaviourToggle(option.id)}
                  pressedStyle={styles.pressed}
                  style={styles.behaviourRow}
                  testID={`report-behaviour-${option.id}`}
                >
                  <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                    {selected ? <Ionicons color={colors.paper} name="checkmark" size={15} /> : null}
                  </View>
                  <Text style={styles.behaviourText}>{option.title}</Text>
                </InteractiveSurface>
              </View>
            );
          })}
        </View>
        <FieldError message={errors.behaviours} />
      </FieldSection>

      <FieldSection label="Factual description · optional">
        <Text style={styles.helperText}>Describe what was said or requested. Avoid conclusions about intent.</Text>
        <TextInput
          accessibilityLabel="Factual description of what happened"
          editable={!disabled}
          maxLength={MAX_REPORT_DESCRIPTION_LENGTH}
          multiline
          onChangeText={onDescriptionChange}
          placeholder="For example: The recruiter asked for a passport image before sending a written contract."
          placeholderTextColor={colors.quiet}
          style={[styles.descriptionInput, errors.description && styles.fieldError]}
          textAlignVertical="top"
          testID="report-description-input"
          value={draft.description}
        />
        <Text style={styles.characterCount}>{draft.description.length} / {MAX_REPORT_DESCRIPTION_LENGTH}</Text>
        <FieldError message={errors.description} />
      </FieldSection>

      <View style={styles.warningPanel}>
        <Ionicons color="#7A5200" name="shield-checkmark-outline" size={20} />
        <View style={styles.warningCopy}>
          <Text style={styles.warningTitle}>Evidence is optional—not proof by itself.</Text>
          <Text style={styles.warningText}>Do not attach passports, identity documents, home addresses or unrelated conversations.</Text>
        </View>
      </View>

      <FieldSection label="Relevant evidence">
        <Text style={styles.helperText}>Images stay in this local private draft. Nothing is submitted in this step.</Text>
        {draft.evidence.map((item) => (
          <View key={item.id} style={styles.evidenceRow} testID={`report-evidence-${item.id}`}>
            <PrivateEvidenceThumbnail evidence={item} />
            <View style={styles.evidenceCopy}>
              <Text style={styles.evidenceName}>{item.fileName}</Text>
              <Text style={styles.evidenceMeta}>{formatEvidenceMetadata(item.fileSize, item.mimeType)}</Text>
            </View>
            <InteractiveSurface
              accessibilityLabel={`Remove evidence ${item.fileName}`}
              accessibilityRole="button"
              accessibilityState={{ disabled: evidencePending }}
              disabled={evidencePending}
              disabledStyle={styles.disabled}
              focusStyle={styles.controlFocused}
              hoverStyle={styles.iconHovered}
              onPress={() => onRemoveEvidence(item.id)}
              pressedStyle={styles.pressed}
              style={styles.removeEvidence}
              testID={`report-remove-evidence-${item.id}`}
            >
              <Ionicons color={colors.blue} name="trash-outline" size={20} />
            </InteractiveSurface>
          </View>
        ))}
        <InteractiveSurface
          accessibilityLabel={evidencePending ? 'Choosing evidence image' : 'Add relevant evidence image'}
          accessibilityRole="button"
          accessibilityState={{ busy: evidencePending, disabled: disabled || evidencePending }}
          disabled={disabled || evidencePending}
          disabledStyle={styles.disabled}
          focusStyle={styles.controlFocused}
          hoverStyle={styles.secondaryHovered}
          onPress={onAddEvidence}
          pressedStyle={styles.pressed}
          style={styles.addEvidenceButton}
          testID="report-add-evidence"
        >
          {evidencePending ? <ActivityIndicator color={colors.blue} size="small" /> : <Ionicons color={colors.blue} name="image-outline" size={20} />}
          <Text style={styles.addEvidenceText}>{evidencePending ? 'Choosing image…' : 'Add an image'}</Text>
        </InteractiveSurface>
        <FieldError message={evidenceError || errors.evidence} />
      </FieldSection>

      <View style={styles.actionPanel}>
        <InteractiveSurface
          accessibilityLabel="Review report privacy"
          accessibilityRole="button"
          accessibilityState={{ disabled }}
          disabled={disabled}
          disabledStyle={styles.disabled}
          focusStyle={styles.primaryFocused}
          hoverStyle={styles.primaryHovered}
          onPress={onReviewPrivacy}
          pressedStyle={styles.pressed}
          style={[styles.primaryButton, webGradient]}
          testID="report-review-privacy"
        >
          <Text style={styles.primaryButtonText}>Review privacy</Text>
          <Ionicons color={colors.paper} name="arrow-forward" size={20} />
        </InteractiveSurface>
        <Text style={styles.anonymousNote}>Anonymous by default · No name or account required</Text>
      </View>
    </PrototypeTabScreen>
  );
}

function FieldSection({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <View style={styles.fieldSection}>
      <Text style={styles.sectionLabel}>{label}</Text>
      {children}
    </View>
  );
}

function ChoiceRadioGroup<T extends string>({ accessibilityLabel, onChange, options, testPrefix, value }: {
  accessibilityLabel: string;
  onChange: (value: T) => void;
  options: readonly { id: T; label: string }[];
  testPrefix: string;
  value: T;
}) {
  const selectedIndex = Math.max(0, options.findIndex((option) => option.id === value));
  const selectAndFocus = (index: number) => {
    const option = options[index];
    if (!option) return;
    onChange(option.id);
    if (Platform.OS === 'web') {
      requestAnimationFrame(() => document.getElementById(`${testPrefix}-${option.id}`)?.focus());
    }
  };

  return (
    <View accessibilityLabel={accessibilityLabel} accessibilityRole="radiogroup" style={styles.chipWrap}>
      {options.map((option, index) => (
        <ChoiceChip
          key={option.id}
          label={option.label}
          nativeID={`${testPrefix}-${option.id}`}
          onKeyDown={(key) => {
            if (key === ' ') {
              selectAndFocus(index);
              return true;
            }
            if (key === 'Home') {
              selectAndFocus(0);
              return true;
            }
            if (key === 'End') {
              selectAndFocus(options.length - 1);
              return true;
            }
            if (key === 'ArrowLeft' || key === 'ArrowUp') {
              selectAndFocus((index - 1 + options.length) % options.length);
              return true;
            }
            if (key === 'ArrowRight' || key === 'ArrowDown') {
              selectAndFocus((index + 1) % options.length);
              return true;
            }
            return false;
          }}
          onPress={() => onChange(option.id)}
          selected={value === option.id}
          tabbable={index === selectedIndex}
          testID={`${testPrefix}-${option.id}`}
        />
      ))}
    </View>
  );
}

function ChoiceChip({ label, nativeID, onKeyDown, onPress, selected, tabbable, testID }: {
  label: string;
  nativeID: string;
  onKeyDown: (key: string) => boolean;
  onPress: () => void;
  selected: boolean;
  tabbable: boolean;
  testID: string;
}) {
  const webKeyboardProps = Platform.OS === 'web'
    ? ({
        onKeyDown: (event: { key: string; preventDefault: () => void }) => {
          if (!onKeyDown(event.key)) return;
          event.preventDefault();
        },
      } as unknown as Partial<ComponentProps<typeof InteractiveSurface>>)
    : {};
  return (
    <InteractiveSurface
      {...webKeyboardProps}
      aria-checked={selected}
      accessibilityLabel={`${label}. ${selected ? 'Selected' : 'Not selected'}`}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      focusStyle={styles.controlFocused}
      hoverStyle={styles.chipHovered}
      nativeID={nativeID}
      onPress={onPress}
      pressedStyle={styles.pressed}
      style={[styles.choiceChip, selected && styles.choiceChipSelected]}
      tabIndex={tabbable ? 0 : -1}
      testID={testID}
    >
      <Text style={[styles.choiceChipText, selected && styles.choiceChipTextSelected]}>{label}</Text>
    </InteractiveSurface>
  );
}

function TextButton({ icon, label, onPress, testID }: { icon: IconName; label: string; onPress: () => void; testID: string }) {
  return (
    <InteractiveSurface
      accessibilityLabel={label}
      accessibilityRole="link"
      focusStyle={styles.controlFocused}
      hoverStyle={styles.textButtonHovered}
      onPress={onPress}
      pressedStyle={styles.pressed}
      style={styles.textButton}
      testID={testID}
    >
      <Ionicons color={colors.blue} name={icon} size={20} />
      <Text style={styles.textButtonLabel}>{label}</Text>
    </InteractiveSurface>
  );
}

function FieldError({ message }: { message?: string }) {
  return message ? <Text accessibilityLiveRegion="assertive" style={styles.errorText}>{message}</Text> : null;
}

function StorageState({ loading, onRetry, recoveryNotice, retryPending, storageIssue }: {
  loading: boolean;
  onRetry: () => void;
  recoveryNotice?: string;
  retryPending: boolean;
  storageIssue?: string;
}) {
  if (loading) {
    return (
      <View accessibilityLiveRegion="polite" style={styles.storagePanel} testID="report-storage-loading">
        <ActivityIndicator color={colors.blue} size="small" />
        <Text style={styles.storageText}>Loading private draft…</Text>
      </View>
    );
  }
  if (storageIssue) {
    return (
      <View accessibilityLiveRegion="assertive" style={styles.storageErrorPanel} testID="report-storage-error">
        <Text style={styles.storageErrorText}>{storageIssue}</Text>
        <InteractiveSurface
          accessibilityLabel={retryPending ? 'Retrying private draft storage' : 'Retry private draft storage'}
          accessibilityRole="button"
          accessibilityState={{ busy: retryPending, disabled: retryPending }}
          disabled={retryPending}
          focusStyle={styles.controlFocused}
          onPress={onRetry}
          pressedStyle={styles.pressed}
          style={styles.retryButton}
          testID="report-storage-retry"
        >
          {retryPending ? <ActivityIndicator color="#7A5200" size="small" /> : null}
          <Text style={styles.retryText}>{retryPending ? 'Retrying…' : 'Retry storage'}</Text>
        </InteractiveSurface>
      </View>
    );
  }
  return recoveryNotice ? (
    <View accessibilityLiveRegion="polite" style={styles.recoveryPanel}>
      <Text style={styles.recoveryText}>{recoveryNotice}</Text>
    </View>
  ) : null;
}

function formatEvidenceMetadata(fileSize: number | undefined, mimeType: string): string {
  const type = mimeType.replace('image/', '').toUpperCase();
  if (!fileSize) return `${type} · Local only`;
  const size = fileSize >= 1024 * 1024
    ? `${(fileSize / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(fileSize / 1024))} KB`;
  return `${type} · ${size} · Local only`;
}

function PrivateEvidenceThumbnail({ evidence }: { evidence: ReportEvidenceDraft }) {
  const [displayUri, setDisplayUri] = useState<string>();
  useEffect(() => {
    let active = true;
    let resolvedUri: string | undefined;
    void resolveLocalReportEvidenceUri(evidence)
      .then((uri) => {
        resolvedUri = uri;
        if (active) setDisplayUri(uri);
      })
      .catch(() => {
        if (active) setDisplayUri(undefined);
      });
    return () => {
      active = false;
      if (resolvedUri) releaseResolvedReportEvidenceUri(resolvedUri);
    };
  }, [evidence]);

  return displayUri ? (
    <Image accessible={false} resizeMode="cover" source={{ uri: displayUri }} style={styles.evidenceThumbnail} />
  ) : (
    <View accessibilityElementsHidden style={[styles.evidenceThumbnail, styles.evidenceThumbnailFallback]}>
      <Ionicons color={colors.blue} name="image-outline" size={20} />
    </View>
  );
}

const styles = StyleSheet.create({
  screenContent: { gap: 12, paddingTop: 12, paddingBottom: 116 },
  backRow: { minWidth: 0, width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  textButton: { minWidth: 48, minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: -8, paddingHorizontal: 8, borderRadius: 10 },
  textButtonLabel: { color: colors.blue, fontFamily: typography.bodySemiBold, fontSize: 13, lineHeight: 20 },
  textButtonHovered: { backgroundColor: colors.ice },
  privateBadge: { minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, borderWidth: 1, borderColor: colors.paleBlue, borderRadius: 6, backgroundColor: colors.ice },
  privateBadgeText: { color: colors.blue, fontFamily: typography.monoMedium, fontSize: 11, lineHeight: 16, letterSpacing: 0.5, textTransform: 'uppercase' },
  headingBlock: { gap: 5 },
  kicker: { color: colors.blue, fontFamily: typography.mono, fontSize: 11, lineHeight: 16, letterSpacing: 1.2, textTransform: 'uppercase' },
  title: { color: colors.navy, fontFamily: typography.heading, fontSize: 29, lineHeight: 34, letterSpacing: -0.45 },
  introPanel: { minWidth: 0, width: '100%', minHeight: 86, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, paddingLeft: 8, paddingRight: 14, borderWidth: 1, borderColor: '#D6E9FA', borderRadius: 12, backgroundColor: colors.ice },
  reportMascot: { width: 54, height: 70, flexShrink: 0, alignSelf: 'flex-end' },
  introText: { minWidth: 0, flex: 1, color: colors.body, fontFamily: typography.body, fontSize: 15, lineHeight: 23 },
  fieldSection: { minWidth: 0, width: '100%', gap: 8, padding: 13, borderWidth: 1, borderColor: colors.line, borderRadius: 12, backgroundColor: colors.paper },
  sectionLabel: { color: colors.navy, fontFamily: typography.bodySemiBold, fontSize: 15, lineHeight: 21 },
  helperText: { color: colors.muted, fontFamily: typography.body, fontSize: 13, lineHeight: 19 },
  chipWrap: { minWidth: 0, width: '100%', flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  choiceChip: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 12, borderWidth: 1, borderColor: colors.line, borderRadius: 999, backgroundColor: colors.paper },
  choiceChipSelected: { borderColor: colors.blue, backgroundColor: colors.ice },
  choiceChipText: { color: colors.body, fontFamily: typography.bodyMedium, fontSize: 13, lineHeight: 19 },
  choiceChipTextSelected: { color: colors.blue, fontFamily: typography.bodySemiBold },
  chipHovered: { borderColor: colors.paleBlue, backgroundColor: '#F8FBFE' },
  textInput: { minWidth: 0, width: '100%', minHeight: 48, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: colors.line, borderRadius: 9, backgroundColor: colors.canvas, color: colors.ink, fontFamily: typography.body, fontSize: 14, lineHeight: 21 },
  descriptionInput: { minWidth: 0, width: '100%', minHeight: 112, padding: 12, borderWidth: 1, borderColor: colors.line, borderRadius: 9, backgroundColor: colors.canvas, color: colors.ink, fontFamily: typography.body, fontSize: 14, lineHeight: 21 },
  fieldError: { borderColor: '#B83939' },
  errorText: { color: '#9F2525', fontFamily: typography.bodyMedium, fontSize: 12, lineHeight: 18 },
  characterCount: { alignSelf: 'flex-end', color: colors.quiet, fontFamily: typography.mono, fontSize: 11, lineHeight: 16 },
  behaviourList: { overflow: 'hidden', borderWidth: 1, borderColor: '#E9EDF1', borderRadius: 10 },
  behaviourRow: { minWidth: 0, width: '100%', minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: colors.paper },
  behaviourText: { minWidth: 0, flex: 1, color: colors.body, fontFamily: typography.body, fontSize: 13, lineHeight: 19 },
  checkbox: { width: 22, height: 22, flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line, borderRadius: 5, backgroundColor: colors.paper },
  checkboxSelected: { borderColor: colors.blue, backgroundColor: colors.blue },
  rule: { height: 1, marginHorizontal: 10, backgroundColor: '#E9EDF1' },
  rowHovered: { backgroundColor: '#F8FBFE' },
  warningPanel: { minWidth: 0, width: '100%', flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12, borderWidth: 1, borderColor: '#F2D28D', borderRadius: 12, backgroundColor: colors.amberSoft },
  warningCopy: { minWidth: 0, flex: 1, gap: 2 },
  warningTitle: { color: '#6F4B00', fontFamily: typography.bodySemiBold, fontSize: 13, lineHeight: 19 },
  warningText: { color: '#6F4B00', fontFamily: typography.body, fontSize: 13, lineHeight: 19 },
  evidenceRow: { minWidth: 0, width: '100%', minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 7, borderWidth: 1, borderColor: '#E9EDF1', borderRadius: 9, backgroundColor: colors.canvas },
  evidenceThumbnail: { width: 48, height: 48, flexShrink: 0, borderRadius: 7, backgroundColor: colors.ice },
  evidenceThumbnailFallback: { alignItems: 'center', justifyContent: 'center' },
  evidenceCopy: { minWidth: 0, flex: 1, gap: 2 },
  evidenceName: { color: colors.navy, fontFamily: typography.bodySemiBold, fontSize: 13, lineHeight: 19 },
  evidenceMeta: { color: colors.quiet, fontFamily: typography.mono, fontSize: 11, lineHeight: 16, letterSpacing: 0.3 },
  removeEvidence: { width: 48, height: 48, flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderRadius: 9 },
  iconHovered: { backgroundColor: colors.ice },
  addEvidenceButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.paleBlue, borderRadius: 999, backgroundColor: colors.paper },
  addEvidenceText: { color: colors.blue, fontFamily: typography.bodySemiBold, fontSize: 13, lineHeight: 19 },
  secondaryHovered: { backgroundColor: colors.ice },
  actionPanel: { gap: 7, paddingTop: 2 },
  primaryButton: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, paddingHorizontal: 18, borderRadius: 999, backgroundColor: colors.brightBlue },
  primaryButtonText: { color: colors.paper, fontFamily: typography.bodySemiBold, fontSize: 15, lineHeight: 21 },
  primaryHovered: { opacity: 0.94 },
  primaryFocused: { borderWidth: 3, borderColor: colors.navy },
  anonymousNote: { color: colors.quiet, fontFamily: typography.mono, fontSize: 11, lineHeight: 17, textAlign: 'center' },
  controlFocused: { borderWidth: 3, borderColor: colors.focus },
  pressed: { opacity: 0.72 },
  disabled: { opacity: 0.55 },
  storagePanel: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 12, borderWidth: 1, borderColor: '#D6E9FA', borderRadius: 10, backgroundColor: colors.ice },
  storageText: { color: colors.body, fontFamily: typography.body, fontSize: 13, lineHeight: 19 },
  storageErrorPanel: { gap: 9, padding: 12, borderWidth: 1, borderColor: '#F2D28D', borderRadius: 10, backgroundColor: colors.amberSoft },
  storageErrorText: { color: '#6F4B00', fontFamily: typography.body, fontSize: 13, lineHeight: 19 },
  retryButton: { minHeight: 48, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 14, borderWidth: 1, borderColor: '#B67C00', borderRadius: 999, backgroundColor: colors.paper },
  retryText: { color: '#6F4B00', fontFamily: typography.bodySemiBold, fontSize: 13, lineHeight: 19 },
  recoveryPanel: { padding: 11, borderWidth: 1, borderColor: '#B8DDB0', borderRadius: 10, backgroundColor: '#EEF9EB' },
  recoveryText: { color: '#1E632B', fontFamily: typography.body, fontSize: 13, lineHeight: 19 },
});

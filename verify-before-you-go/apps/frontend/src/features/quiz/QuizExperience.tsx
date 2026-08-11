import { type ComponentProps } from 'react';
import {
  Image,
  Platform,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
  type ViewStyle,
} from 'react-native';

import { InteractiveSurface } from '@/components/InteractiveSurface';
import { colors, typography } from '@/theme';

import { MIL_QUIZ_QUESTIONS, type QuizOption } from './quiz-content';
import {
  getAdjacentQuizOptionId,
  getCurrentQuizAnswer,
  getQuizScore,
  isQuizComplete,
  type QuizProgress,
} from './quiz-model';

type QuizExperienceProps = {
  disabled?: boolean;
  mascotSource: ImageSourcePropType;
  onAdvance: () => void;
  onAnswer: (optionId: string) => void;
  onOpenChecker: () => void;
  onRetry: () => void;
  progress: QuizProgress;
  focusOption?: (optionId: string) => void;
  webKeyboardEnabled?: boolean;
};

export function QuizExperience({
  disabled = false,
  focusOption,
  mascotSource,
  onAdvance,
  onAnswer,
  onOpenChecker,
  onRetry,
  progress,
  webKeyboardEnabled = Platform.OS === 'web',
}: QuizExperienceProps) {
  const complete = isQuizComplete(progress);
  const score = getQuizScore(progress);

  if (complete) {
    return (
      <View style={styles.experience} testID="quiz-completion">
        <Text style={styles.kicker} testID="quiz-kicker">Practice complete · 5 of 5</Text>
        <Text accessibilityRole="header" style={styles.title} testID="quiz-heading">Keep checking the evidence.</Text>
        <MascotProgress
          mascotSource={mascotSource}
          progress={5}
          progressLabel="Quiz complete: 5 of 5 questions reviewed"
        />
        <View accessibilityLiveRegion="polite" style={[styles.scoreCard, webScoreGradient]}>
          <Text style={styles.scoreMeta}>Your local score</Text>
          <Text style={styles.scoreValue}>{score} / 5</Text>
          <Text style={styles.scoreCopy}>This score reflects five practice answers. It is not a score for any job offer.</Text>
        </View>
        <View style={styles.transferPanel}>
          <View style={styles.skillChip}><RainbowMark /><Text style={styles.skillChipText}>Skill · Reflect</Text></View>
          <Text style={styles.transferTitle}>Take the habit with you</Text>
          <Text style={styles.transferCopy}>Pause, identify the claim, and check it through a source you found independently.</Text>
        </View>
        <PrimaryButton disabled={disabled} label="Try all five again" onPress={onRetry} testID="quiz-retry" />
        <LinkButton disabled={disabled} label="Open the Offer Checker" onPress={onOpenChecker} testID="quiz-open-checker" />
      </View>
    );
  }

  const question = MIL_QUIZ_QUESTIONS[progress.currentQuestionIndex] ?? MIL_QUIZ_QUESTIONS[0];
  const answer = getCurrentQuizAnswer(progress);
  const answered = Boolean(answer);
  const correct = answer?.optionId === question.correctOptionId;
  const optionIds = question.options.map((option) => option.id);

  const focus = (optionId: string) => {
    if (focusOption) {
      focusOption(optionId);
      return;
    }
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    requestAnimationFrame(() => document.getElementById(`quiz-option-${optionId}`)?.focus());
  };

  const select = (optionId: string, shouldMoveFocus = false) => {
    if (disabled || answered) return;
    onAnswer(optionId);
    if (shouldMoveFocus) focus(optionId);
  };

  return (
    <View style={styles.experience} testID="quiz-question">
      <Text style={styles.kicker} testID="quiz-kicker">Practise · Question {progress.currentQuestionIndex + 1} of 5 · Score {score}</Text>
      <Text accessibilityRole="header" style={styles.title} testID="quiz-heading">What would you verify first?</Text>
      <MascotProgress
        mascotSource={mascotSource}
        progress={progress.currentQuestionIndex + 1}
        progressLabel={`Quiz progress: question ${progress.currentQuestionIndex + 1} of 5`}
      />
      <Text style={styles.lede}>{question.supportingText}</Text>

      <View style={[styles.questionCard, cardShadow]}>
        <Text style={styles.topic}>{question.topic}</Text>
        <Text style={styles.question}>{question.prompt}</Text>
        <View
          accessibilityLabel={`Question ${progress.currentQuestionIndex + 1}. Choose one answer`}
          accessibilityRole="radiogroup"
          style={styles.options}
          testID="quiz-radio-group"
        >
          {question.options.map((option, optionIndex) => (
            <QuizAnswerOption
              answered={answered}
              disabled={disabled}
              key={option.id}
              onSelect={(shouldMoveFocus) => select(option.id, shouldMoveFocus)}
              option={option}
              optionIds={optionIds}
              optionIndex={optionIndex}
              selected={answer?.optionId === option.id}
              webKeyboardEnabled={webKeyboardEnabled}
            />
          ))}
        </View>

        {answer ? (
          <View
            accessibilityLiveRegion="polite"
            style={[styles.feedback, correct ? styles.feedbackCorrect : styles.feedbackTry]}
            testID="quiz-feedback"
          >
            <Text style={[styles.feedbackTitle, correct ? styles.feedbackCorrectText : styles.feedbackTryText]}>
              {correct ? question.correctTitle : question.tryTitle}
            </Text>
            <Text style={[styles.feedbackCopy, correct ? styles.feedbackCorrectText : styles.feedbackTryText]}>
              {correct ? question.correctFeedback : question.tryFeedback}
            </Text>
          </View>
        ) : null}
      </View>

      {answer ? (
        <View style={styles.transferPanel} testID="quiz-transfer">
          <View style={styles.skillChip}><RainbowMark /><Text style={styles.skillChipText}>Skill · {question.skill}</Text></View>
          <Text style={styles.transferTitle}>Transfer this habit</Text>
          <Text style={styles.transferCopy}>{question.transferPrompt}</Text>
        </View>
      ) : null}

      {answer ? (
        <PrimaryButton
          disabled={disabled}
          label={progress.currentQuestionIndex === 4 ? 'See your result' : 'Next question'}
          onPress={onAdvance}
          testID="quiz-next"
        />
      ) : null}
      <LinkButton disabled={disabled} label="Open the Offer Checker" onPress={onOpenChecker} testID="quiz-open-checker" />
    </View>
  );
}

function MascotProgress({
  mascotSource,
  progress,
  progressLabel,
}: {
  mascotSource: ImageSourcePropType;
  progress: number;
  progressLabel: string;
}) {
  return (
    <View style={styles.progressStage}>
      <Image
        accessibilityIgnoresInvertColors
        accessible={false}
        resizeMode="contain"
        source={mascotSource}
        style={styles.mascot}
      />
      <View
        aria-valuemax={5}
        aria-valuemin={0}
        aria-valuenow={progress}
        aria-valuetext={progressLabel}
        accessibilityLabel={progressLabel}
        accessibilityRole="progressbar"
        style={styles.progressTrack}
        testID="quiz-progress"
      >
        <View style={[styles.progressFill, { width: `${progress * 20}%` }]} />
      </View>
    </View>
  );
}

function QuizAnswerOption({
  answered,
  disabled,
  onSelect,
  option,
  optionIds,
  optionIndex,
  selected,
  webKeyboardEnabled,
}: {
  answered: boolean;
  disabled: boolean;
  onSelect: (moveFocus?: boolean) => void;
  option: QuizOption;
  optionIds: readonly string[];
  optionIndex: number;
  selected: boolean;
  webKeyboardEnabled: boolean;
}) {
  const blocked = disabled || answered;
  const tabbable = answered ? selected : optionIndex === 0;
  const webKeyboardProps = webKeyboardEnabled && !blocked
    ? ({
        onKeyDown: (event: { key: string; preventDefault: () => void }) => {
          const nextId = getAdjacentQuizOptionId(optionIds, option.id, event.key);
          if (!nextId) return;
          event.preventDefault();
          if (nextId === option.id) return;
          const next = document.getElementById(`quiz-option-${nextId}`);
          next?.click();
          requestAnimationFrame(() => next?.focus());
        },
      } as unknown as Partial<ComponentProps<typeof InteractiveSurface>>)
    : {};

  return (
    <InteractiveSurface
      {...webKeyboardProps}
      aria-checked={selected}
      accessibilityLabel={`${option.label}. ${selected ? 'Selected' : 'Not selected'}.`}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled: blocked }}
      disabled={blocked}
      disabledStyle={styles.optionAnswered}
      focusStyle={styles.optionFocused}
      hoverStyle={styles.optionHovered}
      nativeID={`quiz-option-${option.id}`}
      onPress={() => onSelect(false)}
      pressedStyle={styles.pressed}
      style={[styles.option, selected && styles.optionSelected]}
      tabIndex={tabbable ? 0 : -1}
      testID={`quiz-option-${option.id}`}
    >
      <View
        aria-hidden
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.optionVisual}
      >
        <View style={[styles.radio, selected && styles.radioSelected]}>{selected ? <View style={styles.radioDot} /> : null}</View>
        <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{option.label}</Text>
      </View>
    </InteractiveSurface>
  );
}

function PrimaryButton({ disabled, label, onPress, testID }: ButtonProps) {
  return (
    <InteractiveSurface
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      disabledStyle={styles.controlDisabled}
      focusStyle={styles.primaryFocused}
      hoverStyle={styles.primaryHovered}
      onPress={onPress}
      pressedStyle={styles.pressed}
      style={[styles.primaryButton, webPrimaryGradient]}
      testID={testID}
    >
      <Text style={styles.primaryButtonText}>{label}</Text>
    </InteractiveSurface>
  );
}

function LinkButton({ disabled, label, onPress, testID }: ButtonProps) {
  return (
    <InteractiveSurface
      accessibilityLabel={label}
      accessibilityRole="link"
      accessibilityState={{ disabled }}
      disabled={disabled}
      disabledStyle={styles.controlDisabled}
      focusStyle={styles.linkFocused}
      hoverStyle={styles.linkHovered}
      onPress={onPress}
      pressedStyle={styles.pressed}
      style={styles.linkButton}
      testID={testID}
    >
      <Text style={styles.linkButtonText}>{label}</Text>
    </InteractiveSurface>
  );
}

function RainbowMark() {
  return (
    <View accessibilityElementsHidden style={styles.rainbowMark}>
      <View style={[styles.rainbowSegment, styles.yellow]} />
      <View style={[styles.rainbowSegment, styles.green]} />
      <View style={[styles.rainbowSegment, styles.sky]} />
      <View style={[styles.rainbowSegment, styles.purple]} />
    </View>
  );
}

type ButtonProps = {
  disabled: boolean;
  label: string;
  onPress: () => void;
  testID: string;
};

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

const webPrimaryGradient = Platform.select({
  web: { backgroundImage: 'linear-gradient(135deg,#0077D4 0%,#7B3FE4 100%)' },
  default: {},
}) as ViewStyle;

const webScoreGradient = Platform.select({
  web: { backgroundImage: 'linear-gradient(125deg,#00224A 0%,#003D73 70%,#005CA8 100%)' },
  default: {},
}) as ViewStyle;

const styles = StyleSheet.create({
  experience: { minWidth: 0, width: '100%', maxWidth: '100%', gap: 12 },
  kicker: { color: colors.blue, fontFamily: typography.mono, fontSize: 11, lineHeight: 16, letterSpacing: 1.05, textTransform: 'uppercase' },
  title: { color: colors.blue, fontFamily: typography.heading, fontSize: 29, fontWeight: '700', lineHeight: 34, letterSpacing: -0.45 },
  progressStage: { position: 'relative', width: '100%', maxWidth: '100%', height: 116, isolation: 'isolate' },
  mascot: { position: 'absolute', zIndex: 2, bottom: 2, left: '26%', width: 158, height: 112 },
  progressTrack: { position: 'absolute', right: 0, bottom: 8, left: 0, height: 7, overflow: 'hidden', borderRadius: 99, backgroundColor: '#D6E9FA' },
  progressFill: { height: '100%', borderRadius: 99, backgroundColor: colors.purple },
  lede: { color: colors.body, fontFamily: typography.body, fontSize: 15, lineHeight: 23 },
  questionCard: { minWidth: 0, width: '100%', maxWidth: '100%', gap: 10, padding: 15, borderWidth: 1, borderColor: colors.line, borderRadius: 12, backgroundColor: colors.paper },
  topic: { color: colors.quiet, fontFamily: typography.mono, fontSize: 11, lineHeight: 16, letterSpacing: 0.9, textTransform: 'uppercase' },
  question: { color: colors.navy, fontFamily: typography.bodySemiBold, fontSize: 15, lineHeight: 22 },
  options: { minWidth: 0, width: '100%', maxWidth: '100%', gap: 8 },
  option: { minWidth: 0, width: '100%', maxWidth: '100%', minHeight: 48, justifyContent: 'center', paddingHorizontal: 11, paddingVertical: 10, borderWidth: 1, borderColor: colors.line, borderRadius: 10, backgroundColor: colors.paper },
  optionSelected: { borderColor: colors.blue, backgroundColor: colors.ice },
  optionAnswered: { opacity: 1 },
  optionHovered: { borderColor: colors.paleBlue, backgroundColor: '#F8FBFE' },
  optionFocused: { borderWidth: 2, borderColor: colors.focus },
  optionVisual: { minWidth: 0, flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  radio: { width: 18, height: 18, flexShrink: 0, marginTop: 1, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#AEB8C2', borderRadius: 9, backgroundColor: colors.paper },
  radioSelected: { borderWidth: 2, borderColor: colors.blue },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.blue },
  optionText: { minWidth: 0, flex: 1, color: colors.body, fontFamily: typography.body, fontSize: 13, lineHeight: 20 },
  optionTextSelected: { color: colors.navy, fontFamily: typography.bodyMedium },
  feedback: { gap: 3, padding: 11, borderWidth: 1, borderRadius: 10 },
  feedbackCorrect: { borderColor: '#B8DDB0', backgroundColor: '#EEF9EB' },
  feedbackTry: { borderColor: '#ECCB80', backgroundColor: colors.amberSoft },
  feedbackTitle: { fontFamily: typography.bodySemiBold, fontSize: 13, lineHeight: 19 },
  feedbackCopy: { fontFamily: typography.body, fontSize: 13, lineHeight: 20 },
  feedbackCorrectText: { color: '#1E632B' },
  feedbackTryText: { color: '#6F4B00' },
  transferPanel: { minWidth: 0, width: '100%', maxWidth: '100%', gap: 6, padding: 13, borderWidth: 1, borderColor: '#D6E9FA', borderRadius: 12, backgroundColor: colors.ice },
  skillChip: { minHeight: 24, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: colors.paleBlue, borderRadius: 5, backgroundColor: colors.paper },
  skillChipText: { color: colors.blue, fontFamily: typography.mono, fontSize: 11, lineHeight: 16, letterSpacing: 0.55, textTransform: 'uppercase' },
  rainbowMark: { width: 14, height: 3, flexDirection: 'row', overflow: 'hidden', borderRadius: 2 },
  rainbowSegment: { flex: 1 },
  yellow: { backgroundColor: colors.amber },
  green: { backgroundColor: '#8ED97F' },
  sky: { backgroundColor: '#3FB6E8' },
  purple: { backgroundColor: '#A855F7' },
  transferTitle: { color: colors.navy, fontFamily: typography.bodySemiBold, fontSize: 14, lineHeight: 20 },
  transferCopy: { color: colors.body, fontFamily: typography.body, fontSize: 13, lineHeight: 20 },
  primaryButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, borderRadius: 999, backgroundColor: colors.brightBlue },
  primaryButtonText: { color: colors.paper, fontFamily: typography.bodySemiBold, fontSize: 14, lineHeight: 20 },
  primaryHovered: { opacity: 0.9 },
  primaryFocused: { borderWidth: 3, borderColor: colors.navy },
  linkButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, borderRadius: 999 },
  linkButtonText: { color: colors.blue, fontFamily: typography.bodySemiBold, fontSize: 14, lineHeight: 20 },
  linkHovered: { backgroundColor: colors.ice },
  linkFocused: { borderWidth: 2, borderColor: colors.focus },
  pressed: { opacity: 0.72 },
  controlDisabled: { opacity: 0.48 },
  scoreCard: { gap: 5, padding: 16, borderWidth: 1, borderColor: '#164A77', borderRadius: 14, backgroundColor: colors.navy },
  scoreMeta: { color: colors.paleBlue, fontFamily: typography.mono, fontSize: 11, lineHeight: 16, letterSpacing: 1, textTransform: 'uppercase' },
  scoreValue: { color: colors.paper, fontFamily: typography.heading, fontSize: 34, fontWeight: '700', lineHeight: 39 },
  scoreCopy: { color: '#D6E9FA', fontFamily: typography.body, fontSize: 13, lineHeight: 20 },
});

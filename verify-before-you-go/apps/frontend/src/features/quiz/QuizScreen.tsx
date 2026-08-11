import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
} from 'react-native';

import { InteractiveSurface } from '@/components/InteractiveSurface';
import { PrototypeTabScreen } from '@/components/prototype/PrototypeShell';
import { colors, typography } from '@/theme';

import { QuizExperience } from './QuizExperience';
import {
  advanceQuiz,
  answerQuizQuestion,
  createEmptyQuizProgress,
  getQuizScrollResetKey,
  restartQuiz,
  type QuizProgress,
} from './quiz-model';
import {
  quizPersistenceCoordinator,
  type QuizPersistenceCoordinatorPort,
} from './quiz-persistence-coordinator';
import { enqueueQuizWriteAfterConfirmedRead } from './quiz-write-queue';

type StorageIssue = {
  kind: 'read' | 'write';
  message: string;
};

export function QuizScreen() {
  return (
    <QuizScreenController
      mascotSource={require('../../../assets/mascots/quiz-insight-v3.png')}
      onOpenChecker={() => router.push('/check')}
      persistence={quizPersistenceCoordinator}
    />
  );
}

export function QuizScreenController({
  mascotSource,
  onOpenChecker,
  persistence,
}: {
  mascotSource: ImageSourcePropType;
  onOpenChecker: () => void;
  persistence: QuizPersistenceCoordinatorPort;
}) {
  const [progress, setProgress] = useState<QuizProgress>(() => createEmptyQuizProgress());
  const [loading, setLoading] = useState(true);
  const [retryPending, setRetryPending] = useState(false);
  const [storageReady, setStorageReady] = useState(false);
  const [storageIssue, setStorageIssue] = useState<StorageIssue | null>(null);
  const [recoveryNotice, setRecoveryNotice] = useState<string | null>(null);
  const storageReadSucceededRef = useRef(false);
  const mountedRef = useRef(false);
  const hydrationAttemptRef = useRef(0);
  const retryInFlightRef = useRef(false);
  const retryAttemptIdRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      retryAttemptIdRef.current += 1;
      retryInFlightRef.current = false;
    };
  }, []);

  useEffect(() => persistence.subscribe((result) => {
    if (!mountedRef.current || retryInFlightRef.current || !result.isLatest) return;
    if (result.status === 'saved') {
      setStorageIssue((current) => current?.kind === 'write' ? null : current);
      return;
    }
    setStorageIssue({
      kind: 'write',
      message: 'Your latest answer remains in this session but could not be saved locally.',
    });
  }), [persistence]);

  useEffect(() => {
    const attemptId = ++hydrationAttemptRef.current;
    const isActive = () => mountedRef.current && hydrationAttemptRef.current === attemptId;

    void persistence.hydrate(isActive)
      .then((loaded) => {
        if (!isActive()) return;
        storageReadSucceededRef.current = true;
        setStorageReady(true);
        setProgress(loaded.progress);
        setRecoveryNotice(loaded.status === 'recovered'
          ? 'Invalid or outdated saved quiz data was replaced with a fresh local practice.'
          : null);
        setStorageIssue((current) => current?.kind === 'read' ? null : current);
      })
      .catch(() => {
        if (!isActive()) return;
        storageReadSucceededRef.current = false;
        setStorageReady(false);
        setStorageIssue({
          kind: 'read',
          message: 'Your saved quiz progress could not be read. Retry before answering so existing progress is not overwritten.',
        });
      })
      .finally(() => {
        if (isActive()) setLoading(false);
      });

    return () => {
      if (hydrationAttemptRef.current === attemptId) hydrationAttemptRef.current += 1;
    };
  }, [persistence]);

  const updateProgress = (next: QuizProgress) => {
    setProgress(next);
    void enqueueQuizWriteAfterConfirmedRead(
      next,
      storageReadSucceededRef.current,
      persistence,
    );
  };

  const retryStorage = async () => {
    if (!mountedRef.current || retryInFlightRef.current) return;
    retryInFlightRef.current = true;
    const attemptId = ++retryAttemptIdRef.current;
    const retryingRead = storageIssue?.kind === 'read' || !storageReadSucceededRef.current;
    const isActive = () => mountedRef.current && retryAttemptIdRef.current === attemptId;

    setRetryPending(true);
    setLoading(true);
    try {
      if (retryingRead) {
        const loaded = await persistence.hydrate(isActive);
        if (!isActive()) return;
        storageReadSucceededRef.current = true;
        setStorageReady(true);
        setProgress(loaded.progress);
        setRecoveryNotice(loaded.status === 'recovered'
          ? 'Invalid or outdated saved quiz data was replaced with a fresh local practice.'
          : null);
        setStorageIssue((current) => current?.kind === 'read' ? null : current);
      } else {
        const result = await persistence.enqueue(progress);
        if (result.status === 'failed') throw result.error;
        if (!isActive()) return;
        setStorageIssue((current) => current?.kind === 'write' ? null : current);
      }
    } catch {
      if (!isActive()) return;
      if (retryingRead) {
        storageReadSucceededRef.current = false;
        setStorageReady(false);
        setStorageIssue({
          kind: 'read',
          message: 'Saved quiz progress is still unavailable. No existing local progress has been overwritten.',
        });
      } else {
        setStorageIssue({
          kind: 'write',
          message: 'Local saving is still unavailable. Your latest answer remains in this session.',
        });
      }
    } finally {
      if (!isActive()) return;
      retryInFlightRef.current = false;
      setRetryPending(false);
      setLoading(false);
    }
  };

  const disabled = loading || !storageReady;
  const scrollResetKey = getQuizScrollResetKey(progress);

  return (
    <PrototypeTabScreen
      contentStyle={styles.screenContent}
      scrollResetKey={scrollResetKey}
      testID="mil-quiz-screen"
    >
      <StatusBar style="dark" />

      {loading ? (
        <View accessibilityLiveRegion="polite" style={styles.statusRow} testID="quiz-loading">
          <ActivityIndicator color={colors.blue} size="small" />
          <Text style={styles.statusText}>{retryPending ? 'Retrying local storage…' : 'Loading local practice…'}</Text>
        </View>
      ) : null}

      {recoveryNotice ? (
        <View accessibilityLiveRegion="polite" style={styles.recoveryNotice}>
          <Text style={styles.recoveryText}>{recoveryNotice}</Text>
        </View>
      ) : null}

      {storageIssue ? (
        <View accessibilityLiveRegion="assertive" style={styles.storageError} testID="quiz-storage-error">
          <Text style={styles.storageErrorText}>{storageIssue.message}</Text>
          <InteractiveSurface
            accessibilityLabel={retryPending ? 'Retrying quiz storage' : 'Retry quiz storage'}
            accessibilityRole="button"
            accessibilityState={{ busy: retryPending, disabled: retryPending }}
            disabled={retryPending}
            disabledStyle={styles.retryDisabled}
            focusStyle={styles.retryFocused}
            hoverStyle={styles.retryHovered}
            onPress={() => void retryStorage()}
            pressedStyle={styles.pressed}
            style={styles.retryStorageButton}
            testID="quiz-storage-retry"
          >
            {retryPending ? (
              <>
                <ActivityIndicator accessible={false} color="#6F4B00" size="small" />
                <Text style={styles.retryStorageText}>Retrying storage…</Text>
              </>
            ) : <Text style={styles.retryStorageText}>Retry storage</Text>}
          </InteractiveSurface>
        </View>
      ) : null}

      <QuizExperience
        disabled={disabled}
        mascotSource={mascotSource}
        onAdvance={() => updateProgress(advanceQuiz(progress))}
        onAnswer={(optionId) => updateProgress(answerQuizQuestion(progress, optionId))}
        onOpenChecker={onOpenChecker}
        onRetry={() => updateProgress(restartQuiz(progress))}
        progress={progress}
      />
    </PrototypeTabScreen>
  );
}

const styles = StyleSheet.create({
  screenContent: { paddingTop: 14, paddingBottom: 104 },
  statusRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: '#D6E9FA', borderRadius: 10, backgroundColor: colors.ice },
  statusText: { color: colors.body, fontFamily: typography.body, fontSize: 13, lineHeight: 20 },
  recoveryNotice: { padding: 11, borderWidth: 1, borderColor: '#B8DDB0', borderRadius: 10, backgroundColor: '#EEF9EB' },
  recoveryText: { color: '#1E632B', fontFamily: typography.body, fontSize: 13, lineHeight: 20 },
  storageError: { gap: 9, padding: 12, borderWidth: 1, borderColor: '#ECCB80', borderRadius: 10, backgroundColor: colors.amberSoft },
  storageErrorText: { color: '#6F4B00', fontFamily: typography.body, fontSize: 13, lineHeight: 20 },
  retryStorageButton: { minHeight: 48, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 15, borderWidth: 1, borderColor: '#B67C00', borderRadius: 999, backgroundColor: colors.paper },
  retryStorageText: { color: '#6F4B00', fontFamily: typography.bodySemiBold, fontSize: 13, lineHeight: 19 },
  retryHovered: { backgroundColor: '#FFF9EC' },
  retryFocused: { borderWidth: 3, borderColor: colors.focus },
  retryDisabled: { opacity: 0.7 },
  pressed: { opacity: 0.72 },
});

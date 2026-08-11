import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, layout } from '@/theme';

import { verticalScrollViewProps } from './vertical-scroll-props';

interface ScreenContainerProps {
  children: ReactNode;
  maxWidth?: number;
  testID?: string;
}

export function ScreenContainer({ children, maxWidth = layout.contentMaxWidth, testID }: ScreenContainerProps) {
  const { width } = useWindowDimensions();
  const wide = width >= layout.wideBreakpoint;

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea} testID={testID}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboardAvoiding}>
        <ScrollView
          {...verticalScrollViewProps}
          contentContainerStyle={styles.scrollContent}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View
            style={[
              styles.content,
              { maxWidth, paddingHorizontal: wide ? layout.desktopGutter : layout.mobileGutter },
            ]}
          >
            {children}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    minWidth: 0,
    width: '100%',
    maxWidth: '100%',
    flex: 1,
    overflow: 'hidden',
    backgroundColor: colors.canvas,
  },
  scrollContent: {
    minWidth: 0,
    width: '100%',
    maxWidth: '100%',
    flexGrow: 1,
    overflow: 'hidden',
  },
  keyboardAvoiding: {
    minWidth: 0,
    maxWidth: '100%',
    flex: 1,
    overflow: 'hidden',
  },
  content: {
    minWidth: 0,
    width: '100%',
    alignSelf: 'center',
    paddingTop: 28,
    paddingBottom: 124,
  },
});

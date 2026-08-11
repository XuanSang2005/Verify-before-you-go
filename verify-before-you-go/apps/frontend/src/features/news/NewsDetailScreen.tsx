import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { InteractiveSurface } from '@/components/InteractiveSurface';
import { PrototypeTabScreen } from '@/components/prototype/PrototypeShell';
import { colors, typography } from '@/theme';

import {
  formatNewsCacheTime,
  getNewsCategoryLabel,
  getNewsMetadata,
} from './news-model';
import { useNewsStory } from './use-news';

export function NewsDetailScreen() {
  const params = useLocalSearchParams<{ slug?: string | string[] }>();
  const slug = Array.isArray(params.slug) ? params.slug[0] ?? '' : params.slug ?? '';
  const news = useNewsStory(slug);
  const story = news.response?.story;

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/news');
  };

  return (
    <PrototypeTabScreen contentStyle={styles.screenContent} testID="news-story-detail">
      <StatusBar style="dark" />
      <View style={styles.contentFrame}>
        <InteractiveSurface
          accessibilityLabel="Back to recruitment newsroom"
          accessibilityRole="button"
          focusStyle={styles.backFocused}
          hoverStyle={styles.backHovered}
          onPress={goBack}
          pressedStyle={styles.controlPressed}
          style={styles.backControl}
        >
          <Ionicons color={colors.body} name="chevron-back" size={20} />
          <Text style={styles.backText}>Newsroom</Text>
        </InteractiveSurface>

        {news.status === 'loading' && !story ? (
          <View accessibilityLabel="Loading synthetic newsroom story" accessibilityLiveRegion="polite" style={styles.loadingPanel}>
            <ActivityIndicator color={colors.brightBlue} />
            <Text style={styles.loadingText}>Loading story</Text>
          </View>
        ) : null}

        {news.status === 'error' ? (
          <View accessibilityLiveRegion="polite" style={styles.errorPanel}>
            <Ionicons color={colors.blue} name="alert-circle-outline" size={24} />
            <Text style={styles.errorTitle}>Story unavailable</Text>
            <Text style={styles.errorBody}>{news.message}</Text>
            <InteractiveSurface
              accessibilityLabel="Retry newsroom story"
              accessibilityRole="button"
              focusStyle={styles.retryFocused}
              hoverStyle={styles.retryHovered}
              onPress={news.retry}
              pressedStyle={styles.controlPressed}
              style={styles.retryButton}
            >
              <Ionicons color={colors.blue} name="refresh" size={17} />
              <Text style={styles.retryText}>Retry</Text>
            </InteractiveSurface>
          </View>
        ) : null}

        {news.status === 'not-found' ? (
          <View accessibilityLiveRegion="polite" style={styles.errorPanel}>
            <Ionicons color={colors.blue} name="document-outline" size={24} />
            <Text style={styles.errorTitle}>Not found</Text>
            <Text style={styles.errorBody}>{news.message}</Text>
            <InteractiveSurface
              accessibilityLabel="Return to recruitment newsroom"
              accessibilityRole="button"
              focusStyle={styles.retryFocused}
              hoverStyle={styles.retryHovered}
              onPress={() => router.replace('/news')}
              pressedStyle={styles.controlPressed}
              style={styles.retryButton}
            >
              <Ionicons color={colors.blue} name="arrow-back" size={17} />
              <Text style={styles.retryText}>Return to newsroom</Text>
            </InteractiveSurface>
          </View>
        ) : null}

        {(news.status === 'offline' || news.status === 'service-unavailable') && news.cachedAt ? (
          <View accessibilityLiveRegion="polite" style={styles.offlineNotice}>
            <Ionicons
              color={colors.blue}
              name={news.status === 'offline' ? 'cloud-offline-outline' : 'server-outline'}
              size={18}
            />
            <View style={styles.offlineCopy}>
              <Text style={styles.offlineTitle}>
                {news.status === 'offline' ? 'Offline · saved story' : 'Service unavailable · showing saved copy'}
              </Text>
              <Text style={styles.offlineText}>Last saved {formatNewsCacheTime(news.cachedAt)}. Review metadata may have changed.</Text>
            </View>
            <InteractiveSurface
              accessibilityLabel={news.refreshing ? 'Refreshing saved story' : 'Retry story connection'}
              accessibilityRole="button"
              disabled={Boolean(news.refreshing)}
              disabledStyle={styles.offlineRetryDisabled}
              onPress={news.retry}
              pressedStyle={styles.controlPressed}
              style={styles.offlineRetry}
            >
              {news.refreshing
                ? <ActivityIndicator color={colors.blue} size="small" />
                : <Ionicons color={colors.blue} name="refresh" size={18} />}
            </InteractiveSurface>
          </View>
        ) : null}

        {story ? (
          <View style={styles.article}>
            <View style={styles.badgeRow}>
              <View style={styles.categoryBadge}><Text style={styles.categoryBadgeText}>{getNewsCategoryLabel(story.category)}</Text></View>
              <View style={styles.syntheticBadge}><Text style={styles.syntheticBadgeText}>{story.syntheticLabel}</Text></View>
            </View>
            <Text style={styles.kicker}>{story.eyebrow}</Text>
            <Text accessibilityRole="header" style={styles.title}>{story.title}</Text>
            <Text style={styles.dek}>{story.dek}</Text>
            <Text style={styles.metadata}>{getNewsMetadata(story)}</Text>

            <View style={styles.sourceStatus}>
              <Ionicons color={colors.blue} name="document-text-outline" size={19} />
              <View style={styles.sourceStatusCopy}>
                <Text style={styles.sourceStatusLabel}>Source status</Text>
                <Text style={styles.sourceStatusValue}>{story.sourceStatusLabel}</Text>
              </View>
            </View>

            <View style={styles.bodySections}>
              {story.bodySections.map((paragraph, index) => (
                <Text key={`${story.slug}-paragraph-${index}`} style={styles.bodyText}>{paragraph}</Text>
              ))}
            </View>

            <View style={styles.verificationPanel}>
              <Text style={styles.sectionKicker}>Independent verification</Text>
              <Text style={styles.sectionTitle}>How to check it yourself</Text>
              <View style={styles.steps}>
                {story.verificationSteps.map((step, index) => (
                  <View key={`${story.slug}-step-${index}`} style={styles.stepRow}>
                    <View style={styles.stepNumber}><Text style={styles.stepNumberText}>{String(index + 1).padStart(2, '0')}</Text></View>
                    <Text style={styles.stepText}>{step}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.sourceNotes}>
              <Text style={styles.sectionKicker}>Source notes</Text>
              {story.sourceNotes.map((note, index) => (
                <View key={`${story.slug}-note-${index}`} style={styles.noteRow}>
                  <View style={styles.noteDot} />
                  <Text style={styles.noteText}>{note}</Text>
                </View>
              ))}
            </View>

            <View style={styles.notVerdictNotice}>
              <Ionicons color={colors.blue} name="information-circle-outline" size={18} />
              <Text style={styles.notVerdictText}>This synthetic story offers verification guidance, not a verdict about any offer, person or company.</Text>
            </View>

            <InteractiveSurface
              accessibilityLabel="Open verification checklist"
              accessibilityRole="link"
              focusStyle={styles.actionFocused}
              hoverStyle={styles.actionHovered}
              onPress={() => router.push('/check/checklist')}
              pressedStyle={styles.controlPressed}
              style={styles.primaryAction}
            >
              <Ionicons color={colors.paper} name="checkbox-outline" size={18} />
              <Text style={styles.primaryActionText}>Open verification checklist</Text>
            </InteractiveSurface>
            <InteractiveSurface
              accessibilityLabel="View reviewed reports and alerts"
              accessibilityRole="link"
              focusStyle={styles.secondaryFocused}
              hoverStyle={styles.secondaryHovered}
              onPress={() => router.push('/alerts')}
              pressedStyle={styles.controlPressed}
              style={styles.secondaryAction}
            >
              <Text style={styles.secondaryActionText}>View reviewed reports and alerts</Text>
              <Ionicons color={colors.blue} name="chevron-forward" size={18} />
            </InteractiveSurface>
          </View>
        ) : null}
      </View>
    </PrototypeTabScreen>
  );
}

const styles = StyleSheet.create({
  screenContent: { paddingTop: 10, paddingBottom: 112 },
  contentFrame: { minWidth: 0, width: '100%', maxWidth: 680, alignSelf: 'center', gap: 12 },
  backControl: { minWidth: 0, minHeight: 44, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: -10, paddingHorizontal: 10, borderRadius: 22 },
  backText: { color: colors.body, fontFamily: typography.bodyMedium, fontSize: 13, lineHeight: 19 },
  backHovered: { backgroundColor: colors.ice },
  backFocused: { borderWidth: 2, borderColor: colors.focus },
  controlPressed: { opacity: 0.72 },
  loadingPanel: { minHeight: 240, alignItems: 'center', justifyContent: 'center', gap: 9 },
  loadingText: { color: colors.muted, fontFamily: typography.bodyMedium, fontSize: 13, lineHeight: 19 },
  errorPanel: { minHeight: 220, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 20, borderWidth: 1, borderColor: '#D6E9FA', borderRadius: 12, backgroundColor: colors.ice },
  errorTitle: { color: colors.navy, fontFamily: typography.bodySemiBold, fontSize: 16, lineHeight: 22 },
  errorBody: { maxWidth: 440, color: colors.muted, fontFamily: typography.body, fontSize: 13, lineHeight: 20, textAlign: 'center' },
  retryButton: { minWidth: 108, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.paleBlue, borderRadius: 999, backgroundColor: colors.paper },
  retryText: { color: colors.blue, fontFamily: typography.bodySemiBold, fontSize: 13, lineHeight: 19 },
  retryHovered: { borderColor: colors.blue },
  retryFocused: { borderWidth: 2, borderColor: colors.focus },
  offlineNotice: { minWidth: 0, flexDirection: 'row', alignItems: 'flex-start', gap: 9, padding: 12, borderWidth: 1, borderColor: '#D6E9FA', borderRadius: 12, backgroundColor: colors.ice },
  offlineCopy: { minWidth: 0, flex: 1, gap: 2 },
  offlineTitle: { color: colors.blue, fontFamily: typography.bodySemiBold, fontSize: 13, lineHeight: 19 },
  offlineText: { color: colors.muted, fontFamily: typography.body, fontSize: 12, lineHeight: 18 },
  offlineRetry: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginVertical: -7, marginRight: -7, borderRadius: 22 },
  offlineRetryDisabled: { opacity: 0.62 },
  article: { minWidth: 0, gap: 14 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  categoryBadge: { minHeight: 26, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8, borderWidth: 1, borderColor: colors.paleBlue, borderRadius: 5, backgroundColor: colors.ice },
  categoryBadgeText: { color: colors.blue, fontFamily: typography.monoMedium, fontSize: 11, lineHeight: 16, letterSpacing: 0.8, textTransform: 'uppercase' },
  syntheticBadge: { minHeight: 26, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8, borderWidth: 1, borderColor: colors.line, borderRadius: 5, backgroundColor: colors.paper },
  syntheticBadgeText: { color: colors.quiet, fontFamily: typography.mono, fontSize: 11, lineHeight: 16, letterSpacing: 0.6, textTransform: 'uppercase' },
  kicker: { color: colors.blue, fontFamily: typography.monoMedium, fontSize: 11, lineHeight: 16, letterSpacing: 1.32, textTransform: 'uppercase' },
  title: { color: colors.navy, fontFamily: typography.heading, fontSize: 29, fontWeight: '700', lineHeight: 35, letterSpacing: -0.4 },
  dek: { color: colors.body, fontFamily: typography.body, fontSize: 16, lineHeight: 25 },
  metadata: { color: colors.quiet, fontFamily: typography.mono, fontSize: 11, lineHeight: 17, letterSpacing: 0.25 },
  sourceStatus: { minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderWidth: 1, borderColor: '#D6E9FA', borderRadius: 12, backgroundColor: colors.ice },
  sourceStatusCopy: { minWidth: 0, flex: 1 },
  sourceStatusLabel: { color: colors.blue, fontFamily: typography.monoMedium, fontSize: 11, lineHeight: 16, letterSpacing: 1.1, textTransform: 'uppercase' },
  sourceStatusValue: { color: colors.body, fontFamily: typography.bodyMedium, fontSize: 13, lineHeight: 19 },
  bodySections: { gap: 12 },
  bodyText: { color: colors.body, fontFamily: typography.body, fontSize: 15, lineHeight: 24 },
  verificationPanel: { gap: 10, padding: 15, borderWidth: 1, borderColor: '#D6E9FA', borderRadius: 12, backgroundColor: colors.ice },
  sectionKicker: { color: colors.blue, fontFamily: typography.monoMedium, fontSize: 11, lineHeight: 16, letterSpacing: 1.1, textTransform: 'uppercase' },
  sectionTitle: { color: colors.navy, fontFamily: typography.heading, fontSize: 20, fontWeight: '700', lineHeight: 26 },
  steps: { gap: 10 },
  stepRow: { minWidth: 0, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  stepNumber: { width: 28, height: 28, flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.navy },
  stepNumberText: { color: colors.paper, fontFamily: typography.monoMedium, fontSize: 11, lineHeight: 16 },
  stepText: { minWidth: 0, flex: 1, paddingTop: 3, color: colors.body, fontFamily: typography.body, fontSize: 13, lineHeight: 20 },
  sourceNotes: { gap: 8, paddingTop: 2 },
  noteRow: { minWidth: 0, flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  noteDot: { width: 6, height: 6, flexShrink: 0, marginTop: 7, borderRadius: 3, backgroundColor: colors.sky },
  noteText: { minWidth: 0, flex: 1, color: colors.muted, fontFamily: typography.body, fontSize: 13, lineHeight: 20 },
  notVerdictNotice: { minWidth: 0, flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12, borderLeftWidth: 3, borderLeftColor: colors.sky, backgroundColor: colors.ice },
  notVerdictText: { minWidth: 0, flex: 1, color: colors.body, fontFamily: typography.body, fontSize: 13, lineHeight: 19 },
  primaryAction: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 20, borderRadius: 999, backgroundColor: colors.brightBlue },
  primaryActionText: { color: colors.paper, fontFamily: typography.bodySemiBold, fontSize: 15, lineHeight: 21 },
  actionHovered: { opacity: 0.92 },
  actionFocused: { borderWidth: 2, borderColor: colors.amber },
  secondaryAction: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 16, borderWidth: 1, borderColor: colors.paleBlue, borderRadius: 999, backgroundColor: colors.paper },
  secondaryActionText: { color: colors.blue, fontFamily: typography.bodySemiBold, fontSize: 14, lineHeight: 20 },
  secondaryHovered: { backgroundColor: colors.ice },
  secondaryFocused: { borderWidth: 2, borderColor: colors.focus },
});

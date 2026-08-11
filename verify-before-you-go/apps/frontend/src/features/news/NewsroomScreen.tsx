import { Ionicons } from '@expo/vector-icons';
import type { NewsStorySummary } from '@vbyg/contracts';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState, type ComponentProps } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type ViewStyle,
} from 'react-native';

import { InteractiveSurface } from '@/components/InteractiveSurface';
import { PrototypeTabScreen } from '@/components/prototype/PrototypeShell';
import { colors, typography } from '@/theme';

import {
  filterNewsStories,
  formatNewsCacheTime,
  getCompactNewsCardCopy,
  getNewsCategoryLabel,
  getNewsMetadata,
  newsFilters,
  shouldUseTwoColumnNewsCards,
  type NewsFilter,
} from './news-model';
import { useNewsroom } from './use-news';

const newsPresenter = require('../../../assets/mascots/news-presenter-v3.png');
const emptyNewsStories: readonly NewsStorySummary[] = [];

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

const heroGradient = Platform.select({
  web: { backgroundImage: 'linear-gradient(125deg,#00224A 0%,#005CA8 70%,#4DA3E4 100%)' },
  default: {},
}) as ViewStyle;

export function NewsroomScreen() {
  const [filter, setFilter] = useState<NewsFilter>('all');
  const { width } = useWindowDimensions();
  const twoColumnCards = shouldUseTwoColumnNewsCards(width);
  const newsroom = useNewsroom();
  const allStories = newsroom.response?.stories ?? emptyNewsStories;
  const filteredStories = useMemo(
    () => filterNewsStories(allStories, filter),
    [allStories, filter],
  );
  const featured = filter === 'all'
    ? filteredStories.find((story) => story.isFeatured)
    : undefined;
  const listStories = featured
    ? filteredStories.filter((story) => story.slug !== featured.slug)
    : filteredStories;
  const hasResponse = Boolean(newsroom.response);

  return (
    <PrototypeTabScreen contentStyle={styles.screenContent} testID="recruitment-newsroom">
      <StatusBar style="dark" />
      <View style={styles.contentFrame}>
        <View style={styles.intro}>
          <Text style={styles.kicker}>Editorial desk · Synthetic prototype</Text>
          <Text accessibilityRole="header" style={styles.title}>Work and recruitment brief.</Text>
          <View accessibilityElementsHidden style={styles.rainbowRule}>
            <View style={[styles.rainbowSegment, styles.rainbowYellow]} />
            <View style={[styles.rainbowSegment, styles.rainbowGreen]} />
            <View style={[styles.rainbowSegment, styles.rainbowBlue]} />
            <View style={[styles.rainbowSegment, styles.rainbowPurple]} />
          </View>
          <Text style={styles.lede}>Updates are separated from reviewed alerts. Every story shows its type, source status and dates.</Text>
        </View>

        <NewsFilterControls onChange={setFilter} value={filter} />

        {newsroom.status === 'loading' && !hasResponse ? <NewsLoadingState /> : null}
        {newsroom.status === 'error' ? (
          <NewsStatePanel
            body={newsroom.message ?? 'The newsroom could not be loaded.'}
            icon="alert-circle-outline"
            onRetry={newsroom.retry}
            title="Newsroom unavailable"
          />
        ) : null}

        {(newsroom.status === 'offline' || newsroom.status === 'service-unavailable') && newsroom.cachedAt ? (
          <SavedCopyNotice
            cachedAt={newsroom.cachedAt}
            mode={newsroom.status}
            onRetry={newsroom.retry}
            refreshing={Boolean(newsroom.refreshing)}
          />
        ) : null}

        {hasResponse ? (
          <>
            {filteredStories.length === 0 ? (
              <NewsStatePanel
                body="No synthetic stories are available in this filter. Choose another topic or refresh the newsroom."
                icon="newspaper-outline"
                onRetry={newsroom.retry}
                title="No stories in this section"
              />
            ) : null}

            {featured ? <FeaturedStory story={featured} /> : null}

            {listStories.length ? (
              <View accessibilityLabel="Newsroom stories" style={styles.newsGrid}>
                {listStories.map((story) => (
                  <CompactNewsStoryCard
                    key={story.slug}
                    story={story}
                    twoColumn={twoColumnCards}
                  />
                ))}
              </View>
            ) : null}

            <View style={styles.relatedLinks}>
              <Text style={styles.sectionLabel}>Keep checking</Text>
              <RelatedLink
                description="Search privacy-redacted, reviewed synthetic patterns."
                icon="search-outline"
                label="Reviewed reports and alerts"
                onPress={() => router.push('/alerts')}
              />
              <RelatedLink
                description="Use five independent checks instead of relying on a story alone."
                icon="checkbox-outline"
                label="Open the verification guide"
                onPress={() => router.push('/check/checklist')}
              />
            </View>

            <View style={styles.syntheticNotice}>
              <Ionicons color={colors.blue} name="information-circle-outline" size={18} />
              <Text style={styles.syntheticNoticeText}>{newsroom.response?.syntheticContentNotice}</Text>
            </View>
          </>
        ) : null}
      </View>
    </PrototypeTabScreen>
  );
}

export function NewsFilterControls({
  onChange,
  value,
}: {
  onChange: (filter: NewsFilter) => void;
  value: NewsFilter;
}) {
  return (
    <View accessibilityLabel="Filter newsroom stories" style={styles.filterRow}>
      {newsFilters.map((item) => {
        const selected = item.id === value;
        const select = () => onChange(item.id);
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
            accessibilityLabel={`Filter: ${item.label}`}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            focusStyle={styles.filterFocused}
            hoverStyle={styles.filterHovered}
            key={item.id}
            onPress={select}
            pressedStyle={styles.controlPressed}
            style={[styles.filterChip, selected && styles.filterChipSelected]}
            testID={`news-filter-${item.id}`}
          >
            <Text style={[styles.filterText, selected && styles.filterTextSelected]}>{item.label}</Text>
          </InteractiveSurface>
        );
      })}
    </View>
  );
}

function openStory(slug: string) {
  router.push({ pathname: '/news/[slug]', params: { slug } });
}

function FeaturedStory({ story }: { story: NewsStorySummary }) {
  return (
    <InteractiveSurface
      accessibilityLabel={`Featured synthetic story. ${story.title}. ${story.dek}. ${getNewsMetadata(story)}`}
      accessibilityRole="link"
      focusStyle={styles.heroFocused}
      hoverStyle={styles.heroHovered}
      onPress={() => openStory(story.slug)}
      pressedStyle={styles.controlPressed}
      style={styles.hero}
    >
      <View style={[styles.heroVisual, heroGradient]}>
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.heroRing} />
        <Image
          accessibilityIgnoresInvertColors
          accessible={false}
          resizeMode="contain"
          source={newsPresenter}
          style={styles.presenter}
        />
        <View style={styles.heroHeadingCopy}>
          <Text style={styles.heroMeta}>{getNewsCategoryLabel(story.category)} · Demo</Text>
          <Text style={styles.heroTitle}>{story.title}</Text>
        </View>
      </View>
      <View style={styles.heroCopy}>
        <Text style={styles.heroDek}>{story.dek}</Text>
        <Text style={styles.heroSource}>{story.syntheticLabel} · {story.sourceStatusLabel}</Text>
        <Text style={styles.heroDates}>{getNewsMetadata(story)}</Text>
      </View>
    </InteractiveSurface>
  );
}

export function CompactNewsStoryCard({
  story,
  twoColumn,
}: {
  story: NewsStorySummary;
  twoColumn: boolean;
}) {
  const tone = story.category === 'scam-watch'
    ? 'amber'
    : story.category === 'mil-explainer'
      ? 'purple'
      : 'blue';
  const copy = getCompactNewsCardCopy(story);
  return (
    <InteractiveSurface
      accessibilityLabel={`${getNewsCategoryLabel(story.category)}. ${copy.title}. ${copy.dek}.`}
      accessibilityRole="link"
      focusStyle={styles.cardFocused}
      hoverStyle={styles.cardHovered}
      onPress={() => openStory(story.slug)}
      pressedStyle={styles.controlPressed}
      style={[styles.newsCard, twoColumn && styles.newsCardTwoColumn, cardShadow]}
      testID={`news-card-${story.slug}`}
    >
      <StoryThumbnail tone={tone} />
      <View style={styles.cardCopy}>
        <View style={styles.cardMetaRow}>
          <View style={[styles.categoryBadge, tone === 'amber' && styles.categoryBadgeAmber]}>
            <Text style={[styles.categoryBadgeText, tone === 'amber' && styles.categoryBadgeTextAmber]}>{getNewsCategoryLabel(story.category)}</Text>
          </View>
        </View>
        <Text style={styles.cardTitle} testID={`news-card-title-${story.slug}`}>{copy.title}</Text>
        <Text style={styles.cardDek} testID={`news-card-dek-${story.slug}`}>{copy.dek}</Text>
      </View>
    </InteractiveSurface>
  );
}

function StoryThumbnail({ tone }: { tone: 'blue' | 'amber' | 'purple' }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.thumbnail,
        tone === 'amber' && styles.thumbnailAmber,
        tone === 'purple' && styles.thumbnailPurple,
      ]}
    >
      <View style={styles.thumbnailRing} />
      <View style={[styles.thumbnailDot, styles.dotAmber]} />
      <View style={[styles.thumbnailDot, styles.dotGreen]} />
      <View style={[styles.thumbnailDot, styles.dotPurple]} />
    </View>
  );
}

function NewsLoadingState() {
  return (
    <View accessibilityLabel="Loading recruitment newsroom" accessibilityLiveRegion="polite" style={styles.loadingPanel}>
      <ActivityIndicator color={colors.brightBlue} />
      <Text style={styles.loadingTitle}>Loading the newsroom</Text>
      <Text style={styles.loadingBody}>Retrieving synthetic stories and their review metadata.</Text>
    </View>
  );
}

function NewsStatePanel({
  body,
  icon,
  onRetry,
  title,
}: {
  body: string;
  icon: IconName;
  onRetry: () => void;
  title: string;
}) {
  return (
    <View accessibilityLiveRegion="polite" style={styles.statePanel}>
      <Ionicons color={colors.blue} name={icon} size={24} />
      <Text style={styles.stateTitle}>{title}</Text>
      <Text style={styles.stateBody}>{body}</Text>
      <InteractiveSurface
        accessibilityLabel="Retry newsroom"
        accessibilityRole="button"
        focusStyle={styles.retryFocused}
        hoverStyle={styles.retryHovered}
        onPress={onRetry}
        pressedStyle={styles.controlPressed}
        style={styles.retryButton}
      >
        <Ionicons color={colors.blue} name="refresh" size={17} />
        <Text style={styles.retryText}>Retry</Text>
      </InteractiveSurface>
    </View>
  );
}

function SavedCopyNotice({
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
          {offline ? 'Offline · showing saved summaries' : 'Service unavailable · showing saved copy'}
        </Text>
        <Text style={styles.offlineText}>Last saved {formatNewsCacheTime(cachedAt)}. Dates and source status may have changed.</Text>
      </View>
      <InteractiveSurface
        accessibilityLabel={refreshing ? 'Refreshing saved newsroom copy' : 'Retry newsroom connection'}
        accessibilityRole="button"
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

function RelatedLink({
  description,
  icon,
  label,
  onPress,
}: {
  description: string;
  icon: IconName;
  label: string;
  onPress: () => void;
}) {
  return (
    <InteractiveSurface
      accessibilityLabel={`${label}. ${description}`}
      accessibilityRole="link"
      focusStyle={styles.relatedFocused}
      hoverStyle={styles.relatedHovered}
      onPress={onPress}
      pressedStyle={styles.controlPressed}
      style={styles.relatedRow}
    >
      <View style={styles.relatedIcon}><Ionicons color={colors.blue} name={icon} size={18} /></View>
      <View style={styles.relatedCopy}>
        <Text style={styles.relatedTitle}>{label}</Text>
        <Text style={styles.relatedDescription}>{description}</Text>
      </View>
      <Ionicons color={colors.quiet} name="chevron-forward" size={18} />
    </InteractiveSurface>
  );
}

const styles = StyleSheet.create({
  screenContent: { paddingTop: 12, paddingBottom: 112 },
  contentFrame: { minWidth: 0, width: '100%', maxWidth: 720, alignSelf: 'center', gap: 14 },
  intro: { minWidth: 0, gap: 7 },
  kicker: { color: colors.quiet, fontFamily: typography.monoMedium, fontSize: 11, lineHeight: 16, letterSpacing: 1.32, textTransform: 'uppercase' },
  title: { color: colors.blue, fontFamily: typography.heading, fontSize: 29, fontWeight: '700', lineHeight: 34, letterSpacing: -0.4 },
  rainbowRule: { width: 56, height: 3, flexDirection: 'row', overflow: 'hidden', borderRadius: 999 },
  rainbowSegment: { flex: 1 },
  rainbowYellow: { backgroundColor: '#FFC24D' },
  rainbowGreen: { backgroundColor: '#8ED97F' },
  rainbowBlue: { backgroundColor: '#3FB6E8' },
  rainbowPurple: { backgroundColor: '#A855F7' },
  lede: { color: colors.body, fontFamily: typography.body, fontSize: 15, lineHeight: 23 },
  filterRow: { minWidth: 0, width: '100%', flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  filterChip: { minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, borderWidth: 1, borderColor: colors.line, borderRadius: 999, backgroundColor: colors.paper },
  filterChipSelected: { borderColor: colors.blue, backgroundColor: colors.ice },
  filterText: { color: colors.muted, fontFamily: typography.bodyMedium, fontSize: 13, lineHeight: 19 },
  filterTextSelected: { color: colors.blue, fontFamily: typography.bodySemiBold },
  filterHovered: { borderColor: colors.paleBlue, backgroundColor: '#F8FBFE' },
  filterFocused: { borderWidth: 2, borderColor: colors.focus },
  controlPressed: { opacity: 0.72 },
  hero: { minWidth: 0, width: '100%', overflow: 'hidden', borderWidth: 1, borderColor: '#164A77', borderRadius: 15, backgroundColor: colors.navy },
  heroFocused: { borderWidth: 2, borderColor: colors.focus },
  heroHovered: { borderColor: colors.paleBlue },
  heroVisual: { position: 'relative', minHeight: 126, overflow: 'hidden', padding: 14, backgroundColor: colors.blue },
  heroRing: { position: 'absolute', top: -35, right: -28, width: 116, height: 116, borderWidth: 1, borderColor: 'rgba(255,255,255,.28)', borderRadius: 58 },
  presenter: { position: 'absolute', zIndex: 2, left: 5, bottom: -7, width: 116, height: 116 },
  heroHeadingCopy: { minWidth: 0, marginLeft: 108, gap: 7 },
  heroMeta: { color: colors.paleBlue, fontFamily: typography.monoMedium, fontSize: 11, lineHeight: 16, letterSpacing: 1.1, textTransform: 'uppercase' },
  heroTitle: { color: colors.paper, fontFamily: typography.heading, fontSize: 17, fontWeight: '700', lineHeight: 22 },
  heroCopy: { gap: 6, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 14 },
  heroDek: { color: '#EAF3FB', fontFamily: typography.body, fontSize: 13, lineHeight: 20 },
  heroSource: { color: colors.paleBlue, fontFamily: typography.bodyMedium, fontSize: 12, lineHeight: 18 },
  heroDates: { color: colors.paleBlue, fontFamily: typography.mono, fontSize: 11, lineHeight: 16, letterSpacing: 0.2 },
  newsGrid: { minWidth: 0, width: '100%', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'stretch', gap: 10 },
  newsCard: { minWidth: 0, minHeight: 105, flexBasis: 300, flexGrow: 1, flexShrink: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12, borderWidth: 1, borderColor: colors.line, borderRadius: 12, backgroundColor: colors.paper },
  newsCardTwoColumn: { flexBasis: '48%', flexGrow: 0 },
  cardFocused: { borderWidth: 2, borderColor: colors.focus },
  cardHovered: { borderColor: colors.paleBlue, backgroundColor: '#FAFCFE' },
  thumbnail: { position: 'relative', width: 70, height: 64, flexShrink: 0, overflow: 'hidden', borderRadius: 10, backgroundColor: colors.blue },
  thumbnailAmber: { backgroundColor: '#B77600' },
  thumbnailPurple: { backgroundColor: '#5C35AA' },
  thumbnailRing: { position: 'absolute', top: -16, right: -14, width: 54, height: 54, borderWidth: 1, borderColor: 'rgba(255,255,255,.35)', borderRadius: 27 },
  thumbnailDot: { position: 'absolute', width: 10, height: 10, borderRadius: 5 },
  dotAmber: { bottom: 11, left: 12, backgroundColor: colors.amber },
  dotGreen: { bottom: 19, left: 30, backgroundColor: '#8ED97F' },
  dotPurple: { right: 10, bottom: 8, backgroundColor: colors.purple },
  cardCopy: { minWidth: 0, flex: 1, gap: 4 },
  cardMetaRow: { minWidth: 0, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  categoryBadge: { minHeight: 24, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 7, borderWidth: 1, borderColor: colors.paleBlue, borderRadius: 5, backgroundColor: colors.ice },
  categoryBadgeAmber: { borderColor: '#E7C46D', backgroundColor: colors.amberSoft },
  categoryBadgeText: { color: colors.blue, fontFamily: typography.monoMedium, fontSize: 11, lineHeight: 15, letterSpacing: 0.7, textTransform: 'uppercase' },
  categoryBadgeTextAmber: { color: '#755000' },
  cardTitle: { color: colors.navy, fontFamily: typography.bodySemiBold, fontSize: 14, lineHeight: 19 },
  cardDek: { color: colors.muted, fontFamily: typography.body, fontSize: 12, lineHeight: 18 },
  loadingPanel: { minHeight: 180, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 20, borderWidth: 1, borderColor: '#D6E9FA', borderRadius: 12, backgroundColor: colors.ice },
  loadingTitle: { color: colors.navy, fontFamily: typography.bodySemiBold, fontSize: 15, lineHeight: 21 },
  loadingBody: { color: colors.muted, fontFamily: typography.body, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  statePanel: { minHeight: 176, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 18, borderWidth: 1, borderColor: '#D6E9FA', borderRadius: 12, backgroundColor: colors.ice },
  stateTitle: { color: colors.navy, fontFamily: typography.bodySemiBold, fontSize: 16, lineHeight: 22, textAlign: 'center' },
  stateBody: { maxWidth: 440, color: colors.muted, fontFamily: typography.body, fontSize: 13, lineHeight: 20, textAlign: 'center' },
  retryButton: { minWidth: 108, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.paleBlue, borderRadius: 999, backgroundColor: colors.paper },
  retryText: { color: colors.blue, fontFamily: typography.bodySemiBold, fontSize: 13, lineHeight: 19 },
  retryHovered: { borderColor: colors.blue, backgroundColor: '#FAFCFE' },
  retryFocused: { borderWidth: 2, borderColor: colors.focus },
  offlineNotice: { minWidth: 0, flexDirection: 'row', alignItems: 'flex-start', gap: 9, padding: 12, borderWidth: 1, borderColor: '#D6E9FA', borderRadius: 12, backgroundColor: colors.ice },
  offlineCopy: { minWidth: 0, flex: 1, gap: 2 },
  offlineTitle: { color: colors.blue, fontFamily: typography.bodySemiBold, fontSize: 13, lineHeight: 19 },
  offlineText: { color: colors.muted, fontFamily: typography.body, fontSize: 12, lineHeight: 18 },
  offlineRetry: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginVertical: -7, marginRight: -7, borderRadius: 22 },
  offlineRetryDisabled: { opacity: 0.62 },
  relatedLinks: { gap: 0, paddingTop: 4, borderTopWidth: 1, borderTopColor: '#E9EDF1' },
  sectionLabel: { marginBottom: 4, color: colors.quiet, fontFamily: typography.monoMedium, fontSize: 11, lineHeight: 16, letterSpacing: 1.32, textTransform: 'uppercase' },
  relatedRow: { minWidth: 0, minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#E9EDF1' },
  relatedHovered: { backgroundColor: '#FAFCFE' },
  relatedFocused: { borderWidth: 2, borderColor: colors.focus, borderRadius: 8 },
  relatedIcon: { width: 36, height: 36, flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: colors.ice },
  relatedCopy: { minWidth: 0, flex: 1 },
  relatedTitle: { color: colors.blue, fontFamily: typography.bodySemiBold, fontSize: 15, lineHeight: 21 },
  relatedDescription: { color: colors.muted, fontFamily: typography.body, fontSize: 12, lineHeight: 18 },
  syntheticNotice: { minWidth: 0, flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12, borderLeftWidth: 3, borderLeftColor: colors.sky, backgroundColor: colors.ice },
  syntheticNoticeText: { minWidth: 0, flex: 1, color: colors.body, fontFamily: typography.body, fontSize: 13, lineHeight: 19 },
});

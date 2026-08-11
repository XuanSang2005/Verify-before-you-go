import { NewsDetailScreen } from '@/features/news/NewsDetailScreen';
import { NEWS_PROTOTYPE_SLUGS } from '@/features/news/news-model';

export function generateStaticParams() {
  return NEWS_PROTOTYPE_SLUGS.map((slug) => ({ slug }));
}

export default function NewsDetailRoute() {
  return <NewsDetailScreen />;
}

import type {
  AlertCategory,
  AlertLocation,
  AlertSummary,
} from '@vbyg/contracts';

export type AlertLocationFilter = 'all' | AlertLocation;
export type AlertCategoryFilter = 'all' | AlertCategory;

export const alertLocationFilters: readonly { id: AlertLocationFilter; label: string }[] = [
  { id: 'all', label: 'All places' },
  { id: 'cambodia', label: 'Cambodia' },
  { id: 'vietnam', label: 'Vietnam' },
  { id: 'regional', label: 'Regional' },
] as const;

export const alertCategoryFilters: readonly { id: AlertCategoryFilter; label: string }[] = [
  { id: 'all', label: 'All patterns' },
  { id: 'identity-document', label: 'Documents' },
  { id: 'off-platform-contact', label: 'Contact channel' },
  { id: 'licence-claim', label: 'Licence' },
  { id: 'upfront-payment', label: 'Payment' },
] as const;

export const ALERT_PROTOTYPE_IDS = ['A-018', 'A-024', 'A-031', 'A-036', 'A-041'] as const;

export function filterCommunityAlerts(
  alerts: readonly AlertSummary[],
  {
    category,
    location,
    search,
  }: {
    category?: AlertCategoryFilter;
    location: AlertLocationFilter;
    search: string;
  },
): AlertSummary[] {
  const normalizedSearch = search.trim().toLocaleLowerCase('en');
  return alerts.filter((alert) => {
    if (location !== 'all' && alert.location !== location) return false;
    if (category && category !== 'all' && alert.category !== category) return false;
    if (!normalizedSearch) return true;
    return [
      alert.id,
      alert.title,
      alert.locationLabel,
      alert.categoryLabel,
      alert.moderationStatusLabel,
      alert.summary,
      ...alert.maskedIdentifiers,
    ].some((value) => value.toLocaleLowerCase('en').includes(normalizedSearch));
  });
}

export function formatAlertDate(value: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(value));
}

export function formatAlertCacheTime(value: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

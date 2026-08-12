import type { SupportContact, SupportCountry } from '@vbyg/contracts';

export const supportCountries: readonly { id: SupportCountry; label: string }[] = [
  { id: 'cambodia', label: 'Cambodia' },
  { id: 'vietnam', label: 'Viet Nam' },
];

export function filterSupportContacts(
  contacts: readonly SupportContact[],
  country: SupportCountry,
) {
  return contacts
    .filter((contact) => contact.country === country)
    .toSorted((left, right) => left.sortOrder - right.sortOrder);
}

export function isSupportReviewDue(contact: SupportContact, now = new Date()) {
  return contact.reviewStatus === 'review-due'
    || new Date(contact.nextReviewAt).getTime() < now.getTime();
}

export function formatSupportReviewDate(value: string) {
  return new Intl.DateTimeFormat('en', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(value));
}

export function formatSupportCacheTime(value: string) {
  return new Intl.DateTimeFormat('en', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
  }).format(new Date(value));
}

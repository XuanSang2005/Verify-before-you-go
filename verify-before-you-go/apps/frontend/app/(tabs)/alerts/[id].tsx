import { AlertDetailScreen } from '@/features/alerts/AlertDetailScreen';
import { ALERT_PROTOTYPE_IDS } from '@/features/alerts/alerts-model';

export function generateStaticParams() {
  return ALERT_PROTOTYPE_IDS.map((id) => ({ id }));
}

export default function AlertDetailRoute() {
  return <AlertDetailScreen />;
}

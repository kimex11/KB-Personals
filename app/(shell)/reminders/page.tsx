import { PlaceholderScreen } from '@/components/shared/PlaceholderScreen';
import { TAB_ITEMS } from '@/components/shell/tab-config';

const icon = TAB_ITEMS.find((tab) => tab.href === '/reminders')!.icon;

export default function RemindersPage() {
  return <PlaceholderScreen icon={icon} />;
}

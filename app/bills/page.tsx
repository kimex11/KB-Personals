import { PlaceholderScreen } from '@/components/shared/PlaceholderScreen';
import { TAB_ITEMS } from '@/components/shell/tab-config';

const icon = TAB_ITEMS.find((tab) => tab.href === '/bills')!.icon;

export default function BillsPage() {
  return <PlaceholderScreen icon={icon} />;
}

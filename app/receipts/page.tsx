import { PlaceholderScreen } from '@/components/shared/PlaceholderScreen';
import { TAB_ITEMS } from '@/components/shell/tab-config';

const icon = TAB_ITEMS.find((tab) => tab.href === '/receipts')!.icon;

export default function ReceiptsPage() {
  return <PlaceholderScreen icon={icon} />;
}

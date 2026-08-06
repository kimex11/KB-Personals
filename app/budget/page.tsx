import { PlaceholderScreen } from '@/components/shared/PlaceholderScreen';
import { TAB_ITEMS } from '@/components/shell/tab-config';

const icon = TAB_ITEMS.find((tab) => tab.href === '/budget')!.icon;

export default function BudgetPage() {
  return <PlaceholderScreen icon={icon} />;
}

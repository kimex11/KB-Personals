'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';

export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <Button
      type="button"
      data-testid="logout-button"
      onClick={handleLogout}
      className="bg-transparent text-neutral-500 hover:text-neutral-900"
    >
      Log out
    </Button>
  );
}

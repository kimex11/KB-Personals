import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { InstallPrompt } from './InstallPrompt';

function makeBeforeInstallPromptEvent() {
  const event = new Event('beforeinstallprompt') as Event & {
    prompt: () => void;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
  };
  event.prompt = vi.fn();
  event.userChoice = Promise.resolve({ outcome: 'accepted' });
  return event;
}

afterEach(() => {
  cleanup();
});

describe('InstallPrompt', () => {
  it('renders nothing until the browser fires beforeinstallprompt', () => {
    const { container } = render(<InstallPrompt />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows an Install button after beforeinstallprompt fires', () => {
    render(<InstallPrompt />);
    fireEvent(window, makeBeforeInstallPromptEvent());
    expect(screen.getByTestId('install-app-button')).toBeInTheDocument();
  });

  it('calls prompt() on the captured event when the button is clicked', () => {
    render(<InstallPrompt />);
    const event = makeBeforeInstallPromptEvent();
    fireEvent(window, event);
    fireEvent.click(screen.getByTestId('install-app-button'));
    expect(event.prompt).toHaveBeenCalled();
  });

  it('hides the button once the app is installed', () => {
    render(<InstallPrompt />);
    fireEvent(window, makeBeforeInstallPromptEvent());
    expect(screen.getByTestId('install-app-button')).toBeInTheDocument();
    fireEvent(window, new Event('appinstalled'));
    expect(screen.queryByTestId('install-app-button')).not.toBeInTheDocument();
  });
});

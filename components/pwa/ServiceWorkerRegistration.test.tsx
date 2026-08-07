import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { ServiceWorkerRegistration } from './ServiceWorkerRegistration';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('ServiceWorkerRegistration', () => {
  it('registers the service worker when the browser supports it', () => {
    const register = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, serviceWorker: { register } });

    render(<ServiceWorkerRegistration />);

    expect(register).toHaveBeenCalledWith('/sw.js');
  });

  it('does nothing when the browser does not support service workers', () => {
    const navigatorWithoutSW = { ...navigator };
    // @ts-expect-error -- simulating an unsupported browser for this test
    delete navigatorWithoutSW.serviceWorker;
    vi.stubGlobal('navigator', navigatorWithoutSW);

    expect(() => render(<ServiceWorkerRegistration />)).not.toThrow();
  });

  it('renders nothing', () => {
    const register = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, serviceWorker: { register } });

    const { container } = render(<ServiceWorkerRegistration />);
    expect(container).toBeEmptyDOMElement();
  });
});

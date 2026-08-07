import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'KB Personals — Financial Tracker',
    short_name: 'KB Personals',
    description: 'A premium personal finance tracker — bills, budget, reminders, and accounts in one place.',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#FAFAFA',
    theme_color: '#0B0B0C',
    icons: [
      { src: '/icon/small', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon/large', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon/small', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icon/large', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}

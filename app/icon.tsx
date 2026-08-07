import { ImageResponse } from 'next/og';

export function generateImageMetadata() {
  return [
    { id: 'small', size: { width: 192, height: 192 }, contentType: 'image/png' },
    { id: 'large', size: { width: 512, height: 512 }, contentType: 'image/png' },
  ];
}

export default function Icon({ id }: { id: string }) {
  const isSmall = id === 'small';
  const dimension = isSmall ? 192 : 512;
  const fontSize = isSmall ? 84 : 220;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0B0B0C',
          color: '#B08D57',
          fontSize,
          fontWeight: 700,
        }}
      >
        KB
      </div>
    ),
    { width: dimension, height: dimension }
  );
}

import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
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
          fontSize: 78,
          fontWeight: 700,
        }}
      >
        KB
      </div>
    ),
    { ...size }
  );
}

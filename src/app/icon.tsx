import { ImageResponse } from 'next/og';

// Browser tab icon. The full logo is 935x267, far too wide to stay legible at
// 32px, so the tab uses an "MX" monogram instead.
export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#00a6e8',
          color: '#ffffff',
          fontSize: 17,
          fontWeight: 700,
          letterSpacing: -0.5,
          borderRadius: 6,
        }}
      >
        MX
      </div>
    ),
    size,
  );
}

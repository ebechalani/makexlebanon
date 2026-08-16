import fs from 'node:fs';
import path from 'node:path';
import { ImageResponse } from 'next/og';
import { site } from '@content/site';

// Preview card shown when the site is shared on WhatsApp, Facebook, LinkedIn.
export const alt = 'MakeX Lebanon — national robotics competition';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OpengraphImage() {
  const logo = fs.readFileSync(path.join(process.cwd(), 'public', 'logo.png'));
  const logoSrc = `data:image/png;base64,${logo.toString('base64')}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          background: '#05080f',
          padding: '0 90px',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoSrc} alt="" width={468} height={134} />

        <div
          style={{
            display: 'flex',
            marginTop: 52,
            fontSize: 62,
            fontWeight: 700,
            color: '#ffffff',
            lineHeight: 1.1,
            letterSpacing: -1.5,
          }}
        >
          National robotics competition
        </div>

        <div
          style={{
            display: 'flex',
            marginTop: 24,
            fontSize: 30,
            color: '#71daff',
          }}
        >
          {site.tagline}
        </div>
      </div>
    ),
    size,
  );
}

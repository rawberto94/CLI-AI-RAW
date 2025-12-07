import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export const size = {
  width: 32,
  height: 32,
};

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
          background: 'linear-gradient(135deg, #06B6D4 0%, #3B82F6 100%)',
          borderRadius: 6,
        }}
      >
        {/* Document icon */}
        <svg
          width="20"
          height="24"
          viewBox="0 0 20 24"
          fill="none"
          style={{ display: 'flex' }}
        >
          <path
            d="M12 0H4C2.9 0 2 0.9 2 2V18C2 19.1 2.9 20 4 20H16C17.1 20 18 19.1 18 18V6L12 0Z"
            fill="white"
          />
          <path
            d="M12 0V6H18"
            fill="#E0F2FE"
          />
          <path
            d="M5 11H15M5 14H13"
            stroke="#3B82F6"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </div>
    ),
    {
      ...size,
    }
  );
}

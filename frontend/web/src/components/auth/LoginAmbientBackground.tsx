import { Box } from '@mui/material';

type Variant = 'staff' | 'consumer';

/** Calm institutional backdrop — slate navy + soft water teal, minimal motion. */
export default function LoginAmbientBackground({ variant }: { variant: Variant }) {
  const isStaff = variant === 'staff';

  return (
    <>
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          background: isStaff
            ? `
              radial-gradient(ellipse 80% 60% at 0% 0%, rgba(15, 76, 129, 0.45) 0%, transparent 55%),
              radial-gradient(ellipse 55% 45% at 100% 100%, rgba(8, 145, 178, 0.18) 0%, transparent 50%),
              linear-gradient(165deg, #07111f 0%, #0c1a2e 42%, #0f2438 72%, #0a1628 100%)
            `
            : `
              radial-gradient(ellipse 75% 60% at 8% 18%, rgba(56, 189, 248, 0.22) 0%, transparent 55%),
              radial-gradient(ellipse 60% 50% at 95% 85%, rgba(14, 165, 233, 0.14) 0%, transparent 50%),
              linear-gradient(165deg, #e0f2fe 0%, #f0f9ff 40%, #f8fafc 100%)
            `,
        }}
      />

      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          opacity: isStaff ? 0.035 : 0.35,
          backgroundImage: isStaff
            ? 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)'
            : 'radial-gradient(circle at 1px 1px, #7dd3fc 1px, transparent 0)',
          backgroundSize: isStaff ? '48px 48px' : '32px 32px',
          pointerEvents: 'none',
        }}
      />

      {isStaff && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(90deg, transparent 0%, transparent 48%, rgba(7, 17, 31, 0.35) 72%, rgba(7, 17, 31, 0.55) 100%)',
            pointerEvents: 'none',
          }}
        />
      )}

      {isStaff && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(180deg, transparent 55%, rgba(2, 6, 23, 0.55) 100%)',
            pointerEvents: 'none',
          }}
        />
      )}
    </>
  );
}

import { Box } from '@mui/material';

type Variant = 'staff' | 'consumer';

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
              radial-gradient(ellipse 90% 70% at 12% 30%, rgba(37, 99, 235, 0.28) 0%, transparent 58%),
              radial-gradient(ellipse 70% 55% at 92% 75%, rgba(13, 148, 136, 0.2) 0%, transparent 52%),
              radial-gradient(ellipse 50% 40% at 50% 8%, rgba(99, 102, 241, 0.14) 0%, transparent 50%),
              conic-gradient(from 210deg at 70% 40%, rgba(37,99,235,0.08), transparent 35%, rgba(13,148,136,0.06), transparent 70%),
              linear-gradient(152deg, #010409 0%, #0f172a 40%, #1e293b 65%, #0b1220 100%)
            `
            : `
              radial-gradient(ellipse 75% 60% at 8% 18%, rgba(56, 189, 248, 0.28) 0%, transparent 55%),
              radial-gradient(ellipse 60% 50% at 95% 85%, rgba(45, 212, 191, 0.2) 0%, transparent 50%),
              radial-gradient(ellipse 45% 35% at 55% 5%, rgba(14, 165, 233, 0.12) 0%, transparent 45%),
              linear-gradient(165deg, #e0f2fe 0%, #f0f9ff 35%, #f8fafc 72%, #ecfeff 100%)
            `,
        }}
      />

      {/* Animated mesh lines */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          opacity: isStaff ? 0.05 : 0.4,
          backgroundImage: isStaff
            ? 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)'
            : 'radial-gradient(circle at 1px 1px, #7dd3fc 1px, transparent 0)',
          backgroundSize: isStaff ? '56px 56px' : '32px 32px',
          animation: 'loginGridDrift 40s linear infinite',
          '@keyframes loginGridDrift': {
            '0%': { transform: 'translate(0, 0)' },
            '100%': { transform: 'translate(56px, 56px)' },
          },
        }}
      />

      {/* Floating orbs */}
      {[
        { top: '-6%', left: '10%', size: 440, color: isStaff ? 'rgba(37,99,235,0.2)' : 'rgba(56,189,248,0.25)', delay: 0 },
        { bottom: '8%', right: isStaff ? '35%' : '8%', size: 380, color: isStaff ? 'rgba(13,148,136,0.16)' : 'rgba(45,212,191,0.2)', delay: 2 },
        { top: '40%', right: '5%', size: 280, color: isStaff ? 'rgba(99,102,241,0.12)' : 'rgba(14,165,233,0.15)', delay: 4 },
      ].map((orb, i) => (
        <Box
          key={i}
          sx={{
            position: 'absolute',
            width: orb.size,
            height: orb.size,
            borderRadius: '50%',
            top: orb.top,
            left: orb.left,
            right: orb.right,
            bottom: orb.bottom,
            background: `radial-gradient(circle, ${orb.color} 0%, transparent 68%)`,
            filter: 'blur(48px)',
            pointerEvents: 'none',
            animation: `loginOrbFloat${i} ${16 + i * 4}s ease-in-out infinite alternate`,
            animationDelay: `${orb.delay}s`,
            [`@keyframes loginOrbFloat${i}`]: {
              '0%': { transform: 'translate(0, 0) scale(1)' },
              '100%': { transform: `translate(${i % 2 ? -24 : 20}px, ${i % 2 ? 28 : -20}px) scale(1.06)` },
            },
          }}
        />
      ))}

      {/* Water ripple rings — consumer only */}
      {!isStaff && (
        <Box
          sx={{
            position: 'absolute',
            bottom: '12%',
            left: '18%',
            width: 200,
            height: 200,
            borderRadius: '50%',
            border: '1px solid rgba(2, 132, 199, 0.2)',
            pointerEvents: 'none',
            animation: 'rippleExpand 6s ease-out infinite',
            '@keyframes rippleExpand': {
              '0%': { transform: 'scale(0.6)', opacity: 0.6 },
              '100%': { transform: 'scale(2.2)', opacity: 0 },
            },
          }}
        />
      )}

      {isStaff && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(180deg, transparent 50%, rgba(2, 6, 23, 0.65) 100%)',
            pointerEvents: 'none',
          }}
        />
      )}
    </>
  );
}

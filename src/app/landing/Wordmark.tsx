import Image from 'next/image'

/**
 * The real Workmark logo, served from /public.
 *
 * workmark-logo.png is a 2000×2000 square canvas with a lot of whitespace
 * padding around the horizontal wordmark, so we crop it tightly via
 * object-fit: cover inside a wide, short box. workmark-logo2.png is already a
 * tightly-cropped horizontal lockup (743×164) — pass variant="2" to use it
 * uncropped if the crop on variant 1 ever looks off.
 */
export function Wordmark({ height = 28, variant = '1' }: { height?: number; variant?: '1' | '2' }) {
  if (variant === '2') {
    const width = Math.round(height * (743 / 164))
    return (
      <Image
        src="/workmark-logo2.png"
        alt="Workmark"
        width={width}
        height={height}
        priority
        style={{ height, width: 'auto' }}
      />
    )
  }

  // variant "1" — crop the square canvas down to a wordmark-shaped box.
  const width = Math.round(height * 4.6)
  return (
    <span
      style={{
        position: 'relative',
        display: 'inline-block',
        width,
        height,
        overflow: 'hidden',
      }}
    >
      <Image
        src="/workmark-logo.png"
        alt="Workmark"
        fill
        priority
        style={{ objectFit: 'cover', objectPosition: '50% 50%' }}
      />
    </span>
  )
}

import Image from 'next/image'

/**
 * The real Workmark logo, served from /public.
 *
 * workmark-logo-transparent.png is workmark-logo.png with its opaque white
 * canvas background removed (flood-filled to alpha 0) and tightly cropped in
 * natural aspect ratio, so it sits cleanly on any background color instead of
 * showing a white box. workmark-logo2.png is a separate, already-cropped
 * asset (743×164) — pass variant="2" to use it instead if ever needed.
 */
export function Wordmark({ height = 34, variant = '1' }: { height?: number; variant?: '1' | '2' }) {
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

  // variant "1" — transparent, cropped tight to the wordmark's natural aspect ratio.
  const width = Math.round(height * (1166 / 236))
  return (
    <Image
      src="/workmark-logo-transparent.png"
      alt="Workmark"
      width={width}
      height={height}
      priority
      style={{ height, width: 'auto' }}
    />
  )
}

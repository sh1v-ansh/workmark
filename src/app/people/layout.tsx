import NavbarSlot from '@/components/NavbarSlot'

/**
 * The navbar, rendered once for this whole section.
 *
 * It used to be rendered inside each page instead. Two things went wrong
 * with that. Clicking a nav link swapped the page for its loading fallback
 * and took the navbar with it, so the nav vanished at the exact moment
 * someone was using it. And every new page had to remember to render it
 * with the right props — twelve of the fourteen forgot at least one.
 *
 * A layout sits above the loading boundary, so the navbar survives the
 * swap, and nothing below here has to know it exists.
 */
export default function SectionLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <NavbarSlot />
      {children}
    </>
  )
}

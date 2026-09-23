import NavbarSlot from '@/components/NavbarSlot'

/**
 * The navbar, rendered once for this whole section.
 *
 * This section shipped without one, which is the exact failure the other
 * section layouts were written to prevent: nothing in the route tree above
 * /workspaces renders the nav, so both the project list and the board came
 * up with no way to get anywhere else. A page you can only leave with the
 * back button reads as a broken page, and fairly so.
 *
 * A layout sits above the loading boundary, so the navbar survives the swap
 * when a link is clicked, and nothing below here has to know it exists.
 */
export default function SectionLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <NavbarSlot />
      {children}
    </>
  )
}

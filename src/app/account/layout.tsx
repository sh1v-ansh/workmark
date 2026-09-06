import NavbarSlot from '@/components/NavbarSlot'

/**
 * The navbar, for the account screens.
 *
 * These pages had no nav at all — they were only ever reached from a link in
 * the account dropdown and got a "← Back" link instead. Settings is a real
 * destination now, and landing somewhere with no way out except the browser
 * button is not a destination, it is a trap.
 *
 * NavbarSlot renders nothing for a signed-out visitor, which is what
 * /account/deleted needs: the account is gone, and a nav full of "My record"
 * links would be a cruel thing to show someone who just left.
 */
export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <NavbarSlot />
      {children}
    </>
  )
}

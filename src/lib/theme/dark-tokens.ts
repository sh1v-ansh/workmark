// The app's theme entry point.
//
// Named "dark-tokens" for historical reasons — the app used to be dark, then
// shared the light marketing palette, and now has its own. The filename is
// kept only because ~25 app modules import from it; renaming is a separate,
// mechanical change and not worth tangling into a redesign.
//
// What matters is the indirection: every app surface reads C and F from here,
// so the palette and the font stacks are swappable in one place. Marketing
// pages import from @/app/landing/tokens instead and are unaffected.
export { app as C, appFonts as F } from './tokens'
export { state, R, T, E } from './tokens'

// The app pages historically consumed a "dark" theme via this module. We've
// unified on the light palette (marketing + app share the same theme now), so
// this file just re-exports the light tokens under the same C/F names that
// existing app-page imports expect. Rename this file if you want to clean up,
// but keeping it lets us avoid rewriting 16 import paths across the app.
export { light as C, F } from './tokens'

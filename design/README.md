# UI prototypes

Mockups only — nothing here ships. These are the source artboards behind the
design canvas the team reviews; the canvas itself is a 2.5 MB generated file
and is git-ignored, since it is rebuilt from these on every change.

- `Main.dc.html` — the student dashboard, with a Direction control that flips
  the whole screen between the three colour treatments.
- `Directions.dc.html` — Cool paper / Lit edges / Soft mesh, the same card
  rendered three ways so they can be compared fairly.
- `Skills.dc.html` — the skills summary, before and after. The "before" is the
  real bug: `skills.map()` renders all 37 chips with no cap.
- `NextProject.dc.html` — three rewrites of the card that currently reads
  "Not sure what to build next?".
- `canvas.json` — where each artboard sits on the canvas.

Values are lifted from the real app rather than approximated: Schibsted
Grotesk and Hanken Grotesk, the `R`/`T` scales in `src/lib/theme/tokens.ts`,
13px card radii, 18px grid gaps, 1320px content width. Sample data is
plausible and invented.

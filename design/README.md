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
- `Empty.dc.html` — the first screen a new student sees: one action, three
  visible steps, and a dimmed preview of where they land.
- `Verified.dc.html` — four ways to colour verification, argued and compared:
  gold on the top tier, one gold seal, a full warm ramp, verified green.
- `canvas.json` — where each artboard sits on the canvas.

## The two colours

Violet is what Workmark is asking you to do — buttons, the focal card, the
next-project block. Gold is what your code already proved.

Gold is scarce on purpose. Only the top tier carries it: six skills out of
thirty-seven, never the whole ramp and never a button. Scarcity is the entire
mechanism — colour every level and the top one stops being distinguishable
from the bottom, which is the failure the current card already has.

The gradient matters as much as the hue. Flat yellow reads as a highlighter;
a light-to-deep sweep reads as metal, and that is the distance between a medal
and a novelty sticker.

    fill    linear-gradient(145deg, #F9E4AE 0%, #EBCB74 44%, #D9A93C 100%)
    border  #CE9F32
    text    #4A3106   (level suffix #7A5410)

Teal was tried first and dropped — see the git history. It was too muted to
read as a reward, and "verified" is not a cool-toned idea.

Levels read Beginner / Intermediate / Advanced.

Values are lifted from the real app rather than approximated: Schibsted
Grotesk and Hanken Grotesk, the `R`/`T` scales in `src/lib/theme/tokens.ts`,
13px card radii, 18px grid gaps, 1320px content width. Sample data is
plausible and invented.

# Team photos

Drop two files in here and they appear on /about automatically:

    shivansh-soni.jpg
    jineshwar-nariani.jpg

Square, at least 320×320. Anything larger is fine — the page renders them at
128px and the browser scales, so a 640×640 crop looks right on a retina
screen without shipping a huge file.

Until a file exists, that person's card shows their initials. That is a
deliberate fallback rather than a placeholder somebody has to remember to
remove, so the page is never broken by a missing photo.

Any of .jpg, .png or .webp works — change the path in
`src/app/landing/TeamSection.tsx` if you use a different extension.

# Frame studio

The design studio for an e-ink wall frame (an Inky Impression 7.3" in a 3D-printed case
with a passe-partout): a copy of the frame you can play with in the browser.

**Open it:** `lab/studio.html` (the site's start page goes there).

- **Frame:** every page of the frame (gothic, classic, disruptions, calibration) inside a
  digital copy of the case and mat, in e-ink colours. The orange buttons work like the real ones.
- **Etch:** the effects that roughen and pepper the gothic page's type, live, with sliders,
  and a type scale for each font. Settings stay in your browser; "Copy" gives the line to
  hand over to the frame.
- **Guides:** a drawing guide over the artwork, exported as a PNG for drawing by hand.

The data is a saved, anonymised recording (stops renamed, location moved), so the departures
and weather don't change. Everything is drawn in your browser by the same code the frame's
server uses.

**Generated:** this repository is built from the frame's private project with
`npm run studio`. Don't edit it here: changes are overwritten by the next build.

## Credits

- Fonts (SIL Open Font License, texts in `fonts/` and `lab/fonts/`): Jacquard 12 and
  Jacquarda Bastarda 9 (The Soft Type Project), Jersey 10, IBM Plex Sans.
- Icons: [pixelarticons](https://github.com/halfmage/pixelarticons), MIT (`licenses/`).
- The artwork (`art/window.png`) is drawn by the repository's owner; all rights reserved.

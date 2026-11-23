/*
 * The gothic page (button C): the data laid over web/art/window.png, an engraving of
 * a window drawn for exactly the visible part of the frame (460×704, placed 1:1 at
 * the mat's top-left corner, so it moves with --mat-*).
 *
 *   rose window      current temperature, and under it what it feels like (or a stale-data warning)
 *   top roundels     today's low (left) and high (right), captioned "min" and "max"
 *   flower roundels  weather now (left) and for the next 6 hours (right), with "now"/"later"
 *   top medallions   the button icons, white on black, one under each button (what A–D do here)
 *   four arches      departures, soonest first: an arrow (up = towards the centre,
 *                    down = away from it), the line number, then the times on rows
 *                    shared by all four arches. In an arch with several lines the
 *                    number at the top is the next departure's line, and times of
 *                    other lines get their line number above them, small.
 *
 * Every place below is in artwork pixels, measured from the white areas of the drawing.
 * Two pixel fonts by the same designer, only at whole multiples of their grids, so
 * every font pixel is a square of g×g panel pixels:
 *   Jacquard 12 (21 px/em): temperatures, line numbers, labels
 *   Jacquarda Bastarda 9 (13 px/em): the times, lighter and narrower (2× fits the arches)
 * alignGothic() centres each text on its place by its measured width, on whole
 * (and for g ≥ 2, even) pixels. Both fonts' digits have 1 font pixel of space on
 * the left and none on the right. The small temperatures are centred on their number:
 * the ° hangs to the right of the centre instead of pushing the number left. The big
 * one in the rose is centred with its °.
 */
(function () {
    const ART = { src: 'art/window.png', width: 460, height: 704 }; // relative to dashboard.html
    const FONTS = {
        jacquard: { family: "'Jacquard 12'", em: 21, body: 8 },          // digit body: 8 font px
        bastarda: { family: "'Jacquarda Bastarda 9'", em: 13, body: 6 }, // digit body: 6 font px
    };

    // Rose: the temperature's digit body centred at cy, at the biggest of `sizes` that fits
    // `width`; under it, at `subBase`, what it feels like (Jacquard 1×, like the min/max
    // captions), or a stale warning, 7 px under the big digits' descenders (176 + 18 + 7 +
    // the line's 12 px ascenders), by eye.
    const ROSE = { cx: 230, cy: 152, width: 136, sizes: [6, 5, 4], subBase: 213 };
    // Top roundels: the number (body centred at cy) with "min"/"max" under it at 1×.
    const LOW = { cx: 95.5, cy: 90, captionBase: 115, caption: 'min' };
    const HIGH = { cx: 363.5, cy: 90, captionBase: 115, caption: 'max' };
    const ROUNDEL_WIDTH = 50;
    // Flower roundels: a 24 px icon (1 px per icon unit, so exact) with its caption under it
    // in Jacquard 12 at 1×, its smallest exact size (letters 8 px, ascenders 12). The captions
    // sit a little apart from the icons' centres, by eye.
    const NOW = { cx: 86.5, iconTop: 164, captionX: 84.5, captionBase: 200, caption: 'now' };
    const LATER = { cx: 372, iconTop: 164, captionX: 374, captionBase: 200, caption: 'later' };
    const ICON = 24;

    // The medallions drawn into the top border under the buttons (disc pixels measured from
    // the drawing: their white discs are 21–23 px across). Each is filled black to just inside
    // its outer ring and holds its button's 24 px icon in white (2 px strokes). The icons used
    // here reach at most 11.7 px from their centre, so they keep a pixel of black around them.
    const MEDALLIONS = { a: { cx: 50, cy: 19 }, b: { cx: 169.5, cy: 19.5 }, c: { cx: 290, cy: 20 }, d: { cx: 410, cy: 19 } };
    const MEDALLION_FILL = 13; // radius of the black disc
    const BUTTON_ICON = 24;

    // The arches' white openings (centre x), and the rows shared by all four.
    const ARCHES = [84.5, 184, 276, 375.5];
    const ARROW_TOP = 292;   // 5×6 pixel arrow at 2 px: 292–304
    const HEAD_BASE = 326;   // line number, Jacquard 12 at 2×
    const ROW_BASE = 368;    // first time's baseline, Bastarda at 2×
    const ROW_PITCH = 36;
    const ROWS = 8;          // last row 620 (+4 for descenders), above the arch bottom at 646
    const LABEL_UP = 20;     // a small line number's baseline sits this far above its time's

    const ARROW_UP = ['..#..', '.###.', '#####', '..#..', '..#..', '..#..'];
    const RED = '#ff0000';

    const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const deg = (v) => (v === null || v === undefined ? '–' : `${v < 0 ? '−' : ''}${Math.abs(v)}°`);

    // Text centred on cx with its baseline at `base`, in font `font` at g× its grid;
    // alignGothic() fixes x once the fonts are in. `fit`: [width, sizes...], the biggest
    // size whose ink fits the width. A trailing ° hangs outside the centring, unless
    // `hang` is false.
    function text(s, cx, base, g, { font = 'jacquard', fill = '#000', strike = false, fit = null, hang = true } = {}) {
        const f = FONTS[font];
        const hanging = hang && String(s).endsWith('°') ? 1 : 0;
        const data = `data-cx="${cx}" data-g="${g}" data-font="${font}"${strike ? ' data-strike' : ''}`
            + `${fit ? ` data-fit="${fit.join(',')}"` : ''}${hanging ? ` data-hang="${hanging}"` : ''}`;
        return `<text x="${cx}" y="${base}" font-family="${f.family.replace(/'/g, '&apos;')}" font-size="${f.em * g}" fill="${fill}" ${data}>${esc(s)}</text>`;
    }

    function arrow(direction, cx, top, s = 2) {
        const rows = direction === 'in' ? ARROW_UP : [...ARROW_UP].reverse();
        const x0 = Math.round((cx - (5 * s) / 2) / 2) * 2;
        let out = '';
        rows.forEach((row, y) => [...row].forEach((c, x) => {
            if (c === '#') out += `<rect x="${x0 + x * s}" y="${top + y * s}" width="${s}" height="${s}"/>`;
        }));
        return out;
    }

    function column(col, cx) {
        const head = col.lines.length === 1 ? col.lines[0] : col.times[0]?.line;
        let out = arrow(col.direction, cx, ARROW_TOP);
        if (head) out += text(head, cx, HEAD_BASE, 2);
        col.times.slice(0, ROWS).forEach((t, i) => {
            const base = ROW_BASE + i * ROW_PITCH;
            if (t.line !== head) out += text(t.line, cx, base - LABEL_UP, 1);
            out += text(t.time, cx, base, 2, { font: 'bastarda', fill: t.late || t.cancelled ? RED : '#000', strike: t.cancelled });
        });
        return out;
    }

    function buttonIcons(actions) {
        return Object.entries(actions).map(([button, action]) => {
            const m = MEDALLIONS[button];
            const body = (window.UI_ICONS || {})[action];
            if (!m || !body) return '';
            // Disc pixel (cx, cy) spans cx…cx+1, so its centre is at +0.5. The icon goes on
            // even coordinates (the 2 px grid), within half a pixel of that centre.
            const x = Math.round((m.cx + 0.5 - BUTTON_ICON / 2) / 2) * 2;
            const y = Math.round((m.cy + 0.5 - BUTTON_ICON / 2) / 2) * 2;
            return `<circle cx="${m.cx + 0.5}" cy="${m.cy + 0.5}" r="${MEDALLION_FILL}" fill="#000"/>`
                + `<svg x="${x}" y="${y}" width="${BUTTON_ICON}" height="${BUTTON_ICON}" viewBox="0 0 24 24" fill="#fff" aria-label="${button}: ${action}">${body}</svg>`;
        }).join('');
    }

    function roundel(name, place, at) {
        const left = Math.round(at.x + place.cx - ICON / 2);
        const top = at.y + place.iconTop;
        return `<div class="gothic-icon" style="left:${left}px;top:${top}px;width:${ICON}px;height:${ICON}px">${window.weatherIcon(name)}</div>`;
    }

    // `actions`: what each button does on this page ({ a: 'refresh', ... }), for the medallions.
    window.gothicHtml = function (view, frame, actions = {}) {
        const style = getComputedStyle(frame);
        const at = { x: parseFloat(style.getPropertyValue('--mat-left')) || 0, y: parseFloat(style.getPropertyValue('--mat-top')) || 0 };
        const { weather, gothic, stale } = view;

        let svg = '';
        const big = ROSE.sizes[0];
        // The big number is centred with its °, which looks balanced at this size (by eye).
        svg += text(deg(weather.now), ROSE.cx, ROSE.cy + (FONTS.jacquard.body / 2) * big, big, { fit: [ROSE.width, ...ROSE.sizes], hang: false });
        // One line under it: stale data first (departures, then weather), else what it feels like.
        if (stale.transit) svg += text(`Departures ${stale.transit}`, ROSE.cx, ROSE.subBase, 1, { fill: RED });
        else if (stale.weather) svg += text(`Weather ${stale.weather}`, ROSE.cx, ROSE.subBase, 1, { fill: RED });
        else if (gothic.feels !== null && gothic.feels !== undefined) {
            svg += text(`feels ${deg(gothic.feels)}`, ROSE.cx, ROSE.subBase, 1);
        }
        for (const r of [[LOW, weather.min], [HIGH, weather.max]]) {
            const [place, value] = r;
            svg += text(deg(value), place.cx, place.cy + 8, 2, { fit: [ROUNDEL_WIDTH, 2, 1] });
            svg += text(place.caption, place.cx, place.captionBase, 1);
        }
        svg += text(NOW.caption, NOW.captionX, NOW.captionBase, 1);
        svg += text(LATER.caption, LATER.captionX, LATER.captionBase, 1);
        gothic.columns.slice(0, ARCHES.length).forEach((col, i) => { svg += column(col, ARCHES[i]); });
        svg += buttonIcons(actions);

        return `
            <div class="gothic">
                <img src="${ART.src}" width="${ART.width}" height="${ART.height}" style="left:${at.x}px;top:${at.y}px" alt="">
                ${roundel(gothic.outlook.now, NOW, at)}
                ${roundel(gothic.outlook.later, LATER, at)}
                <svg class="gothic-data" width="480" height="800" viewBox="${-at.x} ${-at.y} 480 800" shape-rendering="crispEdges">${svg}</svg>
            </div>`;
    };

    // Once the fonts and the artwork are in: pick the rose's size, centre every text on whole
    // pixels by its real width, and strike through cancelled times.
    window.alignGothic = function (frame) {
        const page = frame.querySelector('.gothic');
        if (!page) return Promise.resolve();
        return Promise.all([
            ...Object.values(FONTS).map((f) => document.fonts.load(`${f.em * 2}px ${f.family}`)),
            page.querySelector('img').decode().catch(() => {}),
        ]).then(() => {
            // A newer render may have replaced this one while the fonts loaded: its texts
            // are no longer laid out and can't be measured.
            if (!page.isConnected) return;
            for (const el of page.querySelectorAll('text[data-cx]')) {
                const f = FONTS[el.dataset.font];
                let g = Number(el.dataset.g);
                const cx = Number(el.dataset.cx);
                if (el.dataset.fit) {
                    // Biggest size whose ink fits, keeping the digits' body centred.
                    const [width, ...sizes] = el.dataset.fit.split(',').map(Number);
                    const centre = Number(el.getAttribute('y')) - (f.body / 2) * g;
                    for (const size of sizes) {
                        g = size;
                        el.setAttribute('font-size', f.em * g);
                        if (el.getComputedTextLength() - g <= width) break;
                    }
                    el.setAttribute('y', centre + (f.body / 2) * g);
                    el.dataset.g = g; // web/etch.js reads the final scale
                }
                // Centre the ink, minus any hanging ° at the end.
                const hang = Number(el.dataset.hang || 0);
                const width = hang ? el.getSubStringLength(0, el.textContent.length - hang) : el.getComputedTextLength();
                const ink = width - g;
                const snap = g === 1 ? 1 : 2;
                const x = Math.round((cx - ink / 2 - g) / snap) * snap;
                el.setAttribute('x', x);
                if ('strike' in el.dataset) {
                    const y = Number(el.getAttribute('y')) - (f.body / 2 + 1) * g; // (times never hang)
                    el.insertAdjacentHTML('afterend', `<rect x="${x}" y="${y}" width="${ink + 2 * g}" height="${g}" fill="${RED}"/>`);
                }
            }
        });
    };
})();

/*
 * Calibration page (button D): shows which part of the 480×800 frame the
 * passe-partout leaves visible, and where the buttons are.
 *
 * Each edge has a staircase of bars growing out of it, every 4 px longer than the
 * last and numbered in the visible part of the frame. The mat hides the short
 * ones: the first bar you can see sticks out by up to 4 px, so the edge hides
 * between its length and the previous bar's (dashboard.css takes the middle).
 * The ruler near the top gives the x under each physical button.
 *
 * The middle holds pixel tests: 1-px patterns in black, red and white-on-black (does
 * the panel hold single pixels?), grey and red ramps (where the Zero's reduction to
 * black/white/red flips), the fonts at their sizes, and an icon at 1:1, 2:1 and half
 * a pixel off the grid.
 */
(function () {
    const W = 480;
    const H = 800;
    const STEP = 4;   // each bar 4 px longer than the previous one
    const PITCH = 20; // 18 px bar + 2 px gap

    const px = (frame, name) => parseFloat(getComputedStyle(frame).getPropertyValue(name)) || 0;
    const text = (x, y, s, attrs = '') => `<text x="${x}" y="${y}" ${attrs}>${s}</text>`;

    // Bars along the top or bottom edge: lengths `from`, from+4, ... at x = x0, x0+20, ...
    function horizontalStair(edge, from, count, x0, labelY) {
        let out = '';
        for (let i = 0; i < count; i++) {
            const len = from + i * STEP;
            const x = x0 + i * PITCH;
            const y = edge === 'top' ? 0 : H - len;
            out += `<rect x="${x}" y="${y}" width="${PITCH - 2}" height="${len}"/>`;
            out += text(x + (PITCH - 2) / 2, labelY, len, 'text-anchor="middle" font-size="12"');
        }
        return out;
    }

    // Bars along the left or right edge: lengths `from`, from+4, ... at y = y0, y0+20, ...
    function verticalStair(edge, from, count, y0, labelX) {
        let out = '';
        for (let i = 0; i < count; i++) {
            const len = from + i * STEP;
            const y = y0 + i * PITCH;
            const x = edge === 'left' ? 0 : W - len;
            out += `<rect x="${x}" y="${y}" width="${len}" height="${PITCH - 2}"/>`;
            out += text(labelX, y + 14, len, `text-anchor="${edge === 'left' ? 'start' : 'end'}" font-size="14"`);
        }
        return out;
    }

    // An x scale across the frame: ticks every 10 px, numbers every 40 px, and the
    // button positions the design currently assumes (dashboard.css --btn-*-x).
    function buttonRuler(y, buttons) {
        let out = `<rect x="0" y="${y}" width="${W}" height="2"/>`;
        for (let x = 0; x <= W; x += 10) {
            const long = x % 40 === 0;
            const tx = Math.min(x, W - 2);
            out += `<rect x="${tx}" y="${y + 2}" width="2" height="${long ? 10 : 5}"/>`;
            if (long && x > 0 && x < W) out += text(tx + 1, y + 26, x, 'text-anchor="middle" font-size="12"');
        }
        for (const [label, x] of buttons) {
            out += `<path d="M${x - 7} ${y - 22}h14v12l-7 8l-7 -8z" fill="#ff0000"/>`;
            out += text(x, y - 12, label, 'text-anchor="middle" font-size="12" font-weight="700" fill="#ffffff"');
        }
        return out;
    }

    // Pixel test patterns, tiled from the frame's pixel 0 so every patch lands on whole pixels.
    const PATTERNS = {
        check1: [2, 2, '<rect width="1" height="1"/><rect x="1" y="1" width="1" height="1"/>'],
        vline1: [2, 1, '<rect width="1" height="1"/>'],
        hline1: [1, 2, '<rect width="1" height="1"/>'],
        check1red: [2, 2, '<rect width="1" height="1" fill="#ff0000"/><rect x="1" y="1" width="1" height="1" fill="#ff0000"/>'],
        check2: [4, 4, '<rect width="2" height="2"/><rect x="2" y="2" width="2" height="2"/>'],
        redblack: [2, 1, '<rect width="1" height="1"/><rect x="1" width="1" height="1" fill="#ff0000"/>'],
        dots: [4, 4, '<rect width="1" height="1"/>'],
        white1: [4, 1, '<rect width="3" height="1"/>'],
    };
    const defs = () => '<defs>' + Object.entries(PATTERNS).map(([id, [w, h, body]]) =>
        `<pattern id="p-${id}" width="${w}" height="${h}" patternUnits="userSpaceOnUse">${body}</pattern>`).join('') + '</defs>';

    function pixelTests(x0) {
        const PATCH = 60, GAP = 8, WIDTH = 4 * PATCH + 3 * GAP; // 264
        const small = 'font-size="12"';
        let out = '';
        const row = (y, ids, labels) => ids.forEach((id, i) => {
            const x = x0 + i * (PATCH + GAP);
            out += `<rect x="${x}" y="${y}" width="${PATCH}" height="40" fill="url(#p-${id})"/>`;
            out += text(x + PATCH / 2, y + 54, labels[i], `text-anchor="middle" ${small}`);
        });
        row(322, ['check1', 'vline1', 'hline1', 'check1red'], ['1px check', '1px |||', '1px ≡', '1px red']);
        row(384, ['check2', 'redblack', 'dots', 'white1'], ['2px check', 'red | black', 'dots', 'white line']);

        // Ramps: 12 steps of 22 px. Grey 0→255, then white → red → black.
        const ramp = (y, colours, label) => {
            colours.forEach((c, i) => { out += `<rect x="${x0 + i * 22}" y="${y}" width="22" height="16" fill="${c}"/>`; });
            out += `<rect x="${x0 - 1}" y="${y - 1}" width="${WIDTH + 2}" height="18" fill="none" stroke="#000" stroke-width="1"/>`;
            out += text(x0 + WIDTH / 2, y + 30, label, `text-anchor="middle" ${small}`);
        };
        const lerp = (a, b, t) => a.map((v, k) => Math.round(v + (b[k] - v) * t));
        const rgb = (c) => `rgb(${c.join(',')})`;
        ramp(448, Array.from({ length: 12 }, (_, i) => rgb(lerp([0, 0, 0], [255, 255, 255], i / 11))), 'grey: black → white');
        ramp(486, Array.from({ length: 12 }, (_, i) => rgb(i < 6 ? lerp([255, 255, 255], [255, 0, 0], i / 5) : lerp([255, 0, 0], [0, 0, 0], (i - 5) / 6))),
            'white → red → black');

        // Type at the sizes the frame uses (and the pixel fonts' base sizes).
        out += text(x0, 546, 'Jersey 10 · 20px Afternoon', 'font-family="\'Jersey 10\'" font-weight="400" font-size="20"');
        out += text(x0, 562, 'Jersey 10 · 10px Morning Evening Night 0123', 'font-family="\'Jersey 10\'" font-weight="400" font-size="10"');
        out += text(x0, 590, 'Jacquard 12 · 24px −5° 18', 'font-family="\'Jacquard 12\'" font-weight="400" font-size="24"');
        out += text(x0, 612, 'Plex 15 Gaustadalléen 18:43', 'font-weight="500" font-size="15"');
        out += text(x0, 634, '18:46 Plex 18 bold red', 'font-weight="700" font-size="18" fill="#ff0000"');

        // The refresh icon at 1:1 (12px), 2:1 (24px), and 1:1 half a pixel off the grid.
        const icon = (x, y, size) => `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 24 24">${(window.UI_ICONS || {}).refresh || ''}</svg>`;
        out += icon(x0, 656, 12) + icon(x0 + 20, 650, 24) + icon(x0 + 52.5, 656.5, 12);
        out += text(x0 + 74, 667, '1:1 · 2:1 · ½ px off', small);
        return out;
    }

    window.calibrationHtml = function (frame) {
        const [top, right, bottom, left] = ['top', 'right', 'bottom', 'left'].map((e) => px(frame, `--mat-${e}`));
        const buttons = ['A', 'B', 'C', 'D'].map((b) => [b, px(frame, `--btn-${b.toLowerCase()}-x`)]);

        const svg = [
            // What the design assumes is visible (dashboard.css --mat-*): a dashed red outline just inside it.
            `<rect x="${left + 1}" y="${top + 1}" width="${W - left - right - 2}" height="${H - top - bottom - 2}" fill="none" stroke="#ff0000" stroke-width="2" stroke-dasharray="8 6"/>`,
            horizontalStair('top', 20, 20, 40, 116),
            horizontalStair('bottom', 20, 20, 40, H - 106),
            verticalStair('left', 4, 19, 220, 86),
            verticalStair('right', 4, 19, 220, W - 86),
            buttonRuler(170, buttons),
            pixelTests(108),
        ].join('');

        const lines = [
            ['CALIBRATION', 'font-size="16" font-weight="700"'],
            ['Edges: number of the first bar you see.', ''],
            ['Ruler: the number under each button.', ''],
            [`Mat now (T R B L): ${top} · ${right} · ${bottom} · ${left}`, 'fill="#ff0000" font-weight="700"'],
            ['Press D to go back', 'font-weight="700"'],
        ];
        const block = lines.map(([s, attrs], i) => text(W / 2, 232 + i * 18, s, `text-anchor="middle" font-size="12" ${attrs}`)).join('');

        return `<svg class="calibrate" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" shape-rendering="crispEdges" fill="#000">${defs()}${svg}${block}</svg>`;
    };
})();

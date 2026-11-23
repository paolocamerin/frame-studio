/*
 * Icons for the frame. Weather icons are pixelarticons (see scripts/build-icons.js,
 * which generates window.WEATHER_ICONS in weather-icons.js); shown at 48px so each
 * icon pixel is a whole number of screen pixels and stays sharp on e-ink.
 */
(function () {
    window.weatherIcon = function (name) {
        const body = (window.WEATHER_ICONS || {})[name];
        if (!body) return '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="8" y="11" width="8" height="2"/></svg>';
        return `<svg viewBox="0 0 24 24" fill="currentColor" shape-rendering="crispEdges" role="img" aria-label="${name.replace('-', ' ')}">${body}</svg>`;
    };

    // Button notch: a black pixel teardrop hanging from the top of the window (its top
    // NOTCH_HIDDEN rows sit behind the passe-partout), with the action's pixelarticon in
    // white at 12px, so each icon pixel is exactly one panel pixel.
    const NOTCH_W = 22;
    const NOTCH_H = 34;
    window.NOTCH_HIDDEN = 4;

    // Convex hull of a 4px neck at the top and a circle at the bottom; a pixel is filled when its
    // centre is inside. Returned as one rect per horizontal run, all on whole pixels.
    function teardropRects(w, h, neck, r) {
        const cx = w / 2;
        const cy = h - r;
        const pts = [[cx - neck, 0], [cx + neck, 0]];
        for (let i = 0; i < 64; i++) {
            const t = (i / 64) * 2 * Math.PI;
            pts.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]);
        }
        pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
        const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
        const chain = (ps) => {
            const s = [];
            for (const p of ps) {
                while (s.length >= 2 && cross(s[s.length - 2], s[s.length - 1], p) <= 0) s.pop();
                s.push(p);
            }
            s.pop();
            return s;
        };
        const hull = [...chain(pts), ...chain([...pts].reverse())];
        const inside = (x, y) => hull.every((p, i) => cross(p, hull[(i + 1) % hull.length], [x, y]) >= 0);
        let rects = '';
        for (let y = 0; y < h; y++) {
            let start = -1;
            for (let x = 0; x <= w; x++) {
                const on = x < w && inside(x + 0.5, y + 0.5);
                if (on && start < 0) start = x;
                if (!on && start >= 0) {
                    rects += `<rect x="${start}" y="${y}" width="${x - start}" height="1"/>`;
                    start = -1;
                }
            }
        }
        return rects;
    }
    const TEARDROP = teardropRects(NOTCH_W, NOTCH_H, 2, 11);

    window.notchSvg = function (action) {
        const body = action ? (window.UI_ICONS || {})[action] || '' : '';
        const icon = body
            ? `<svg x="5" y="${NOTCH_H - 17}" width="12" height="12" viewBox="0 0 24 24" fill="#fff">${body}</svg>`
            : '';
        const label = action ? ` role="img" aria-label="${action}"` : ' aria-hidden="true"';
        return `<svg width="${NOTCH_W}" height="${NOTCH_H}" viewBox="0 0 ${NOTCH_W} ${NOTCH_H}" shape-rendering="crispEdges"${label}><g fill="#000">${TEARDROP}</g>${icon}</svg>`;
    };

    // Direction of travel. The dot is the city centre; a triangle points
    // left into it (towards the centre, ●◀) or right away from it (away, ●▶).
    window.directionIcon = function (dir) {
        const dot = '<circle cx="6" cy="8" r="5" fill="currentColor"/>';
        const triangle = dir === 'in'
            ? '<path d="M29 1.5L16 8L29 14.5Z" fill="currentColor"/>'
            : '<path d="M16 1.5L29 8L16 14.5Z" fill="currentColor"/>';
        const body = dot + triangle;
        const label = dir === 'in' ? 'towards the centre' : 'away from the centre';
        return `<svg class="dir" viewBox="0 0 30 16" role="img" aria-label="${label}">${body}</svg>`;
    };

    // Pixel arrows to sit beside the pixel-font temperatures: a 5×6 grid of squares.
    const ARROW_UP = ['..#..', '.###.', '#####', '..#..', '..#..', '..#..'];
    function pixels(rows) {
        let rects = '';
        rows.forEach((row, y) => [...row].forEach((c, x) => {
            if (c === '#') rects += `<rect x="${x}" y="${y}" width="1" height="1"/>`;
        }));
        return rects;
    }

    window.arrowIcon = function (dir) {
        const rows = dir === 'up' ? ARROW_UP : [...ARROW_UP].reverse();
        return `<svg viewBox="0 0 5 6" fill="currentColor" aria-hidden="true">${pixels(rows)}</svg>`;
    };
})();

/*
 * Etched text for the gothic page: roughens the edges of big pixel-font text so it
 * sits with the engraving's 1 px stipple. The artwork is never touched; only the
 * text is redrawn, onto a canvas laid over it.
 *
 * For each text (scale g: 1×, 2×, 6× its font's grid) and weather icon (treated as 2×):
 *   1. M = the text as an exact 1-bit mask (pixel fonts at whole sizes on whole
 *      pixels have no partial pixels, so canvas text reproduces the SVG text exactly)
 *   2. F = M blurred with sigma = blur × (g − 1): nothing at 1×, more the bigger the text
 *   3. near the edge (within `band` px of a pixel of the other value):
 *        pixel = F + noise × (N − ½) > ½,   N = a fixed pattern in panel coordinates
 *      elsewhere the pixel stays as it was.
 * The blur rounds the corners of the big pixels, and the noise breaks up the edges,
 * adding pixels outside and removing them inside. The pattern is fixed to the panel,
 * so the same text in the same place always comes out the same.
 *
 * Pepper, independent of the edges, for text from `pepperFrom`× up:
 *   holes   share of the text's pixels turned white
 *   specks  share of the pixels next to the text turned to ink, fading out to `reach` px away
 * Single scattered pixels, from their own fixed random field.
 *
 * Frame pepper, independent of the text: an even scatter over the whole page, artwork
 * included. A layer on top with `grainInk` of its pixels black (adds ink wherever it
 * lands on white) and `grainPaper` white (takes ink away wherever it lands on black or red).
 * Again its own fixed random field.
 *
 * Tune it in the frame studio's Etch tab (web/lab/studio.html); ETCH_DEFAULTS are what the frame uses.
 */
(function () {
    // Tuned by the user on the lab page (2026-11-22).
    const DEFAULTS = {
        on: true, blur: 0.65, noise: 0.35, band: 1, pattern: 'white',
        pepper: true, holes: 0, specks: 0.12, reach: 6, pepperFrom: 3,
        grain: true, grainInk: 0.018, grainPaper: 0.008,
    };
    window.ETCH_DEFAULTS = DEFAULTS;

    const BAYER8 = (() => {
        // 8×8 ordered-dither matrix, values in [0, 1).
        let m = [[0]];
        while (m.length < 8) {
            const n = m.length;
            const next = Array.from({ length: 2 * n }, () => new Array(2 * n));
            for (let y = 0; y < n; y++) {
                for (let x = 0; x < n; x++) {
                    const v = 4 * m[y][x];
                    next[y][x] = v; next[y][x + n] = v + 2; next[y + n][x] = v + 3; next[y + n][x + n] = v + 1;
                }
            }
            m = next;
        }
        return m.map((row) => row.map((v) => (v + 0.5) / 64));
    })();
    const fract = (v) => v - Math.floor(v);
    // Each gives a value in [0, 1) for a panel pixel.
    const PATTERNS = {
        ign: (x, y) => fract(52.9829189 * fract(0.06711056 * x + 0.00583715 * y)), // interleaved gradient noise: even, stipple-like
        bayer: (x, y) => BAYER8[y & 7][x & 7],                                       // ordered: regular, like a halftone
        white: (x, y) => fract(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453),     // random: clumpy
    };
    window.ETCH_PATTERNS = Object.keys(PATTERNS);
    // The pepper's own random field, so it doesn't line up with the edge noise.
    const pepperAt = (x, y) => fract(Math.sin(x * 39.3467 + y * 11.1351) * 24634.6345);
    // And the frame pepper's: an integer hash, even over the whole page.
    function grainAt(x, y) {
        let h = Math.imul(x, 374761393) + Math.imul(y, 668265263);
        h = Math.imul(h ^ (h >>> 13), 1274126177);
        return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
    }

    function grainLayer(p) {
        const canvas = document.createElement('canvas');
        canvas.width = 480;
        canvas.height = 800;
        canvas.className = 'gothic-grain';
        const ctx = canvas.getContext('2d');
        const img = ctx.createImageData(480, 800);
        for (let y = 0; y < 800; y++) {
            for (let x = 0; x < 480; x++) {
                const r = grainAt(x, y);
                const v = r < p.grainInk ? 0 : r < p.grainInk + p.grainPaper ? 255 : -1;
                if (v < 0) continue;
                const i = (y * 480 + x) * 4;
                img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
                img.data[i + 3] = 255;
            }
        }
        ctx.putImageData(img, 0, 0);
        return canvas;
    }

    function gaussian(src, w, h, sigma) {
        const r = Math.ceil(3 * sigma);
        const k = Array.from({ length: 2 * r + 1 }, (_, i) => Math.exp(-((i - r) ** 2) / (2 * sigma * sigma)));
        const sum = k.reduce((a, b) => a + b, 0);
        const kn = k.map((v) => v / sum);
        const tmp = new Float32Array(w * h);
        const out = new Float32Array(w * h);
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                let v = 0;
                for (let i = -r; i <= r; i++) { const xx = x + i; if (xx >= 0 && xx < w) v += kn[i + r] * src[y * w + xx]; }
                tmp[y * w + x] = v;
            }
        }
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                let v = 0;
                for (let i = -r; i <= r; i++) { const yy = y + i; if (yy >= 0 && yy < h) v += kn[i + r] * tmp[yy * w + x]; }
                out[y * w + x] = v;
            }
        }
        return out;
    }

    // 1 where a pixel of the other value is within `band` px (a (2·band+1)² square).
    function edgeBand(m, w, h, band) {
        const out = new Uint8Array(w * h);
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const v = m[y * w + x];
                search: for (let dy = -band; dy <= band; dy++) {
                    for (let dx = -band; dx <= band; dx++) {
                        const xx = x + dx; const yy = y + dy;
                        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
                        if (m[yy * w + xx] !== v) { out[y * w + x] = 1; break search; }
                    }
                }
            }
        }
        return out;
    }

    // Distance (in px, square neighbourhood) from each pixel to the nearest ink, up to `max`; ink is 0.
    function inkDistance(m, w, h, max) {
        const dist = new Uint8Array(w * h).fill(255);
        let front = m.slice();
        for (let i = 0; i < m.length; i++) if (m[i]) dist[i] = 0;
        for (let d = 1; d <= max; d++) {
            const next = front.slice();
            for (let y = 0; y < h; y++) {
                for (let x = 0; x < w; x++) {
                    const i = y * w + x;
                    if (front[i]) continue;
                    for (let dy = -1; dy <= 1 && !next[i]; dy++) {
                        for (let dx = -1; dx <= 1; dx++) {
                            const xx = x + dx; const yy = y + dy;
                            if (xx >= 0 && yy >= 0 && xx < w && yy < h && front[yy * w + xx]) { next[i] = 1; dist[i] = d; break; }
                        }
                    }
                }
            }
            front = next;
        }
        return dist;
    }

    function pepper(m, w, h, left, top, p) {
        const dist = inkDistance(m, w, h, p.reach);
        const out = m.slice();
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const i = y * w + x;
                const r = pepperAt(left + x, top + y);
                if (m[i]) out[i] = r < p.holes ? 0 : 1;
                else if (dist[i] <= p.reach) out[i] = r < p.specks * (1 - (dist[i] - 1) / p.reach) ? 1 : 0;
            }
        }
        return out;
    }

    // The weather icons' strokes are 2 px (2 icon units at 1 px each), so they're
    // treated like 2× text.
    const ICON_SCALE = 2;

    // What gets redrawn: every text, and the weather icons. Each item has its scale g,
    // its box on the panel, its colour, and draws itself as ink on a canvas.
    async function itemsOf(page, svg) {
        const [vx, vy] = svg.getAttribute('viewBox').split(' ').map(Number);
        const items = [];
        for (const el of svg.querySelectorAll('text[data-cx]')) {
            const size = parseFloat(el.getAttribute('font-size'));
            const x = Number(el.getAttribute('x')) - vx;
            const base = Number(el.getAttribute('y')) - vy;
            const font = `${size}px ${el.getAttribute('font-family')}`;
            items.push({
                el,
                g: Number(el.dataset.g),
                box: { x: Math.floor(x), y: Math.floor(base - size), w: Math.ceil(el.getComputedTextLength()), h: Math.ceil(size * 1.5) },
                fill: el.getAttribute('fill') || '#000',
                draw: (ctx, ox, oy) => { ctx.font = font; ctx.fillText(el.textContent, x - ox, base - oy); },
            });
        }
        for (const el of page.querySelectorAll('.gothic-icon')) {
            const icon = el.querySelector('svg');
            if (!icon) continue;
            // From the inline style gothic.js sets (offset* would include the lab's zoom).
            const size = parseFloat(el.style.width);
            const copy = icon.cloneNode(true);
            copy.setAttribute('width', size);
            copy.setAttribute('height', size);
            const img = new Image();
            img.src = `data:image/svg+xml,${encodeURIComponent(new XMLSerializer().serializeToString(copy))}`;
            await img.decode();
            const x = parseFloat(el.style.left);
            const y = parseFloat(el.style.top);
            items.push({
                el,
                g: ICON_SCALE,
                box: { x, y, w: size, h: size },
                fill: '#000',
                draw: (ctx, ox, oy) => ctx.drawImage(img, x - ox, y - oy, size, size),
            });
        }
        return items;
    }

    let runs = 0;

    // Etch the gothic page's text and weather icons (after alignGothic). Call again with
    // other options to redo it; { on: false, pepper: false, grain: false } puts the plain page back.
    // Returns a promise (the icons are read as images).
    window.etchGothic = async function (frame, options = {}) {
        const run = ++runs;
        const p = { ...DEFAULTS, ...options };
        const page = frame.querySelector('.gothic');
        if (!page) return;
        const svg = page.querySelector('svg.gothic-data');
        const items = await itemsOf(page, svg);
        if (run !== runs) return; // a newer call took over
        page.querySelector('canvas.gothic-etched')?.remove();
        page.querySelector('canvas.gothic-grain')?.remove();
        if (p.grain) page.append(grainLayer(p));
        // The edges (on) and the text pepper are independent: either one redraws the page's ink.
        const redraw = p.on || p.pepper;
        for (const item of items) item.el.style.visibility = redraw ? 'hidden' : '';
        if (!redraw) return;

        const canvas = document.createElement('canvas');
        canvas.width = 480;
        canvas.height = 800;
        canvas.className = 'gothic-etched';
        const out = canvas.getContext('2d');
        const noiseAt = PATTERNS[p.pattern] || PATTERNS.ign;

        for (const item of items) {
            const { g } = item;
            const sigma = p.on ? p.blur * (g - 1) : 0;
            const peppered = p.pepper && g >= p.pepperFrom;
            const margin = Math.max(Math.ceil(3 * sigma) + p.band, peppered ? p.reach : 0) + 2;
            const left = item.box.x - margin;
            const top = item.box.y - margin;
            const w = item.box.w + 2 * margin;
            const h = item.box.h + 2 * margin;

            const c = document.createElement('canvas');
            c.width = w;
            c.height = h;
            const ctx = c.getContext('2d');
            item.draw(ctx, left, top);
            const alpha = ctx.getImageData(0, 0, w, h).data;
            const m = new Uint8Array(w * h);
            for (let i = 0; i < m.length; i++) m[i] = alpha[i * 4 + 3] >= 128 ? 1 : 0;

            let result = m;
            if (sigma > 0.05 && p.band > 0) {
                const f = gaussian(m, w, h, sigma);
                const near = edgeBand(m, w, h, p.band);
                result = new Uint8Array(w * h);
                for (let y = 0; y < h; y++) {
                    for (let x = 0; x < w; x++) {
                        const i = y * w + x;
                        result[i] = near[i] ? (f[i] + p.noise * (noiseAt(left + x, top + y) - 0.5) > 0.5 ? 1 : 0) : m[i];
                    }
                }
            }
            if (peppered) result = pepper(result, w, h, left, top, p);
            out.fillStyle = item.fill;
            for (let y = 0; y < h; y++) {
                for (let x = 0; x < w; x++) if (result[y * w + x]) out.fillRect(left + x, top + y, 1, 1);
            }
        }
        svg.after(canvas);
    };
})();

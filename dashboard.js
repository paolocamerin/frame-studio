/*
 * Renders the view from /state.json into the frame.
 *   /            live preview, refreshes every 15 s
 *   /?mock=1     recorded data, for design work
 *   /?render=1   used by the server's headless Chromium: waits for renderDashboard(payload)
 *   add &mode=notices (or ?mode=notices) for the disruption page shown by button B,
 *   &mode=gothic for the gothic page (button C, web/gothic.js; &etch=0 shows it without web/etch.js),
 *   or &mode=calibrate for the passe-partout calibration page (button D)
 */
(function () {
    const PERIOD_NAMES = { NIGHT: 'Night', MORNING: 'Morning', AFTERNOON: 'Afternoon', EVENING: 'Evening' };
    const frame = document.getElementById('frame');

    const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const deg = (v) => (v === null || v === undefined ? '–' : `${v < 0 ? '−' : ''}${Math.abs(v)}°`);

    function weatherHtml(w, stale) {
        const warning = stale ? `<p class="warning">Weather not updated since ${esc(stale)}</p>` : '';
        const periods = w.periods.map((p) => `
            <div class="period${p.current ? ' current' : ''}">
                ${window.weatherIcon(p.icon)}
                <span>${esc(PERIOD_NAMES[p.label] || p.label)}</span>
            </div>`).join('');
        return `
            ${warning}
            <section class="weather">
                <div class="now">
                    <div class="temp">${deg(w.now)}</div>
                    <div class="range">
                        <div>${window.arrowIcon('up')}${deg(w.max)}</div>
                        <div>${window.arrowIcon('down')}${deg(w.min)}</div>
                    </div>
                </div>
                <div class="periods">${periods}</div>
            </section>`;
    }

    function timeHtml(t, i) {
        const cls = ['time', i === 0 ? 'first' : '', t.late ? 'late' : '', t.cancelled ? 'cancelled' : ''].filter(Boolean).join(' ');
        // Departures without live tracking only have a timetable time: mark them "ca.", like Ruter's signs.
        const ca = t.realtime ? '' : '<span class="ca">ca.</span>';
        return `<span class="${cls}">${ca}${esc(t.time)}</span>`;
    }

    // Line number: square for trams, round for buses; a red "!" when a disruption notice concerns it.
    function badgeHtml(line, mode, notice = false) {
        const alert = notice ? '<span class="alert" aria-label="disruption">!</span>' : '';
        return `<span class="badge ${mode === 'tram' ? 'tram' : 'bus'}">${esc(line)}${alert}</span>`;
    }

    // What each button does on each page (display/client.py), as the icon on its notch.
    // C switches the main page between classic and gothic; on the disruption page it
    // depends on which one you came from, so it has no notch there. The calibration
    // page has no notches (they'd cover its top scale); its ruler marks the buttons instead.
    const BUTTON_ACTIONS = {
        normal: { a: 'refresh', b: 'disruptions', c: 'gothic', d: 'calibrate' },
        gothic: { a: 'refresh', b: 'disruptions', c: 'classic', d: 'calibrate' },
        notices: { a: 'refresh', b: 'back', d: 'calibrate' },
    };
    function notchesHtml(mode) {
        return Object.entries(BUTTON_ACTIONS[mode])
            .map(([button, action]) => `<div class="notch ${button}">${window.notchSvg(action)}</div>`)
            .join('');
    }

    function noticesHtml(notices) {
        if (!notices.length) {
            return `<section class="notices"><h1 class="notices-title">Disruptions</h1>
                <p class="empty">Nothing affecting your stops right now.</p></section>`;
        }
        const items = notices.map((n) => `
            <article class="notice">
                <div class="notice-lines">${n.lines.map((l) => badgeHtml(l.code, l.mode)).join('')}</div>
                <p class="notice-summary">${esc(n.summary)}</p>
                ${n.description ? `<p class="notice-desc">${esc(n.description)}</p>` : ''}
                ${n.until ? `<p class="notice-until">Until ${esc(n.until)}</p>` : ''}
            </article>`).join('');
        return `<section class="notices"><h1 class="notices-title">Disruptions</h1>${items}</section>`;
    }

    function transitHtml(rows, stale) {
        const warning = stale
            ? `<p class="warning">Departures not updated since ${esc(stale)}. Times may be wrong.</p>`
            : '';
        if (!rows.length) {
            return `<section class="transit">${warning}<p class="empty">No departures in the next two hours.</p></section>`;
        }
        let html = '';
        let lastStop = null;
        for (const r of rows) {
            if (r.stop !== lastStop) {
                html += `<h2 class="stop">${esc(r.stop)}</h2>`;
                lastStop = r.stop;
            }
            const times = r.times.map(timeHtml);
            while (times.length < 3) times.push('<span></span>');
            html += `
                <div class="row">
                    ${badgeHtml(r.line, r.mode, r.notice)}
                    <span class="dest">${r.direction ? window.directionIcon(r.direction) : '<span class="dir"></span>'}${esc(r.destination)}</span>
                    ${times.join('')}
                </div>`;
        }
        return `<section class="transit">${warning}${html}</section>`;
    }

    const PAGE_FONTS = ["500 18px 'IBM Plex Sans'", "700 18px 'IBM Plex Sans'", "42px 'Jacquard 12'", "20px 'Jersey 10'"];

    // Shrink rows until the departures fit the frame (down to MIN_ROW px), then drop
    // rows from the end if they still don't, so a row is never cut in half.
    const ROW = 42;
    const MIN_ROW = 34;
    function fitRows() {
        const transit = frame.querySelector('.transit');
        if (!transit) return;
        const overflowing = () => transit.scrollHeight > transit.clientHeight;
        for (let h = ROW; h >= MIN_ROW; h--) {
            frame.style.setProperty('--row-h', `${h}px`);
            if (!overflowing()) return;
        }
        const rows = [...transit.querySelectorAll('.row')];
        while (overflowing() && rows.length) {
            const row = rows.pop();
            const header = row.previousElementSibling?.classList.contains('stop') ? row.previousElementSibling : null;
            row.remove();
            if (header && !header.nextElementSibling?.classList.contains('row')) header.remove();
        }
    }

    // A destination too long for its column gets slightly smaller text (down to 15px)
    // before falling back to "…".
    function fitDestinations() {
        for (const dest of frame.querySelectorAll('.dest')) {
            for (let size = 18; size >= 15 && dest.scrollWidth > dest.clientWidth; size--) {
                dest.style.fontSize = `${size - 1}px`;
            }
        }
    }

    // Returns a promise when the page needs fonts or images before it can be laid out;
    // the renderer waits for it before taking the screenshot.
    window.renderDashboard = function (payload) {
        const { view, drawnAt } = payload;
        const mode = payload.mode;
        let ready = null;
        if (mode === 'calibrate') {
            frame.innerHTML = window.calibrationHtml(frame);
        } else if (mode === 'gothic') {
            // No teardrops here: the artwork has a medallion under each button for its icon.
            frame.innerHTML = window.gothicHtml(view, frame, BUTTON_ACTIONS.gothic);
            // Etched with window.ETCH_PARAMS if a page (the studio's Etch tab) set them, else the defaults.
            const etch = new URLSearchParams(location.search).get('etch') !== '0';
            ready = window.alignGothic(frame).then(() => (etch ? window.etchGothic(frame, window.ETCH_PARAMS) : null));
        } else if (mode === 'notices') {
            frame.innerHTML = `
                ${noticesHtml(view.notices)}
                <footer class="footer"><span></span><span>Updated ${esc(drawnAt)}</span></footer>
                ${notchesHtml(mode)}`;
        } else {
            frame.innerHTML = `
                ${weatherHtml(view.weather, view.stale.weather)}
                ${transitHtml(view.transit, view.stale.transit)}
                <footer class="footer"><span>Weather: MET Norway. Departures: Entur</span><span>Updated ${esc(drawnAt)}</span></footer>
                ${notchesHtml('normal')}`;
            // Measure only once the fonts are in: with a fallback font the rows look too
            // tall and fitRows() drops some (it did on the first render after a restart).
            ready = Promise.all(PAGE_FONTS.map((f) => document.fonts.load(f))).then(() => {
                fitDestinations();
                fitRows();
            });
        }
        document.documentElement.dataset.hash = payload.hash;
        return ready;
    };

    const params = new URLSearchParams(location.search);
    if (params.has('render')) return;

    document.body.classList.add('preview');
    const query = new URLSearchParams();
    if (params.has('mock')) query.set('mock', '1');
    if (['notices', 'calibrate', 'gothic'].includes(params.get('mode'))) query.set('mode', params.get('mode'));
    const src = `/state.json?${query}`;

    async function load() {
        try {
            const res = await fetch(src, { cache: 'no-store' });
            const body = await res.json();
            if (!res.ok) throw new Error(body.error || res.status);
            window.renderDashboard(body);
        } catch (err) {
            frame.innerHTML = `<p class="warning">Can't load the dashboard data: ${esc(err.message)}. Is the server running?</p>`;
        }
    }
    load();
    if (!params.has('mock')) setInterval(load, 15000);
})();

// ==============================================================================
// DASHBOARD OVERVIEW WIDGETS (admin-dashboard.html + seller-dashboard.html)
// KPI cards with mini bars, the sales trend chart with its period controls,
// the order status donut, the order funnel and the row of people.
// Charts are SVG coloured by CSS classes (palette variables), so the
// high-contrast mode recolours them. Every chart has its numbers in text too.
// ==============================================================================
const TJDash = (() => {
    const PAID_STATUSES = ['paid', 'processing', 'preparing', 'shipped', 'delivered', 'completed'];
    const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    const money = value => TJFormat.money(Number(value) || 0);
    const count = value => (Number(value) || 0).toLocaleString('th-TH');
    const bangkokFormat = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' });
    const today = () => bangkokFormat.format(new Date());
    const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
    const keyLength = grouping => grouping === 'day' ? 10 : grouping === 'month' ? 7 : 4;

    // "YYYY-MM-DD HH:MM:SS" (UTC, no zone) or ISO -> Bangkok calendar date
    function bangkokDate(value) {
        if (!value) return null;
        const raw = String(value);
        const date = new Date(/[TZ]/.test(raw) ? raw : raw.replace(' ', 'T') + 'Z');
        return Number.isNaN(date.getTime()) ? null : bangkokFormat.format(date);
    }

    // Seller orders -> the same daily rows as /api/admin/stats sales_daily
    // (paid orders only, product subtotal + support money, no shipping: services/salesStats.js)
    function dailyFromOrders(orders) {
        const byDate = new Map();
        for (const order of orders || []) {
            if (!PAID_STATUSES.includes(order.status)) continue;
            const date = bangkokDate(order.created_at);
            if (!date) continue;
            const row = byDate.get(date) || { date, revenue: 0, order_count: 0 };
            row.revenue += (Number(order.subtotal) || 0) + (Number(order.tip_amount) || 0);
            row.order_count += 1;
            byDate.set(date, row);
        }
        return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
    }

    // Last `size` calendar months (oldest first), the last one is the current month
    function monthBuckets(daily, size = 7) {
        const [year, month] = today().split('-').map(Number);
        const buckets = [];
        for (let i = size - 1; i >= 0; i--) {
            const date = new Date(Date.UTC(year, month - 1 - i, 1));
            buckets.push({
                key: date.toISOString().slice(0, 7),
                label: new Intl.DateTimeFormat('th-TH', { timeZone: 'UTC', month: 'short' }).format(date),
                revenue: 0, orders: 0
            });
        }
        const byKey = new Map(buckets.map(bucket => [bucket.key, bucket]));
        for (const row of daily) {
            const bucket = byKey.get(String(row.date).slice(0, 7));
            if (bucket) { bucket.revenue += Number(row.revenue) || 0; bucket.orders += Number(row.order_count) || 0; }
        }
        for (const bucket of buckets) bucket.average = bucket.orders ? bucket.revenue / bucket.orders : 0;
        return buckets;
    }

    // "↑ เพิ่มขึ้น 12.5% จากเดือนก่อน": arrow + words, so the change is not shown by colour alone
    function renderDelta(element, current, previous, compareLabel) {
        if (!element) return;
        current = Number(current) || 0;
        previous = Number(previous) || 0;
        let kind = 'flat';
        let text = `เท่ากับ${compareLabel}`;
        if (previous === 0 && current > 0) { kind = 'up'; text = `เพิ่มขึ้น (${compareLabel}ไม่มียอด)`; }
        else if (previous > 0 && current !== previous) {
            const percent = Math.abs((current - previous) / previous * 100);
            const shown = percent.toLocaleString('th-TH', { maximumFractionDigits: percent < 10 ? 1 : 0 });
            kind = current > previous ? 'up' : 'down';
            text = `${kind === 'up' ? 'เพิ่มขึ้น' : 'ลดลง'} ${shown}% จาก${compareLabel}`;
        }
        const arrow = { up: 'M12 19V5M6 11l6-6 6 6', down: 'M12 5v14M6 13l6 6 6-6', flat: 'M5 12h14' }[kind];
        element.className = `tjd-delta tjd-delta--${kind}`;
        element.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="${arrow}"/></svg><span>${esc(text)}</span>`;
    }

    // Mini bar chart on a KPI card (decorative: the numbers are written on the card)
    function sparkSvg(values) {
        const width = 104, height = 52, gap = 5;
        const max = Math.max(0, ...values);
        const barWidth = (width - gap * (values.length - 1)) / Math.max(1, values.length);
        const bars = values.map((value, index) => {
            const barHeight = max ? Math.max(4, value / max * height) : 4;
            const last = index === values.length - 1;
            return `<rect class="tjd-spark-bar${last ? ' is-on' : ''}" x="${(index * (barWidth + gap)).toFixed(1)}" y="${(height - barHeight).toFixed(1)}" width="${barWidth.toFixed(1)}" height="${barHeight.toFixed(1)}" rx="${Math.min(4, barWidth / 2).toFixed(1)}"/>`;
        }).join('');
        return `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" aria-hidden="true" focusable="false">${bars}</svg>`;
    }

    // One KPI card: big number for this month, change against last month, 7-month mini bars
    function renderKpi(prefix, { value, values, current, previous, note }) {
        const set = (suffix, text) => { const node = document.getElementById(`${prefix}-${suffix}`); if (node) node.textContent = text; };
        set('value', value);
        if (note !== undefined) set('note', note);
        renderDelta(document.getElementById(`${prefix}-delta`), current, previous, 'เดือนก่อน');
        const spark = document.getElementById(`${prefix}-spark`);
        if (spark) spark.innerHTML = sparkSvg(values);
    }

    function niceCeiling(max) {
        if (!(max > 0)) return 1;
        const power = 10 ** Math.floor(Math.log10(max));
        const step = [1, 2, 2.5, 5, 10].find(n => max / power <= n);
        return step * power;
    }
    const compact = value => value.toLocaleString('th-TH', { notation: 'compact', maximumFractionDigits: 1 });

    // Bar chart: light bars, the highest one dark with a label above it.
    // Pointer users can move the label to another bar; the table under the chart has every number.
    function barChart(element, points, options) {
        element._tjdChart = { points, ...options };
        drawBars(element);
        if (!element._tjdObserved && 'ResizeObserver' in window) {
            element._tjdObserved = true;
            let lastWidth = element.clientWidth;
            new ResizeObserver(() => {
                if (Math.abs(element.clientWidth - lastWidth) < 8) return;
                lastWidth = element.clientWidth;
                drawBars(element);
            }).observe(element);
        }
    }

    function drawBars(element) {
        const { points, field, format, label, ariaLabel, axisLabel } = element._tjdChart;
        const width = Math.max(280, Math.round(element.clientWidth || 640));
        const height = width < 480 ? 240 : 280;
        // top leaves room for the label above the tallest bar, so it never covers the date controls
        const left = 48, right = 8, top = 84, bottom = 34;
        const plotWidth = width - left - right, plotHeight = height - top - bottom;
        const values = points.map(point => Number(point[field]) || 0);
        const max = Math.max(0, ...values);
        const ceiling = niceCeiling(max);
        const slot = plotWidth / Math.max(1, points.length);
        const barWidth = Math.max(4, Math.min(46, slot * 0.62));
        const centre = index => left + (index + 0.5) * slot;
        const peak = max > 0 ? values.indexOf(max) : -1;
        let svg = `<svg class="tjd-bars-svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(ariaLabel)}">`;
        for (const step of [0, 0.5, 1]) {
            const y = top + plotHeight * (1 - step);
            svg += `<line class="tjd-gridline" x1="${left}" x2="${width - right}" y1="${y}" y2="${y}"/><text class="tjd-axis" x="${left - 8}" y="${y + 4}" text-anchor="end">${esc(compact(ceiling * step))}</text>`;
        }
        if (axisLabel) svg += `<text class="tjd-axis" x="0" y="${top - 22}">${esc(axisLabel)}</text>`;
        const every = Math.max(1, Math.ceil(points.length / Math.max(1, Math.floor(plotWidth / 58))));
        points.forEach((point, index) => {
            const value = values[index];
            const barHeight = value > 0 ? Math.max(3, plotHeight * value / ceiling) : 0;
            const y = top + plotHeight - barHeight;
            // Full-height hit area so short bars are easy to point at
            svg += `<g class="tjd-bar-group${index === peak ? ' is-on' : ''}" data-index="${index}"><rect class="tjd-bar-hit" x="${centre(index) - slot / 2}" y="${top}" width="${slot}" height="${plotHeight}"/>`;
            if (barHeight) svg += `<rect class="tjd-bar" x="${(centre(index) - barWidth / 2).toFixed(1)}" y="${y.toFixed(1)}" width="${barWidth.toFixed(1)}" height="${barHeight.toFixed(1)}" rx="${Math.min(8, barWidth / 2, barHeight / 2).toFixed(1)}"/>`;
            svg += '</g>';
            if (index % every === 0) svg += `<text class="tjd-axis" x="${centre(index)}" y="${height - 10}" text-anchor="middle">${esc(point.shortLabel || point.label)}</text>`;
        });
        svg += '</svg>';
        element.innerHTML = `${svg}<div class="tjd-tip" aria-hidden="true" hidden></div>`;
        const tip = element.querySelector('.tjd-tip');
        const show = index => {
            element.querySelectorAll('.tjd-bar-group').forEach(group => group.classList.toggle('is-on', Number(group.dataset.index) === index));
            if (index < 0 || !values[index]) { tip.hidden = true; return; }
            const barTop = top + plotHeight - Math.max(3, plotHeight * values[index] / ceiling);
            tip.innerHTML = `<span>${esc(points[index].label)}</span><strong>${esc(label)} ${esc(format(values[index]))}</strong>`;
            tip.hidden = false;
            const half = tip.offsetWidth / 2;
            tip.style.left = `${Math.min(width - half - 2, Math.max(half + 2, centre(index)))}px`;
            tip.style.top = `${Math.max(0, barTop - 10)}px`;
        };
        show(peak);
        element.querySelectorAll('.tjd-bar-group').forEach(group => group.addEventListener('pointerenter', () => show(Number(group.dataset.index))));
        element.querySelector('svg').addEventListener('pointerleave', () => show(peak));
    }

    // Donut of order statuses. groups: [{ label, count, tone (1-6) }]
    function donut(element, legend, groups, { unit = 'รายการ', always = [] } = {}) {
        const total = groups.reduce((sum, group) => sum + group.count, 0);
        const radius = 60, stroke = 22, length = 2 * Math.PI * radius;
        const shown = groups.filter(group => group.count);
        const gap = shown.length > 1 ? 3 : 0;
        let offset = 0;
        let rings = `<circle class="tjd-donut-track" cx="80" cy="80" r="${radius}" stroke-width="${stroke}"/>`;
        for (const group of shown) {
            const part = group.count / total * length;
            rings += `<circle class="tjd-tone-${group.tone}" cx="80" cy="80" r="${radius}" stroke-width="${stroke}" stroke-dasharray="${Math.max(0.5, part - gap).toFixed(2)} ${(length - Math.max(0.5, part - gap)).toFixed(2)}" stroke-dashoffset="${(-offset).toFixed(2)}" transform="rotate(-90 80 80)"/>`;
            offset += part;
        }
        const summary = total ? `${count(total)} ${unit}: ${shown.map(group => `${group.label} ${count(group.count)}`).join(', ')}` : `ยังไม่มี${unit}`;
        element.innerHTML = `<svg viewBox="0 0 160 160" width="160" height="160" role="img" aria-label="${esc(summary)}">${rings}</svg><div class="tjd-donut-centre" aria-hidden="true"><strong>${count(total)}</strong><small>${esc(unit)}</small></div>`;
        legend.innerHTML = groups.filter(group => group.count || always.includes(group.label)).map(group => {
            const percent = total ? Math.round(group.count / total * 100) : 0;
            return `<li><i class="tjd-dot tjd-tone-${group.tone}" aria-hidden="true"></i><span>${esc(group.label)}</span><strong>${count(group.count)}</strong><small>${percent}%</small></li>`;
        }).join('');
    }

    // Statuses grouped the same way on both dashboards
    function statusGroups(rows) {
        const groups = [
            { label: 'จัดส่งสำเร็จ', states: ['completed', 'delivered'], tone: 1 },
            { label: 'กำลังจัดส่ง', states: ['shipped'], tone: 2 },
            { label: 'เตรียมสินค้า / ชำระแล้ว', states: ['paid', 'processing', 'preparing'], tone: 3 },
            { label: 'รอชำระ', states: ['pending'], tone: 4 },
            { label: 'ยกเลิก', states: ['cancelled'], tone: 5 },
            { label: 'อื่น ๆ', states: [], tone: 6 }
        ].map(group => ({ ...group, count: 0 }));
        for (const row of rows) (groups.find(group => group.states.includes(row.status)) || groups.at(-1)).count += Number(row.count) || 0;
        return groups;
    }

    const ICONS = {
        cart: '<circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2 3h3l2.6 12.4a2 2 0 0 0 2 1.6h8.2a2 2 0 0 0 2-1.6L21 7H6"/>',
        card: '<rect x="2" y="5" width="20" height="14" rx="2.5"/><path d="M2 10h20M6 15h4"/>',
        truck: '<path d="M1 4h14v12H1zM15 9h4l3 3v4h-7"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/>',
        check: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>'
    };
    const icon = name => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICONS[name] || ''}</svg>`;

    // Funnel: each step with its share of the first step
    function funnel(element, stages) {
        const first = Number(stages[0]?.value) || 0;
        element.innerHTML = stages.map((stage, index) => {
            const percent = first ? Math.round((Number(stage.value) || 0) / first * 100) : 0;
            return `<li><span class="tjd-funnel-icon">${icon(stage.icon)}</span><span class="tjd-funnel-label">${esc(stage.label)}</span><strong>${count(stage.value)}</strong><small>${index === 0 ? 'ทั้งหมด' : `${percent}% ของทั้งหมด`}</small></li>`;
        }).join('');
    }

    // Row of people (avatar or first letter + first name)
    function people(element, list) {
        element.hidden = !list.length;
        element.innerHTML = list.map(person => {
            const name = String(person.name || '').trim() || 'ไม่ระบุชื่อ';
            const initial = Array.from(name)[0];
            // The letter sits under the photo and shows if the photo fails to load
            const photo = person.avatar ? `<img src="${esc(person.avatar)}" alt="" loading="lazy" onerror="this.remove()">` : '';
            return `<li><span class="tjd-person-avatar" aria-hidden="true">${esc(initial)}${photo}</span><span class="tjd-person-name">${esc(name.split(/\s+/)[0])}</span><span class="sr-only">${esc(name)}</span></li>`;
        }).join('');
    }

    // ----- sales trend card (period buttons, date controls, chart, table) -----
    function dateSeries(daily, grouping, start, end) {
        if (!validDate(start) || !validDate(end) || start > end) throw new Error('กรุณาเลือกวันที่ให้ถูกต้อง โดยวันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่มต้น');
        const cursor = new Date(`${start}T00:00:00Z`);
        if (grouping !== 'day') cursor.setUTCDate(1);
        if (grouping === 'year') cursor.setUTCMonth(0);
        const points = [];
        while (cursor.toISOString().slice(0, 10) <= end) {
            if (points.length >= 366) throw new Error('ช่วงวันที่มีมากกว่า 366 ช่วงข้อมูล กรุณาเลือกช่วงที่สั้นลง');
            const key = cursor.toISOString().slice(0, keyLength(grouping));
            const fmt = options => new Intl.DateTimeFormat('th-TH', { timeZone: 'UTC', ...options }).format(cursor);
            points.push({
                key, revenue: 0, orders: 0,
                label: grouping === 'day' ? fmt({ day: 'numeric', month: 'short', year: '2-digit' }) : grouping === 'month' ? fmt({ month: 'long', year: 'numeric' }) : fmt({ year: 'numeric' }),
                shortLabel: grouping === 'day' ? fmt({ day: 'numeric', month: 'short' }) : grouping === 'month' ? fmt({ month: 'short' }) : fmt({ year: 'numeric' })
            });
            if (grouping === 'day') cursor.setUTCDate(cursor.getUTCDate() + 1);
            else if (grouping === 'month') cursor.setUTCMonth(cursor.getUTCMonth() + 1);
            else cursor.setUTCFullYear(cursor.getUTCFullYear() + 1);
        }
        const byKey = new Map(points.map(point => [point.key, point]));
        for (const row of daily) {
            const date = String(row.date).slice(0, 10);
            if (date < start || date > end) continue;
            const point = byKey.get(date.slice(0, keyLength(grouping)));
            if (point) { point.revenue += Number(row.revenue) || 0; point.orders += Number(row.order_count) || 0; }
        }
        return points;
    }

    function periodRange(date, period) {
        const [year, month] = date.split('-').map(Number);
        if (period === 'week') {
            const monday = new Date(`${date}T00:00:00Z`);
            monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() + 6) % 7);
            const sunday = new Date(monday);
            sunday.setUTCDate(sunday.getUTCDate() + 6);
            return { start: monday.toISOString().slice(0, 10), end: sunday.toISOString().slice(0, 10), grouping: 'day' };
        }
        if (period === 'year') return { start: `${year}-01-01`, end: `${year}-12-31`, grouping: 'month' };
        if (period === 'month') return { start: `${date.slice(0, 7)}-01`, end: new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10), grouping: 'day' };
        return { start: date, end: date, grouping: 'day' };
    }

    function stepDate(value, period, direction) {
        const date = new Date(`${value}T00:00:00Z`);
        if (period === 'month' || period === 'year') {
            const day = date.getUTCDate();
            date.setUTCDate(1);
            if (period === 'month') date.setUTCMonth(date.getUTCMonth() + direction);
            else date.setUTCFullYear(date.getUTCFullYear() + direction);
            date.setUTCDate(Math.min(day, new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate()));
        } else date.setUTCDate(date.getUTCDate() + direction * (period === 'week' ? 7 : 1));
        return date.toISOString().slice(0, 10);
    }

    const sumRange = (daily, start, end) => daily.reduce((total, row) => {
        const date = String(row.date).slice(0, 10);
        return date >= start && date <= end ? total + (Number(row.revenue) || 0) : total;
    }, 0);

    // root: the trend <section>. Its parts are found by data-trend-* attributes.
    function trend(root, { period = 'month', countLabel = 'คำสั่งซื้อ' } = {}) {
        const part = name => root.querySelector(`[data-trend-${name}]`);
        const state = { daily: [], loaded: false, period, date: today() };
        const fmtDate = date => new Intl.DateTimeFormat('th-TH', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(date));
        const compareLabels = { day: 'วันก่อนหน้า', week: 'สัปดาห์ก่อน', month: 'เดือนก่อน', year: 'ปีก่อน' };

        function render(nextPeriod = state.period) {
            const now = today();
            const range = nextPeriod === 'all' ? null : periodRange(state.date, nextPeriod);
            let points;
            try {
                if (range) points = dateSeries(state.daily, range.grouping, range.start, range.end);
                else {
                    const dates = state.daily.map(row => String(row.date).slice(0, 10)).filter(validDate).sort();
                    points = dates.length ? dateSeries(state.daily, 'year', dates[0], dates.at(-1)) : [];
                }
            } catch (err) {
                part('error').textContent = err.message;
                return;
            }
            part('error').textContent = '';
            state.period = nextPeriod;
            root.querySelectorAll('[data-period]').forEach(button => {
                const on = button.dataset.period === nextPeriod;
                button.classList.toggle('active', on);
                button.setAttribute('aria-pressed', String(on));
            });

            // Date controls: a day picker, a month picker, the week label, or the year list
            // "ทั้งหมด" has no date to pick: the row keeps its place (no jump), only its controls are hidden
            const form = part('dates');
            form.classList.toggle('is-idle', nextPeriod === 'all');
            form.querySelectorAll('button, input, select').forEach(control => { control.disabled = nextPeriod === 'all'; });
            const input = part('date');
            input.type = nextPeriod === 'month' ? 'month' : 'date';
            input.hidden = nextPeriod === 'week' || nextPeriod === 'year';
            input.required = !input.hidden;
            input.setAttribute('aria-label', nextPeriod === 'month' ? 'เลือกเดือน' : 'เลือกวันที่');
            input.value = nextPeriod === 'month' ? state.date.slice(0, 7) : state.date;
            input.max = nextPeriod === 'month' ? now.slice(0, 7) : now;
            const week = part('week');
            week.hidden = nextPeriod !== 'week';
            const yearSelect = part('year');
            yearSelect.hidden = nextPeriod !== 'year';
            const currentYear = Number(now.slice(0, 4));
            const selectedYear = Number(state.date.slice(0, 4));
            yearSelect.replaceChildren();
            for (let year = currentYear; year >= Math.min(currentYear - 4, selectedYear); year--) yearSelect.add(new Option(`พ.ศ. ${year + 543} (${year})`, year, false, year === selectedYear));
            part('today').textContent = { day: 'วันนี้', week: 'สัปดาห์นี้', month: 'เดือนนี้', year: 'ปีนี้' }[nextPeriod] || 'วันนี้';
            if (range) {
                week.textContent = `${fmtDate(range.start)} – ${fmtDate(range.end)}`;
                part('next').disabled = range.end >= periodRange(now, nextPeriod).start;
            }
            if (!state.loaded) return;

            const revenue = points.reduce((sum, point) => sum + point.revenue, 0);
            const orders = points.reduce((sum, point) => sum + point.orders, 0);
            const rangeText = range ? (range.start === range.end ? fmtDate(range.start) : `${fmtDate(range.start)} – ${fmtDate(range.end)}`) : 'ทุกช่วงเวลา แยกตามปี';
            part('total').textContent = money(revenue);
            part('range').textContent = `${rangeText} · ${count(orders)} ${countLabel}`;
            const delta = part('delta');
            delta.hidden = false;
            if (range) {
                const previous = periodRange(stepDate(state.date, nextPeriod, -1), nextPeriod);
                renderDelta(delta, revenue, sumRange(state.daily, previous.start, previous.end), compareLabels[nextPeriod]);
            } else {
                delta.className = 'tjd-delta is-idle';
                delta.textContent = '';
            }
            const status = part('status');
            status.textContent = orders ? '' : 'ไม่มีคำสั่งซื้อที่ชำระแล้วในช่วงเวลานี้';
            status.hidden = orders > 0;
            barChart(part('chart'), points, {
                field: 'revenue', format: money, label: 'ยอดขาย', axisLabel: 'บาท',
                ariaLabel: `กราฟแท่งยอดขาย ${rangeText} รวม ${money(revenue)} ตัวเลขทุกช่วงอยู่ในตารางใต้กราฟ`
            });
            part('table').innerHTML = `<table class="tjd-table"><caption class="sr-only">ยอดขายและ${countLabel} ${esc(rangeText)}</caption><thead><tr><th scope="col">ช่วงเวลา</th><th scope="col">ยอดขาย (บาท)</th><th scope="col">${esc(countLabel)}</th></tr></thead><tbody>${points.map(point => `<tr><th scope="row">${esc(point.label)}</th><td>${point.revenue.toLocaleString('th-TH', { maximumFractionDigits: 2 })}</td><td>${count(point.orders)}</td></tr>`).join('')}</tbody></table>`;
        }

        root.querySelectorAll('[data-period]').forEach(button => button.addEventListener('click', () => render(button.dataset.period)));
        part('dates').addEventListener('submit', event => event.preventDefault());
        part('date').addEventListener('change', () => {
            const value = part('date').value;
            const date = state.period === 'month' ? `${value}-01` : value;
            if (!validDate(date) || date > today()) { part('error').textContent = 'กรุณาเลือกวันที่ให้ถูกต้อง (ต้องไม่เกินวันนี้)'; return; }
            state.date = date;
            render();
        });
        part('year').addEventListener('change', () => { state.date = `${part('year').value}-01-01`; render('year'); });
        root.querySelectorAll('[data-trend-step]').forEach(button => button.addEventListener('click', () => {
            state.date = [stepDate(state.date, state.period, Number(button.dataset.trendStep)), today()].sort()[0];
            render();
        }));
        part('today').addEventListener('click', () => { state.date = today(); render(); });
        render(period);

        return {
            setDaily(daily) { state.daily = Array.isArray(daily) ? daily : []; state.loaded = true; render(); },
            render
        };
    }

    return { PAID_STATUSES, esc, money, count, today, bangkokDate, dailyFromOrders, monthBuckets, renderDelta, renderKpi, barChart, donut, statusGroups, funnel, people, trend };
})();

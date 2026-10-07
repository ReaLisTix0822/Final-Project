// ==============================================================================
// ADMIN DASHBOARD CONTROLLER
// Platform stats, verification approvals, store moderation & campaigns
// ==============================================================================

async function initAdminDashboard() {
    if (!Auth.isLoggedIn()) {
        window.location.href = `/login.html?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;
        return;
    }

    const user = Auth.getUser();
    if (user.role !== 'admin') {
        alert('หน้านี้สำหรับบัญชีผู้ดูแลระบบ (Admin) เท่านั้น');
        window.location.href = '/index.html';
        return;
    }

    const name = document.getElementById('admin-topbar-name');
    const initials = document.getElementById('admin-topbar-initials');
    const avatar = document.getElementById('admin-topbar-avatar');
    if (name) name.textContent = user.full_name || 'ผู้ดูแลระบบ';
    if (initials) initials.textContent = Array.from((user.full_name || 'Admin').trim())[0] || 'A';
    if (avatar && initials && user.avatar_url) {
        avatar.onerror = () => { avatar.hidden = true; initials.hidden = false; };
        avatar.src = user.avatar_url;
        avatar.hidden = false;
        initials.hidden = true;
    }

    // Each page loads only the data it displays.
    if (document.getElementById('admin-total-revenue')) await loadAdminStats();
    if (document.getElementById('admin-stores-table-container')) await loadAdminStores();
    if (document.getElementById('admin-users-table-container')) await loadAdminUsers();
    if (document.getElementById('ai-status-pill')) await loadAiStatus();
}

let adminSalesDaily = [];
let adminSalesPeriod = 'year';
let adminSalesLoaded = false;
let adminSalesSelectedDate = null;

function buildAdminSalesSeries(daily, period, now = new Date()) {
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
    const [year, month, day] = today.split('-').map(Number);
    const count = period === 'year' ? 5 : period === 'month' ? 12 : 7;
    const points = [];
    for (let i = count - 1; i >= 0; i--) {
        const date = new Date(Date.UTC(year - (period === 'year' ? i : 0), month - 1 - (period === 'month' ? i : 0), day - (period === 'day' ? i : 0)));
        // Month/year buckets start on day one to avoid overflow at month ends.
        if (period === 'month') date.setTime(Date.UTC(year, month - 1 - i, 1));
        if (period === 'year') date.setTime(Date.UTC(year - i, 0, 1));
        const key = date.toISOString().slice(0, period === 'day' ? 10 : period === 'month' ? 7 : 4);
        const label = new Intl.DateTimeFormat('th-TH', { timeZone: 'UTC', ...(period === 'day' ? { day: 'numeric', month: 'short' } : period === 'month' ? { month: 'short', year: '2-digit' } : { year: 'numeric' }) }).format(date);
        points.push({ key, label, revenue: 0, orders: 0 });
    }
    for (const row of daily) {
        const key = String(row.date).slice(0, period === 'day' ? 10 : period === 'month' ? 7 : 4);
        const point = points.find(item => item.key === key);
        if (point) { point.revenue += Number(row.revenue) || 0; point.orders += Number(row.order_count) || 0; }
    }
    return points;
}

function buildAdminSalesDateSeries(daily, period, start, end) {
    const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
    if (!validDate(start) || !validDate(end) || start > end) throw new Error('กรุณาเลือกวันที่ให้ถูกต้อง โดยวันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่มต้น');
    const cursor = new Date(`${start}T00:00:00Z`);
    if (period !== 'day') cursor.setUTCDate(1);
    if (period === 'year') cursor.setUTCMonth(0);
    const points = [];
    while (cursor.toISOString().slice(0, 10) <= end) {
        if (points.length >= 366) throw new Error('ช่วงวันที่มีมากกว่า 366 ช่วงข้อมูล กรุณาเลือกช่วงที่สั้นลง หรือเปลี่ยนเป็นรายเดือน / รายปี');
        const key = cursor.toISOString().slice(0, period === 'day' ? 10 : period === 'month' ? 7 : 4);
        const label = new Intl.DateTimeFormat('th-TH', { timeZone: 'UTC', ...(period === 'day' ? { day: 'numeric', month: 'short', year: '2-digit' } : period === 'month' ? { month: 'short', year: '2-digit' } : { year: 'numeric' }) }).format(cursor);
        points.push({ key, label, revenue: 0, orders: 0 });
        if (period === 'day') cursor.setUTCDate(cursor.getUTCDate() + 1);
        else if (period === 'month') cursor.setUTCMonth(cursor.getUTCMonth() + 1);
        else cursor.setUTCFullYear(cursor.getUTCFullYear() + 1);
    }
    const byKey = new Map(points.map(point => [point.key, point]));
    for (const row of daily) {
        const date = String(row.date).slice(0, 10);
        if (date < start || date > end) continue;
        const point = byKey.get(date.slice(0, period === 'day' ? 10 : period === 'month' ? 7 : 4));
        if (point) { point.revenue += Number(row.revenue) || 0; point.orders += Number(row.order_count) || 0; }
    }
    return points;
}

function getAdminSalesDateRange(date, period) {
    const [year, month] = date.split('-').map(Number);
    if (period === 'week') {
        const monday = new Date(`${date}T00:00:00Z`);
        monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() + 6) % 7);
        const sunday = new Date(monday);
        sunday.setUTCDate(sunday.getUTCDate() + 6);
        return { start: monday.toISOString().slice(0, 10), end: sunday.toISOString().slice(0, 10), grouping: 'day' };
    }
    if (period === 'year') return { start: `${year}-01-01`, end: `${year}-12-31`, grouping: 'month' };
    if (period === 'month') return {
        start: `${date.slice(0, 7)}-01`,
        end: new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10),
        grouping: 'day'
    };
    return { start: date, end: date, grouping: 'day' };
}

function applyAdminSalesDates(event) {
    event.preventDefault();
    const value = document.getElementById('sales-date').value;
    const date = adminSalesPeriod === 'month' ? `${value}-01` : value;
    try {
        buildAdminSalesDateSeries([], 'day', date, date);
        if (date > getAdminToday()) throw new Error('วันที่อยู่ในอนาคต');
        adminSalesSelectedDate = date;
        document.getElementById('sales-date-error').textContent = '';
        renderAdminSales(adminSalesPeriod === 'all' ? 'day' : adminSalesPeriod);
    } catch (err) {
        document.getElementById('sales-date-error').textContent = 'กรุณาเลือกวันที่ให้ถูกต้อง';
    }
}

function resetAdminSalesDates() {
    adminSalesSelectedDate = getAdminToday();
    document.getElementById('sales-date').value = adminSalesSelectedDate;
    document.getElementById('sales-date-error').textContent = '';
    renderAdminSales(adminSalesPeriod);
}

function getAdminToday() {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

function pickAdminSalesYear(year) {
    adminSalesSelectedDate = `${year}-01-01`;
    renderAdminSales('year');
}

function stepAdminSalesDate(direction) {
    const date = new Date(`${adminSalesSelectedDate || getAdminToday()}T00:00:00Z`);
    if (adminSalesPeriod === 'month' || adminSalesPeriod === 'year') {
        const day = date.getUTCDate();
        date.setUTCDate(1);
        if (adminSalesPeriod === 'month') date.setUTCMonth(date.getUTCMonth() + direction);
        else date.setUTCFullYear(date.getUTCFullYear() + direction);
        const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
        date.setUTCDate(Math.min(day, lastDay));
    } else date.setUTCDate(date.getUTCDate() + direction * (adminSalesPeriod === 'week' ? 7 : 1));
    adminSalesSelectedDate = [date.toISOString().slice(0, 10), getAdminToday()].sort()[0];
    renderAdminSales(adminSalesPeriod);
}

async function loadAdminStats() {
    const status = document.getElementById('admin-overview-status');
    if (status) { status.hidden = false; status.textContent = 'กำลังโหลดข้อมูล...'; }
    try {
        const res = await API.get('/admin/stats');
        if (!res.success || !res.data) throw new Error(res.message || 'โหลดข้อมูลไม่สำเร็จ');
        const d = res.data;
        if (d.sales_revenue == null || d.shipped_orders == null || !Array.isArray(d.sales_daily)) {
            document.getElementById('admin-total-revenue').innerText = '—';
            document.getElementById('admin-total-shipments').innerText = '—';
            document.getElementById('admin-sales-chart').innerHTML = '';
            document.getElementById('admin-sales-table').innerHTML = '';
            adminSalesLoaded = false;
            throw new Error('ข้อมูลสรุปจากเซิร์ฟเวอร์ยังไม่ครบ กรุณารีสตาร์ตเซิร์ฟเวอร์แล้วกดรีเฟรชข้อมูล');
        }
        const money = value => `฿${Number(value || 0).toLocaleString('th-TH', { maximumFractionDigits: 2 })}`;
        document.getElementById('admin-total-revenue').innerText = money(d.sales_revenue);
        document.getElementById('admin-total-tips').innerText = money(d.total_tips);
        document.getElementById('admin-total-orders').innerText = Number(d.total_orders || 0).toLocaleString('th-TH');
        document.getElementById('admin-total-shipments').innerText = Number(d.shipped_orders || 0).toLocaleString('th-TH');
        document.getElementById('admin-total-stores').innerText = `${d.verified_stores || 0} / ${d.total_stores || 0}`;
        document.getElementById('admin-products-3d').innerText = `${d.products_with_3d || 0} / ${d.total_products || 0}`;
        renderAdminOverviewDetails(d);
        adminSalesDaily = Array.isArray(d.sales_daily) ? d.sales_daily : [];
        adminSalesLoaded = true;
        renderAdminSales(adminSalesPeriod);
    } catch (err) {
        if (status) status.textContent = `โหลดข้อมูลไม่สำเร็จ${adminSalesLoaded ? ' (ยังแสดงข้อมูลครั้งก่อน)' : ''}: ${err.message}`;
    }
}

function renderAdminSales(period) {
    if (!['all', 'day', 'week', 'month', 'year'].includes(period)) return;
    let points;
    const todayDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    if (!adminSalesSelectedDate) adminSalesSelectedDate = todayDate;
    const dateRange = period === 'all' ? null : getAdminSalesDateRange(adminSalesSelectedDate, period);
    try {
        if (period === 'all') {
            const dates = adminSalesDaily.map(row => String(row.date).slice(0, 10)).filter(date => /^\d{4}-\d{2}-\d{2}$/.test(date)).sort();
            points = dates.length ? buildAdminSalesDateSeries(adminSalesDaily, 'year', dates[0], dates.at(-1)) : [];
        } else points = dateRange
            ? buildAdminSalesDateSeries(adminSalesDaily, dateRange.grouping, dateRange.start, dateRange.end)
            : buildAdminSalesSeries(adminSalesDaily, period);
    } catch (err) {
        document.getElementById('sales-date-error').textContent = err.message;
        return;
    }
    document.getElementById('sales-date-error').textContent = '';
    adminSalesPeriod = period;
    for (const key of ['all', 'day', 'week', 'month', 'year']) {
        const button = document.getElementById(`sales-period-${key}`);
        button.classList.toggle('active', key === period);
        button.setAttribute('aria-pressed', String(key === period));
    }
    document.getElementById('admin-sales-date-form').hidden = false;
    document.querySelectorAll('#admin-sales-date-form button, #admin-sales-date-form input, #admin-sales-date-form select').forEach(control => { control.disabled = period === 'all'; });
    const dateInput = document.getElementById('sales-date');
    dateInput.type = period === 'month' ? 'month' : 'date';
    dateInput.hidden = period === 'all' || period === 'week' || period === 'year';
    dateInput.required = !dateInput.hidden;
    dateInput.value = period === 'month' ? adminSalesSelectedDate.slice(0, 7) : adminSalesSelectedDate;
    dateInput.max = period === 'month' ? todayDate.slice(0, 7) : todayDate;
    const weekLabel = document.getElementById('sales-week-label');
    weekLabel.hidden = period !== 'week';
    if (period === 'week') {
        const format = new Intl.DateTimeFormat('th-TH', { timeZone: 'UTC', day: 'numeric', month: 'short' });
        weekLabel.textContent = `${format.format(new Date(dateRange.start))} – ${format.format(new Date(dateRange.end))}`;
    }
    const yearSelect = document.getElementById('sales-year');
    yearSelect.hidden = period !== 'year' && period !== 'all';
    const currentYear = Number(todayDate.slice(0, 4));
    const selectedYear = Number(adminSalesSelectedDate.slice(0, 4));
    yearSelect.replaceChildren();
    for (let year = currentYear; year >= Math.min(currentYear - 4, selectedYear); year--) {
        yearSelect.add(new Option(`พ.ศ. ${year + 543} (${year})`, year, false, year === selectedYear));
    }
    document.getElementById('sales-today').textContent = { day: 'วันนี้', week: 'สัปดาห์นี้', month: 'เดือนนี้', year: 'ปีนี้', all: 'ปีนี้' }[period] || 'วันนี้';
    const currentRange = getAdminSalesDateRange(todayDate, period);
    document.getElementById('sales-date-next').disabled = !dateRange || dateRange.end >= currentRange.start;
    if (!adminSalesLoaded) return;
    const formatDate = date => new Intl.DateTimeFormat('th-TH', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(date));
    const range = dateRange
        ? (dateRange.start === dateRange.end ? formatDate(dateRange.start) : `${formatDate(dateRange.start)} – ${formatDate(dateRange.end)}`)
        : { all: 'ทั้งหมด · แสดงแยกตามปี', day: '7 วันล่าสุด', month: '12 เดือนล่าสุด', year: '5 ปีล่าสุด' }[period];
    document.getElementById('admin-sales-range').textContent = dateRange || period === 'all' ? range : `${range} · รวมช่วงเวลาปัจจุบัน`;
    const revenue = points.reduce((sum, point) => sum + point.revenue, 0);
    const orders = points.reduce((sum, point) => sum + point.orders, 0);
    document.getElementById('admin-overview-status').textContent = orders ? `ยอดขาย ฿${revenue.toLocaleString('th-TH', { maximumFractionDigits: 2 })} · ${orders.toLocaleString('th-TH')} คำสั่งซื้อ ใน${range}` : 'ไม่มีคำสั่งซื้อที่ชำระแล้วในช่วงเวลานี้';
    const badges = document.getElementById('admin-sales-badges');
    badges.replaceChildren();
    const peak = points.reduce((best, point) => !best || point.revenue > best.revenue ? point : best, null);
    for (const label of [`ยอดขาย ฿${revenue.toLocaleString('th-TH', { maximumFractionDigits: 2 })}`, `${orders.toLocaleString('th-TH')} คำสั่งซื้อ`, ...(peak && revenue ? [`ยอดสูงสุด: ${peak.label}`] : [])]) {
        const badge = document.createElement('span'); badge.textContent = label; badges.append(badge);
    }
    document.getElementById('admin-overview-status').hidden = orders > 0;
    const plots = [{ field: 'revenue', title: 'ยอดขาย (บาท)', color: '#1b3329', top: 50, height: 190 }, { field: 'orders', title: 'คำสั่งซื้อ (รายการ)', color: '#95571f', top: 350, height: 190 }];
    const slotWidth = 774 / Math.max(1, points.length);
    const barWidth = Math.min(48, slotWidth * 0.65);
    const barCenter = index => 64 + (index + 0.5) * slotWidth;
    let svg = '<svg viewBox="0 0 860 595" role="img" aria-label="กราฟแท่งยอดขายและคำสั่งซื้อ ข้อมูลตัวเลขอยู่ในตารางด้านล่าง">';
    for (const plot of plots) {
        const max = Math.max(1, ...points.map(point => point[plot.field]));
        const ceiling = plot.field === 'orders' ? Math.max(2, Math.ceil(max / 2) * 2) : Math.ceil(max / 2) * 2;
        svg += `<text x="0" y="${plot.top - 30}" class="admin-chart-title">${plot.title}</text>`;
        for (let step = 0; step <= 2; step++) {
            const y = plot.top + plot.height * step / 2;
            svg += `<line x1="64" x2="838" y1="${y}" y2="${y}" stroke="#e5dfd3" stroke-dasharray="4 6"/><text x="52" y="${y + 4}" text-anchor="end">${(ceiling * (1 - step / 2)).toLocaleString('th-TH', { notation: 'compact' })}</text>`;
        }
        points.forEach((point, index) => {
            const height = plot.height * point[plot.field] / ceiling;
            svg += `<rect x="${barCenter(index) - barWidth / 2}" y="${plot.top + plot.height - height}" width="${barWidth}" height="${height}" rx="${Math.min(6, barWidth / 2, height / 2)}" fill="${plot.color}"><title>${escapeAdminText(point.label)} · ${plot.title}: ${point[plot.field].toLocaleString('th-TH')}</title></rect>`;
            if (index % Math.max(1, Math.ceil(points.length / 12)) === 0) {
                const label = period === 'year' ? new Intl.DateTimeFormat('th-TH', { month: 'short', timeZone: 'UTC' }).format(new Date(`${point.key}-01T00:00:00Z`)) : point.label;
                svg += `<text x="${barCenter(index)}" y="${plot.top + plot.height + 35}" text-anchor="middle">${escapeAdminText(label)}</text>`;
            }
        });
    }
    document.getElementById('admin-sales-chart').innerHTML = svg + '</svg>';
    document.getElementById('admin-sales-table').innerHTML = `<table class="admin-users-table"><thead><tr><th scope="col">ช่วงเวลา</th><th scope="col">ยอดขาย (บาท)</th><th scope="col">คำสั่งซื้อ</th></tr></thead><tbody>${points.map(p => `<tr><th scope="row">${escapeAdminText(p.label)}</th><td>${p.revenue.toLocaleString('th-TH', { maximumFractionDigits: 2 })}</td><td>${p.orders.toLocaleString('th-TH')}</td></tr>`).join('')}</tbody></table>`;
}

let adminStores = [];
const adminStoreStatusLabels = { pending: 'รออนุมัติ', approved: 'อนุมัติแล้ว', rejected: 'ระงับ / ไม่อนุมัติ' };
const pendingStoreUpdates = new Set();

async function loadAdminStores() {
    const container = document.getElementById('admin-stores-table-container');
    const status = document.getElementById('admin-stores-status');
    if (status) status.textContent = 'กำลังโหลดข้อมูลร้านค้า...';
    try {
        const res = await API.get('/admin/stores');
        if (!res.success || !Array.isArray(res.data)) throw new Error(res.message || 'โหลดข้อมูลไม่สำเร็จ');
        adminStores = res.data;
        for (const state of ['all', 'pending', 'approved', 'rejected']) {
            const count = document.getElementById(`stores-count-${state}`);
            if (count) count.textContent = (state === 'all' ? adminStores.length : adminStores.filter(store => store.verification_status === state).length).toLocaleString('th-TH');
        }
        renderAdminStores();
    } catch (err) {
        if (status) status.textContent = `โหลดข้อมูลไม่สำเร็จ: ${err.message}`;
        if (!adminStores.length) container.textContent = 'กรุณาลองรีเฟรชข้อมูลอีกครั้ง';
    }
}

function renderAdminStores() {
    const query = (document.getElementById('admin-store-search')?.value || '').trim().toLocaleLowerCase('th-TH');
    const filter = document.getElementById('admin-store-filter')?.value || 'all';
    const rows = adminStores.filter(store => (filter === 'all' || store.verification_status === filter) &&
        [store.store_name, store.owner_name, store.owner_email, store.phone, store.province].some(value => String(value || '').toLocaleLowerCase('th-TH').includes(query)));
    const status = document.getElementById('admin-stores-status');
    if (status) status.textContent = `แสดง ${rows.length} จาก ${adminStores.length} ร้านค้า`;
    const container = document.getElementById('admin-stores-table-container');
    if (!rows.length) {
        container.innerHTML = `<p class="admin-users-empty">${query || filter !== 'all' ? 'ไม่พบร้านค้าที่ตรงกับเงื่อนไข' : 'ยังไม่มีร้านค้าในระบบ'}</p>`;
        return;
    }
    const money = value => Number.isFinite(Number(value)) ? Number(value).toLocaleString('th-TH') : '0';
    container.innerHTML = `<div class="admin-users-scroll" role="region" aria-label="ตารางร้านค้า เลื่อนแนวนอนเพื่อดูข้อมูลเพิ่มเติม" tabindex="0"><table class="admin-users-table admin-stores-table">
        <thead><tr><th scope="col">ร้านค้า / จังหวัด</th><th scope="col">เจ้าของร้าน / ติดต่อ</th><th scope="col">กลุ่มความพิการ</th><th scope="col">ทุนสะสม / เป้าหมาย</th><th scope="col">สถานะ</th><th scope="col">จัดการ</th></tr></thead>
        <tbody>${rows.map(store => {
            const id = Number(store.id);
            const name = escapeAdminText(store.store_name);
            const state = Object.hasOwn(adminStoreStatusLabels, store.verification_status) ? store.verification_status : 'unknown';
            const busy = pendingStoreUpdates.has(id) ? 'disabled' : '';
            return `<tr><td><strong>${name}</strong><small>${escapeAdminText(store.province || 'ไม่ระบุจังหวัด')}</small></td>
                <td><strong>${escapeAdminText(store.owner_name)}</strong><small>${escapeAdminText(store.owner_email)}</small><small>${escapeAdminText(store.phone || '—')}</small></td>
                <td>${escapeAdminText(store.disability_type || '—')}</td>
                <td class="admin-store-funding">฿${money(store.support_goal_current)}<small>จาก ฿${money(store.support_goal_target)}</small></td>
                <td><span class="admin-store-state state-${state}">${escapeAdminText(adminStoreStatusLabels[state] || 'ไม่ระบุสถานะ')}</span></td>
                <td><div class="admin-store-actions"><a href="/store-detail.html?id=${id}" class="btn btn-sm btn-outline-dark" aria-label="ดูร้าน ${name}">ดูร้านค้า</a>
                ${state !== 'approved' ? `<button type="button" class="btn btn-sm admin-approve-store" onclick="setStoreStatus(${id}, 'approved')" ${busy} aria-label="อนุมัติ ${name}">อนุมัติ</button>` : ''}
                ${state !== 'rejected' ? `<button type="button" class="btn btn-sm admin-delete-user" onclick="setStoreStatus(${id}, 'rejected')" ${busy} aria-label="ระงับหรือไม่อนุมัติ ${name}">${state === 'pending' ? 'ไม่อนุมัติ' : 'ระงับ'}</button>` : ''}
                </div></td></tr>`;
        }).join('')}</tbody></table></div>`;
}

let adminUsers = [];
let adminUserRoleFilter = 'all';
const adminRoleLabels = { buyer: 'ผู้ซื้อ', seller: 'ผู้ขาย', admin: 'ผู้ดูแลระบบ' };
function escapeAdminText(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

async function loadAdminUsers() {
    const container = document.getElementById('admin-users-table-container');
    const status = document.getElementById('admin-users-status');
    if (status) status.textContent = 'กำลังโหลดข้อมูลสมาชิก...';
    try {
        const res = await API.get('/admin/users');
        if (!res.success || !Array.isArray(res.data)) throw new Error(res.message || 'โหลดข้อมูลไม่สำเร็จ');
        adminUsers = res.data;
        for (const role of ['all', 'buyer', 'seller', 'admin']) {
            const count = document.getElementById(`users-count-${role}`);
            if (count) count.textContent = (role === 'all' ? adminUsers.length : adminUsers.filter(u => u.role === role).length).toLocaleString('th-TH');
        }
        renderAdminUsers();
    } catch (err) {
        if (status) status.textContent = `โหลดข้อมูลไม่สำเร็จ: ${err.message}`;
        if (!adminUsers.length) container.textContent = 'กรุณาลองรีเฟรชข้อมูลอีกครั้ง';
    }
}

function filterAdminUsers(role) {
    if (!['all', 'buyer', 'seller', 'admin'].includes(role)) return;
    adminUserRoleFilter = role;
    document.querySelectorAll('[data-user-role]').forEach(button => {
        button.setAttribute('aria-pressed', String(button.dataset.userRole === role));
    });
    renderAdminUsers();
}

function renderAdminUsers() {
    const query = (document.getElementById('admin-user-search')?.value || '').trim().toLocaleLowerCase('th-TH');
    const rows = adminUsers.filter(user =>
        (adminUserRoleFilter === 'all' || user.role === adminUserRoleFilter) &&
        [user.full_name, user.phone, user.email].some(value => String(value || '').toLocaleLowerCase('th-TH').includes(query)));
    const status = document.getElementById('admin-users-status');
    if (status) status.textContent = `แสดง ${rows.length} จาก ${adminUsers.length} สมาชิก`;
    const container = document.getElementById('admin-users-table-container');
    if (!rows.length) {
        container.innerHTML = `<p class="admin-users-empty">${query || adminUserRoleFilter !== 'all' ? 'ไม่พบสมาชิกที่ตรงกับคำค้นหาและตัวกรอง' : 'ยังไม่มีสมาชิกในระบบ'}</p>`;
        return;
    }
    container.innerHTML = `<div class="admin-users-scroll" role="region" aria-label="ตารางสมาชิก เลื่อนแนวนอนเพื่อดูข้อมูลเพิ่มเติม" tabindex="0"><table class="admin-users-table">
        <thead><tr><th scope="col">ชื่อสมาชิก</th><th scope="col">เบอร์โทร</th><th scope="col">อีเมล</th><th scope="col">บทบาทสมาชิก</th><th scope="col">วันที่สมัคร</th><th scope="col">จัดการ</th></tr></thead>
        <tbody>${rows.map(user => {
            const id = Number(user.id);
            const name = escapeAdminText(user.full_name);
            const role = Object.hasOwn(adminRoleLabels, user.role) ? user.role : 'buyer';
            const protectedUser = user.role === 'admin' || id === Number(Auth.getUser()?.id);
            const date = new Date(user.created_at);
            return `<tr><td><strong>${name}</strong></td><td>${escapeAdminText(user.phone || '—')}</td><td>${escapeAdminText(user.email)}</td>
                <td><span class="admin-user-role role-${role}">${escapeAdminText(adminRoleLabels[user.role] || user.role)}</span></td>
                <td>${Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('th-TH')}</td>
                <td><div class="admin-user-actions"><button type="button" class="btn btn-sm btn-outline-dark" onclick="editAdminUser(${id})" aria-label="แก้ไข ${name}">✎ แก้ไข</button>
                <button type="button" class="btn btn-sm admin-delete-user" onclick="deleteAdminUser(${id}, this)" ${protectedUser ? 'disabled title="ไม่สามารถลบบัญชีผู้ดูแลระบบหรือบัญชีตนเอง"' : ''} aria-label="ลบ ${name}">ลบ</button></div></td></tr>`;
        }).join('')}</tbody></table></div>`;
}

function editAdminUser(id) {
    const user = adminUsers.find(item => Number(item.id) === id);
    if (!user) return;
    document.getElementById('admin-edit-user-id').value = id;
    document.getElementById('admin-edit-user-name').value = user.full_name || '';
    document.getElementById('admin-edit-user-phone').value = user.phone || '';
    document.getElementById('admin-edit-user-email').value = user.email || '';
    document.getElementById('admin-user-form-status').textContent = '';
    document.getElementById('admin-user-dialog').showModal();
    document.getElementById('admin-edit-user-name').focus();
}

async function saveAdminUser(event) {
    event.preventDefault();
    const button = document.getElementById('admin-user-save');
    if (button.disabled) return;
    const status = document.getElementById('admin-user-form-status');
    const id = Number(document.getElementById('admin-edit-user-id').value);
    const payload = {
        full_name: document.getElementById('admin-edit-user-name').value.trim(),
        phone: document.getElementById('admin-edit-user-phone').value.trim(),
        email: document.getElementById('admin-edit-user-email').value.trim()
    };
    button.disabled = true;
    status.textContent = 'กำลังบันทึก...';
    try {
        const res = await API.put(`/admin/users/${id}`, payload);
        if (!res.success) throw new Error(res.message || 'บันทึกไม่สำเร็จ');
        const current = Auth.getUser();
        if (Number(current?.id) === id) Auth.saveSession(API.getToken(), { ...current, ...payload }, Auth.getStore());
        document.getElementById('admin-user-dialog').close();
        window.showToast('บันทึกข้อมูลสมาชิกแล้ว', 'success');
        await loadAdminUsers();
    } catch (err) {
        status.textContent = err.message;
    } finally {
        button.disabled = false;
    }
}

async function deleteAdminUser(id, button) {
    const user = adminUsers.find(item => Number(item.id) === id);
    if (!user || button.disabled) return;
    if (!window.confirm(`ลบบัญชีของ ${user.full_name} (${user.email}) ถาวรหรือไม่? บัญชีที่มีร้านค้า คำสั่งซื้อ หรือประวัติการใช้งานจะไม่สามารถลบได้`)) return;
    button.disabled = true;
    try {
        const res = await API.delete(`/admin/users/${id}`);
        if (!res.success) throw new Error(res.message || 'ลบไม่สำเร็จ');
        await loadAdminUsers();
        window.showToast('ลบบัญชีสมาชิกแล้ว', 'success');
    } catch (err) {
        window.showToast(err.message, 'error');
    } finally {
        button.disabled = false;
    }
}

async function setStoreStatus(storeId, status) {
    if (!['approved', 'rejected'].includes(status) || pendingStoreUpdates.has(storeId)) return;
    const store = adminStores.find(item => Number(item.id) === storeId);
    if (status === 'rejected' && !window.confirm(`ยืนยันระงับ / ไม่อนุมัติร้าน ${store?.store_name || storeId} หรือไม่? ร้านจะไม่ปรากฏในรายการร้านค้าที่อนุมัติ`)) return;
    pendingStoreUpdates.add(storeId);
    renderAdminStores();
    try {
        const res = await API.put(`/admin/stores/${storeId}/verify`, { status });
        if (!res.success) throw new Error(res.message || 'เปลี่ยนสถานะไม่สำเร็จ');
        window.showToast(res.message, 'success');
        await loadAdminStores();
        if (document.getElementById('admin-total-revenue')) await loadAdminStats();
    } catch (err) {
        window.showToast(`เกิดข้อผิดพลาด: ${err.message}`, 'error');
    } finally {
        pendingStoreUpdates.delete(storeId);
        renderAdminStores();
    }
}

async function handleCreateCampaign(e) {
    e.preventDefault();
    const submit = document.getElementById('campaign-submit');
    if (submit.disabled) return;
    const status = document.getElementById('campaign-status');
    status.textContent = '';
    const payload = {
        title: document.getElementById('camp-title').value.trim(),
        location: document.getElementById('camp-location').value.trim(),
        start_date: document.getElementById('camp-start').value,
        end_date: document.getElementById('camp-end').value,
        image_url: document.getElementById('camp-image').value.trim(),
        description: document.getElementById('camp-desc').value.trim()
    };

    if (payload.end_date < payload.start_date) {
        status.textContent = 'วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่มต้น';
        document.getElementById('camp-end').focus();
        return;
    }
    submit.disabled = true;
    submit.textContent = 'กำลังสร้างแคมเปญ...';
    try {
        const res = await API.post('/campaigns', payload);
        if (res.success) {
            window.showToast('สร้างแคมเปญเรียบร้อยแล้ว', 'success');
            document.getElementById('campaign-form').reset();
            status.textContent = 'สร้างแคมเปญเรียบร้อยแล้ว';
        } else {
            throw new Error(res.message || 'ไม่สามารถสร้างแคมเปญได้');
        }
    } catch (err) {
        status.textContent = `สร้างแคมเปญไม่สำเร็จ: ${err.message}`;
        window.showToast(status.textContent, 'error');
    } finally {
        submit.disabled = false;
        submit.textContent = 'สร้างแคมเปญ';
    }
}

async function loadAiStatus() {
    const pill = document.getElementById('ai-status-pill');
    if (!pill) return;

    try {
        const res = await API.get('/ai/status');
        if (res.success) {
            if (res.configured) {
                pill.style.background = '#e8f5ee';
                pill.style.borderColor = '#a3d9b4';
                pill.style.color = '#166534';
                pill.innerHTML = `ใช้งาน ${res.model} (Free Tier พร้อมใช้งาน)`;
            } else {
                pill.style.background = '#fef3e7';
                pill.style.borderColor = '#fad29a';
                pill.style.color = '#b4532a';
                pill.innerHTML = `ใช้ระบบอัจฉริยะสำรอง (พร้อมใส่ API Key)`;
            }
        }
    } catch (err) {
        pill.innerText = 'ตรวจสอบสถานะไม่ได้';
    }
}

async function saveGeminiKey() {
    const keyInput = document.getElementById('gemini-api-key-input');
    const key = keyInput.value.trim();

    if (!key) {
        alert('กรุณากรอก API Key ก่อนบันทึกครับ');
        keyInput.focus();
        return;
    }

    try {
        const res = await API.post('/ai/set-key', { apiKey: key });
        if (res.success) {
            window.showToast(res.message, 'success');
            keyInput.value = '';
            await loadAiStatus();
        }
    } catch (err) {
        window.showToast(`บันทึกไม่สำเร็จ: ${err.message}`, 'error');
    }
}

async function handleCampaignImageUpload(input) {
    if (!input || !input.files || !input.files[0]) return;
    const file = input.files[0];
    const uploadText = document.getElementById('camp-upload-text');
    const prevText = uploadText ? uploadText.innerText : 'อัปโหลด';

    try {
        if (uploadText) uploadText.innerText = 'กำลังอัปโหลด...';
        const formData = new FormData();
        formData.append('image', file);

        const res = await API.request('/products/upload', {
            method: 'POST',
            body: formData
        });

        if (res.success && res.imageUrl) {
            document.getElementById('camp-image').value = new URL(res.imageUrl, window.location.origin).href;
            if (window.showToast) window.showToast('อัปโหลดรูปภาพแบนเนอร์เรียบร้อยแล้ว', 'success');
        } else {
            throw new Error(res.message || 'อัปโหลดไม่สำเร็จ');
        }
    } catch (err) {
        alert(`เกิดข้อผิดพลาดในการอัปโหลด: ${err.message}`);
    } finally {
        if (uploadText) uploadText.innerText = prevText;
        input.value = '';
    }
}

document.addEventListener('DOMContentLoaded', initAdminDashboard);

function renderAdminOverviewDetails(data) {
    const number = value => Number(value) || 0;
    const money = value => `฿${number(value).toLocaleString('th-TH', { maximumFractionDigits: 2 })}`;
    const text = (id, value) => { const node = document.getElementById(id); if (node) node.textContent = value; };
    text('admin-average-order', money(data.average_order_value));
    text('admin-average-note', `ยอดขายรวม ÷ ${number(data.paid_order_count).toLocaleString('th-TH')} ออเดอร์ที่ชำระแล้ว`);
    text('admin-shipped-note', `(สะสมทั้งหมด) · ${data.total_orders ? Math.round(number(data.shipped_orders) / number(data.total_orders) * 100) : 0}%`);
    const percent = data.total_products ? Math.round(number(data.products_with_3d) / number(data.total_products) * 100) : 0;
    text('admin-products-percent', `${percent}%`);
    document.getElementById('admin-products-progress').value = percent;
    const labels = { completed: 'จัดส่งสำเร็จ', delivered: 'จัดส่งสำเร็จ', shipped: 'กำลังจัดส่ง', paid: 'ชำระแล้ว', processing: 'กำลังเตรียมสินค้า', preparing: 'กำลังเตรียมสินค้า', pending: 'รอชำระ', cancelled: 'ยกเลิก' };
    const groups = [
        { label: 'จัดส่งสำเร็จ', states: ['completed', 'delivered'], color: '#1b3329' },
        { label: 'กำลังจัดส่ง', states: ['shipped'], color: '#4f8068' },
        { label: 'เตรียมสินค้า / ชำระแล้ว', states: ['paid', 'processing', 'preparing'], color: '#df8a28' },
        { label: 'รอชำระ', states: ['pending'], color: '#95571f' },
        { label: 'ยกเลิก', states: ['cancelled'], color: '#bd2525' },
        { label: 'อื่น ๆ', states: [], color: '#84928a' }
    ];
    for (const group of groups) group.count = 0;
    for (const row of data.order_statuses || []) (groups.find(group => group.states.includes(row.status)) || groups.at(-1)).count += number(row.count);
    const total = groups.reduce((sum, group) => sum + group.count, 0);
    let position = 0; const stops = []; const legend = document.getElementById('order-status-legend'); legend.replaceChildren();
    for (const group of groups) {
        if (group.count) { const end = position + group.count / total * 100; stops.push(`${group.color} ${position}% ${end}%`); position = end; }
        if (!group.count && !['จัดส่งสำเร็จ', 'รอชำระ', 'ยกเลิก'].includes(group.label)) continue;
        const li = document.createElement('li'); const dot = document.createElement('i'); dot.style.background = group.color; dot.setAttribute('aria-hidden', 'true');
        const label = document.createElement('span'); label.textContent = group.label;
        const count = document.createElement('strong'); count.textContent = group.count;
        li.append(dot, label, count); legend.append(li);
    }
    const donut = document.getElementById('order-status-donut'); donut.style.background = total ? `conic-gradient(${stops.join(',')})` : '#ede8dc';
    donut.setAttribute('aria-label', `คำสั่งซื้อทั้งหมด ${total} รายการ ${groups.filter(g => g.count).map(g => `${g.label} ${g.count}`).join(', ')}`);
    text('order-status-total', total);
    const esc = escapeAdminText;
    document.getElementById('overview-recent-orders').innerHTML = (data.recent_orders || []).length ? `<table><thead><tr><th>รายการ</th><th>ผู้รับ</th><th>ยอดรวม</th><th>ขนส่ง / พัสดุ</th><th>สถานะ</th></tr></thead><tbody>${data.recent_orders.map(order => `<tr><td>#${esc(order.id)}</td><td>${esc(order.shipping_name || order.buyer_name || '—')}</td><td><strong>${money(order.grand_total)}</strong></td><td>${esc(order.tracking_number ? `${order.courier_name || ''} · ${order.tracking_number}` : '—')}</td><td><span class="overview-status-badge">${esc(labels[order.status] || order.status)}</span></td></tr>`).join('')}</tbody></table>` : '<p>ยังไม่มีคำสั่งซื้อ</p>';
    const disabilities = { visual: 'สายตา', hearing: 'การได้ยิน', physical: 'การเคลื่อนไหว', intellectual: 'สติปัญญา', autism: 'ออทิสติก' };
    document.getElementById('overview-approved-stores').innerHTML = (data.approved_stores || []).length ? data.approved_stores.map(store => `<a class="overview-store-row" href="/store-detail.html?id=${encodeURIComponent(store.id)}"><span><strong>${esc(store.store_name)}</strong><small>${esc(disabilities[store.disability_type] || store.disability_type || 'ช่างฝีมือ')}</small></span><span class="overview-status-badge">อนุมัติแล้ว</span></a>`).join('') : '<p>ยังไม่มีร้านค้าที่อนุมัติ</p>';
}

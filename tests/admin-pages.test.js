const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '../public');
const source = fs.readFileSync(path.join(root, 'js/admin.js'), 'utf8');
const pages = {
    'admin-dashboard.html': '/admin/stats',
    'admin-stores.html': '/admin/stores',
    'admin-users.html': '/admin/users',
    'admin-ai-settings.html': '/ai/status',
    'admin-campaigns.html': null,
    'admin-profile.html': null
};
function makeNode() {
    return {
        value: '', innerHTML: '', textContent: '', style: {}, classList: { add() {}, remove() {}, toggle() {} },
        setAttribute() {}, focus() { this.focused = true; }, reset() { this.didReset = true; },
        replaceChildren(...children) { this.children = children; },
        appendChild(child) { if (!this.children) this.children = []; this.children.push(child); return child; },
        append(...children) { if (!this.children) this.children = []; this.children.push(...children); },
        add(option) { if (!this.options) this.options = []; this.options.push(option); if (!this.children) this.children = []; this.children.push(option); }
    };
}
function setup(file, role = 'admin') {
    const html = fs.readFileSync(path.join(root, file), 'utf8');
    const nodes = Object.fromEntries([...html.matchAll(/\bid="([^"]+)"/g)].map(m => [m[1], makeNode()]));
    const calls = [];
    const context = {
        document: {
            getElementById: id => nodes[id] || null,
            querySelector: () => null,
            querySelectorAll: () => [],
            addEventListener() {},
            createElement: () => makeNode()
        },
        window: { location: { pathname: '/' + file, search: '', origin: 'http://localhost' }, showToast() {} },
        Auth: { isLoggedIn: () => role !== null, getUser: () => ({ role, full_name: 'Admin' }) },
        API: { get: async url => { calls.push(url); return { success: true, data: url === '/admin/stats' ? { sales_revenue: 0, shipped_orders: 0, sales_daily: [] } : [] }; },
            post: async (url, body) => { calls.push({ url, body }); return { success: true }; } },
        alert() {}, console, URL, encodeURIComponent,
        Option: class Option { constructor(text = '', value = '') { this.text = text; this.value = value; } }
    };
    vm.createContext(context);
    vm.runInContext(source, context);
    return { html, nodes, calls, context };
}
for (const [file, endpoint] of Object.entries(pages)) {
    test(`${file}: independent content, navigation and data loading`, async () => {
        const { html, calls, context } = setup(file);
        const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
        assert.equal(ids.length, new Set(ids).size);
        assert.equal((html.match(/<h1\b/g) || []).length, 1);
        assert.equal((html.match(/aria-current="page"/g) || []).length, 2);
        assert.ok(html.includes(`href="/${file}" class="admin-menu-link active" aria-current="page"`));
        for (const target of Object.keys(pages)) assert.ok(html.includes(`href="/${target}"`));
        assert.ok(!html.includes('campaign-modal'));
        assert.equal(html.includes('id="campaign-form"'), file === 'admin-campaigns.html');
        await context.initAdminDashboard();
        assert.deepEqual(calls, endpoint ? [endpoint] : []);
    });
    test(`${file}: protects entry and preserves login destination`, async () => {
        const guest = setup(file, null);
        await guest.context.initAdminDashboard();
        assert.equal(guest.context.window.location.href, '/login.html?redirect=' + encodeURIComponent('/' + file));
        assert.equal(guest.calls.length, 0);
        const buyer = setup(file, 'buyer');
        await buyer.context.initAdminDashboard();
        assert.equal(buyer.context.window.location.href, '/index.html');
        assert.equal(buyer.calls.length, 0);
    });
}
test('store approval refreshes its table without loading overview elements', async () => {
    const { context, calls } = setup('admin-stores.html');
    context.API.put = async () => ({ success: true });
    await context.setStoreStatus(1, 'approved');
    assert.deepEqual(calls, ['/admin/stores']);
});
test('campaign page validates dates and resets form after successful creation', async () => {
    const { context, nodes, calls } = setup('admin-campaigns.html');
    nodes['camp-start'].value = '2026-10-02';
    nodes['camp-end'].value = '2026-10-01';
    await context.handleCreateCampaign({ preventDefault() {} });
    assert.equal(calls.length, 0);
    assert.equal(nodes['camp-end'].focused, true);
    nodes['camp-end'].value = '2026-10-03';
    await context.handleCreateCampaign({ preventDefault() {} });
    assert.equal(calls[0].url, '/campaigns');
    assert.equal(nodes['campaign-form'].didReset, true);
    assert.equal(nodes['campaign-submit'].disabled, false);
    assert.match(nodes['campaign-status'].textContent, /เรียบร้อย/);
});

test('user search matches contact fields and escapes user supplied markup', async () => {
    const { context, nodes } = setup('admin-users.html');
    context.API.get = async () => ({ success: true, data: [
        { id: 2, full_name: '<img src=x onerror=alert(1)>', phone: '0812345678', email: 'seller@example.com', role: 'seller', created_at: '2026-01-01' },
        { id: 3, full_name: 'ผู้ซื้อ', phone: '0999999999', email: 'buyer@example.com', role: 'buyer', created_at: '2026-01-02' }
    ] });
    await context.loadAdminUsers();
    assert.equal(nodes['users-count-all'].textContent, '2');
    assert.ok(nodes['admin-users-table-container'].innerHTML.includes('&lt;img'));
    for (const query of ['seller@', '081234', '<img']) {
        nodes['admin-user-search'].value = query;
        context.renderAdminUsers();
        assert.match(nodes['admin-users-status'].textContent, /แสดง 1 จาก 2/);
    }
    nodes['admin-user-search'].value = 'ไม่พบ';
    context.renderAdminUsers();
    assert.match(nodes['admin-users-table-container'].innerHTML, /ไม่พบสมาชิก/);
});

test('store search combines status and contact filters while counts remain global', async () => {
    const { context, nodes } = setup('admin-stores.html');
    context.API.get = async () => ({ success: true, data: [
        { id: 1, store_name: '<script>alert(1)</script>', owner_name: 'ช่างเอ', owner_email: 'a@example.com', province: 'ขอนแก่น', phone: '0812345678', verification_status: 'pending', support_goal_current: '1200.50', support_goal_target: '10000' },
        { id: 2, store_name: 'ร้านบี', owner_name: 'ช่างบี', province: 'ขอนแก่น', verification_status: 'approved' },
        { id: 3, store_name: 'ร้านซี', province: 'กรุงเทพ', verification_status: 'rejected' }
    ] });
    await context.loadAdminStores();
    assert.equal(nodes['stores-count-all'].textContent, '3');
    assert.equal(nodes['stores-count-pending'].textContent, '1');
    assert.ok(nodes['admin-stores-table-container'].innerHTML.includes('&lt;script&gt;'));
    nodes['admin-store-filter'].value = 'pending';
    for (const query of ['ขอนแก่น', 'ช่างเอ', 'a@example', '081234']) {
        nodes['admin-store-search'].value = query;
        context.renderAdminStores();
        assert.match(nodes['admin-stores-status'].textContent, /แสดง 1 จาก 3/);
    }
    assert.equal(nodes['stores-count-all'].textContent, '3');
    nodes['admin-store-search'].value = 'กรุงเทพ';
    context.renderAdminStores();
    assert.match(nodes['admin-stores-table-container'].innerHTML, /ไม่พบร้านค้า/);
});

test('store rejection requires confirmation; failed updates can be retried', async () => {
    const { context } = setup('admin-stores.html');
    let updates = 0;
    context.API.put = async () => { updates++; throw new Error('offline'); };
    context.window.confirm = () => false;
    await context.setStoreStatus(1, 'rejected');
    assert.equal(updates, 0);
    context.window.confirm = () => true;
    await context.setStoreStatus(1, 'rejected');
    await context.setStoreStatus(1, 'rejected');
    assert.equal(updates, 2);
    await context.setStoreStatus(1, 'invalid');
    assert.equal(updates, 2);
});


test('sales series fills gaps and handles month/year boundaries in Bangkok', () => {
    const { context } = setup('admin-dashboard.html');
    const daily = [{ date: '2026-12-31', revenue: '100.50', order_count: 1 }, { date: '2027-01-01', revenue: 200, order_count: 2 }];
    const now = new Date('2026-12-31T18:00:00Z');
    const days = context.buildAdminSalesSeries(daily, 'day', now);
    assert.equal(days.length, 7);
    assert.equal(days.at(-1).key, '2027-01-01');
    assert.equal(days.at(-1).revenue, 200);
    assert.equal(days.at(-2).revenue, 100.5);
    assert.equal(days[0].orders, 0);
    const months = context.buildAdminSalesSeries(daily, 'month', new Date('2027-03-31T12:00:00Z'));
    assert.equal(months.length, 12);
    assert.equal(new Set(months.map(p => p.key)).size, 12);
    assert.equal(months.at(-2).key, '2027-02');
    const years = context.buildAdminSalesSeries(daily, 'year', now);
    assert.equal(years.at(-2).revenue, 100.5);
    assert.equal(years.at(-1).orders, 2);
});

test('overview renders real totals, graph/table and an empty period', async () => {
    const { context, nodes } = setup('admin-dashboard.html');
    context.API.get = async () => ({ success: true, data: { sales_revenue: 250, total_orders: 4, shipped_orders: 2, sales_daily: [] } });
    await context.loadAdminStats();
    assert.equal(nodes['admin-total-revenue'].innerText, '฿250');
    assert.equal(nodes['admin-total-orders'].innerText, '4');
    assert.equal(nodes['admin-total-shipments'].innerText, '2');
    assert.match(nodes['admin-overview-status'].textContent, /ไม่มีคำสั่งซื้อ/);
    context.renderAdminSales('month');
    assert.match(nodes['admin-sales-range'].textContent, /12 เดือน|\d{1,2} [^\s]+ \d{4}/);
    assert.match(nodes['admin-sales-chart'].innerHTML, /<svg/);
    assert.ok([12, 28, 29, 30, 31].includes((nodes['admin-sales-table'].innerHTML.match(/<th scope="row">/g) || []).length));
    context.API.get = async () => { throw new Error('offline'); };
    await context.loadAdminStats();
    assert.match(nodes['admin-overview-status'].textContent, /ยังแสดงข้อมูลครั้งก่อน/);
});

test('custom sales dates include both boundaries and exclude outside days in monthly totals', () => {
    const { context } = setup('admin-dashboard.html');
    const rows = ['2024-02-01', '2024-02-28', '2024-02-29', '2024-03-01', '2024-03-02'].map(date => ({ date, revenue: 100, order_count: 1 }));
    const days = context.buildAdminSalesDateSeries(rows, 'day', '2024-02-28', '2024-03-01');
    assert.equal(days.length, 3);
    assert.equal(days[1].key, '2024-02-29');
    const months = context.buildAdminSalesDateSeries(rows, 'month', '2024-02-28', '2024-03-01');
    assert.equal(months[0].revenue, 200);
    assert.equal(months[1].revenue, 100);
    assert.throws(() => context.buildAdminSalesDateSeries(rows, 'day', '2024-03-01', '2024-02-28'));
    assert.throws(() => context.buildAdminSalesDateSeries(rows, 'day', '2024-02-30', '2024-03-01'));
    assert.throws(() => context.buildAdminSalesDateSeries(rows, 'day', '2020-01-01', '2024-03-01'));
});

test('date form supports a single day, grouping, refresh, validation and reset', async () => {
    const { context, nodes } = setup('admin-dashboard.html');
    context.API.get = async () => ({ success: true, data: { sales_revenue: 0, shipped_orders: 0, sales_daily: [{ date: '2024-02-29', revenue: 250, order_count: 1 }] } });
    await context.loadAdminStats();
    nodes['sales-date'].value = '2024-02-29';
    context.applyAdminSalesDates({ preventDefault() {} });
    assert.match(nodes['admin-overview-status'].textContent, /250/);
    assert.doesNotMatch(nodes['admin-sales-chart'].innerHTML, /NaN|Infinity/);
    context.renderAdminSales('month');
    assert.equal((nodes['admin-sales-table'].innerHTML.match(/<th scope="row">/g) || []).length, 29);
    context.renderAdminSales('year');
    assert.equal((nodes['admin-sales-table'].innerHTML.match(/<th scope="row">/g) || []).length, 12);
    context.renderAdminSales('month');
    await context.loadAdminStats();
    assert.match(nodes['admin-overview-status'].textContent, /250/);
    nodes['sales-date'].value = '';
    context.applyAdminSalesDates({ preventDefault() {} });
    assert.match(nodes['sales-date-error'].textContent, /เลือกวันที่/);
    context.resetAdminSalesDates();
    assert.match(nodes['sales-date'].value, /^\d{4}-\d{2}$/);
    assert.match(nodes['admin-sales-range'].textContent, /12 เดือน|\d{1,2} [^\s]+ \d{4}/);
});

test('overview all includes old years; weekly selection spans Monday to Sunday across years', async () => {
    const { context, nodes } = setup('admin-dashboard.html');
    context.getAdminToday = () => '2027-01-05';
    context.API.get = async () => ({ success: true, data: { sales_revenue: 0, shipped_orders: 0, sales_daily: [
        { date: '2020-06-01', revenue: 100, order_count: 1 },
        { date: '2026-12-28', revenue: 200, order_count: 1 },
        { date: '2027-01-03', revenue: 300, order_count: 1 },
        { date: '2027-01-04', revenue: 400, order_count: 1 }
    ] } });
    await context.loadAdminStats();
    context.renderAdminSales('all');
    assert.match(nodes['admin-overview-status'].textContent, /1,000/);
    assert.equal(nodes['admin-sales-date-form'].hidden, false);
    const range = context.getAdminSalesDateRange('2027-01-03', 'week');
    assert.equal(range.start, '2026-12-28');
    assert.equal(range.end, '2027-01-03');
    nodes['sales-date'].value = '2027-01-03';
    context.applyAdminSalesDates({ preventDefault() {} });
    context.renderAdminSales('week');
    assert.equal(nodes['admin-sales-date-form'].hidden, false);
    assert.match(nodes['admin-overview-status'].textContent, /500/);
    assert.equal((nodes['admin-sales-table'].innerHTML.match(/<th scope="row">/g) || []).length, 7);
    context.renderAdminSales('all');
    assert.match(nodes['admin-overview-status'].textContent, /1,000/);
});


test('admin profile fills account fields without requesting orders or favorites', async () => {
    const { context, nodes, calls } = setup('admin-profile.html');
    vm.runInContext(fs.readFileSync(path.join(root, 'js/profile.js'), 'utf8'), context);
    context.Auth.getUser = () => ({ id: 1, role: 'admin', full_name: 'Admin Test', email: 'admin@example.com', phone: '0800000000', bio: 'About me' });
    await context.initProfilePage();
    assert.equal(nodes['edit-fullname'].value, 'Admin Test');
    assert.equal(nodes['edit-email'].value, 'admin@example.com');
    assert.equal(nodes['admin-topbar-name'].textContent, 'Admin Test');
    assert.equal(calls.length, 0);
    context.Auth.getUser = () => ({ role: 'buyer' });
    await context.initProfilePage();
    assert.equal(context.window.location.href, '/index.html');
});


test('old stats API reports missing data instead of false zero totals', async () => {
    const { context, nodes } = setup('admin-dashboard.html');
    context.API.get = async () => ({ success: true, data: { total_orders: 2, total_revenue: '1690.00' } });
    await context.loadAdminStats();
    assert.equal(nodes['admin-total-revenue'].innerText, '—');
    assert.equal(nodes['admin-total-shipments'].innerText, '—');
    assert.match(nodes['admin-overview-status'].textContent, /รีสตาร์ตเซิร์ฟเวอร์/);
});

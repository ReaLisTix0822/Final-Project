const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const sqlite3 = require('sqlite3');
const path = require('node:path');

test('user API authorization, editing and deletion preserve dependent data', async () => {
    const sqlite = new sqlite3.Database(':memory:');
    const db = {
        getDriver: () => 'sqlite',
        all: (sql, args) => new Promise((resolve, reject) => sqlite.all(sql, args, (e, rows) => e ? reject(e) : resolve(rows))),
        get: (sql, args) => new Promise((resolve, reject) => sqlite.get(sql, args, (e, row) => e ? reject(e) : resolve(row))),
        run: (sql, args) => new Promise((resolve, reject) => sqlite.run(sql, args, function(e) { e ? reject(e) : resolve({ affectedRows: this.changes }); }))
    };
    try {
        await new Promise((resolve, reject) => sqlite.exec(fs.readFileSync(path.join(__dirname, '../db/schema.sqlite.sql'), 'utf8'), e => e ? reject(e) : resolve()));
        for (const [id, role] of [[1, 'admin'], [2, 'buyer'], [3, 'buyer'], [4, 'admin']]) {
            await db.run('INSERT INTO users(id, email, full_name, password_hash, role) VALUES (?, ?, ?, ?, ?)', [id, `u${id}@example.com`, `User ${id}`, 'hash', role]);
        }
        const routes = {};
        const authenticate = () => {};
        const adminGuard = () => {};
        const router = Object.fromEntries(['get', 'put', 'delete'].map(method => [method, (url, ...handlers) => routes[`${method} ${url}`] = handlers]));
        const context = { module: { exports: {} }, require(name) {
            if (name === 'express') return { Router: () => router };
            if (name === '../config/database') return db;
            if (name === '../middleware/auth') return { authenticate, authorize(role) { assert.equal(role, 'admin'); return adminGuard; } };
            throw new Error(name);
        } };
        vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../routes/admin.js'), 'utf8'), context);
        for (const route of ['get /users', 'put /users/:id', 'delete /users/:id']) {
            assert.equal(routes[route][0], authenticate);
            assert.equal(routes[route][1], adminGuard);
        }
        async function call(method, id, body = {}) {
            const res = { code: 200, status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; } };
            await routes[`${method} /users/:id`].at(-1)({ params: { id: String(id) }, body, user: { id: 1 } }, res, e => { throw e; });
            return res;
        }
        assert.equal((await call('put', 2, { full_name: ' ', email: 'bad' })).code, 400);
        assert.equal((await call('put', 2, { full_name: 'New', email: 'u1@example.com' })).code, 409);
        assert.equal((await call('put', 2, { full_name: 'New', email: 'new@example.com', phone: '0812345678', role: 'admin' })).code, 200);
        const edited = await db.get('SELECT * FROM users WHERE id = 2');
        assert.equal(edited.full_name, 'New');
        assert.equal(edited.role, 'buyer');
        assert.equal((await call('delete', 1)).code, 403);
        assert.equal((await call('delete', 4)).code, 403);
        await db.run('INSERT INTO chat_messages(sender_id, receiver_id, message) VALUES (2, 3, ?)', ['Keep history']);
        assert.equal((await call('delete', 2)).code, 409);
        assert.equal((await call('delete', 3)).code, 409);
        assert.equal((await db.get('SELECT COUNT(*) AS n FROM chat_messages')).n, 1);
        await db.run('INSERT INTO users(id, email, full_name, password_hash, role) VALUES (5, ?, ?, ?, ?)', ['empty@example.com', 'Empty', 'hash', 'buyer']);
        assert.equal((await call('delete', 5)).code, 200);
        assert.equal(await db.get('SELECT id FROM users WHERE id = 5'), undefined);
        assert.equal((await call('delete', 999)).code, 404);
        for (const route of ['get /stores', 'put /stores/:id/verify']) {
            assert.equal(routes[route][0], authenticate);
            assert.equal(routes[route][1], adminGuard);
        }
        await db.run('INSERT INTO stores(id, user_id, store_name, disability_type, story, verification_status) VALUES (1, 2, ?, ?, ?, ?)', ['Test store', 'Other', 'Story', 'pending']);
        async function verifyStore(id, status) {
            const res = { code: 200, status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; } };
            await routes['put /stores/:id/verify'].at(-1)({ params: { id: String(id) }, body: { status } }, res, e => { throw e; });
            return res;
        }
        assert.equal((await verifyStore(1, 'invalid')).code, 400);
        assert.equal((await verifyStore('1x', 'approved')).code, 400);
        assert.equal((await verifyStore(999, 'approved')).code, 404);
        assert.equal((await verifyStore(1, 'approved')).code, 200);
        assert.equal((await db.get('SELECT verification_status FROM stores WHERE id = 1')).verification_status, 'approved');
        assert.equal((await verifyStore(1, 'rejected')).code, 200);
        assert.equal((await db.get('SELECT verification_status FROM stores WHERE id = 1')).verification_status, 'rejected');
        for (const [status, amount] of [['paid', 100], ['delivered', 200], ['pending', 500], ['cancelled', 900]]) {
            await db.run('INSERT INTO orders(buyer_id, store_id, subtotal, grand_total, status, shipping_name, shipping_phone, shipping_address) VALUES (3, 1, ?, ?, ?, ?, ?, ?)', [amount, amount, status, 'Buyer', '0800000000', 'Address']);
        }
        const statsResponse = { json(data) { this.data = data; } };
        await routes['get /stats'].at(-1)({}, statsResponse, e => { throw e; });
        assert.equal(statsResponse.data.data.sales_revenue, 300);
        assert.equal(statsResponse.data.data.shipped_orders, 1);
        assert.equal(statsResponse.data.data.total_orders, 4);
        assert.equal(statsResponse.data.data.paid_order_count, 2);
        assert.equal(statsResponse.data.data.average_order_value, 150);
        assert.equal(statsResponse.data.data.sales_daily.length, 1);
        assert.equal(typeof statsResponse.data.data.sales_daily[0].date, 'string');
    } finally {
        await new Promise(resolve => sqlite.close(resolve));
    }
});

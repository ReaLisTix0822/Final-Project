const fs = require('fs');
const path = require('path');
const { getSeedData } = require('../db/seed');

let dbDriver = null; // 'mysql' or 'sqlite'
let pool = null;
let sqliteDb = null;

class Database {
    async init() {
        const host = process.env.DB_HOST || 'localhost';
        const user = process.env.DB_USER || 'root';
        const password = process.env.DB_PASSWORD || '';
        const database = process.env.DB_NAME || 'inclusive_marketplace';
        const port = parseInt(process.env.DB_PORT || '3306', 10);

        let mysqlConnected = false;
        try {
            const mysql = require('mysql2/promise');
            const connection = await mysql.createConnection({ host, user, password, port, connectTimeout: 1000 });
            await connection.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
            await connection.end();

            pool = mysql.createPool({
                host,
                user,
                password,
                database,
                port,
                waitForConnections: true,
                connectionLimit: 10,
                queueLimit: 0
            });

            const [rows] = await pool.query('SELECT 1 as test');
            if (rows && rows[0].test === 1) {
                dbDriver = 'mysql';
                mysqlConnected = true;
                console.log(`✅ [Database] Connected successfully to MySQL (${host}:${port}/${database})`);
                await this.initMySQLTables();
            }
        } catch (err) {
            console.log(`ℹ️ [Database] MySQL not reachable locally (${err.message}). Using embedded SQLite database with full SQL relational persistence.`);
        }

        if (!mysqlConnected) {
            const sqlite3 = require('sqlite3').verbose();
            const dbPath = path.join(__dirname, '../db/marketplace.sqlite');
            
            await new Promise((resolve, reject) => {
                sqliteDb = new sqlite3.Database(dbPath, (err) => {
                    if (err) return reject(err);
                    dbDriver = 'sqlite';
                    console.log(`✅ [Database] SQLite relational database initialized at ${dbPath}`);
                    resolve();
                });
            });

            await this.initSQLiteTables();
        }
    }

    async initMySQLTables() {
        const schemaPath = path.join(__dirname, '../db/schema.sql');
        let schemaSql = fs.readFileSync(schemaPath, 'utf8');
        schemaSql = schemaSql.replace(/AUTOINCREMENT/g, 'AUTO_INCREMENT');

        const statements = schemaSql
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--'));

        for (const statement of statements) {
            try {
                await pool.query(statement);
            } catch (e) {
                // Table might exist
            }
        }

        const [users] = await pool.query('SELECT COUNT(*) as count FROM users');
        if (users[0].count === 0) {
            console.log('🌱 [Database] Seeding initial marketplace data into MySQL...');
            await this.seedAll();
        }
    }

    async initSQLiteTables() {
        const schemaPath = path.join(__dirname, '../db/schema.sqlite.sql');
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');

        await new Promise((resolve, reject) => {
            sqliteDb.exec(schemaSql, (err) => {
                if (err) return reject(err);
                resolve();
            });
        });

        const userCount = await this.get('SELECT COUNT(*) as count FROM users');
        if (!userCount || userCount.count === 0) {
            console.log('🌱 [Database] Seeding initial marketplace data into SQLite...');
            await this.seedAll();
        }
    }

    async seedAll() {
        const seed = await getSeedData();

        for (const u of seed.users) {
            await this.run(
                `INSERT INTO users (id, email, password_hash, full_name, phone, role, avatar_url, bio)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [u.id, u.email, u.password_hash, u.full_name, u.phone, u.role, u.avatar_url, u.bio]
            );
        }

        for (const s of seed.stores) {
            await this.run(
                `INSERT INTO stores (id, user_id, store_name, disability_type, story, craft_technique, support_goal_title, support_goal_target, support_goal_current, verification_status, phone, province, address, avatar_image, cover_image)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [s.id, s.user_id, s.store_name, s.disability_type, s.story, s.craft_technique, s.support_goal_title, s.support_goal_target, s.support_goal_current, s.verification_status, s.phone, s.province, s.address, s.avatar_image, s.cover_image]
            );
        }

        for (const c of seed.categories) {
            await this.run(
                `INSERT INTO categories (id, name, description, icon) VALUES (?, ?, ?, ?)`,
                [c.id, c.name, c.description, c.icon]
            );
        }

        for (const p of seed.products) {
            await this.run(
                `INSERT INTO products (id, store_id, category_id, name, story, description, price, stock, image_url, model_3d_url, dimensions, weight, is_featured, is_active)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [p.id, p.store_id, p.category_id, p.name, p.story, p.description, p.price, p.stock, p.image_url, p.model_3d_url, p.dimensions, p.weight, p.is_featured, p.is_active]
            );
        }

        for (const camp of seed.campaigns) {
            await this.run(
                `INSERT INTO campaigns (id, title, description, location, start_date, end_date, event_type, image_url, is_active)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [camp.id, camp.title, camp.description, camp.location, camp.start_date, camp.end_date, camp.event_type, camp.image_url, camp.is_active]
            );
        }

        for (const cp of seed.campaign_participants) {
            await this.run(
                `INSERT INTO campaign_participants (campaign_id, store_id, status, booth_number)
                 VALUES (?, ?, ?, ?)`,
                [cp.campaign_id, cp.store_id, cp.status, cp.booth_number]
            );
        }

        for (const r of seed.reviews) {
            await this.run(
                `INSERT INTO reviews (id, product_id, buyer_id, rating, comment, seller_reply, seller_replied_at, status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [r.id, r.product_id, r.buyer_id, r.rating, r.comment, r.seller_reply, r.seller_replied_at, r.status]
            );
        }

        for (const o of seed.orders) {
            await this.run(
                `INSERT INTO orders (id, buyer_id, store_id, subtotal, tip_amount, shipping_cost, grand_total, status, shipping_name, shipping_phone, shipping_address, payment_method, tracking_number, courier_name, notes)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [o.id, o.buyer_id, o.store_id, o.subtotal, o.tip_amount, o.shipping_cost, o.grand_total, o.status, o.shipping_name, o.shipping_phone, o.shipping_address, o.payment_method, o.tracking_number, o.courier_name, o.notes]
            );
        }

        for (const oi of seed.order_items) {
            await this.run(
                `INSERT INTO order_items (id, order_id, product_id, product_name, product_image, quantity, unit_price, subtotal)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [oi.id, oi.order_id, oi.product_id, oi.product_name, oi.product_image, oi.quantity, oi.unit_price, oi.subtotal]
            );
        }

        if (seed.favorites && seed.favorites.length > 0) {
            for (const f of seed.favorites) {
                await this.run(
                    `INSERT INTO favorites (id, user_id, product_id, created_at)
                     VALUES (?, ?, ?, ?)`,
                    [f.id, f.user_id, f.product_id, f.created_at]
                );
            }
        }

        if (seed.chat_messages && seed.chat_messages.length > 0) {
            for (const m of seed.chat_messages) {
                await this.run(
                    `INSERT INTO chat_messages (id, sender_id, receiver_id, store_id, sender_role, message, is_read, created_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [m.id, m.sender_id, m.receiver_id, m.store_id, m.sender_role, m.message, m.is_read, m.created_at]
                );
            }
        }

        console.log('✅ [Database] Seed data successfully populated!');
    }


    async query(sql, params = []) {
        return this.all(sql, params);
    }

    async all(sql, params = []) {
        if (dbDriver === 'mysql') {
            const [rows] = await pool.query(sql, params);
            return rows;
        } else {
            return new Promise((resolve, reject) => {
                sqliteDb.all(sql, params, (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows);
                });
            });
        }
    }

    async get(sql, params = []) {
        if (dbDriver === 'mysql') {
            const [rows] = await pool.query(sql, params);
            return rows[0] || null;
        } else {
            return new Promise((resolve, reject) => {
                sqliteDb.get(sql, params, (err, row) => {
                    if (err) return reject(err);
                    resolve(row || null);
                });
            });
        }
    }

    async run(sql, params = []) {
        if (dbDriver === 'mysql') {
            const [result] = await pool.query(sql, params);
            return {
                insertId: result.insertId,
                affectedRows: result.affectedRows
            };
        } else {
            return new Promise((resolve, reject) => {
                sqliteDb.run(sql, params, function (err) {
                    if (err) return reject(err);
                    resolve({
                        insertId: this.lastID,
                        affectedRows: this.changes
                    });
                });
            });
        }
    }

    getDriver() {
        return dbDriver;
    }
}

const db = new Database();
module.exports = db;

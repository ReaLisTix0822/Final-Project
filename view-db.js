// ==============================================================================
// COMMAND-LINE DATABASE VIEWER
// Usage: node view-db.js [table_name]
// Example: node view-db.js users
// Example: node view-db.js products
// ==============================================================================

const db = require('./config/database');

async function main() {
    await db.init();
    const tableName = process.argv[2] || 'all';

    console.log(`\n======================================================`);
    console.log(`🗄️  DATABASE VIEWER - [DRIVER: ${db.getDriver().toUpperCase()}]`);
    console.log(`======================================================\n`);

    const tables = [
        'users',
        'stores',
        'categories',
        'products',
        'orders',
        'order_items',
        'reviews',
        'campaigns'
    ];

    if (tableName === 'all') {
        for (const t of tables) {
            const count = await db.get(`SELECT COUNT(*) as count FROM ${t}`);
            console.log(`📁 ตาราง [${t}]: ${count ? count.count : 0} แถว`);
        }
        console.log(`\n💡 Tip: หากต้องการดูข้อมูลตารางใดแบบเต็ม ให้พิมพ์คำสั่ง:`);
        console.log(`   node view-db.js users`);
        console.log(`   node view-db.js products`);
        console.log(`   node view-db.js orders`);
        console.log(`   node view-db.js stores\n`);
        process.exit(0);
    }

    try {
        const rows = await db.all(`SELECT * FROM ${tableName} LIMIT 20`);
        console.log(`📋 ข้อมูลในตาราง: ${tableName} (แสดง ${rows.length} แถวล่าสุด):\n`);
        console.table(rows);
    } catch (e) {
        console.error(`❌ ไม่พบตาราง "${tableName}" หรือคำสั่งผิดพลาด:`, e.message);
    }

    process.exit(0);
}

main();

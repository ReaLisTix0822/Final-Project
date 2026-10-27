// ==============================================================================
// ONE REVENUE FORMULA FOR THE WHOLE SITE
// "Seller revenue" = product subtotal + tip (support money) of orders that were paid.
//   - INCLUDES the tip (เงินสมทบ / ทิป), because it goes to the seller
//   - EXCLUDES the shipping cost (ค่าส่ง), it pays the courier, not the seller
//   - EXCLUDES pending (not yet paid) and cancelled orders
// Used by the homepage ("รายได้ผู้ขายสะสม") and the admin dashboard ("ยอดขายรวม").
// ==============================================================================
const db = require('../config/database');

const PAID_ORDER_STATUSES = ['paid', 'processing', 'preparing', 'shipped', 'delivered', 'completed'];
const PAID_STATUS_SQL = PAID_ORDER_STATUSES.map(s => `'${s}'`).join(', ');
const SELLER_REVENUE_SQL = 'subtotal + COALESCE(tip_amount, 0)';

async function getSellerRevenue() {
    const row = await db.get(`SELECT COALESCE(SUM(${SELLER_REVENUE_SQL}), 0) AS total FROM orders WHERE status IN (${PAID_STATUS_SQL})`);
    return Number(row.total) || 0;
}

// Same formula per day (admin sales chart)
function getSellerRevenueDaily() {
    return db.all(`
        SELECT CAST(DATE(created_at) AS CHAR) AS date, COUNT(*) AS order_count,
               COALESCE(SUM(${SELLER_REVENUE_SQL}), 0) AS revenue
        FROM orders WHERE status IN (${PAID_STATUS_SQL})
        GROUP BY DATE(created_at) ORDER BY DATE(created_at)`);
}

module.exports = { PAID_ORDER_STATUSES, getSellerRevenue, getSellerRevenueDaily };

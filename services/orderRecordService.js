const db = require('../config/database');

// Payment status derived from the order: COD is only paid once the parcel is delivered
function paymentStatusFor(method, orderStatus) {
    if (orderStatus === 'cancelled') return 'cancelled';
    if (method === 'cod') return ['delivered', 'completed'].includes(orderStatus) ? 'paid' : 'pending';
    return 'paid';
}

// Write the payments / tips / shipping_tracking rows that belong to a new order
async function recordNewOrder(order) {
    await db.run(
        'INSERT INTO payments (order_id, method, amount, status) VALUES (?, ?, ?, ?)',
        [order.id, order.payment_method, order.grand_total, paymentStatusFor(order.payment_method, order.status)]
    );

    if (Number(order.tip_amount) > 0) {
        await db.run(
            'INSERT INTO tips (buyer_id, store_id, order_id, amount) VALUES (?, ?, ?, ?)',
            [order.buyer_id, order.store_id, order.id, order.tip_amount]
        );
    }

    await db.run(
        'INSERT INTO shipping_tracking (order_id, carrier, tracking_number, status) VALUES (?, ?, ?, ?)',
        [order.id, order.courier_name, order.tracking_number || null, order.status]
    );
}

// Support goal progress = real tips received; tips from cancelled orders do not count
async function refreshSupportGoal(storeId) {
    if (!storeId) return;
    await db.run(`
        UPDATE stores SET support_goal_current = (
            SELECT COALESCE(SUM(t.amount), 0) FROM tips t
            WHERE t.store_id = ?
              AND (t.order_id IS NULL OR NOT EXISTS (SELECT 1 FROM orders o WHERE o.id = t.order_id AND o.status = 'cancelled'))
        ) WHERE id = ?`, [storeId, storeId]);
}

// Keep shipping_tracking and payments in step with the order after a status update
async function syncOrderStatus(order) {
    const tracking = await db.get('SELECT id FROM shipping_tracking WHERE order_id = ?', [order.id]);
    if (tracking) {
        await db.run(
            'UPDATE shipping_tracking SET carrier = ?, tracking_number = ?, status = ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?',
            [order.courier_name, order.tracking_number || null, order.status, tracking.id]
        );
    } else {
        await db.run(
            'INSERT INTO shipping_tracking (order_id, carrier, tracking_number, status) VALUES (?, ?, ?, ?)',
            [order.id, order.courier_name, order.tracking_number || null, order.status]
        );
    }

    await db.run(
        'UPDATE payments SET status = ? WHERE order_id = ?',
        [paymentStatusFor(order.payment_method, order.status), order.id]
    );
    if (Number(order.tip_amount) > 0) await refreshSupportGoal(order.store_id);
}

module.exports = { paymentStatusFor, recordNewOrder, syncOrderStatus, refreshSupportGoal };

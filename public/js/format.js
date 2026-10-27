// ==============================================================================
// SHARED FORMATTING (one format for the whole site)
// TJFormat.money(20000)        -> "฿20,000"      (no decimals for whole numbers)
// TJFormat.money(1351.25)      -> "฿1,351.25"
// TJFormat.number(20000)       -> "20,000"
// TJFormat.goalPercent(9000, 18000) -> 50     (support_goal_current / support_goal_target, 0-100)
// ==============================================================================
const TJFormat = {
    number(value) {
        const n = Number(value);
        return (Number.isFinite(n) ? n : 0).toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    },
    money(value) {
        return `฿${TJFormat.number(value)}`;
    },
    // Funding progress of a store goal. Same function on every page so the numbers always match.
    goalPercent(current, target) {
        const c = Number(current) || 0;
        const t = Number(target) || 0;
        if (t <= 0) return 0;
        return Math.max(0, Math.min(100, Math.round((c / t) * 100)));
    },
    // Status badges never rely on color alone (WCAG 1.4.1): an icon goes before the text.
    // kind: 'success' | 'error' | 'warning' | 'info'
    statusIcon(kind) {
        const icon = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' }[kind] || 'ℹ';
        return `<span class="status-icon" aria-hidden="true">${icon}</span> `;
    },
    orderStatusKind(status) {
        if (['completed', 'delivered'].includes(status)) return 'success';
        if (status === 'cancelled') return 'error';
        if (['pending', 'pending_payment', 'processing', 'preparing'].includes(status)) return 'warning';
        return 'info';
    }
};
window.TJFormat = TJFormat;

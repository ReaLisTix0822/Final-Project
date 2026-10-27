// Whole scores without ".0" (5/5); anything below a perfect 5 keeps one decimal and never rounds up to 5 (4.96 -> 4.9)
function formatRating(value) {
    const score = Number(value);
    if (score >= 5) return '5';
    const shown = Math.min(Math.round(score * 10) / 10, 4.9);
    return Number.isInteger(shown) ? String(shown) : shown.toFixed(1);
}

async function loadHomepageStats() {
    const stores = document.getElementById('home-verified-stores');
    const rating = document.getElementById('home-average-rating');
    const revenue = document.getElementById('home-seller-revenue');
    try {
        const response = await API.get('/marketplace/stats');
        if (!response.success || !response.data) throw new Error('ไม่พบข้อมูลสถิติ');
        const data = response.data;
        stores.textContent = data.verified_stores.toLocaleString('th-TH');
        rating.textContent = data.average_rating == null ? '—' : `${formatRating(data.average_rating)}/5`;
        revenue.textContent = `${TJFormat.money(data.seller_revenue)}`;
    } catch (error) {
        [stores, rating, revenue].forEach(element => {
            element.textContent = '—';
            element.title = 'โหลดข้อมูลไม่สำเร็จ กรุณารีเฟรชหน้าอีกครั้ง';
        });
    }
}

loadHomepageStats();

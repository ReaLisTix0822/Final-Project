async function loadHomepageStats() {
    const stores = document.getElementById('home-verified-stores');
    const rating = document.getElementById('home-average-rating');
    const revenue = document.getElementById('home-seller-revenue');
    try {
        const response = await API.get('/marketplace/stats');
        if (!response.success || !response.data) throw new Error('ไม่พบข้อมูลสถิติ');
        const data = response.data;
        stores.textContent = data.verified_stores.toLocaleString('th-TH');
        rating.textContent = data.average_rating == null ? 'ยังไม่มีรีวิว' : `${data.average_rating.toFixed(1)}/5`;
        revenue.textContent = `฿${data.seller_revenue.toLocaleString('th-TH', { maximumFractionDigits: 2 })}`;
    } catch (error) {
        [stores, rating, revenue].forEach(element => {
            element.textContent = '—';
            element.title = 'โหลดข้อมูลไม่สำเร็จ กรุณารีเฟรชหน้าอีกครั้ง';
        });
    }
}

loadHomepageStats();

// ==============================================================================
// LOGIN & REGISTRATION CONTROLLER
// Handles authentication, role switching, and 1-Click quick login
// ==============================================================================

function initLoginPage() {
    const isLoggedIn = (window.Auth && Auth.isLoggedIn && Auth.isLoggedIn()) || 
                       (typeof Auth !== 'undefined' && Auth.isLoggedIn && Auth.isLoggedIn()) || 
                       (!!localStorage.getItem('token') && !!localStorage.getItem('user'));
    if (isLoggedIn) {
        const user = (typeof Auth !== 'undefined' && Auth.getUser) ? Auth.getUser() : JSON.parse(localStorage.getItem('user') || 'null');
        if (user) {
            const containerCard = document.querySelector('#main-content > div');
            if (containerCard && !document.getElementById('already-logged-in-box')) {
                const roleLabel = user.role === 'seller' ? 'ช่างฝีมือ/ผู้ขาย' : user.role === 'admin' ? 'ผู้ดูแลระบบ' : 'ผู้สนับสนุน/ผู้ซื้อ';
                const destUrl = user.role === 'seller' ? '/seller-dashboard.html' : user.role === 'admin' ? '/admin-dashboard.html' : '/index.html';
                const alertDiv = document.createElement('div');
                alertDiv.id = 'already-logged-in-box';
                alertDiv.style.cssText = 'background:#eef7ee; border:2px solid #2e7d32; border-radius:12px; padding:1.25rem; margin-bottom:1.5rem; text-align:center;';
                alertDiv.innerHTML = `
                    <div style="font-size:1.1rem; font-weight:700; color:#1b5e20; margin-bottom:6px;">
                        คุณได้เข้าสู่ระบบเรียบร้อยแล้ว ในชื่อ <b>${user.full_name || user.email}</b> (${roleLabel})
                    </div>
                    <p style="font-size:0.9rem; color:#2e7d32; margin-bottom:14px;">
                        คุณไม่จำเป็นต้องเข้าสู่ระบบซ้ำ สามารถไปหน้าร้านค้า หรือเปลี่ยนบัญชีได้ที่นี่
                    </p>
                    <div style="display:flex; justify-content:center; gap:10px; flex-wrap:wrap;">
                        <a href="${destUrl}" class="btn btn-primary" style="padding:0.5rem 1.4rem; font-weight:700;">เข้าสู่หน้าร้านค้า / แดชบอร์ด</a>
                        <button onclick="Auth.logout()" class="btn btn-outline-dark" style="padding:0.5rem 1.2rem;">ออกจากระบบ</button>
                    </div>
                `;
                containerCard.prepend(alertDiv);
            }
        }
    }

    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get('tab');
    const roleParam = urlParams.get('role');

    if (tabParam === 'register') {
        setAuthTab('register');
        if (roleParam === 'seller') {
            const sellerRadio = document.querySelector('input[name="reg_role"][value="seller"]');
            if (sellerRadio) {
                sellerRadio.checked = true;
                toggleSellerFields(true);
            }
        }
    }
}

function setAuthTab(tab) {
    const loginForm = document.getElementById('login-form');
    const regForm = document.getElementById('register-form');
    const tabLogin = document.getElementById('tab-login-btn');
    const tabReg = document.getElementById('tab-register-btn');

    if (tab === 'login') {
        loginForm.style.display = 'block';
        regForm.style.display = 'none';
        tabLogin.classList.add('active');
        tabReg.classList.remove('active');
    } else {
        loginForm.style.display = 'none';
        regForm.style.display = 'block';
        tabLogin.classList.remove('active');
        tabReg.classList.add('active');
    }
}

function toggleSellerFields(show) {
    const fields = document.getElementById('seller-fields');
    if (fields) {
        fields.style.display = show ? 'block' : 'none';
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    const submitBtn = document.getElementById('login-submit-btn');
    submitBtn.innerText = '⏳ กำลังเข้าสู่ระบบ...';
    submitBtn.disabled = true;

    try {
        const res = await API.post('/auth/login', { email, password });
        if (res.success) {
            Auth.saveSession(res.token, res.user, res.store);
            window.showToast('เข้าสู่ระบบสำเร็จ ยินดีต้อนรับสู่ระบบตลาดใจ', 'success');

            const urlParams = new URLSearchParams(window.location.search);
            const redirect = urlParams.get('redirect');

            setTimeout(() => {
                if (redirect) {
                    window.location.href = redirect;
                } else if (res.user.role === 'seller') {
                    window.location.href = '/seller-dashboard.html';
                } else if (res.user.role === 'admin') {
                    window.location.href = '/admin-dashboard.html';
                } else {
                    window.location.href = '/index.html';
                }
            }, 500);
        }
    } catch (err) {
        submitBtn.innerText = 'เข้าสู่ระบบ';
        submitBtn.disabled = false;
        window.showToast(err.message, 'error');
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const role = document.querySelector('input[name="reg_role"]:checked')?.value || 'buyer';
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    const full_name = document.getElementById('reg-fullname').value.trim();
    const phone = document.getElementById('reg-phone').value.trim();

    const payload = {
        role,
        email,
        password,
        full_name,
        phone
    };

    if (role === 'seller') {
        payload.store_name = document.getElementById('reg-store-name').value.trim() || `ร้านค้าของ ${full_name}`;
        payload.disability_type = document.getElementById('reg-disability-type').value;
        payload.support_goal_title = document.getElementById('reg-goal-title').value.trim() || 'ระดมทุนสนับสนุนอุปกรณ์';
        payload.support_goal_target = parseFloat(document.getElementById('reg-goal-target').value) || 20000;
    }

    const submitBtn = document.getElementById('register-submit-btn');
    submitBtn.innerText = '⏳ กำลังลงทะเบียน...';
    submitBtn.disabled = true;

    try {
        const res = await API.post('/auth/register', payload);
        if (res.success) {
            Auth.saveSession(res.token, res.user, res.store);
            window.showToast('ลงทะเบียนสำเร็จ ยินดีต้อนรับสู่ระบบตลาดใจ', 'success');
            setTimeout(() => {
                if (role === 'seller') {
                    window.location.href = '/seller-dashboard.html';
                } else {
                    window.location.href = '/index.html';
                }
            }, 600);
        }
    } catch (err) {
        submitBtn.innerText = 'ลงทะเบียนเข้าสู่ระบบ';
        submitBtn.disabled = false;
        window.showToast(err.message, 'error');
    }
}

async function quickLogin(email, password) {
    document.getElementById('login-email').value = email;
    document.getElementById('login-password').value = password;
    setAuthTab('login');

    const form = document.getElementById('login-form');
    form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
}

document.addEventListener('DOMContentLoaded', initLoginPage);

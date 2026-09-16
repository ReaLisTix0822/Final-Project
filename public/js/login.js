// ==============================================================================
// LOGIN & REGISTRATION CONTROLLER (MODERN AUTH & WCAG AA COMPLIANT)
// ==============================================================================

function initLoginPage() {
    const isLoggedIn = (window.Auth && Auth.isLoggedIn && Auth.isLoggedIn()) || 
                       (typeof Auth !== 'undefined' && Auth.isLoggedIn && Auth.isLoggedIn()) || 
                       (!!localStorage.getItem('token') && !!localStorage.getItem('user'));
    if (isLoggedIn) {
        const user = (typeof Auth !== 'undefined' && Auth.getUser) ? Auth.getUser() : JSON.parse(localStorage.getItem('user') || 'null');
        if (user) {
            const containerCard = document.querySelector('.auth-form-card');
            if (containerCard && !document.getElementById('already-logged-in-box')) {
                const roleLabel = user.role === 'seller' ? 'ช่างฝีมือ/ผู้ขาย' : user.role === 'admin' ? 'ผู้ดูแลระบบ' : 'ผู้สนับสนุน/ผู้ซื้อ';
                const destUrl = user.role === 'seller' ? '/seller-dashboard.html' : user.role === 'admin' ? '/admin-dashboard.html' : '/index.html';
                const alertDiv = document.createElement('div');
                alertDiv.id = 'already-logged-in-box';
                alertDiv.style.cssText = 'background:#f0fdf4; border:1.5px solid #86efac; border-radius:16px; padding:1.25rem; margin-bottom:1.5rem; text-align:center;';
                alertDiv.innerHTML = `
                    <div style="font-size:1.05rem; font-weight:700; color:#166534; margin-bottom:4px;">
                        คุณได้เข้าสู่ระบบเรียบร้อยแล้ว ในชื่อ <b>${user.full_name || user.email}</b> (${roleLabel})
                    </div>
                    <p style="font-size:0.86rem; color:#15803d; margin-bottom:12px;">
                        คุณไม่จำเป็นต้องเข้าสู่ระบบซ้ำ สามารถไปยังแดชบอร์ด หรือออกจากระบบเพื่อเปลี่ยนบัญชีได้
                    </p>
                    <div style="display:flex; justify-content:center; gap:10px; flex-wrap:wrap;">
                        <a href="${destUrl}" class="btn btn-primary" style="padding:0.45rem 1.25rem; font-size:0.88rem; font-weight:700; border-radius:var(--radius-full);">ไปยังแดชบอร์ด / ร้านค้า</a>
                        <button type="button" onclick="Auth.logout()" class="btn btn-outline-dark" style="padding:0.45rem 1.1rem; font-size:0.88rem; border-radius:var(--radius-full);">ออกจากระบบ</button>
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
                onRoleChange('seller');
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
        if (loginForm) loginForm.style.display = 'block';
        if (regForm) regForm.style.display = 'none';
        if (tabLogin) {
            tabLogin.classList.add('active');
            tabLogin.setAttribute('aria-selected', 'true');
        }
        if (tabReg) {
            tabReg.classList.remove('active');
            tabReg.setAttribute('aria-selected', 'false');
        }
    } else {
        if (loginForm) loginForm.style.display = 'none';
        if (regForm) regForm.style.display = 'block';
        if (tabLogin) {
            tabLogin.classList.remove('active');
            tabLogin.setAttribute('aria-selected', 'false');
        }
        if (tabReg) {
            tabReg.classList.add('active');
            tabReg.setAttribute('aria-selected', 'true');
        }
    }
}

function onRoleChange(role) {
    const buyerCard = document.getElementById('role-card-buyer');
    const sellerCard = document.getElementById('role-card-seller');

    if (role === 'seller') {
        if (sellerCard) sellerCard.classList.add('selected');
        if (buyerCard) buyerCard.classList.remove('selected');
        toggleSellerFields(true);
    } else {
        if (buyerCard) buyerCard.classList.add('selected');
        if (sellerCard) sellerCard.classList.remove('selected');
        toggleSellerFields(false);
    }
}

function toggleSellerFields(show) {
    const fields = document.getElementById('seller-fields');
    if (fields) {
        fields.style.display = show ? 'block' : 'none';
    }
}

function togglePasswordVisibility(inputId, btnEl) {
    const input = document.getElementById(inputId);
    if (!input) return;

    if (input.type === 'password') {
        input.type = 'text';
        btnEl.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
        `;
        btnEl.setAttribute('aria-label', 'ซ่อนรหัสผ่าน');
    } else {
        input.type = 'password';
        btnEl.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
        `;
        btnEl.setAttribute('aria-label', 'แสดงรหัสผ่าน');
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    const submitBtn = document.getElementById('login-submit-btn');
    const originalContent = submitBtn.innerHTML;
    submitBtn.innerHTML = `
        <span style="width:16px; height:16px; border:2px solid #ffffff; border-top-color:transparent; border-radius:50%; display:inline-block; animation:spin 0.6s linear infinite; margin-right:6px;"></span>
        <span>กำลังเข้าสู่ระบบ...</span>
    `;
    submitBtn.disabled = true;

    try {
        const res = await API.post('/auth/login', { email, password });
        if (res.success) {
            Auth.saveSession(res.token, res.user, res.store);
            if (window.showToast) window.showToast('เข้าสู่ระบบสำเร็จ ยินดีต้อนรับสู่ระบบตลาดใจ', 'success');

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
        submitBtn.innerHTML = originalContent;
        submitBtn.disabled = false;
        if (window.showToast) {
            window.showToast(err.message || 'อีเมลหรือรหัสผ่านไม่ถูกต้อง', 'error');
        } else {
            alert(err.message || 'อีเมลหรือรหัสผ่านไม่ถูกต้อง');
        }
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const role = document.querySelector('input[name="reg_role"]:checked')?.value || 'buyer';
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    const full_name = document.getElementById('reg-fullname').value.trim();
    const phone = document.getElementById('reg-phone')?.value.trim() || '';

    const payload = {
        role,
        email,
        password,
        full_name,
        phone
    };

    if (role === 'seller') {
        payload.store_name = document.getElementById('reg-store-name')?.value.trim() || `ร้านค้าของ ${full_name}`;
        payload.disability_type = document.getElementById('reg-disability-type')?.value || 'physical';
        payload.support_goal_title = document.getElementById('reg-goal-title')?.value.trim() || 'ระดมทุนสนับสนุนอุปกรณ์สร้างสรรค์';
        payload.support_goal_target = parseFloat(document.getElementById('reg-goal-target')?.value) || 20000;
    }

    const submitBtn = document.getElementById('register-submit-btn');
    const originalContent = submitBtn.innerHTML;
    submitBtn.innerHTML = `
        <span style="width:16px; height:16px; border:2px solid #ffffff; border-top-color:transparent; border-radius:50%; display:inline-block; animation:spin 0.6s linear infinite; margin-right:6px;"></span>
        <span>กำลังลงทะเบียน...</span>
    `;
    submitBtn.disabled = true;

    try {
        const res = await API.post('/auth/register', payload);
        if (res.success) {
            Auth.saveSession(res.token, res.user, res.store);
            if (window.showToast) window.showToast('ลงทะเบียนสำเร็จ ยินดีต้อนรับสู่ระบบตลาดใจ', 'success');
            setTimeout(() => {
                if (role === 'seller') {
                    window.location.href = '/seller-dashboard.html';
                } else {
                    window.location.href = '/index.html';
                }
            }, 600);
        }
    } catch (err) {
        submitBtn.innerHTML = originalContent;
        submitBtn.disabled = false;
        if (window.showToast) {
            window.showToast(err.message || 'การลงทะเบียนไม่สำเร็จ กรุณาตรวจสอบข้อมูล', 'error');
        } else {
            alert(err.message || 'การลงทะเบียนไม่สำเร็จ กรุณาตรวจสอบข้อมูล');
        }
    }
}

async function quickLogin(email, password) {
    const emailInput = document.getElementById('login-email');
    const passInput = document.getElementById('login-password');
    if (emailInput) emailInput.value = email;
    if (passInput) passInput.value = password;
    setAuthTab('login');

    const form = document.getElementById('login-form');
    if (form) {
        form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    }
}

document.addEventListener('DOMContentLoaded', initLoginPage);

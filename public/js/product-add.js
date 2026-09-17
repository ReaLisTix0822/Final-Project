// ==============================================================================
// PRODUCT ADD & EDIT CONTROLLER (STANDALONE PAGE)
// Handles creation, edit, TRELLIS.2 3D generation, image upload & Gemini Story
// ==============================================================================

let currentSellerStore = null;
let isEditMode = false;
let currentEditId = null;

async function initProductAddPage() {
    if (!Auth.isLoggedIn()) {
        window.location.href = '/login.html?redirect=' + encodeURIComponent(window.location.href);
        return;
    }

    const user = Auth.getUser();
    if (user.role !== 'seller' && user.role !== 'admin') {
        alert('หน้านี้สำหรับบัญชีผู้ขายหรือแอดมินเท่านั้น');
        window.location.href = '/index.html';
        return;
    }

    currentSellerStore = Auth.getStore();
    if (!currentSellerStore) {
        try {
            const meRes = await API.get('/auth/me');
            if (meRes.success && meRes.store) {
                currentSellerStore = meRes.store;
                localStorage.setItem('store', JSON.stringify(currentSellerStore));
            }
        } catch (e) {
            console.warn('Could not fetch store profile:', e);
        }
    }

    // Check if in edit mode from URL parameter (?id=123)
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('id') || urlParams.get('edit');

    if (productId) {
        isEditMode = true;
        currentEditId = productId;
        document.getElementById('page-title').innerText = 'แก้ไขข้อมูลสินค้า & โมเดล 3 มิติ';
        document.getElementById('page-subtitle').innerText = 'อัปเดตรายละเอียด ราคา สต็อก เรื่องราว และไฟล์โมเดล 3 มิติของชิ้นงาน';
        document.getElementById('breadcrumb-current-action').innerText = 'แก้ไขสินค้า #' + productId;
        document.getElementById('btn-submit-text').innerText = 'บันทึกการแก้ไขสินค้า';
        document.getElementById('edit-product-id').value = productId;
        await loadExistingProduct(productId);
    }
}

async function loadExistingProduct(productId) {
    try {
        const res = await API.get(`/products/${productId}`);
        if (!res.success || !res.data) {
            alert('ไม่พบข้อมูลสินค้านี้');
            window.location.href = '/seller-dashboard.html';
            return;
        }

        const p = res.data;
        document.getElementById('p-name').value = p.name || '';
        document.getElementById('p-category').value = p.category_id || 1;
        document.getElementById('p-price').value = p.price || '';
        document.getElementById('p-stock').value = p.stock ?? 10;
        document.getElementById('p-dimensions').value = p.dimensions || '';
        document.getElementById('p-image').value = p.image_url || '';
        document.getElementById('p-3d').value = p.model_3d_url || '';
        document.getElementById('p-story').value = p.story || '';
        document.getElementById('p-desc').value = p.description || '';

        // Sync Image Preview
        if (p.image_url) {
            syncProductImagePreview(p.image_url);
        }

        // Sync 3D Preview
        if (p.model_3d_url) {
            show3DPreview(p.model_3d_url, p.image_url);
        }
    } catch (err) {
        alert('เกิดข้อผิดพลาดในการโหลดสินค้า: ' + err.message);
        window.location.href = '/seller-dashboard.html';
    }
}

// ==============================================================================
// FORM SUBMISSION (CREATE OR UPDATE)
// ==============================================================================

async function handleProductFormSubmit(e) {
    e.preventDefault();

    const btnSubmit = document.getElementById('btn-submit-product');
    const submitText = document.getElementById('btn-submit-text');
    const statusIndicator = document.getElementById('save-status-indicator');
    const origText = submitText.innerText;

    btnSubmit.disabled = true;
    submitText.innerText = 'กำลังบันทึกข้อมูล...';
    if (statusIndicator) statusIndicator.innerText = '⏳ กำลังส่งข้อมูลไปยังระบบ...';

    const payload = {
        name: document.getElementById('p-name').value.trim(),
        category_id: parseInt(document.getElementById('p-category').value, 10),
        price: parseFloat(document.getElementById('p-price').value),
        stock: parseInt(document.getElementById('p-stock').value, 10),
        dimensions: document.getElementById('p-dimensions').value.trim(),
        image_url: document.getElementById('p-image').value.trim(),
        model_3d_url: document.getElementById('p-3d').value.trim() || null,
        story: document.getElementById('p-story').value.trim(),
        description: document.getElementById('p-desc').value.trim()
    };

    try {
        let res;
        if (isEditMode && currentEditId) {
            res = await API.put(`/products/${currentEditId}`, payload);
        } else {
            res = await API.post('/products', payload);
        }

        if (res.success) {
            if (window.showToast) {
                window.showToast(isEditMode ? 'แก้ไขสินค้าเรียบร้อยแล้ว' : 'เพิ่มสินค้าใหม่ลงในร้านค้าสำเร็จแล้ว', 'success');
            }
            if (statusIndicator) statusIndicator.innerText = '✅ บันทึกสำเร็จ!';

            // Redirect back to seller dashboard after short delay
            setTimeout(() => {
                window.location.href = '/seller-dashboard.html';
            }, 800);
        } else {
            throw new Error(res.message || 'บันทึกไม่สำเร็จ');
        }
    } catch (err) {
        alert('เกิดข้อผิดพลาด: ' + err.message);
        if (statusIndicator) statusIndicator.innerText = '❌ ' + err.message;
    } finally {
        btnSubmit.disabled = false;
        submitText.innerText = origText;
    }
}

// ==============================================================================
// IMAGE UPLOAD & PREVIEW
// ==============================================================================

async function handleProductImageUpload(inputElement) {
    if (!inputElement || !inputElement.files || !inputElement.files[0]) {
        return;
    }

    const file = inputElement.files[0];
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
        alert('กรุณาเลือกไฟล์รูปภาพที่ถูกต้อง (JPG, PNG, WebP, GIF)');
        inputElement.value = '';
        return;
    }

    if (file.size > 10 * 1024 * 1024) {
        alert('ขนาดไฟล์ต้องไม่เกิน 10MB');
        inputElement.value = '';
        return;
    }

    const uploadText = document.getElementById('btn-upload-text');
    const statusMsg = document.getElementById('p-upload-status');
    const prevText = uploadText ? uploadText.innerText : 'อัปโหลดรูป';

    try {
        if (uploadText) uploadText.innerText = 'กำลังอัปโหลด...';
        if (statusMsg) {
            statusMsg.style.display = 'block';
            statusMsg.style.background = '#e0f2fe';
            statusMsg.style.color = '#0369a1';
            statusMsg.innerHTML = `⏳ กำลังอัปโหลดไฟล์ <strong>${file.name}</strong> เข้าสู่ระบบ...`;
        }

        const formData = new FormData();
        formData.append('image', file);

        const res = await API.request('/products/upload', {
            method: 'POST',
            body: formData
        });

        if (res.success && res.imageUrl) {
            const imageUrl = res.imageUrl;
            document.getElementById('p-image').value = imageUrl;
            syncProductImagePreview(imageUrl, file.name);

            if (statusMsg) {
                statusMsg.style.background = '#dcfce7';
                statusMsg.style.color = '#15803d';
                statusMsg.innerHTML = `✅ <strong>อัปโหลดสำเร็จ!</strong> รูปภาพพร้อมใช้งานและพร้อมส่งต่อไปยัง TRELLIS.2 เพื่อสร้าง 3D`;
            }

            if (window.showToast) {
                window.showToast('อัปโหลดรูปภาพสินค้าเรียบร้อยแล้ว', 'success');
            }

            // If 3D preview is active, update poster
            const glb = document.getElementById('p-3d').value.trim();
            if (glb) show3DPreview(glb, imageUrl);
        } else {
            throw new Error(res.message || 'ไม่สามารถอัปโหลดรูปภาพได้');
        }
    } catch (err) {
        console.error('Image Upload Error:', err);
        if (statusMsg) {
            statusMsg.style.display = 'block';
            statusMsg.style.background = '#fee2e2';
            statusMsg.style.color = '#b91c1c';
            statusMsg.innerHTML = `❌ อัปโหลดไม่สำเร็จ: ${err.message}`;
        }
        if (window.showToast) window.showToast(`เกิดข้อผิดพลาดในการอัปโหลด: ${err.message}`, 'error');
    } finally {
        if (uploadText) uploadText.innerText = prevText;
        inputElement.value = '';
    }
}

function handleProductImageInputChanged() {
    const url = document.getElementById('p-image').value.trim();
    if (url) {
        syncProductImagePreview(url);
    } else {
        clearProductImage();
    }
}

function syncProductImagePreview(url, customTitle = '') {
    const wrapper = document.getElementById('p-image-preview-wrapper');
    const img = document.getElementById('p-image-preview-img');
    const titleEl = document.getElementById('p-image-preview-title');
    if (!wrapper || !img) return;

    if (url) {
        img.src = url;
        img.onerror = () => {
            img.src = 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=200&auto=format&fit=crop&q=80';
        };
        if (titleEl) titleEl.innerText = customTitle || (url.startsWith('/uploads/') ? 'รูปภาพอัปโหลดจากเครื่อง' : 'รูปภาพสินค้า');
        wrapper.style.display = 'flex';
    } else {
        wrapper.style.display = 'none';
    }
}

function clearProductImage() {
    const input = document.getElementById('p-image');
    const fileInput = document.getElementById('p-image-file');
    const wrapper = document.getElementById('p-image-preview-wrapper');
    const statusMsg = document.getElementById('p-upload-status');

    if (input) input.value = '';
    if (fileInput) fileInput.value = '';
    if (wrapper) wrapper.style.display = 'none';
    if (statusMsg) statusMsg.style.display = 'none';
}

// ==============================================================================
// TRELLIS.2 3D GENERATOR & LIVE PREVIEW
// ==============================================================================

async function aiGenerate3DModelTrellis() {
    const imageUrl = document.getElementById('p-image').value.trim();
    if (!imageUrl) {
        alert('กรุณากรอกหรืออัปโหลดรูปภาพสินค้าก่อนเริ่มสร้างโมเดล 3 มิติครับ');
        document.getElementById('p-image').focus();
        return;
    }

    const prodName = document.getElementById('p-name').value.trim() || 'ชิ้นงานหัตถศิลป์';
    const catSelect = document.getElementById('p-category');
    const catName = catSelect.options[catSelect.selectedIndex]?.text || '';
    const btn = document.getElementById('btn-trellis-generate');
    const statusMsg = document.getElementById('trellis-status-msg');

    const originalBtnHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span style="display:inline-block; animation:spin 1s linear infinite;">⏳</span> กำลังประมวลผล 3D...`;

    if (statusMsg) {
        statusMsg.style.display = 'block';
        statusMsg.style.background = '#e0f2fe';
        statusMsg.style.color = '#0369a1';
        statusMsg.innerHTML = `⚙️ <strong>TRELLIS.2:</strong> กำลังวิเคราะห์โครงสร้างภาพ (Structured Latents) และสังเคราะห์โมเดล 3D (.glb)...`;
    }

    if (window.showToast) window.showToast('TRELLIS.2 กำลังแปลงภาพ 2D เป็นโมเดล 3D...', 'info');

    try {
        const res = await API.post('/ai/generate-3d', {
            imageUrl,
            prompt: prodName,
            artisanName: currentSellerStore ? currentSellerStore.store_name : '',
            craftCategory: catName
        });

        if (res.success && res.data && res.data.modelUrl) {
            const modelUrl = res.data.modelUrl;
            document.getElementById('p-3d').value = modelUrl;

            if (statusMsg) {
                statusMsg.style.background = '#dcfce7';
                statusMsg.style.color = '#15803d';
                statusMsg.innerHTML = `✅ <strong>สร้างโมเดลสำเร็จ!</strong> ผลิตไฟล์ GLB พร้อมพื้นผิว (Texture & PBR) เรียบร้อยแล้ว`;
            }

            // Render live preview on page
            show3DPreview(modelUrl, imageUrl);

            if (window.showToast) {
                window.showToast('สร้างโมเดล 3 มิติด้วย TRELLIS.2 สำเร็จแล้ว! หมุนดูรอบทิศทางได้ทันที', 'success');
            }
        } else {
            throw new Error(res.message || 'ไม่สามารถสร้างโมเดลได้');
        }
    } catch (err) {
        console.error('TRELLIS.2 Error:', err);
        if (statusMsg) {
            statusMsg.style.background = '#fee2e2';
            statusMsg.style.color = '#b91c1c';
            statusMsg.innerHTML = `❌ ขออภัย ไม่สามารถสร้างโมเดลได้: ${err.message}`;
        }
        if (window.showToast) window.showToast(`เกิดข้อผิดพลาด: ${err.message}`, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalBtnHtml;
    }
}

function update3DPreviewFromInput() {
    const url = document.getElementById('p-3d').value.trim();
    const poster = document.getElementById('p-image').value.trim();
    if (url && (url.endsWith('.glb') || url.endsWith('.gltf') || url.includes('modelviewer.dev'))) {
        show3DPreview(url, poster);
    } else if (!url) {
        hide3DPreview();
    }
}

function show3DPreview(glbUrl, posterUrl = '') {
    const container = document.getElementById('page-3d-preview-container');
    const wrapper = document.getElementById('page-model-viewer-wrapper');
    if (!container || !wrapper) return;

    container.style.display = 'block';
    wrapper.innerHTML = `
        <model-viewer
            src="${glbUrl}"
            ${posterUrl ? `poster="${posterUrl}"` : ''}
            alt="พรีวิวโมเดล 3 มิติ"
            auto-rotate
            camera-controls
            shadow-intensity="1"
            style="width:100%; height:100%; min-height:260px; background:#f8fafc;">
        </model-viewer>
    `;
}

function hide3DPreview() {
    const container = document.getElementById('page-3d-preview-container');
    const wrapper = document.getElementById('page-model-viewer-wrapper');
    const statusMsg = document.getElementById('trellis-status-msg');
    if (container) container.style.display = 'none';
    if (wrapper) wrapper.innerHTML = '';
    if (statusMsg) statusMsg.style.display = 'none';
}

// ==============================================================================
// GEMINI FLASH STORYTELLING
// ==============================================================================

async function aiGenerateProductStory() {
    const prodName = document.getElementById('p-name').value.trim();
    if (!prodName) {
        alert('กรุณากรอกชื่อสินค้าก่อนให้ AI แต่งเรื่องราวครับ');
        document.getElementById('p-name').focus();
        return;
    }

    const catSelect = document.getElementById('p-category');
    const catName = catSelect.options[catSelect.selectedIndex]?.text || '';
    const currentNotes = document.getElementById('p-story').value.trim();

    if (window.showToast) window.showToast('Gemini Flash กำลังเขียนเรื่องราวชิ้นงาน...', 'info');

    try {
        const res = await API.post('/ai/generate-story', {
            artisanName: currentSellerStore ? currentSellerStore.store_name : 'ช่างฝีมือ',
            disabilityType: currentSellerStore ? currentSellerStore.disability_type : 'ช่างฝีมือ',
            craftName: `${prodName} (${catName})`,
            rawNotes: currentNotes || `ผลิตด้วยมือทุกขั้นตอน ประณีต แข็งแรง ทนทาน`,
            goalTitle: currentSellerStore ? currentSellerStore.support_goal_title : 'สนับสนุนอาชีพ'
        });

        if (res.success && res.data) {
            const d = res.data;
            document.getElementById('p-story').value = `${d.quote ? d.quote + ' ' : ''}${d.story_paragraph_1 || ''}`.trim();
            if (d.story_paragraph_2 && !document.getElementById('p-desc').value) {
                document.getElementById('p-desc').value = d.story_paragraph_2;
            }
            if (window.showToast) window.showToast('สร้างเรื่องราวสินค้าด้วย Gemini Flash เรียบร้อยแล้ว', 'success');
        }
    } catch (err) {
        if (window.showToast) window.showToast(`เกิดข้อผิดพลาด: ${err.message}`, 'error');
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initProductAddPage);
} else {
    initProductAddPage();
}

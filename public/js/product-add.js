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
                const nameEmpty = !document.getElementById('p-name').value.trim();
                statusMsg.innerHTML = `✅ <strong>อัปโหลดสำเร็จ!</strong> ${nameEmpty ? 'คุณสามารถคลิกปุ่ม <strong>"✨ ให้ AI วิเคราะห์จากรูปนี้"</strong> เพื่อให้ AI ช่วยกรอกข้อมูลสินค้าทั้งหมดได้ทันที' : 'รูปภาพพร้อมใช้งานและพร้อมแปลงเป็น 3D'}`;
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

// ==============================================================================
// GEMINI MAGIC AUTOFILL & VOICE ASSISTANT
// ==============================================================================

let speechRecognitionInstance = null;
let isRecordingVoice = false;

async function triggerMagicAutofill(fromImageOnly = false) {
    const imageUrl = document.getElementById('p-image').value.trim();
    const promptInput = document.getElementById('ai-quick-prompt');
    const promptText = promptInput ? promptInput.value.trim() : '';

    if (!imageUrl && !promptText) {
        alert('กรุณาอัปโหลดรูปภาพสินค้า หรือพิมพ์/กดไมค์พูดบอกรายละเอียดสั้นๆ เพื่อให้ AI ช่วยเติมข้อมูลครับ');
        if (promptInput) promptInput.focus();
        return;
    }

    const btn = document.getElementById('btn-magic-autofill');
    const btnText = document.getElementById('btn-magic-autofill-text');
    const statusMsg = document.getElementById('ai-autofill-status');
    const originalText = btnText ? btnText.innerText : 'ให้ AI ช่วยกรอกข้อมูลสินค้า';

    try {
        if (btn) btn.disabled = true;
        if (btnText) btnText.innerText = 'กำลังวิเคราะห์ด้วย Gemini AI...';

        if (statusMsg) {
            statusMsg.style.display = 'block';
            statusMsg.style.background = '#e0f2fe';
            statusMsg.style.color = '#0369a1';
            statusMsg.style.border = '1px solid #7dd3fc';
            statusMsg.innerHTML = `
                <div style="display:flex; align-items:center; gap:8px;">
                    <span style="display:inline-block; animation:spin 1s linear infinite;">⏳</span>
                    <span><strong>Gemini AI กำลังทำงาน:</strong> สแกนและวิเคราะห์คุณลักษณะสินค้า คัดเลือกหมวดหมู่ แนะนำราคา และสร้างเรื่องราวประณีต...</span>
                </div>
            `;
        }

        if (window.showToast) window.showToast('Gemini Flash กำลังวิเคราะห์และจัดทำข้อมูลสินค้า...', 'info');

        const payload = {
            imageUrl: imageUrl || null,
            prompt: fromImageOnly ? (promptText ? `${promptText} (เน้นวิเคราะห์จากรูปภาพ)` : 'ช่วยวิเคราะห์จากรูปภาพนี้อย่างละเอียด') : promptText,
            sellerContext: currentSellerStore || {}
        };

        const res = await API.post('/ai/autofill-product', payload);

        if (res.success && res.data) {
            const d = res.data;

            // 1. Populate form fields
            const fieldsToHighlight = [];

            if (d.name) {
                const nameEl = document.getElementById('p-name');
                nameEl.value = d.name;
                fieldsToHighlight.push(nameEl);
            }

            if (d.category_id) {
                const catEl = document.getElementById('p-category');
                catEl.value = d.category_id;
                fieldsToHighlight.push(catEl);
            }

            if (d.price) {
                const priceEl = document.getElementById('p-price');
                priceEl.value = d.price;
                fieldsToHighlight.push(priceEl);
            }

            if (d.stock) {
                const stockEl = document.getElementById('p-stock');
                stockEl.value = d.stock;
                fieldsToHighlight.push(stockEl);
            }

            if (d.dimensions) {
                const dimEl = document.getElementById('p-dimensions');
                dimEl.value = d.dimensions;
                fieldsToHighlight.push(dimEl);
            }

            if (d.story) {
                const storyEl = document.getElementById('p-story');
                storyEl.value = d.story;
                fieldsToHighlight.push(storyEl);
            }

            if (d.description) {
                const descEl = document.getElementById('p-desc');
                descEl.value = d.description;
                fieldsToHighlight.push(descEl);
            }

            // 2. Trigger glow highlight animation on updated fields
            fieldsToHighlight.forEach(el => {
                el.classList.remove('ai-field-highlight');
                void el.offsetWidth; // force browser reflow
                el.classList.add('ai-field-highlight');
            });

            // 3. Update status message
            if (statusMsg) {
                statusMsg.style.display = 'block';
                statusMsg.style.background = '#dcfce7';
                statusMsg.style.color = '#15803d';
                statusMsg.style.border = '1px solid #86efac';
                statusMsg.innerHTML = `
                    <div style="display:flex; flex-direction:column; gap:4px;">
                        <div style="font-weight:700; display:flex; align-items:center; gap:6px;">
                            <span>✅ AI ช่วยกรอกข้อมูลให้ครบทุกช่องแล้ว!</span>
                            <span style="font-weight:normal; font-size:0.8rem; background:#bbf7d0; padding:1px 8px; border-radius:9999px;">${d.category_name || 'วิเคราะห์สำเร็จ'}</span>
                        </div>
                        <div style="font-size:0.82rem; color:#166534;">
                            ชื่อสินค้า: "<strong>${d.name}</strong>" | ราคาแนะนำ: <strong>${d.price} บาท</strong> | ขนาด: <strong>${d.dimensions || 'ตามสัดส่วน'}</strong>
                        </div>
                    </div>
                `;
            }

            if (window.showToast) {
                window.showToast('AI ช่วยจัดเตรียมข้อมูลสินค้าเรียบร้อยแล้ว!', 'success');
            }
        } else {
            throw new Error(res.message || 'ไม่สามารถประมวลผลข้อมูลได้');
        }
    } catch (err) {
        console.error('Magic Autofill Error:', err);
        if (statusMsg) {
            statusMsg.style.display = 'block';
            statusMsg.style.background = '#fee2e2';
            statusMsg.style.color = '#b91c1c';
            statusMsg.style.border = '1px solid #fca5a5';
            statusMsg.innerHTML = `❌ เกิดข้อผิดพลาด: ${err.message}`;
        }
        if (window.showToast) window.showToast(`เกิดข้อผิดพลาด: ${err.message}`, 'error');
    } finally {
        if (btn) btn.disabled = false;
        if (btnText) btnText.innerText = originalText;
    }
}

// ==============================================================================
// VOICE INPUT (SPEECH-TO-TEXT WITH WEB SPEECH API)
// ==============================================================================

function toggleVoiceInputForAI() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        alert('เบราว์เซอร์ของคุณไม่รองรับระบบสั่งการด้วยเสียง กรุณาใช้ Google Chrome หรือ Microsoft Edge ครับ');
        return;
    }

    const btn = document.getElementById('btn-voice-input');
    const promptInput = document.getElementById('ai-quick-prompt');
    const statusMsg = document.getElementById('ai-autofill-status');

    if (isRecordingVoice) {
        if (speechRecognitionInstance) {
            speechRecognitionInstance.stop();
        }
        return;
    }

    try {
        speechRecognitionInstance = new SpeechRecognition();
        speechRecognitionInstance.lang = 'th-TH';
        speechRecognitionInstance.continuous = false;
        speechRecognitionInstance.interimResults = true;

        speechRecognitionInstance.onstart = () => {
            isRecordingVoice = true;
            if (btn) {
                btn.classList.add('mic-recording');
                btn.title = 'กำลังฟังเสียง... (กดเพื่อหยุด)';
            }
            if (statusMsg) {
                statusMsg.style.display = 'block';
                statusMsg.style.background = '#fef2f2';
                statusMsg.style.color = '#991b1b';
                statusMsg.style.border = '1px solid #fecaca';
                statusMsg.innerHTML = `🎙️ <strong>กำลังฟังเสียงพูดภาษาไทย...</strong> พูดบอกรายละเอียดสินค้า เช่น <em>"กระเป๋าสะพายผักตบชวา ราคา 450 บาท"</em>`;
            }
        };

        speechRecognitionInstance.onresult = (event) => {
            let finalTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                }
            }

            if (finalTranscript && promptInput) {
                promptInput.value = (promptInput.value ? promptInput.value + ' ' : '') + finalTranscript;
            }
        };

        speechRecognitionInstance.onerror = (event) => {
            console.warn('Speech Recognition Error:', event.error);
            if (statusMsg) {
                statusMsg.style.display = 'block';
                statusMsg.style.background = '#fef2f2';
                statusMsg.style.color = '#991b1b';
                statusMsg.innerHTML = `⚠️ ระบบเสียง: ${event.error === 'no-speech' ? 'ไม่พบเสียงพูด กรุณาลองใหม่อีกครั้ง' : event.error}`;
            }
        };

        speechRecognitionInstance.onend = () => {
            isRecordingVoice = false;
            if (btn) {
                btn.classList.remove('mic-recording');
                btn.title = 'กดเพื่อพูดด้วยเสียงภาษาไทย';
            }
            if (promptInput && promptInput.value.trim() && statusMsg) {
                statusMsg.style.display = 'block';
                statusMsg.style.background = '#e0f2fe';
                statusMsg.style.color = '#0369a1';
                statusMsg.style.border = '1px solid #7dd3fc';
                statusMsg.innerHTML = `💬 ได้รับข้อความเสียง: "<strong>${promptInput.value.trim()}</strong>" - คลิกปุ่ม <strong>"ให้ AI ช่วยกรอกข้อมูลสินค้า"</strong> เพื่อให้ AI เริ่มประมวลผลได้ทันทีครับ!`;
            }
        };

        speechRecognitionInstance.start();
    } catch (err) {
        console.error('Speech Init Error:', err);
        alert('ไม่สามารถเปิดใช้งานระบบเสียงได้: ' + err.message);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initProductAddPage);
} else {
    initProductAddPage();
}


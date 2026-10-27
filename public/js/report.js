// ==============================================================================
// REPORT DIALOG
// Lets a signed-in user report a product / store to the admins (reports table)
// ==============================================================================

const ReportDialog = {
    target: null,
    trigger: null,

    ensureDialog() {
        let dialog = document.getElementById('report-dialog');
        if (dialog) return dialog;

        dialog = document.createElement('dialog');
        dialog.id = 'report-dialog';
        dialog.className = 'report-dialog';
        dialog.setAttribute('aria-labelledby', 'report-dialog-title');
        dialog.innerHTML = `
            <form method="dialog" id="report-form">
                <h2 id="report-dialog-title">รายงานปัญหา</h2>
                <p id="report-dialog-target" class="report-dialog-target"></p>
                <fieldset class="report-reasons">
                    <legend>เหตุผลที่รายงาน</legend>
                    <label><input type="radio" name="report-reason" value="ข้อมูลไม่ถูกต้องหรือหลอกลวง" checked> ข้อมูลไม่ถูกต้องหรือหลอกลวง</label>
                    <label><input type="radio" name="report-reason" value="สินค้าไม่ตรงกับที่ได้รับ"> สินค้าไม่ตรงกับที่ได้รับ</label>
                    <label><input type="radio" name="report-reason" value="เนื้อหาไม่เหมาะสม"> เนื้อหาไม่เหมาะสม</label>
                    <label><input type="radio" name="report-reason" value="อื่น ๆ"> อื่น ๆ</label>
                </fieldset>
                <label for="report-detail" class="report-detail-label">รายละเอียดเพิ่มเติม (ไม่บังคับ)</label>
                <textarea id="report-detail" rows="3" maxlength="900"></textarea>
                <p id="report-error" class="report-error" role="alert"></p>
                <div class="report-actions">
                    <button type="button" class="btn btn-secondary" id="report-cancel">ยกเลิก</button>
                    <button type="submit" class="btn btn-primary" id="report-submit">ส่งรายงาน</button>
                </div>
            </form>
        `;
        document.body.append(dialog);

        dialog.querySelector('#report-cancel').addEventListener('click', () => dialog.close());
        dialog.querySelector('#report-form').addEventListener('submit', event => {
            event.preventDefault();
            this.submit();
        });
        dialog.addEventListener('close', () => this.trigger?.focus());
        return dialog;
    },

    open(targetType, targetId, targetName = '') {
        if (!(window.Auth && Auth.isLoggedIn())) {
            if (window.showToast) window.showToast('กรุณาเข้าสู่ระบบก่อนรายงานปัญหา', 'warning');
            setTimeout(() => window.location.href = `/login.html?redirect=${encodeURIComponent(window.location.href)}`, 800);
            return;
        }
        this.target = { target_type: targetType, target_id: targetId };
        this.trigger = document.activeElement;

        const dialog = this.ensureDialog();
        dialog.querySelector('#report-form').reset();
        dialog.querySelector('#report-error').textContent = '';
        dialog.querySelector('#report-dialog-target').textContent = targetName ? `รายการ: ${targetName}` : '';
        dialog.showModal();
        dialog.querySelector('input[name="report-reason"]').focus();
    },

    async submit() {
        const dialog = this.ensureDialog();
        const reason = dialog.querySelector('input[name="report-reason"]:checked').value;
        const detail = dialog.querySelector('#report-detail').value.trim();
        const submitBtn = dialog.querySelector('#report-submit');

        submitBtn.disabled = true;
        try {
            const res = await API.post('/reports', {
                ...this.target,
                reason: detail ? `${reason}: ${detail}` : reason
            });
            dialog.close();
            if (window.showToast) window.showToast(res.message, 'success');
        } catch (err) {
            dialog.querySelector('#report-error').textContent = err.message || 'ส่งรายงานไม่สำเร็จ กรุณาลองอีกครั้ง';
        } finally {
            submitBtn.disabled = false;
        }
    }
};

if (typeof window !== 'undefined') {
    window.ReportDialog = ReportDialog;
}

// Homepage search progressively enhances a native GET form.
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('home-search-form');
    if (!form) return;

    const input = document.getElementById('home-search-input');
    const voiceButton = document.getElementById('home-search-voice');
    const voiceLabel = voiceButton.querySelector('span');
    const status = document.getElementById('home-search-status');
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let activeRecognition = null;

    function resetVoiceButton() {
        voiceButton.setAttribute('aria-pressed', 'false');
        voiceLabel.textContent = 'ค้นหาด้วยเสียง';
    }

    function cancelVoice() {
        const recognition = activeRecognition;
        activeRecognition = null;
        resetVoiceButton();
        if (recognition) recognition.abort();
    }

    input.addEventListener('input', () => input.setCustomValidity(''));
    form.addEventListener('submit', (event) => {
        input.value = input.value.trim();
        if (!input.value) {
            event.preventDefault();
            input.setCustomValidity('กรุณาพิมพ์คำที่ต้องการค้นหา');
            input.reportValidity();
            input.focus();
            return;
        }
        cancelVoice();
        // Native form submission encodes Thai text and query delimiters safely.
    });

    voiceButton.hidden = false;
    if (!Recognition || window.isSecureContext === false) {
        voiceButton.disabled = true;
        status.textContent = !Recognition
            ? 'เบราว์เซอร์นี้ไม่รองรับการค้นหาด้วยเสียง กรุณาพิมพ์คำค้นหาแทน'
            : 'ค้นหาด้วยเสียงต้องเปิดเว็บผ่าน HTTPS กรุณาพิมพ์คำค้นหาแทน';
        return;
    }

    status.textContent = 'พิมพ์คำค้นหา หรือกดไมโครโฟนแล้วพูดภาษาไทย ตรวจสอบคำก่อนกดค้นหา';
    voiceButton.addEventListener('click', () => {
        if (activeRecognition) {
            cancelVoice();
            status.textContent = 'ยกเลิกการฟังแล้ว คุณสามารถพิมพ์คำค้นหาได้';
            return;
        }

        let recognition;
        try {
            recognition = new Recognition();
            recognition.lang = 'th-TH';
            recognition.continuous = false;
            recognition.interimResults = false;
            recognition.maxAlternatives = 1;
            let receivedResult = false;
            let failed = false;

            recognition.onstart = () => {
                if (activeRecognition !== recognition) return;
                status.textContent = 'กำลังฟัง… พูดชื่อสินค้าหรือร้านค้า กดปุ่มอีกครั้งเพื่อยกเลิก';
            };
            recognition.onresult = (event) => {
                if (activeRecognition !== recognition) return;
                const transcript = event.results[event.resultIndex || 0]?.[0]?.transcript?.trim();
                if (!transcript) return;
                receivedResult = true;
                input.value = transcript;
                input.setCustomValidity('');
                status.textContent = `ได้ยินว่า “${transcript}” ตรวจสอบหรือแก้ไขคำ แล้วกดค้นหา`;
                input.focus();
            };
            recognition.onerror = (event) => {
                if (activeRecognition !== recognition) return;
                failed = true;
                const messages = {
                    'not-allowed': 'ไม่ได้รับอนุญาตให้ใช้ไมโครโฟน กรุณาอนุญาตในการตั้งค่าเบราว์เซอร์ หรือพิมพ์คำค้นหาแทน',
                    'service-not-allowed': 'บริการค้นหาด้วยเสียงไม่พร้อมใช้งาน กรุณาพิมพ์คำค้นหาแทน',
                    'audio-capture': 'ไม่พบไมโครโฟนที่ใช้งานได้ กรุณาตรวจสอบอุปกรณ์ หรือพิมพ์คำค้นหาแทน',
                    'no-speech': 'ไม่ได้ยินเสียง กรุณากดไมโครโฟนเพื่อลองใหม่ หรือพิมพ์คำค้นหา',
                    'network': 'เชื่อมต่อบริการเสียงไม่ได้ กรุณาลองใหม่ หรือพิมพ์คำค้นหาแทน',
                    'aborted': 'หยุดการฟังแล้ว คุณสามารถพิมพ์คำค้นหาได้'
                };
                status.textContent = messages[event.error] || 'ค้นหาด้วยเสียงไม่สำเร็จ กรุณาลองใหม่ หรือพิมพ์คำค้นหาแทน';
                activeRecognition = null;
                resetVoiceButton();
            };
            recognition.onend = () => {
                if (activeRecognition !== recognition) return;
                activeRecognition = null;
                resetVoiceButton();
                if (!receivedResult && !failed) {
                    status.textContent = 'ยังไม่มีคำค้นหา กรุณากดไมโครโฟนเพื่อลองใหม่ หรือพิมพ์คำค้นหา';
                }
            };

            // Request the microphone only after an explicit user click.
            window.speechSynthesis?.cancel();
            activeRecognition = recognition;
            voiceButton.setAttribute('aria-pressed', 'true');
            voiceLabel.textContent = 'ยกเลิกการฟัง';
            status.textContent = 'กำลังเปิดไมโครโฟน… หากมีข้อความขออนุญาต กรุณาอนุญาตใช้ไมโครโฟน';
            recognition.start();
        } catch (error) {
            cancelVoice();
            status.textContent = 'เปิดไมโครโฟนไม่สำเร็จ กรุณาลองใหม่ หรือพิมพ์คำค้นหาแทน';
        }
    });

    voiceButton.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && activeRecognition) {
            cancelVoice();
            status.textContent = 'ยกเลิกการฟังแล้ว';
        }
    });
    window.addEventListener('pagehide', cancelVoice);
});

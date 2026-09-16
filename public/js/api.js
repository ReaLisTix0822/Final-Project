// ==============================================================================
// API HELPER MODULE
// ==============================================================================

const API = {
    baseUrl: '/api',

    getToken() {
        return localStorage.getItem('token');
    },

    setToken(token) {
        if (token) {
            localStorage.setItem('token', token);
        } else {
            localStorage.removeItem('token');
        }
    },

    getHeaders() {
        const headers = {
            'Content-Type': 'application/json'
        };
        const token = this.getToken();
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        return headers;
    },

    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const headers = {
            ...this.getHeaders(),
            ...(options.headers || {})
        };

        // If body is FormData, delete Content-Type so browser sets correct boundary
        if (options.body instanceof FormData) {
            delete headers['Content-Type'];
        }

        const config = {
            ...options,
            headers
        };

        try {
            const response = await fetch(url, config);
            const data = await response.json();

            if (!response.ok) {
                const errorMsg = data.message || `เกิดข้อผิดพลาดในการเชื่อมต่อ (${response.status})`;
                throw new Error(errorMsg);
            }

            return data;
        } catch (err) {
            console.error(`[API Error] [${endpoint}]:`, err);
            throw err;
        }
    },

    upload(endpoint, formData) {
        return this.request(endpoint, {
            method: 'POST',
            body: formData
        });
    },

    get(endpoint, params = {}) {
        const urlParams = new URLSearchParams();
        Object.keys(params).forEach(key => {
            if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
                urlParams.append(key, params[key]);
            }
        });
        const queryString = urlParams.toString();
        return this.request(queryString ? `${endpoint}?${queryString}` : endpoint, { method: 'GET' });
    },

    post(endpoint, body = {}) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(body)
        });
    },

    put(endpoint, body = {}) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(body)
        });
    },

    delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    }
};

if (typeof window !== 'undefined') {
    window.API = API;
}

const errorHandler = (err, req, res, next) => {
    console.error('❌ Server Error:', err);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์',
        error: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
};

module.exports = errorHandler;

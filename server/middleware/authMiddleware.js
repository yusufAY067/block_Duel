const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
    const authHeader = req.header('Authorization');
    if (!authHeader) return res.status(401).json({ error: 'Yetkilendirme reddedildi. Token bulunamadı.' });

    const token = authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Yetkilendirme reddedildi. Geçersiz token formatı.' });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded; // { userId, username }
        next();
    } catch (err) {
        res.status(401).json({ error: 'Geçersiz token.' });
    }
};

module.exports = authMiddleware;

// middleware/auth.js
import jwt from 'jsonwebtoken';

// Middleware para verificar token
export const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ msg: 'Acceso denegado. Token no proporcionado.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secreto_muy_secreto_para_dev');
    
    req.user = {
      id: decoded.id,
      role: decoded.role,
      fullName: decoded.fullName || ''
    };

    next();
  } catch (err) {
    return res.status(401).json({ msg: 'Token inválido o expirado' });
  }
};

// Middleware para verificar que sea admin (NOMBRE COHERENTE)
export const verifyAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ msg: 'Acceso denegado. Solo administradores.' });
  }
  next();
};
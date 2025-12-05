// routes/auth.js → VERSIÓN PRODUCCIÓN 2025
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../db/db.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'cambia-esta-clave-secreta-en-render-ya-mismo-123456789';

// ==================== CREAR ADMIN AUTOMÁTICO (solo la primera vez) ====================
async function ensureAdminExists() {
  try {
    const [rows] = await pool.query('SELECT id FROM users WHERE username = ?', ['admin']);
    if (rows.length === 0) {
      const hashed = await bcrypt.hash('Admin2025!', 12);
      await pool.query(
        'INSERT INTO users (username, email, password, fullName, role) VALUES (?, ?, ?, ?, ?)',
        ['admin', 'admin@consultorio.com', hashed, 'Administrador', 'admin']
      );
      console.log('Admin creado automáticamente: usuario=admin | contraseña=Admin2025!');
    }
  } catch (err) {
    console.error('Error creando admin:', err);
  }
}
ensureAdminExists(); // Se ejecuta al iniciar el server

// ==================== LOGIN ====================
router.post('/login', async (req, res) => {
  try {
    const { identifier, password } = req.body; // ahora solo un campo: identifier (email o username)

    if (!identifier || !password) {
      return res.status(400).json({ success: false, message: 'Faltan credenciales' });
    }

    const id = identifier.trim().toLowerCase();

    const [rows] = await pool.query(
      `SELECT id, username, password, fullName, email, role 
       FROM users 
       WHERE LOWER(username) = ? OR LOWER(email) = ?`,
      [id, id]
    );

    if (rows.length === 0) {
      return res.status(400).json({ success: false, message: 'Usuario no encontrado' });
    }

    const user = rows[0];
    const isMatch = await bcrypt.compare(password.trim(), user.password);

    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Contraseña incorrecta' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '12h' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error('Error login:', err);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

// ==================== REGISTRO (solo pacientes) ====================
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, fullName } = req.body;

    if (!username || !email || !password || !fullName) {
      return res.status(400).json({ success: false, message: 'Todos los campos son obligatorios' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Mínimo 6 caracteres' });
    }

    const [exists] = await pool.query(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [username.trim().toLowerCase(), email.trim().toLowerCase()]
    );

    if (exists.length > 0) {
      return res.status(400).json({ success: false, message: 'Usuario o email ya existe' });
    }

    const hashed = await bcrypt.hash(password, 12);

    const [result] = await pool.query(
      'INSERT INTO users (username, email, password, fullName, role) VALUES (?, ?, ?, ?, ?)',
      [username.trim().toLowerCase(), email.trim().toLowerCase(), hashed, fullName.trim(), 'paciente']
    );

    res.status(201).json({
      success: true,
      message: '¡Registro exitoso!',
      userId: result.insertId,
    });
  } catch (err) {
    console.error('Error registro:', err);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

// ==================== VERIFICAR TOKEN ====================
router.get('/verify', (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'No autorizado' });

    const decoded = jwt.verify(token, JWT_SECRET);
    res.json({ success: true, user: decoded });
  } catch (err) {
    res.status(401).json({ success: false, message: 'Token inválido' });
  }
});

// ==================== RUTA DE SALUD (para UptimeRobot) ====================
router.get('/health', (req, res) => {
  res.json({ success: true, uptime: process.uptime(), time: new Date().toISOString() });
});

export default router;
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../db/db.js';

const router = express.Router();

// ==================== LOGIN ====================
router.post('/login', async (req, res) => {
  let { username, password } = req.body;
  username = username?.trim();
  password = password?.trim();

  if (!username || !password) {
    return res.status(400).json({ msg: 'Faltan credenciales' });
  }

  try {
    const [rows] = await pool.query(
      'SELECT * FROM users WHERE username = ? OR email = ?',
      [username, username]
    );

    if (rows.length === 0) {
      return res.status(400).json({ msg: 'Usuario o contraseña incorrectos' });
    }

    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ msg: 'Usuario o contraseña incorrectos' });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET || 'secreto_muy_secreto_para_dev',
      { expiresIn: '8h' }
    );

    res.json({
      token,
      role: user.role,
      username: user.username,
      fullName: user.fullName
    });
  } catch (err) {
    console.error('Error en login:', err);
    res.status(500).json({ msg: 'Error del servidor' });
  }
});

// ==================== REGISTRO ====================
router.post('/register', async (req, res) => {
  let { username, password, fullName, email } = req.body;
  username = username?.trim();
  password = password?.trim();
  fullName = fullName?.trim();
  email = email?.toLowerCase()?.trim();

  if (!username || !password || !fullName || !email) {
    return res.status(400).json({ msg: 'Todos los campos son obligatorios' });
  }

  try {
    const [existing] = await pool.query(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [username, email]
    );

    if (existing.length > 0) {
      return res.status(400).json({ msg: 'El usuario o email ya está registrado' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const [result] = await pool.query(
      'INSERT INTO users (username, password, fullName, email, role) VALUES (?, ?, ?, ?, ?)',
      [username, hashedPassword, fullName, email, 'user']
    );

    res.json({ msg: 'Usuario creado con éxito', id: result.insertId });
  } catch (err) {
    console.error('Error en registro:', err);
    res.status(500).json({ msg: 'Error del servidor' });
  }
});

// ==================== RECUPERAR CONTRASEÑA (dev) ====================
router.post('/forgot-password', async (req, res) => {
  let { username, newPassword } = req.body;
  username = username?.trim();
  newPassword = newPassword?.trim();

  if (!username || !newPassword) {
    return res.status(400).json({ msg: 'Faltan datos' });
  }

  try {
    const [rows] = await pool.query('SELECT id FROM users WHERE username = ?', [username]);
    if (rows.length === 0) {
      return res.status(400).json({ msg: 'Usuario no encontrado' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(newPassword, salt);

    await pool.query('UPDATE users SET password = ? WHERE username = ?', [hashed, username]);

    res.json({ msg: 'Contraseña actualizada con éxito' });
  } catch (err) {
    console.error('Error en forgot-password:', err);
    res.status(500).json({ msg: 'Error del servidor' });
  }
});

export default router;
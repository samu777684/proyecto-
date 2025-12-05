// routes/auth.js
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../db/db.js';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

// ==================== LOGIN ====================
router.post('/login', async (req, res) => {
  let { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ msg: 'Faltan usuario y/o contraseña' });
  }

  username = username.trim().toLowerCase();
  password = password.trim();

  try {
    const [rows] = await pool.query(
      'SELECT id, username, password, fullName, email, role FROM users WHERE username = ? OR email = ?',
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
      { id: user.id, role: user.role, username: user.username },
      process.env.JWT_SECRET || 'secreto_muy_secreto_para_dev',
      { expiresIn: '12h' }
    );

    res.json({
      token,
      role: user.role,
      username: user.username,
      fullName: user.fullName,
      email: user.email
    });
  } catch (err) {
    console.error('Error en login:', err);
    res.status(500).json({ msg: 'Error del servidor' });
  }
});

// ==================== REGISTRO ====================
router.post('/register', async (req, res) => {
  let { username, password, fullName, email } = req.body;

  if (!username || !password || !fullName || !email) {
    return res.status(400).json({ msg: 'Todos los campos son obligatorios' });
  }

  username = username.trim().toLowerCase();
  password = password.trim();
  fullName = fullName.trim();
  email = email.trim().toLowerCase();

  try {
    // Verificar si ya existe usuario o email
    const [existing] = await pool.query(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [username, email]
    );

    if (existing.length > 0) {
      return res.status(400).json({ msg: 'El usuario o email ya está registrado' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const [result] = await pool.query(
      'INSERT INTO users (username, password, fullName, email, role) VALUES (?, ?, ?, ?, ?)',
      [username, hashedPassword, fullName, email, 'user']
    );

    res.status(201).json({
      msg: '¡Cuenta creada con éxito! Ya puedes iniciar sesión',
      userId: result.insertId
    });
  } catch (err) {
    console.error('Error en registro:', err);
    res.status(500).json({ msg: 'Error al crear la cuenta' });
  }
});

// ==================== RECUPERAR CONTRASEÑA (solo para desarrollo) ====================
router.post('/forgot-password', async (req, res) => {
  let { username, newPassword } = req.body;

  if (!username || !newPassword) {
    return res.status(400).json({ msg: 'Faltan datos' });
  }

  username = username.trim().toLowerCase();
  newPassword = newPassword.trim();

  if (newPassword.length < 6) {
    return res.status(400).json({ msg: 'La contraseña debe tener al menos 6 caracteres' });
  }

  try {
    const [users] = await pool.query('SELECT id FROM users WHERE username = ? OR email = ?', [username, username]);

    if (users.length === 0) {
      return res.status(400).json({ msg: 'Usuario no encontrado' });
    }

    const hashed = await bcrypt.hash(newPassword, 12);
    await pool.query('UPDATE users SET password = ? WHERE username = ? OR email = ?', [hashed, username, username]);

    res.json({ msg: '¡Contraseña cambiada con éxito! Ya puedes iniciar sesión' });
  } catch (err) {
    console.error('Error en forgot-password:', err);
    res.status(500).json({ msg: 'Error del servidor' });
  }
});

export default router;
// routes/auth.js - VERSIÓN CORREGIDA Y DEPURADA
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../db/db.js';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

// ==================== LOGIN - VERSIÓN MEJORADA ====================
router.post('/login', async (req, res) => {
  console.log('📨 Login request received:', req.body);
  
  try {
    let { email, password, username } = req.body;

    // Aceptar tanto email como username
    const userIdentifier = email || username;
    
    if (!userIdentifier || !password) {
      console.log('❌ Missing credentials');
      return res.status(400).json({ 
        success: false,
        message: 'Faltan credenciales' 
      });
    }

    userIdentifier = userIdentifier.trim().toLowerCase();
    password = password.trim();

    console.log(`🔍 Searching user: ${userIdentifier}`);
    
    // Buscar usuario por email o username
    const [rows] = await pool.query(
      `SELECT id, username, password, fullName, email, role 
       FROM users 
       WHERE username = ? OR email = ?`,
      [userIdentifier, userIdentifier]
    );

    console.log(`📊 Users found: ${rows.length}`);

    if (rows.length === 0) {
      console.log('❌ User not found');
      return res.status(400).json({ 
        success: false,
        message: 'Usuario no encontrado' 
      });
    }

    const user = rows[0];
    console.log(`✅ User found: ${user.username} (${user.role})`);

    // Verificar contraseña
    const isMatch = await bcrypt.compare(password, user.password);
    
    if (!isMatch) {
      console.log('❌ Password mismatch');
      return res.status(400).json({ 
        success: false,
        message: 'Contraseña incorrecta' 
      });
    }

    console.log('✅ Password verified');

    // Crear token JWT
    const token = jwt.sign(
      { 
        id: user.id, 
        role: user.role, 
        username: user.username,
        email: user.email
      },
      process.env.JWT_SECRET || 'secreto_temporal_para_desarrollo',
      { expiresIn: '24h' }
    );

    console.log('✅ Token generated successfully');

    // Respuesta exitosa
    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        role: user.role
      },
      message: 'Login exitoso'
    });

  } catch (err) {
    console.error('🔥 ERROR EN LOGIN:', err);
    console.error('Error stack:', err.stack);
    
    res.status(500).json({ 
      success: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// ==================== REGISTRO - VERSIÓN MEJORADA ====================
router.post('/register', async (req, res) => {
  console.log('📨 Register request:', req.body);
  
  try {
    let { username, email, password, fullName } = req.body;

    if (!username || !email || !password || !fullName) {
      return res.status(400).json({ 
        success: false,
        message: 'Todos los campos son obligatorios' 
      });
    }

    username = username.trim().toLowerCase();
    email = email.trim().toLowerCase();
    password = password.trim();
    fullName = fullName.trim();

    if (password.length < 6) {
      return res.status(400).json({ 
        success: false,
        message: 'La contraseña debe tener al menos 6 caracteres' 
      });
    }

    // Verificar si ya existe
    const [existing] = await pool.query(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [username, email]
    );

    if (existing.length > 0) {
      return res.status(400).json({ 
        success: false,
        message: 'El usuario o email ya está registrado' 
      });
    }

    // Encriptar contraseña
    const hashedPassword = await bcrypt.hash(password, 12);

    // Insertar nuevo usuario
    const [result] = await pool.query(
      'INSERT INTO users (username, email, password, fullName, role) VALUES (?, ?, ?, ?, ?)',
      [username, email, hashedPassword, fullName, 'paciente'] // Cambié 'user' por 'paciente' para tu sistema
    );

    console.log(`✅ User registered: ${username} (ID: ${result.insertId})`);

    res.status(201).json({
      success: true,
      message: '¡Cuenta creada exitosamente!',
      userId: result.insertId
    });

  } catch (err) {
    console.error('🔥 ERROR EN REGISTRO:', err);
    res.status(500).json({ 
      success: false,
      message: 'Error al crear la cuenta',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// ==================== VERIFICAR TOKEN ====================
router.post('/verify', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ 
        success: false,
        message: 'No hay token' 
      });
    }

    const decoded = jwt.verify(
      token, 
      process.env.JWT_SECRET || 'secreto_temporal_para_desarrollo'
    );

    // Verificar que el usuario aún existe
    const [rows] = await pool.query(
      'SELECT id, username, fullName, email, role FROM users WHERE id = ?',
      [decoded.id]
    );

    if (rows.length === 0) {
      return res.status(401).json({ 
        success: false,
        message: 'Usuario no encontrado' 
      });
    }

    const user = rows[0];

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        role: user.role
      }
    });

  } catch (err) {
    console.error('Token verification error:', err);
    res.status(401).json({ 
      success: false,
      message: 'Token inválido o expirado' 
    });
  }
});

// ==================== RUTA DE PRUEBA ====================
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Auth routes working!',
    timestamp: new Date().toISOString()
  });
});

export default router;
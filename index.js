// index.js
import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import pool from './db/db.js';
import authRouter from './routes/auth.js';
import adminRouter from './routes/admin.js';     // ← Importamos como ES Module
import citasRouter from './routes/citas.js';     // ← (opcional, si ya lo tienes)

import dotenv from 'dotenv';
dotenv.config(); // ← Muy importante para leer .env

const app = express();

// Middlewares
app.use(cors({
  origin: 'http://localhost:5173', // Cambia si tu frontend está en otro puerto
  credentials: true
}));
app.use(express.json());

// Rutas
app.use('/api/auth', authRouter);
app.use('/api/admin', adminRouter);        // ← Ahora sí funciona
app.use('/api/citas', citasRouter);        // ← Si ya tienes esta ruta

// Middleware de verificación de token
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ msg: 'No autorizado' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secreto_muy_secreto_para_dev');
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ msg: 'Token inválido o expirado' });
  }
};

// Ruta /api/me (usada por tu frontend para saber quién está logueado)
app.get('/api/me', verifyToken, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, username, email, fullName, role FROM users WHERE id = ?',
      [req.user.id]
    );
    if (rows.length === 0) return res.status(404).json({ msg: 'Usuario no encontrado' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Error del servidor' });
  }
});

// Ruta de prueba
app.get('/', (req, res) => res.send('Backend del consultorio médico funcionando'));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
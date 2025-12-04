// index.js
import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import pool from './db/db.js';
import authRouter from './routes/auth.js';
import adminRouter from './routes/admin.js';
import citasRouter from './routes/citas.js';

import dotenv from 'dotenv';
dotenv.config();

const app = express();

// CORS CORREGIDO PARA LOCAL + PRODUCCIÓN
app.use(cors({
  origin: [
    'http://localhost:5173',                    // Desarrollo local
    'https://proyecto-frontend-t7fk.vercel.app' // Producción (tu frontend en Vercel)
  ],
  credentials: true
}));

app.use(express.json());

// Rutas
app.use('/api/auth', authRouter);
app.use('/api/admin', adminRouter);
app.use('/api/citas', citasRouter);

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

// Ruta /api/me
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

// Ruta de prueba de base de datos
app.get("/test-db", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT NOW()");
    res.json({ success: true, time: rows[0] });
  } catch (err)16n {
    res.status(500).json({ error: err.message });
  }
});

// Ruta raíz
app.get('/', (req, res) => {
  res.send('Backend del consultorio médico funcionando correctamente');
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
  console.log(`URL: https://proyecto-production-fc30.up.railway.app`);
});
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

// CORS 100% CORREGIDO (esto es lo que fallaba)
app.use(
  cors({
    origin: [
      'http://localhost:5173',
      'https://proyecto-frontend-t7fk.vercel.app'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],  // ← FALTABA OPTIONS
    allowedHeaders: ['Content-Type', 'Authorization']      // ← importante
  })
);

// Esto es CRUCIAL para que no dé Network Error en POST
app.options('*', cors()); // responde automáticamente a los preflight

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true })); // por si acaso

// Rutas
app.use('/api/auth', authRouter);
app.use('/api/admin', adminRouter);
app.use('/api/citas', citasRouter);

// Verificar token
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

// Ruta raíz (para despertar el servidor)
app.get('/', (req, res) => {
  res.send('Backend del consultorio médico funcionando correctamente');
});

app.get('/test-db', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT NOW()');
    res.json({ success: true, time: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Puerto
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
  console.log(`URL: https://proyecto-2-yy3f.onrender.com`);
});
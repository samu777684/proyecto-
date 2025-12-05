// server.js o app.js - VERSIÓN FINAL PARA DESPLIEGUE CON MYSQL
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Importar rutas
import authRoutes from './routes/auth.js';
import citasRoutes from './routes/citas.js';
import userRoutes from './routes/users.js';
import adminRoutes from './routes/admin.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// ==================== MIDDLEWARE ====================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ==================== CORS - VERSIÓN DEFINITIVA 100% FUNCIONAL EN PRODUCCIÓN ====================
const corsOptions = {
  origin: (origin, callback) => {
    // Permitir requests sin origin (como mobile apps o curl)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:3000',
      'http://localhost:5174',
      'https://proyecto-frontend-t7fk.vercel.app',
      'https://proyecto-frontend.vercel.app'
    ];

    // Permitir todos los subdominios de vercel.app
    if (origin.endsWith('.vercel.app') || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // En desarrollo, permitir todo
    if (process.env.NODE_ENV === 'development') {
      console.log('CORS: Permitiendo origen en desarrollo:', origin);
      return callback(null, true);
    }

    console.log('CORS bloqueado para origen:', origin);
    return callback(new Error('CORS bloqueado'), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // ← imprescindible para preflight requests

// ==================== RUTAS ====================
app.use('/api/auth', authRoutes);
app.use('/api/citas', citasRoutes);
app.use('/api/user', userRoutes);
app.use('/api/admin', adminRoutes);

// ==================== RUTA DE PRUEBA ====================
app.get('/', (req, res) => {
  res.json({
    message: 'API del Sistema de Citas Médicas con MySQL',
    status: 'online',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    database: 'MySQL'
  });
});

// ==================== RUTA DE PRUEBA DE CONEXIÓN A BD ====================
app.get('/api/test-db', async (req, res) => {
  try {
    const pool = await import('./db/db.js').then(module => module.default);
    const [result] = await pool.query('SELECT 1 + 1 AS solution');
    
    res.json({
      success: true,
      message: 'Conexión a MySQL exitosa',
      data: result[0]
    });
  } catch (error) {
    console.error('Error en prueba de BD:', error);
    res.status(500).json({
      success: false,
      message: 'Error al conectar con MySQL',
      error: error.message
    });
  }
});

// ==================== MANEJO DE ERRORES 404 ====================
app.use((req, res) => {
  res.status(404).json({ msg: 'Ruta no encontrada' });
});

// ==================== MANEJO DE ERRORES GLOBAL ====================
app.use((err, req, res, next) => {
  console.error('Error global:', err);
  
  // Si es error de CORS
  if (err.message === 'CORS bloqueado') {
    return res.status(403).json({ msg: 'Acceso no permitido desde este origen' });
  }
  
  res.status(500).json({ 
    msg: 'Error interno del servidor',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// ==================== INICIAR SERVIDOR ====================
app.listen(PORT, () => {
  console.log(`
  ===========================================
  🚀 Servidor corriendo en puerto ${PORT}
  🌍 Ambiente: ${process.env.NODE_ENV || 'development'}
  🗄️  Base de datos: MySQL (InfinityFree)
  📅 ${new Date().toLocaleString()}
  ===========================================
  `);
});

export default app;
// CORS - VERSIÓN DEFINITIVA 100% FUNCIONAL EN PRODUCCIÓN
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      
      const allowed = [
        'http://localhost:5173',
        'http://localhost:3000',
        'https://proyecto-frontend-t7fk.vercel.app'
      ];

      if (origin.endsWith('.vercel.app') || allowed.includes(origin)) {
        return callback(null, true);
      }

      if (process.env.NODE_ENV === 'development') {
        return callback(null, true);
      }

      return callback(new Error('CORS bloqueado'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
);

app.options('*', cors()); // ← imprescindible
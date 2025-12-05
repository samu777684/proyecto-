// db/db.js - PARA MYSQL (InfinityFree)
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

console.log("🔧 Iniciando conexión a MySQL...");
console.log("Host:", process.env.DB_HOST || 'No configurado');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'sql213.infinityfree.com',
  user: process.env.DB_USER || 'if0_40591285',
  password: process.env.DB_PASSWORD || 'E7RgqdLL7MYLl',
  database: process.env.DB_NAME || 'if0_40591285_citasmedicas',
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

// Probar conexión
const testConnection = async () => {
  try {
    const connection = await pool.getConnection();
    console.log("✅ Conectado a MySQL InfinityFree");
    console.log(`📊 Base de datos: ${process.env.DB_NAME || 'if0_40591285_citasmedicas'}`);
    connection.release();
    
    // Verificar tablas existentes
    const [tables] = await pool.query('SHOW TABLES');
    console.log(`📋 Tablas existentes: ${tables.length}`);
    
  } catch (err) {
    console.error("❌ Error al conectar a MySQL:", err.message);
    console.error("Código de error:", err.code);
    console.error("Detalles:", err);
    
    // Intentar crear la base de datos si no existe
    if (err.code === 'ER_BAD_DB_ERROR') {
      console.log("⚠️  La base de datos no existe. Creando...");
      await createDatabase();
    }
  }
};

// Función para crear la base de datos si no existe
const createDatabase = async () => {
  try {
    const tempPool = mysql.createPool({
      host: process.env.DB_HOST || 'sql213.infinityfree.com',
      user: process.env.DB_USER || 'if0_40591285',
      password: process.env.DB_PASSWORD || 'E7RgqdLL7MYLl',
      port: process.env.DB_PORT || 3306
    });
    
    const dbName = process.env.DB_NAME || 'if0_40591285_citasmedicas';
    await tempPool.query(`CREATE DATABASE IF NOT EXISTS ${dbName}`);
    console.log(`✅ Base de datos '${dbName}' creada exitosamente`);
    
    await tempPool.end();
    
    // Ahora intentar conectar de nuevo
    await testConnection();
    
  } catch (createErr) {
    console.error("❌ Error al crear la base de datos:", createErr.message);
  }
};

// Ejecutar prueba de conexión al iniciar
testConnection();

export default pool;
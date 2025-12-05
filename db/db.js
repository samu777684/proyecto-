// db/db.js - CONEXIÓN INFINITYFREE CON TU BD REAL
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

console.log("====================================");
console.log("🔧 CONEXIÓN A INFINITYFREE MYSQL");
console.log("====================================");
console.log("🏷️  Host: sql213.infinityfree.com");
console.log("👤 Usuario: if0_40591285");
console.log("🗄️  Base de datos: if0_40591285_consultorio_medico");
console.log("====================================");

// CONFIGURACIÓN EXACTA PARA TU BD EN INFINITYFREE
const config = {
  host: 'sql213.infinityfree.com',
  user: 'if0_40591285',
  password: 'E7RgqdLL7MYLl',
  database: 'if0_40591285_consultorio_medico', // ← ¡TU BD REAL!
  port: 3306,
  
  // Configuraciones óptimas para InfinityFree
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 20000, // 20 segundos para conexiones lentas
  acquireTimeout: 20000,
  
  // Configuración específica para evitar timeout
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  
  // Configurar zona horaria si es necesario
  timezone: 'Z'
};

const pool = mysql.createPool(config);

// FUNCIÓN MEJORADA PARA PROBAR CONEXIÓN
const testConnection = async () => {
  let connection;
  try {
    console.log("\n🔄 Intentando conexión a InfinityFree...");
    
    // Obtener conexión del pool
    connection = await pool.getConnection();
    console.log("✅ ¡CONEXIÓN ESTABLECIDA EXITOSAMENTE!");
    console.log(`📊 Base de datos conectada: if0_40591285_consultorio_medico`);
    
    // Probar consulta básica
    const [result] = await connection.query('SELECT 1 + 1 AS suma, NOW() AS fecha_servidor');
    console.log(`🧮 Prueba de cálculo: 1 + 1 = ${result[0].suma}`);
    console.log(`📅 Fecha/hora del servidor MySQL: ${result[0].fecha_servidor}`);
    
    // Verificar tablas existentes en TU base de datos
    const [tables] = await connection.query(`
      SELECT TABLE_NAME, TABLE_ROWS 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = 'if0_40591285_consultorio_medico'
    `);
    
    console.log(`\n📋 TABLAS EN TU BASE DE DATOS (${tables.length}):`);
    if (tables.length === 0) {
      console.log("⚠️  No hay tablas. Necesitas crear la estructura.");
      console.log("💡 Ejecuta el script SQL en phpMyAdmin para crear tablas.");
    } else {
      tables.forEach(table => {
        console.log(`   • ${table.TABLE_NAME} (${table.TABLE_ROWS || 0} registros)`);
      });
    }
    
    connection.release();
    console.log("\n🎉 ¡Base de datos lista para usar!");
    
  } catch (err) {
    console.error("\n❌ ERROR DE CONEXIÓN:");
    console.error("Código:", err.code);
    console.error("Mensaje:", err.message);
    console.error("Número error:", err.errno);
    
    if (err.code === 'ER_BAD_DB_ERROR') {
      console.error("\n⚠️  LA BASE DE DATOS NO EXISTE:");
      console.error("Asegúrate de que el nombre sea exacto:");
      console.error("if0_40591285_consultorio_medico");
      console.error("\n💡 Ve a phpMyAdmin y verifica que exista.");
    }
    
    if (err.code === 'ENOTFOUND') {
      console.error("\n🌐 ERROR DE DNS/RED:");
      console.error("1. Verifica tu conexión a internet");
      console.error("2. El host 'sql213.infinityfree.com' debe ser accesible");
      console.error("3. Prueba hacer ping: ping sql213.infinityfree.com");
    }
    
    if (err.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error("\n🔐 ERROR DE CREDENCIALES:");
      console.error("Usuario o contraseña incorrectos");
      console.error("Usuario: if0_40591285");
    }
    
    if (connection) {
      connection.release();
    }
  }
};

// Ejecutar prueba al iniciar
testConnection();

// Exportar el pool de conexiones
export default pool;
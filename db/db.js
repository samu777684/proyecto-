// db.js  ← Reemplaza todo el archivo con esto
import mysql from 'mysql2';
import dotenv from 'dotenv';

dotenv.config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'consultorio_medico',
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// ¡¡ESTA LÍNEA ES LA CLAVE!!
// Convertimos el pool normal en uno que soporte promesas
const promisePool = pool.promise();

export default promisePool;
// db.js
import pkg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,  // URL completa del Session Pooler
  ssl: { rejectUnauthorized: false }           // Necesario para Supabase
});

// Probar conexión
pool.connect()
  .then(() => console.log("✅ Conectado a PostgreSQL Supabase"))
  .catch(err => console.error("❌ Error al conectar a Supabase:", err));

export default pool;
// routes/admin.js → VERSIÓN CORREGIDA Y COMPATIBLE CON TU SISTEMA
import express from "express";
import pool from "../db/db.js";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const router = express.Router();

// ==================== MIDDLEWARE: SOLO ADMIN ====================
const verifyAdmin = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ 
        success: false,
        message: "Acceso denegado: token requerido" 
      });
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({ 
        success: false,
        message: "Token no encontrado" 
      });
    }

    // Verificar token - USANDO EL MISMO SECRET QUE AUTH.JS
    const decoded = jwt.verify(
      token, 
      process.env.JWT_SECRET || "secreto_temporal_para_desarrollo"
    );

    // Verificar que el usuario tenga rol 'admin'
    if (decoded.role !== "admin") {
      return res.status(403).json({ 
        success: false,
        message: "Acceso prohibido: se requiere rol de administrador" 
      });
    }

    req.user = decoded;
    next();
  } catch (err) {
    console.error("❌ Error verificando token admin:", err.message);
    
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ 
        success: false,
        message: "Sesión expirada" 
      });
    }
    
    return res.status(401).json({ 
      success: false,
      message: "Token inválido" 
    });
  }
};

// ==================== 1. TODAS LAS CITAS (VISTA ADMIN) ====================
router.get("/citas", verifyAdmin, async (req, res) => {
  try {
    console.log("📋 Admin solicitando todas las citas");
    
    // Primero verificar si existe la tabla citas
    const [tables] = await pool.query(`
      SHOW TABLES LIKE 'citas'
    `);
    
    if (tables.length === 0) {
      console.log("⚠️  La tabla 'citas' no existe");
      return res.status(200).json({
        success: true,
        message: "Tabla de citas no existe aún",
        citas: []
      });
    }

    // Obtener citas con información de pacientes y médicos
    const [rows] = await pool.query(`
      SELECT 
        c.id,
        c.fecha,
        c.hora,
        c.motivo,
        c.estado,
        c.created_at,
        p.fullName AS paciente_nombre,
        p.email AS paciente_email,
        m.fullName AS medico_nombre,
        m.email AS medico_email
      FROM citas c
      LEFT JOIN users p ON p.id = c.paciente_id
      LEFT JOIN users m ON m.id = c.medico_id
      ORDER BY c.fecha DESC, c.hora DESC
    `);

    console.log(`✅ Encontradas ${rows.length} citas`);
    
    res.json({
      success: true,
      count: rows.length,
      citas: rows
    });
  } catch (err) {
    console.error("🔥 Error cargando citas (admin):", err);
    res.status(500).json({ 
      success: false,
      message: "Error al cargar las citas",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// ==================== 2. CAMBIAR ESTADO DE CITA (ADMIN) ====================
router.put("/citas/:id/estado", verifyAdmin, async (req, res) => {
  try {
    const { estado } = req.body;
    const citaId = req.params.id;
    
    console.log(`🔄 Cambiando estado cita ${citaId} a: ${estado}`);
    
    const estadosValidos = ["pendiente", "confirmada", "completada", "cancelada"];

    if (!estado || !estadosValidos.includes(estado)) {
      return res.status(400).json({ 
        success: false,
        message: `Estado inválido. Usa: ${estadosValidos.join(", ")}` 
      });
    }

    const [result] = await pool.query(
      "UPDATE citas SET estado = ?, updated_at = NOW() WHERE id = ?",
      [estado, citaId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ 
        success: false,
        message: "Cita no encontrada" 
      });
    }

    console.log(`✅ Cita ${citaId} actualizada a estado: ${estado}`);
    
    res.json({ 
      success: true,
      message: `Cita marcada como "${estado}" correctamente`,
      citaId,
      nuevoEstado: estado
    });
  } catch (err) {
    console.error("🔥 Error actualizando estado de cita:", err);
    res.status(500).json({ 
      success: false,
      message: "Error al actualizar el estado de la cita",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// ==================== 3. TODOS LOS USUARIOS ====================
router.get("/usuarios", verifyAdmin, async (req, res) => {
  try {
    console.log("👥 Admin solicitando lista de usuarios");
    
    const [rows] = await pool.query(`
      SELECT 
        id,
        username,
        fullName,
        email,
        role,
        telefono,
        created_at,
        updated_at
      FROM users 
      ORDER BY created_at DESC
    `);

    console.log(`✅ Encontrados ${rows.length} usuarios`);
    
    res.json({
      success: true,
      count: rows.length,
      usuarios: rows
    });
  } catch (err) {
    console.error("🔥 Error cargando usuarios (admin):", err);
    res.status(500).json({ 
      success: false,
      message: "Error al cargar usuarios",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// ==================== 4. CAMBIAR ROL DE USUARIO ====================
router.put("/usuarios/:id/rol", verifyAdmin, async (req, res) => {
  try {
    const { role } = req.body;
    const userId = req.params.id;
    
    console.log(`🔄 Cambiando rol usuario ${userId} a: ${role}`);
    
    // Roles compatibles con tu sistema (USAR LOS MISMOS QUE EN AUTH.JS)
    const rolesPermitidos = ["paciente", "medico", "admin"];

    if (!role || !rolesPermitidos.includes(role)) {
      return res.status(400).json({ 
        success: false,
        message: `Rol inválido. Opciones: ${rolesPermitidos.join(", ")}` 
      });
    }

    // No permitir cambiar rol de otro admin a menos que seas superadmin
    // (Aquí podrías agregar lógica extra si necesitas)
    if (userId == req.user.id && role !== "admin") {
      return res.status(400).json({ 
        success: false,
        message: "No puedes quitarte el rol de admin a ti mismo" 
      });
    }

    const [result] = await pool.query(
      "UPDATE users SET role = ?, updated_at = NOW() WHERE id = ?",
      [role, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ 
        success: false,
        message: "Usuario no encontrado" 
      });
    }

    console.log(`✅ Usuario ${userId} ahora tiene rol: ${role}`);
    
    res.json({ 
      success: true,
      message: `Rol cambiado a "${role}" correctamente`,
      userId,
      nuevoRol: role
    });
  } catch (err) {
    console.error("🔥 Error cambiando rol:", err);
    res.status(500).json({ 
      success: false,
      message: "Error al cambiar el rol",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// ==================== 5. CREAR TABLA DE CITAS SI NO EXISTE ====================
router.post("/setup-tables", verifyAdmin, async (req, res) => {
  try {
    console.log("🛠️  Creando tabla de citas...");
    
    // Crear tabla de médicos (especialidades)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS medicos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT,
        especialidad VARCHAR(100),
        descripcion TEXT,
        horario_inicio TIME,
        horario_fin TIME,
        duracion_cita INT DEFAULT 30,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Crear tabla de citas
    await pool.query(`
      CREATE TABLE IF NOT EXISTS citas (
        id INT AUTO_INCREMENT PRIMARY KEY,
        paciente_id INT,
        medico_id INT,
        fecha DATE NOT NULL,
        hora TIME NOT NULL,
        motivo TEXT,
        notas TEXT,
        estado ENUM('pendiente', 'confirmada', 'completada', 'cancelada') DEFAULT 'pendiente',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (paciente_id) REFERENCES users(id),
        FOREIGN KEY (medico_id) REFERENCES medicos(id)
      )
    `);

    console.log("✅ Tablas creadas exitosamente");
    
    res.json({
      success: true,
      message: "Tablas 'medicos' y 'citas' creadas exitosamente"
    });
  } catch (err) {
    console.error("🔥 Error creando tablas:", err);
    res.status(500).json({ 
      success: false,
      message: "Error al crear tablas",
      error: err.message
    });
  }
});

// ==================== 6. DASHBOARD - ESTADÍSTICAS ====================
router.get("/dashboard", verifyAdmin, async (req, res) => {
  try {
    console.log("📊 Generando estadísticas del dashboard");
    
    // Total usuarios por rol
    const [usuariosPorRol] = await pool.query(`
      SELECT role, COUNT(*) as total 
      FROM users 
      GROUP BY role
    `);

    // Total citas por estado
    const citasPorEstado = await pool.query(`
      SELECT estado, COUNT(*) as total 
      FROM citas 
      GROUP BY estado
    `).then(([rows]) => rows).catch(() => []);

    // Usuarios registrados recientemente (últimos 7 días)
    const [usuariosRecientes] = await pool.query(`
      SELECT id, username, fullName, role, created_at
      FROM users
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      ORDER BY created_at DESC
      LIMIT 10
    `);

    // Citas recientes
    const citasRecientes = await pool.query(`
      SELECT c.id, c.fecha, c.estado, u.fullName as paciente_nombre
      FROM citas c
      LEFT JOIN users u ON u.id = c.paciente_id
      ORDER BY c.created_at DESC
      LIMIT 10
    `).then(([rows]) => rows).catch(() => []);

    res.json({
      success: true,
      estadisticas: {
        totalUsuarios: usuariosPorRol.reduce((sum, item) => sum + item.total, 0),
        usuariosPorRol,
        citasPorEstado,
        usuariosRecientes,
        citasRecientes
      }
    });
  } catch (err) {
    console.error("🔥 Error generando dashboard:", err);
    res.status(500).json({ 
      success: false,
      message: "Error al generar estadísticas",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// ==================== 7. ELIMINAR USUARIO (CON SEGURIDAD) ====================
router.delete("/usuarios/:id", verifyAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    
    console.log(`🗑️  Intentando eliminar usuario ID: ${userId}`);
    
    // No permitir eliminarse a sí mismo
    if (userId == req.user.id) {
      return res.status(400).json({ 
        success: false,
        message: "No puedes eliminarte a ti mismo" 
      });
    }

    // Iniciar transacción
    await pool.query("START TRANSACTION");

    try {
      // Verificar si el usuario existe
      const [user] = await pool.query("SELECT role FROM users WHERE id = ?", [userId]);
      
      if (user.length === 0) {
        await pool.query("ROLLBACK");
        return res.status(404).json({ 
          success: false,
          message: "Usuario no encontrado" 
        });
      }

      // No permitir eliminar otros admins (a menos que seas superadmin)
      if (user[0].role === "admin") {
        await pool.query("ROLLBACK");
        return res.status(403).json({ 
          success: false,
          message: "No puedes eliminar a otro administrador" 
        });
      }

      // Eliminar citas relacionadas primero
      await pool.query("DELETE FROM citas WHERE paciente_id = ?", [userId]);
      
      // Si el usuario es médico, eliminar o actualizar referencias
      if (user[0].role === "medico") {
        await pool.query("DELETE FROM medicos WHERE user_id = ?", [userId]);
        await pool.query("UPDATE citas SET medico_id = NULL WHERE medico_id IN (SELECT id FROM medicos WHERE user_id = ?)", [userId]);
      }

      // Finalmente eliminar el usuario
      const [result] = await pool.query("DELETE FROM users WHERE id = ?", [userId]);

      await pool.query("COMMIT");
      
      console.log(`✅ Usuario ${userId} eliminado exitosamente`);
      
      res.json({ 
        success: true,
        message: "Usuario y datos relacionados eliminados correctamente" 
      });
      
    } catch (transErr) {
      await pool.query("ROLLBACK");
      throw transErr;
    }
    
  } catch (err) {
    console.error("🔥 Error eliminando usuario:", err);
    res.status(500).json({ 
      success: false,
      message: "Error al eliminar el usuario",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// ==================== RUTA DE PRUEBA ADMIN ====================
router.get("/test", verifyAdmin, (req, res) => {
  res.json({
    success: true,
    message: "Admin routes working!",
    user: req.user,
    timestamp: new Date().toISOString()
  });
});

export default router;
// routes/users.js → VERSIÓN COMPLETA Y MEJORADA
import express from "express";
import pool from "../db/db.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

dotenv.config();

const router = express.Router();

// ==================== MIDDLEWARE DE AUTENTICACIÓN MEJORADO ====================
const auth = (req, res, next) => {
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

    // Usar el mismo secret que en auth.js
    const decoded = jwt.verify(
      token, 
      process.env.JWT_SECRET || "secreto_temporal_para_desarrollo"
    );
    
    req.user = decoded; // { id, role, username, email, iat, exp }
    next();
  } catch (err) {
    console.error("❌ Error en autenticación user.js:", err.message);
    
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ 
        success: false,
        message: "Sesión expirada. Por favor, inicia sesión nuevamente." 
      });
    }
    
    return res.status(401).json({ 
      success: false,
      message: "Token inválido" 
    });
  }
};

// ==================== 1. OBTENER DATOS DEL USUARIO LOGUEADO ====================
router.get("/me", auth, async (req, res) => {
  try {
    console.log(`👤 Usuario ${req.user.id} solicitando sus datos`);
    
    const [rows] = await pool.query(
      `SELECT 
          id, 
          username, 
          fullName, 
          email, 
          role,
          telefono,
          created_at,
          updated_at
       FROM users 
       WHERE id = ?`,
      [req.user.id]
    );

    if (rows.length === 0) {
      console.log(`❌ Usuario ${req.user.id} no encontrado en BD`);
      return res.status(404).json({ 
        success: false,
        message: "Usuario no encontrado" 
      });
    }

    const user = rows[0];
    
    // Si es médico, agregar información adicional
    if (user.role === 'medico') {
      const [medicoInfo] = await pool.query(
        `SELECT 
            especialidad,
            descripcion,
            horario_inicio,
            horario_fin,
            duracion_cita
         FROM medicos 
         WHERE user_id = ?`,
        [user.id]
      );
      
      if (medicoInfo.length > 0) {
        user.especialidad = medicoInfo[0].especialidad;
        user.descripcion = medicoInfo[0].descripcion;
        user.horario_inicio = medicoInfo[0].horario_inicio;
        user.horario_fin = medicoInfo[0].horario_fin;
        user.duracion_cita = medicoInfo[0].duracion_cita;
      }
    }

    console.log(`✅ Datos enviados para usuario ${user.username}`);
    
    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        telefono: user.telefono,
        especialidad: user.especialidad,
        descripcion: user.descripcion,
        horario_inicio: user.horario_inicio,
        horario_fin: user.horario_fin,
        duracion_cita: user.duracion_cita,
        created_at: user.created_at,
        updated_at: user.updated_at
      }
    });
  } catch (err) {
    console.error("🔥 Error en /api/user/me:", err);
    res.status(500).json({ 
      success: false,
      message: "Error al obtener tus datos",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// ==================== 2. ACTUALIZAR PERFIL (NOMBRE, TELÉFONO, EMAIL) ====================
router.put("/profile", auth, async (req, res) => {
  try {
    const { fullName, email, telefono } = req.body;
    
    console.log(`✏️ Usuario ${req.user.id} actualizando perfil`);
    console.log("Datos recibidos:", { fullName, email, telefono });

    if (!fullName?.trim() && !email?.trim() && !telefono?.trim()) {
      return res.status(400).json({ 
        success: false,
        message: "No hay datos para actualizar" 
      });
    }

    // Validar email si se va a actualizar
    if (email?.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        return res.status(400).json({ 
          success: false,
          message: "Formato de email inválido" 
        });
      }
    }

    const updates = [];
    const values = [];

    if (fullName?.trim()) {
      updates.push("fullName = ?");
      values.push(fullName.trim());
    }
    
    if (email?.trim()) {
      // Verificar que el email no esté en uso por otro usuario
      const [existingEmail] = await pool.query(
        "SELECT id FROM users WHERE email = ? AND id != ?",
        [email.trim().toLowerCase(), req.user.id]
      );
      
      if (existingEmail.length > 0) {
        return res.status(400).json({ 
          success: false,
          message: "Este email ya está registrado por otro usuario" 
        });
      }
      
      updates.push("email = ?");
      values.push(email.trim().toLowerCase());
    }
    
    if (telefono?.trim()) {
      updates.push("telefono = ?");
      values.push(telefono.trim());
    }

    values.push(req.user.id);

    const [result] = await pool.query(
      `UPDATE users SET ${updates.join(", ")}, updated_at = NOW() WHERE id = ?`,
      values
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ 
        success: false,
        message: "Usuario no encontrado" 
      });
    }

    console.log(`✅ Perfil de usuario ${req.user.id} actualizado`);
    
    // Obtener datos actualizados
    const [updatedUser] = await pool.query(
      "SELECT id, username, fullName, email, role, telefono FROM users WHERE id = ?",
      [req.user.id]
    );

    res.json({
      success: true,
      message: "Perfil actualizado correctamente",
      user: updatedUser[0]
    });
  } catch (err) {
    console.error("🔥 Error actualizando perfil:", err);
    res.status(500).json({ 
      success: false,
      message: "Error al actualizar el perfil",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// ==================== 3. CAMBIAR CONTRASEÑA ====================
router.put("/change-password", auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    console.log(`🔐 Usuario ${req.user.id} intentando cambiar contraseña`);

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ 
        success: false,
        message: "Contraseña actual y nueva contraseña son requeridas" 
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ 
        success: false,
        message: "La nueva contraseña debe tener al menos 6 caracteres" 
      });
    }

    // Obtener contraseña actual del usuario
    const [rows] = await pool.query(
      "SELECT password FROM users WHERE id = ?",
      [req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: "Usuario no encontrado" 
      });
    }

    // Verificar contraseña actual
    const isMatch = await bcrypt.compare(currentPassword, rows[0].password);
    
    if (!isMatch) {
      return res.status(400).json({ 
        success: false,
        message: "Contraseña actual incorrecta" 
      });
    }

    // Encriptar nueva contraseña
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Actualizar contraseña
    const [result] = await pool.query(
      "UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?",
      [hashedPassword, req.user.id]
    );

    console.log(`✅ Contraseña cambiada para usuario ${req.user.id}`);

    res.json({
      success: true,
      message: "Contraseña cambiada exitosamente"
    });
  } catch (err) {
    console.error("🔥 Error cambiando contraseña:", err);
    res.status(500).json({ 
      success: false,
      message: "Error al cambiar la contraseña",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// ==================== 4. ACTUALIZAR INFORMACIÓN DE MÉDICO (SOLO PARA MÉDICOS) ====================
router.put("/medico/profile", auth, async (req, res) => {
  try {
    // Solo médicos pueden usar esta ruta
    if (req.user.role !== 'medico') {
      return res.status(403).json({ 
        success: false,
        message: "Acceso restringido a médicos" 
      });
    }

    const { especialidad, descripcion, horario_inicio, horario_fin, duracion_cita } = req.body;
    
    console.log(`👨‍⚕️ Médico ${req.user.id} actualizando información profesional`);

    // Validar horarios si se proporcionan
    if (horario_inicio && horario_fin) {
      const inicio = horario_inicio.substring(0, 5);
      const fin = horario_fin.substring(0, 5);
      
      if (inicio >= fin) {
        return res.status(400).json({ 
          success: false,
          message: "El horario de inicio debe ser anterior al horario de fin" 
        });
      }
    }

    if (duracion_cita && (duracion_cita < 15 || duracion_cita > 120)) {
      return res.status(400).json({ 
        success: false,
        message: "La duración de la cita debe estar entre 15 y 120 minutos" 
      });
    }

    // Verificar si ya existe registro en la tabla medicos
    const [existing] = await pool.query(
      "SELECT id FROM medicos WHERE user_id = ?",
      [req.user.id]
    );

    let result;
    
    if (existing.length > 0) {
      // Actualizar registro existente
      [result] = await pool.query(
        `UPDATE medicos 
         SET especialidad = ?, descripcion = ?, horario_inicio = ?, horario_fin = ?, duracion_cita = ?
         WHERE user_id = ?`,
        [
          especialidad || null,
          descripcion || null,
          horario_inicio || null,
          horario_fin || null,
          duracion_cita || 30,
          req.user.id
        ]
      );
    } else {
      // Crear nuevo registro
      [result] = await pool.query(
        `INSERT INTO medicos 
         (user_id, especialidad, descripcion, horario_inicio, horario_fin, duracion_cita)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          req.user.id,
          especialidad || null,
          descripcion || null,
          horario_inicio || null,
          horario_fin || null,
          duracion_cita || 30
        ]
      );
    }

    console.log(`✅ Información profesional actualizada para médico ${req.user.id}`);

    res.json({
      success: true,
      message: "Información profesional actualizada correctamente",
      data: {
        especialidad,
        descripcion,
        horario_inicio,
        horario_fin,
        duracion_cita: duracion_cita || 30
      }
    });
  } catch (err) {
    console.error("🔥 Error actualizando información de médico:", err);
    res.status(500).json({ 
      success: false,
      message: "Error al actualizar la información profesional",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// ==================== 5. OBTENER ESTADÍSTICAS DEL USUARIO ====================
router.get("/stats", auth, async (req, res) => {
  try {
    console.log(`📊 Usuario ${req.user.id} solicitando estadísticas`);
    
    let stats = {};
    
    // Estadísticas para pacientes
    if (req.user.role === 'paciente') {
      const [citasStats] = await pool.query(
        `SELECT 
            estado,
            COUNT(*) as total
         FROM citas 
         WHERE paciente_id = ?
         GROUP BY estado`,
        [req.user.id]
      );
      
      const [proximaCita] = await pool.query(
        `SELECT fecha, hora, motivo, estado
         FROM citas 
         WHERE paciente_id = ? AND estado IN ('pendiente', 'confirmada') AND fecha >= CURDATE()
         ORDER BY fecha ASC, hora ASC
         LIMIT 1`,
        [req.user.id]
      );
      
      stats = {
        citasPorEstado: citasStats,
        totalCitas: citasStats.reduce((sum, item) => sum + item.total, 0),
        proximaCita: proximaCita.length > 0 ? proximaCita[0] : null
      };
    }
    
    // Estadísticas para médicos
    if (req.user.role === 'medico') {
      const [citasStats] = await pool.query(
        `SELECT 
            estado,
            COUNT(*) as total
         FROM citas 
         WHERE medico_id = ?
         GROUP BY estado`,
        [req.user.id]
      );
      
      const [citasHoy] = await pool.query(
        `SELECT COUNT(*) as total
         FROM citas 
         WHERE medico_id = ? AND fecha = CURDATE() AND estado IN ('pendiente', 'confirmada')`,
        [req.user.id]
      );
      
      const [proximaCita] = await pool.query(
        `SELECT c.fecha, c.hora, c.motivo, u.fullName as paciente_nombre
         FROM citas c
         JOIN users u ON u.id = c.paciente_id
         WHERE c.medico_id = ? AND c.estado IN ('pendiente', 'confirmada') AND c.fecha >= CURDATE()
         ORDER BY c.fecha ASC, c.hora ASC
         LIMIT 1`,
        [req.user.id]
      );
      
      stats = {
        citasPorEstado: citasStats,
        totalCitas: citasStats.reduce((sum, item) => sum + item.total, 0),
        citasHoy: citasHoy[0]?.total || 0,
        proximaCita: proximaCita.length > 0 ? proximaCita[0] : null
      };
    }
    
    // Estadísticas para admin
    if (req.user.role === 'admin') {
      const [totalUsuarios] = await pool.query("SELECT COUNT(*) as total FROM users");
      const [totalCitas] = await pool.query("SELECT COUNT(*) as total FROM citas");
      const [citasHoy] = await pool.query("SELECT COUNT(*) as total FROM citas WHERE fecha = CURDATE()");
      
      stats = {
        totalUsuarios: totalUsuarios[0]?.total || 0,
        totalCitas: totalCitas[0]?.total || 0,
        citasHoy: citasHoy[0]?.total || 0
      };
    }

    console.log(`✅ Estadísticas enviadas para usuario ${req.user.id}`);
    
    res.json({
      success: true,
      stats,
      role: req.user.role
    });
  } catch (err) {
    console.error("🔥 Error obteniendo estadísticas:", err);
    res.status(500).json({ 
      success: false,
      message: "Error al obtener estadísticas",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// ==================== 6. VERIFICAR TOKEN (RUTA DE PRUEBA) ====================
router.get("/verify-token", auth, (req, res) => {
  res.json({
    success: true,
    message: "Token válido",
    user: {
      id: req.user.id,
      username: req.user.username,
      role: req.user.role,
      email: req.user.email
    },
    expiresIn: req.user.exp ? new Date(req.user.exp * 1000).toISOString() : null
  });
});

// ==================== 7. ELIMINAR CUENTA (CONFIRMACIÓN REQUERIDA) ====================
router.delete("/account", auth, async (req, res) => {
  try {
    const { password } = req.body;
    
    console.log(`🗑️ Usuario ${req.user.id} solicitando eliminar cuenta`);
    
    if (!password) {
      return res.status(400).json({ 
        success: false,
        message: "Se requiere confirmación con contraseña" 
      });
    }

    // Obtener contraseña actual del usuario
    const [rows] = await pool.query(
      "SELECT password FROM users WHERE id = ?",
      [req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: "Usuario no encontrado" 
      });
    }

    // Verificar contraseña
    const isMatch = await bcrypt.compare(password, rows[0].password);
    
    if (!isMatch) {
      return res.status(400).json({ 
        success: false,
        message: "Contraseña incorrecta" 
      });
    }

    // Iniciar transacción
    await pool.query("START TRANSACTION");

    try {
      // Eliminar citas relacionadas (si es paciente)
      await pool.query("DELETE FROM citas WHERE paciente_id = ?", [req.user.id]);
      
      // Si es médico, eliminar de tabla medicos y sus citas
      if (req.user.role === 'medico') {
        await pool.query("DELETE FROM medicos WHERE user_id = ?", [req.user.id]);
        await pool.query("UPDATE citas SET medico_id = NULL WHERE medico_id = ?", [req.user.id]);
      }
      
      // Finalmente eliminar el usuario
      const [result] = await pool.query("DELETE FROM users WHERE id = ?", [req.user.id]);

      if (result.affectedRows === 0) {
        await pool.query("ROLLBACK");
        return res.status(404).json({ 
          success: false,
          message: "Usuario no encontrado" 
        });
      }

      await pool.query("COMMIT");
      
      console.log(`✅ Cuenta de usuario ${req.user.id} eliminada exitosamente`);
      
      res.json({
        success: true,
        message: "Cuenta eliminada exitosamente"
      });
      
    } catch (transErr) {
      await pool.query("ROLLBACK");
      throw transErr;
    }
    
  } catch (err) {
    console.error("🔥 Error eliminando cuenta:", err);
    res.status(500).json({ 
      success: false,
      message: "Error al eliminar la cuenta",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

export default router;
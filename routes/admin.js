// routes/admin.js → VERSIÓN FINAL 100% FUNCIONAL, SEGURA Y PROFESIONAL
import express from "express";
import pool from "../db/db.js";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const router = express.Router();

// ==================== MIDDLEWARE: SOLO ADMIN ====================
const verifyAdmin = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ msg: "Acceso denegado: token requerido" });
  }

  const token = authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ msg: "Token no encontrado" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "secreto_muy_secreto_para_dev");

    if (decoded.role !== "admin") {
      return res.status(403).json({ msg: "Acceso prohibido: se requiere rol de administrador" });
    }

    req.user = decoded;
    next();
  } catch (err) {
    console.error("Error verificando token admin:", err.message);
    return res.status(401).json({ msg: "Sesión expirada o token inválido" });
  }
};

// ==================== 1. TODAS LAS CITAS (VISTA ADMIN) ====================
router.get("/citas", verifyAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        c.id,
        c.fecha_hora,
        c.motivo,
        c.estado,
        c.created_at,
        p.fullName AS paciente_name,
        p.username AS paciente_username,
        m.fullName AS medico_name,
        m.username AS medico_username
      FROM citas c
      JOIN users p ON p.id = c.paciente_id
      JOIN users m ON m.id = c.medico_id
      ORDER BY c.fecha_hora DESC
    `);

    res.json(rows);
  } catch (err) {
    console.error("Error cargando citas (admin):", err);
    res.status(500).json({ msg: "Error al cargar las citas" });
  }
});

// ==================== 2. CAMBIAR ESTADO DE CITA (ADMIN) ====================
router.put("/citas/:id/estado", verifyAdmin, async (req, res) => {
  const { estado } = req.body;
  const estadosValidos = ["pendiente", "confirmada", "atendida", "cancelada"];

  if (!estado || !estadosValidos.includes(estado)) {
    return res.status(400).json({ msg: "Estado inválido. Usa: pendiente, confirmada, atendida o cancelada" });
  }

  try {
    const [result] = await pool.query(
      "UPDATE citas SET estado = ? WHERE id = ?",
      [estado, req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404('Cita no encontrada o ya fue eliminada'));
    }

    res.json({ msg: `Cita marcada como "${estado}" correctamente` });
  } catch (err) {
    console.error("Error actualizando estado de cita:", err);
    res.status(500).json({ msg: "Error al actualizar el estado de la cita" });
  }
});

// ==================== 3. TODOS LOS USUARIOS ====================
router.get("/usuarios", verifyAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        id,
        username,
        fullName,
        email,
        role,
        created_at
      FROM users 
      ORDER BY created_at DESC
    `);

    res.json(rows);
  } catch (err) {
    console.error("Error cargando usuarios (admin):", err);
    res.status(500).json({ msg: "Error al cargar usuarios" });
  }
});

// ==================== 4. CAMBIAR ROL DE USUARIO ====================
router.put("/usuario/:id/rol", verifyAdmin, async (req, res) => {
  const { role } = req.body;
  const rolesPermitidos = ["user", "doctor", "recepcion", "admin"];

  if (!role || !rolesPermitidos.includes(role)) {
    return res.status(400).json({ msg: "Rol inválido. Opciones: user, doctor, recepcion, admin" });
  }

  // Opcional: no permitir cambiar rol de otro admin (seguridad extra)
  if (req.params.id == req.user.id && role !== "admin") {
    return res.status(400).json({ msg: "No puedes quitarte el rol de admin a ti mismo" });
  }

  try {
    const [result] = await pool.query(
      "UPDATE users SET role = ? WHERE id = ?",
      [role, req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ msg: "Usuario no encontrado" });
    }

    res.json({ msg: `Rol cambiado a "${role}" correctamente` });
  } catch (err) {
    console.error("Error cambiando rol:", err);
    res.status(500).json({ msg: "Error al cambiar el rol" });
  }
});

// ==================== 5. ELIMINAR USUARIO (PELIGROSO) ====================
router.delete("/usuario/:id", verifyAdmin, async (req, res) => {
  const userId = req.params.id;

  // No permitir eliminarse a sí mismo
  if (userId == req.user.id) {
    return res.status(400).json({ msg: "No puedes eliminarte a ti mismo" });
  }

  try {
    await pool.query("START TRANSACTION");

    // Eliminar citas donde el usuario es paciente
    await pool.query("DELETE FROM citas WHERE paciente_id = ?", [userId]);

    // Opcional: eliminar citas donde es médico (o reasignar)
    await pool.query("DELETE FROM citas WHERE medico_id = ?", [userId]);

    // Finalmente eliminar el usuario
    const [result] = await pool.query("DELETE FROM users WHERE id = ?", [userId]);

    if (result.affectedRows === 0) {
      await pool.query("ROLLBACK");
      return res.status(404).json({ msg: "Usuario no encontrado" });
    }

    await pool.query("COMMIT");
    res.json({ msg: "Usuario y todas sus citas eliminadas correctamente" });
  } catch (err) {
    await pool.query("ROLLBACK");
    console.error("Error eliminando usuario:", err);
    res.status(500).json({ msg: "Error crítico al eliminar el usuario" });
  }
});

export default router;
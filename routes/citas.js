// routes/citas.js → VERSIÓN FINAL 100% FUNCIONAL Y SEGURA
import express from "express";
import pool from "../db/db.js";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const router = express.Router();

// ==================== MIDDLEWARE DE AUTENTICACIÓN ====================
const auth = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ msg: "Acceso denegado: token requerido" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "secreto_muy_secreto_para_dev");
    req.user = decoded; // { id, role, username }
    next();
  } catch (err) {
    return res.status(401).json({ msg: "Token inválido o expirado" });
  }
};

// ==================== 1. OBTENER MÉDICOS ====================
router.get("/medicos", auth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, fullName, email FROM users WHERE role IN ('doctor', 'admin') ORDER BY fullName ASC"
    );
    res.json(rows);
  } catch (err) {
    console.error("Error al cargar médicos:", err);
    res.status(500).json({ msg: "Error del servidor" });
  }
});

// ==================== 2. MIS CITAS (PACIENTE) ====================
router.get("/mis-citas", auth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT 
          c.id, c.fecha_hora, c.motivo, c.estado, c.created_at,
          u.fullName AS medico_name
       FROM citas c
       JOIN users u ON u.id = c.medico_id
       WHERE c.paciente_id = ?
       ORDER BY c.fecha_hora DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error("Error al cargar mis citas:", err);
    res.status(500).json({ msg: "Error al cargar tus citas" });
  }
});

// ==================== 3. CREAR CITA (PACIENTE) ====================
router.post("/crear", auth, async (req, res) => {
  const { medico_id, fecha_hora, motivo } = req.body;

  if (!medico_id || !fecha_hora || !motivo?.trim()) {
    return res.status(400).json({ msg: "Todos los campos son obligatorios" });
  }

  if (motivo.trim().length < 5) {
    return res.status(400).json({ msg: "El motivo debe tener al menos 5 caracteres" });
  }

  try {
    // Verificar que el médico exista y sea doctor
    const [medico] = await pool.query("SELECT id FROM users WHERE id = ? AND role IN ('doctor', 'admin')", [medico_id]);
    if (medico.length === 0) {
      return res.status(400).json({ msg: "Médico no válido" });
    }

    // Verificar que no haya otra cita en el mismo horario (opcional)
    const [conflicto] = await pool.query(
      "SELECT id FROM citas WHERE medico_id = ? AND fecha_hora = ? AND estado != 'cancelada'",
      [medico_id, fecha_hora]
    );
    if (conflicto.length > 0) {
      return res.status(400).json({ msg: "El médico ya tiene una cita en ese horario" });
    }

    const [result] = await pool.query(
      `INSERT INTO citas 
         (paciente_id, medico_id, fecha_hora, motivo, estado) 
         VALUES (?, ?, ?, ?, 'pendiente')`,
      [req.user.id, medico_id, fecha_hora, motivo.trim()]
    );

    res.status(201).json({
      msg: "Cita solicitada con éxito. El médico la confirmará pronto.",
      id: result.insertId
    });
  } catch (err) {
    console.error("Error al crear cita:", err);
    res.status(500).json({ msg: "Error al solicitar la cita" });
  }
});

// ==================== 4. CANCELAR CITA (PACIENTE) ====================
router.put("/cancelar/:id", auth, async (req, res) => {
  const citaId = req.params.id;

  try {
    const [result] = await pool.query(
      `UPDATE citas 
       SET estado = 'cancelada' 
       WHERE id = ? AND paciente_id = ? AND estado = 'pendiente'`,
      [citaId, req.user.id]
    );

    if (result.affectedRows === 0) {
      return res.status(400).json({ msg: "No puedes cancelar esta cita o ya fue procesada" });
    }

    res.json({ msg: "Cita cancelada correctamente" });
  } catch (err) {
    console.error("Error al cancelar cita:", err);
    res.status(500).json({ msg: "Error del servidor" });
  }
});

// ==================== 5. INFO DEL USUARIO LOGUEADO ====================
router.get("/me", auth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, username, fullName, email, role FROM users WHERE id = ?",
      [req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ msg: "Usuario no encontrado" });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error("Error en /me:", err);
    res.status(500).json({ msg: "Error del servidor" });
  }
});

export default router;
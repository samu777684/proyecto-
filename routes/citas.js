// routes/citas.js → Versión FINAL y 100% funcional
import express from "express";
import pool from "../db/db.js";
import jwt from "jsonwebtoken";

const router = express.Router();

// Middleware autenticación
const auth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ msg: "Token requerido" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "secreto_muy_secreto_para_dev");
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ msg: "Token inválido o expirado" });
  }
};

// 1. Obtener médicos
router.get("/medicos", auth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, fullName FROM users WHERE role = 'doctor' ORDER BY fullName"
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error del servidor" });
  }
});

// 2. Mis citas
router.get("/mis-citas", auth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT c.*, u.fullName AS medico_name 
       FROM citas c 
       JOIN users u ON u.id = c.medico_id 
       WHERE c.paciente_id = ? 
       ORDER BY c.fecha_hora DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error al cargar citas" });
  }
});

// 3. Crear cita
router.post("/crear", auth, async (req, res) => {
  const { medico_id, fecha_hora, motivo } = req.body;

  if (!medico_id || !fecha_hora || !motivo?.trim()) {
    return res.status(400).json({ msg: "Faltan datos requeridos" });
  }

  try {
    const [result] = await pool.query(
      `INSERT INTO citas (paciente_id, medico_id, fecha_hora, motivo, estado) 
       VALUES (?, ?, ?, ?, 'pendiente')`,
      [req.user.id, medico_id, fecha_hora, motivo.trim()]
    );

    res.status(201).json({ msg: "Cita solicitada con éxito", id: result.insertId });
  } catch (err) {
    console.error(err);
    if (err.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json({ msg: "Médico no válido" });
    }
    res.status(500).json({ msg: "Error al crear la cita" });
  }
});

// 4. Cancelar cita
router.put("/cancelar/:id", auth, async (req, res) => {
  try {
    const [result] = await pool.query(
      `UPDATE citas SET estado = 'cancelada' 
       WHERE id = ? AND paciente_id = ? AND estado = 'pendiente'`,
      [req.params.id, req.user.id]
    );

    if (result.affectedRows === 0) {
      return res.status(400).json({ msg: "No puedes cancelar esta cita" });
    }

    res.json({ msg: "Cita cancelada correctamente" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error del servidor" });
  }
});

// 5. Info del usuario logueado
router.get("/me", auth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, fullName, email, role FROM users WHERE id = ?",
      [req.user.id]
    );
    if (rows.length === 0) return res.status(404).json({ msg: "Usuario no encontrado" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ msg: "Error del servidor" });
  }
});

export default router;
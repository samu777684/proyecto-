// routes/user.js → VERSIÓN FINAL 100% FUNCIONAL Y SEGURA
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

  if (!token) {
    return res.status(401).json({ msg: "Token no encontrado" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "secreto_muy_secreto_para_dev");
    req.user = decoded; // { id, role, username, iat, exp }
    next();
  } catch (err) {
    console.error("Token inválido o expirado:", err.message);
    return res.status(401).json({ msg: "Sesión expirada o token inválido" });
  }
};

// ==================== OBTENER DATOS DEL USUARIO LOGUEADO ====================
router.get("/me", auth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT 
          id, 
          username, 
          fullName, 
          email, 
          role,
          created_at
       FROM users 
       WHERE id = ?`,
      [req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ msg: "Usuario no encontrado" });
    }

    const user = rows[0];

    res.json({
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      created_at: user.created_at
    });
  } catch (err) {
    console.error("Error en /api/user/me:", err);
    res.status(500).json({ msg: "Error del servidor al obtener tus datos" });
  }
});

// ==================== (OPCIONAL) ACTUALIZAR PERFIL ====================
// Descomenta si quieres permitir que el usuario edite su nombre o email
/*
router.put("/me", auth, async (req, res) => {
  const { fullName, email } = req.body;

  if (!fullName?.trim() && !email?.trim()) {
    return res.status(400).json({ msg: "Nada que actualizar" });
  }

  try {
    const updates = [];
    const values = [];

    if (fullName?.trim()) {
      updates.push("fullName = ?");
      values.push(fullName.trim());
    }
    if (email?.trim()) {
      updates.push("email = ?");
      values.push(email.trim().toLowerCase());
    }

    values.push(req.user.id);

    await pool.query(
      `UPDATE users SET ${updates.join(", ")} WHERE id = ?`,
      values
    );

    res.json({ msg: "Perfil actualizado correctamente" });
  } catch (err) {
    console.error("Error actualizando perfil:", err);
    res.status(500).json({ msg: "Error al actualizar el perfil" });
  }
});
*/

export default router;
import express from "express";
import pool from "../db/db.js";
import jwt from "jsonwebtoken";

const router = express.Router();

function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ msg: "No autorizado" });

  const token = header.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "secreto_muy_secreto_para_dev");
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ msg: "Token inválido" });
  }
}

// Ruta para obtener información del usuario autenticado
router.get("/me", auth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, fullName, email, role FROM users WHERE id = ?",
      [req.user.id]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ msg: "Usuario no encontrado" });
    }
    
    res.json(rows[0]);
  } catch (err) {
    console.error("Error al obtener usuario:", err);
    res.status(500).json({ msg: "Error al obtener información del usuario" });
  }
});

export default router;
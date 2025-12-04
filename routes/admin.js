import express from "express";
import pool from "../db/db.js";
import jwt from "jsonwebtoken";

const router = express.Router();

// Middleware para verificar que es admin
const verifyAdmin = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ msg: "Token requerido" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "secreto_muy_secreto_para_dev");
    
    // Verificar que el usuario sea admin
    if (decoded.role !== 'admin') {
      return res.status(403).json({ msg: "Acceso denegado. Se requiere rol de administrador" });
    }
    
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ msg: "Token inválido o expirado" });
  }
};

// 1. Obtener todas las citas (vista admin)
router.get("/citas", verifyAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT 
        c.*,
        p.fullName AS paciente_name,
        m.fullName AS medico_name
       FROM citas c
       JOIN users p ON p.id = c.paciente_id
       JOIN users m ON m.id = c.medico_id
       ORDER BY c.fecha_hora DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error al cargar citas" });
  }
});

// 2. Actualizar estado de cita (admin puede cambiar cualquier estado)
router.put("/citas/:id/estado", verifyAdmin, async (req, res) => {
  const { estado } = req.body;
  const estadosPermitidos = ['pendiente', 'confirmada', 'atendida', 'cancelada'];
  
  if (!estadosPermitidos.includes(estado)) {
    return res.status(400).json({ msg: "Estado no válido" });
  }

  try {
    const [result] = await pool.query(
      "UPDATE citas SET estado = ? WHERE id = ?",
      [estado, req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ msg: "Cita no encontrada" });
    }

    res.json({ msg: "Estado de cita actualizado correctamente" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error del servidor" });
  }
});

// 3. Obtener todos los usuarios
router.get("/usuarios", verifyAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, fullName, username, email, role FROM users ORDER BY fullName"
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error al cargar usuarios" });
  }
});

// 4. Cambiar rol de usuario
router.put("/usuario/:id/rol", verifyAdmin, async (req, res) => {
  const { role } = req.body;
  const rolesPermitidos = ['user', 'doctor', 'recepcion', 'admin'];
  
  if (!rolesPermitidos.includes(role)) {
    return res.status(400).json({ msg: "Rol no válido" });
  }

  try {
    const [result] = await pool.query(
      "UPDATE users SET role = ? WHERE id = ?",
      [role, req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ msg: "Usuario no encontrado" });
    }

    res.json({ msg: "Rol actualizado correctamente" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error del servidor" });
  }
});

// 5. Eliminar usuario (con precaución - elimina también sus citas)
router.delete("/usuario/:id", verifyAdmin, async (req, res) => {
  try {
    // Iniciar transacción
    await pool.query("START TRANSACTION");
    
    // Eliminar citas relacionadas con este usuario (como paciente)
    await pool.query("DELETE FROM citas WHERE paciente_id = ?", [req.params.id]);
    
    // Eliminar citas donde es médico (si se quiere mantener integridad)
    // Se podría cambiar el médico_id a null o manejar de otra forma
    
    // Eliminar el usuario
    const [result] = await pool.query("DELETE FROM users WHERE id = ?", [req.params.id]);
    
    await pool.query("COMMIT");
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ msg: "Usuario no encontrado" });
    }

    res.json({ msg: "Usuario eliminado correctamente" });
  } catch (err) {
    await pool.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ msg: "Error al eliminar usuario" });
  }
});

export default router;
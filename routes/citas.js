// routes/citas.js → VERSIÓN CORREGIDA Y COMPATIBLE CON TU BD
import express from "express";
import pool from "../db/db.js";
import jwt from "jsonwebtoken";
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

    // Usar el mismo secret que en auth.js
    const decoded = jwt.verify(
      token, 
      process.env.JWT_SECRET || "secreto_temporal_para_desarrollo"
    );
    
    req.user = decoded; // { id, role, username, email }
    next();
  } catch (err) {
    console.error("❌ Error en autenticación:", err.message);
    
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

// ==================== 1. OBTENER MÉDICOS DISPONIBLES ====================
router.get("/medicos", auth, async (req, res) => {
  try {
    console.log("👨‍⚕️ Solicitando lista de médicos");
    
    // Obtener médicos (usuarios con rol 'medico')
    const [rows] = await pool.query(
      `SELECT 
        u.id,
        u.fullName,
        u.email,
        u.telefono,
        m.especialidad,
        m.descripcion,
        m.horario_inicio,
        m.horario_fin,
        m.duracion_cita
       FROM users u
       LEFT JOIN medicos m ON m.user_id = u.id
       WHERE u.role = 'medico'
       ORDER BY u.fullName ASC`
    );

    console.log(`✅ Encontrados ${rows.length} médicos`);
    
    res.json({
      success: true,
      count: rows.length,
      medicos: rows
    });
  } catch (err) {
    console.error("🔥 Error al cargar médicos:", err);
    res.status(500).json({ 
      success: false,
      message: "Error al cargar la lista de médicos",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// ==================== 2. MIS CITAS (PACIENTE) ====================
router.get("/mis-citas", auth, async (req, res) => {
  try {
    console.log(`📅 Usuario ${req.user.id} solicitando sus citas`);
    
    // Verificar si la tabla citas existe
    const [tables] = await pool.query("SHOW TABLES LIKE 'citas'");
    
    if (tables.length === 0) {
      return res.json({
        success: true,
        message: "No hay citas registradas aún",
        citas: []
      });
    }

    const [rows] = await pool.query(
      `SELECT 
          c.id,
          c.fecha,
          c.hora,
          c.motivo,
          c.notas,
          c.estado,
          c.created_at,
          u.fullName AS medico_nombre,
          u.email AS medico_email,
          m.especialidad
       FROM citas c
       LEFT JOIN users u ON u.id = c.medico_id
       LEFT JOIN medicos m ON m.user_id = u.id
       WHERE c.paciente_id = ?
       ORDER BY c.fecha DESC, c.hora DESC`,
      [req.user.id]
    );

    console.log(`✅ Usuario ${req.user.id} tiene ${rows.length} citas`);
    
    res.json({
      success: true,
      count: rows.length,
      citas: rows
    });
  } catch (err) {
    console.error("🔥 Error al cargar mis citas:", err);
    res.status(500).json({ 
      success: false,
      message: "Error al cargar tus citas",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// ==================== 3. CREAR CITA (PACIENTE) - VERSIÓN CORREGIDA ====================
router.post("/crear", auth, async (req, res) => {
  console.log("📝 Creando nueva cita:", req.body);
  
  try {
    const { medico_id, fecha, hora, motivo, notas } = req.body;

    // Validaciones
    if (!medico_id || !fecha || !hora || !motivo?.trim()) {
      return res.status(400).json({ 
        success: false,
        message: "Médico, fecha, hora y motivo son obligatorios" 
      });
    }

    if (motivo.trim().length < 5) {
      return res.status(400).json({ 
        success: false,
        message: "El motivo debe tener al menos 5 caracteres" 
      });
    }

    // Validar que la fecha sea futura
    const fechaCita = new Date(`${fecha}T${hora}`);
    const ahora = new Date();
    
    if (fechaCita <= ahora) {
      return res.status(400).json({ 
        success: false,
        message: "La cita debe ser en una fecha y hora futuras" 
      });
    }

    // Verificar que el médico exista y sea médico
    const [medico] = await pool.query(
      "SELECT u.id, u.fullName, m.horario_inicio, m.horario_fin FROM users u LEFT JOIN medicos m ON m.user_id = u.id WHERE u.id = ? AND u.role = 'medico'",
      [medico_id]
    );
    
    if (medico.length === 0) {
      return res.status(400).json({ 
        success: false,
        message: "Médico no válido o no encontrado" 
      });
    }

    // Verificar horario del médico
    const horaCita = hora.substring(0, 5); // Formato HH:MM
    const medicoData = medico[0];
    
    if (medicoData.horario_inicio && medicoData.horario_fin) {
      if (horaCita < medicoData.horario_inicio.substring(0, 5) || 
          horaCita > medicoData.horario_fin.substring(0, 5)) {
        return res.status(400).json({ 
          success: false,
          message: `El médico atiende de ${medicoData.horario_inicio.substring(0, 5)} a ${medicoData.horario_fin.substring(0, 5)}` 
        });
      }
    }

    // Verificar que no haya otra cita en el mismo horario
    const [conflicto] = await pool.query(
      `SELECT id FROM citas 
       WHERE medico_id = ? AND fecha = ? AND hora = ? AND estado != 'cancelada'`,
      [medico_id, fecha, hora]
    );
    
    if (conflicto.length > 0) {
      return res.status(400).json({ 
        success: false,
        message: "El médico ya tiene una cita en ese horario" 
      });
    }

    // Verificar que el paciente no tenga otra cita en el mismo horario
    const [conflictoPaciente] = await pool.query(
      `SELECT id FROM citas 
       WHERE paciente_id = ? AND fecha = ? AND hora = ? AND estado != 'cancelada'`,
      [req.user.id, fecha, hora]
    );
    
    if (conflictoPaciente.length > 0) {
      return res.status(400).json({ 
        success: false,
        message: "Ya tienes una cita agendada en ese horario" 
      });
    }

    // Crear la cita
    const [result] = await pool.query(
      `INSERT INTO citas 
         (paciente_id, medico_id, fecha, hora, motivo, notas, estado) 
         VALUES (?, ?, ?, ?, ?, ?, 'pendiente')`,
      [req.user.id, medico_id, fecha, hora, motivo.trim(), notas || null]
    );

    console.log(`✅ Cita creada exitosamente ID: ${result.insertId}`);
    
    res.status(201).json({
      success: true,
      message: "Cita solicitada con éxito. El médico la confirmará pronto.",
      citaId: result.insertId,
      datos: {
        fecha,
        hora,
        motivo: motivo.trim(),
        estado: 'pendiente'
      }
    });
  } catch (err) {
    console.error("🔥 Error al crear cita:", err);
    res.status(500).json({ 
      success: false,
      message: "Error al solicitar la cita",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// ==================== 4. CANCELAR CITA (PACIENTE) ====================
router.put("/cancelar/:id", auth, async (req, res) => {
  try {
    const citaId = req.params.id;
    
    console.log(`❌ Usuario ${req.user.id} cancelando cita ${citaId}`);

    const [result] = await pool.query(
      `UPDATE citas 
       SET estado = 'cancelada', updated_at = NOW() 
       WHERE id = ? AND paciente_id = ? AND estado IN ('pendiente', 'confirmada')`,
      [citaId, req.user.id]
    );

    if (result.affectedRows === 0) {
      return res.status(400).json({ 
        success: false,
        message: "No puedes cancelar esta cita (ya fue atendida, cancelada o no existe)" 
      });
    }

    console.log(`✅ Cita ${citaId} cancelada exitosamente`);
    
    res.json({ 
      success: true,
      message: "Cita cancelada correctamente",
      citaId
    });
  } catch (err) {
    console.error("🔥 Error al cancelar cita:", err);
    res.status(500).json({ 
      success: false,
      message: "Error al cancelar la cita",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// ==================== 5. CITAS DEL MÉDICO (SI EL USUARIO ES MÉDICO) ====================
router.get("/medico/citas", auth, async (req, res) => {
  try {
    // Solo médicos pueden ver sus citas
    if (req.user.role !== 'medico') {
      return res.status(403).json({ 
        success: false,
        message: "Acceso restringido a médicos" 
      });
    }

    console.log(`👨‍⚕️ Médico ${req.user.id} solicitando sus citas`);
    
    const [rows] = await pool.query(
      `SELECT 
          c.id,
          c.fecha,
          c.hora,
          c.motivo,
          c.notas,
          c.estado,
          c.created_at,
          u.fullName AS paciente_nombre,
          u.email AS paciente_email,
          u.telefono
       FROM citas c
       JOIN users u ON u.id = c.paciente_id
       WHERE c.medico_id = ?
       ORDER BY c.fecha ASC, c.hora ASC`,
      [req.user.id]
    );

    console.log(`✅ Médico ${req.user.id} tiene ${rows.length} citas`);
    
    res.json({
      success: true,
      count: rows.length,
      citas: rows
    });
  } catch (err) {
    console.error("🔥 Error al cargar citas del médico:", err);
    res.status(500).json({ 
      success: false,
      message: "Error al cargar las citas",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// ==================== 6. MÉDICO: CONFIRMAR O RECHAZAR CITA ====================
router.put("/medico/citas/:id/estado", auth, async (req, res) => {
  try {
    // Solo médicos pueden cambiar estado de sus citas
    if (req.user.role !== 'medico') {
      return res.status(403).json({ 
        success: false,
        message: "Acceso restringido a médicos" 
      });
    }

    const citaId = req.params.id;
    const { estado } = req.body;
    
    console.log(`🔄 Médico ${req.user.id} cambiando estado cita ${citaId} a: ${estado}`);
    
    const estadosPermitidos = ['confirmada', 'cancelada', 'completada'];
    
    if (!estado || !estadosPermitidos.includes(estado)) {
      return res.status(400).json({ 
        success: false,
        message: `Estado inválido. Usa: ${estadosPermitidos.join(', ')}` 
      });
    }

    const [result] = await pool.query(
      `UPDATE citas 
       SET estado = ?, updated_at = NOW() 
       WHERE id = ? AND medico_id = ? AND estado = 'pendiente'`,
      [estado, citaId, req.user.id]
    );

    if (result.affectedRows === 0) {
      return res.status(400).json({ 
        success: false,
        message: "No se pudo actualizar la cita (ya fue procesada o no existe)" 
      });
    }

    console.log(`✅ Cita ${citaId} actualizada a estado: ${estado}`);
    
    res.json({ 
      success: true,
      message: `Cita ${estado} exitosamente`,
      citaId,
      nuevoEstado: estado
    });
  } catch (err) {
    console.error("🔥 Error al actualizar estado de cita (médico):", err);
    res.status(500).json({ 
      success: false,
      message: "Error al actualizar la cita",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// ==================== 7. INFO DEL USUARIO LOGUEADO ====================
router.get("/me", auth, async (req, res) => {
  try {
    console.log(`👤 Usuario ${req.user.id} solicitando su información`);
    
    const [rows] = await pool.query(
      `SELECT 
        id,
        username,
        fullName,
        email,
        role,
        telefono,
        created_at
       FROM users 
       WHERE id = ?`,
      [req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: "Usuario no encontrado" 
      });
    }

    const user = rows[0];
    
    // Si es médico, agregar información de especialidad
    if (user.role === 'medico') {
      const [medicoInfo] = await pool.query(
        "SELECT especialidad, descripcion, horario_inicio, horario_fin FROM medicos WHERE user_id = ?",
        [user.id]
      );
      
      if (medicoInfo.length > 0) {
        user.especialidad = medicoInfo[0].especialidad;
        user.descripcion = medicoInfo[0].descripcion;
        user.horario_inicio = medicoInfo[0].horario_inicio;
        user.horario_fin = medicoInfo[0].horario_fin;
      }
    }

    console.log(`✅ Información de usuario ${user.username} enviada`);
    
    res.json({
      success: true,
      user
    });
  } catch (err) {
    console.error("🔥 Error en /me:", err);
    res.status(500).json({ 
      success: false,
      message: "Error al obtener información del usuario",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// ==================== 8. HORARIOS DISPONIBLES DEL MÉDICO ====================
router.get("/medico/:id/horarios-disponibles/:fecha", auth, async (req, res) => {
  try {
    const medicoId = req.params.id;
    const fecha = req.params.fecha;
    
    console.log(`🕐 Solicitando horarios disponibles médico ${medicoId} para ${fecha}`);
    
    // Obtener información del médico
    const [medico] = await pool.query(
      `SELECT u.fullName, m.horario_inicio, m.horario_fin, m.duracion_cita
       FROM users u
       LEFT JOIN medicos m ON m.user_id = u.id
       WHERE u.id = ? AND u.role = 'medico'`,
      [medicoId]
    );
    
    if (medico.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: "Médico no encontrado" 
      });
    }

    const medicoData = medico[0];
    const duracion = medicoData.duracion_cita || 30; // minutos por defecto
    
    // Obtener citas ya agendadas para esa fecha
    const [citasAgendadas] = await pool.query(
      `SELECT hora, estado 
       FROM citas 
       WHERE medico_id = ? AND fecha = ? AND estado IN ('pendiente', 'confirmada')`,
      [medicoId, fecha]
    );

    // Generar horarios disponibles
    const horariosDisponibles = generarHorariosDisponibles(
      medicoData.horario_inicio,
      medicoData.horario_fin,
      duracion,
      citasAgendadas
    );

    console.log(`✅ ${horariosDisponibles.length} horarios disponibles encontrados`);
    
    res.json({
      success: true,
      medico: {
        id: medicoId,
        nombre: medicoData.fullName,
        horario_inicio: medicoData.horario_inicio,
        horario_fin: medicoData.horario_fin,
        duracion_cita: duracion
      },
      fecha,
      horariosDisponibles,
      total: horariosDisponibles.length
    });
  } catch (err) {
    console.error("🔥 Error al obtener horarios disponibles:", err);
    res.status(500).json({ 
      success: false,
      message: "Error al obtener horarios disponibles",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// ==================== FUNCIÓN AUXILIAR: GENERAR HORARIOS DISPONIBLES ====================
function generarHorariosDisponibles(inicio, fin, duracion, citasAgendadas) {
  if (!inicio || !fin) {
    // Horario por defecto si no está configurado
    inicio = '08:00:00';
    fin = '17:00:00';
  }

  const horariosOcupados = citasAgendadas.map(c => c.hora.substring(0, 5)); // Formato HH:MM
  const disponibles = [];
  
  let horaActual = parseTime(inicio);
  const horaFin = parseTime(fin);
  
  while (horaActual < horaFin) {
    const horaStr = formatTime(horaActual);
    
    if (!horariosOcupados.includes(horaStr)) {
      disponibles.push(horaStr);
    }
    
    // Añadir duración de la cita
    horaActual.setMinutes(horaActual.getMinutes() + duracion);
  }
  
  return disponibles;
}

function parseTime(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
}

function formatTime(date) {
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}

export default router;
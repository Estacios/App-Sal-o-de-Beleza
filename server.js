require('dotenv').config();
const express = require('express');
const session = require('express-session');
const mysql = require('mysql2/promise');
const path = require('path');

const app = express();
const port = Number(process.env.PORT || 3000);

const pool = mysql.createPool({
  host: process.env.DB_HOST || process.env.MYSQLHOST,
  port: Number(process.env.DB_PORT || process.env.MYSQLPORT || 3306),
  user: process.env.DB_USER || process.env.MYSQLUSER,
  password: process.env.DB_PASSWORD || process.env.MYSQLPASSWORD,
  database: process.env.DB_NAME || process.env.MYSQLDATABASE,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'troque-essa-chave',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax' }
}));
app.use(express.static(path.join(__dirname, 'public')));

function requireAdmin(req, res, next) {
  if (!req.session?.isAdmin) {
    return res.status(401).json({ error: 'Não autorizado.' });
  }
  next();
}

function parseSettingsRow(row) {
  return {
    salonName: row.salon_name,
    salonSubtitle: row.salon_subtitle,
    hours: row.hours.split(',').map(v => v.trim()).filter(Boolean),
    workingDays: row.working_days.split(',').map(v => Number(v.trim())).filter(v => !Number.isNaN(v)),
    bookingLimitDays: Number(row.booking_limit_days || 15)
  };
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function isAllowedDate(dateString, settings) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const selected = new Date(dateString + 'T00:00:00');
  const max = new Date(today);
  max.setDate(max.getDate() + Number(settings.bookingLimitDays || 15));
  if (selected < today || selected > max) return false;
  return settings.workingDays.includes(selected.getDay());
}

app.get('/api/public-data', async (req, res) => {
  try {
    const [[settingsRow]] = await pool.query('SELECT * FROM settings WHERE id = 1 LIMIT 1');
    const [servicesRows] = await pool.query('SELECT id, name, duration, price FROM services WHERE active = 1 ORDER BY created_at DESC');
    const settings = parseSettingsRow(settingsRow);
    res.json({ settings, services: servicesRows });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao carregar dados públicos.' });
  }
});

app.get('/api/availability', async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'Data obrigatória.' });
    const [[settingsRow]] = await pool.query('SELECT * FROM settings WHERE id = 1 LIMIT 1');
    const settings = parseSettingsRow(settingsRow);
    if (!isAllowedDate(date, settings)) {
      return res.json({ availableHours: [], blocked: true });
    }
    const [rows] = await pool.query(
      'SELECT booking_time FROM bookings WHERE booking_date = ? AND status IN ("Pendente","Confirmado") ORDER BY booking_time ASC',
      [date]
    );
    const used = rows.map(r => String(r.booking_time).slice(0, 5));
    const availableHours = settings.hours.filter(hour => !used.includes(hour));
    res.json({ availableHours, blocked: false });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao carregar horários.' });
  }
});

app.post('/api/bookings', async (req, res) => {
  try {
    const { clientName, phone, serviceId, bookingDate, bookingTime, notes } = req.body;
    if (!clientName || !phone || !serviceId || !bookingDate || !bookingTime) {
      return res.status(400).json({ error: 'Preencha todos os campos obrigatórios.' });
    }

    const [[settingsRow]] = await pool.query('SELECT * FROM settings WHERE id = 1 LIMIT 1');
    const settings = parseSettingsRow(settingsRow);
    if (!isAllowedDate(bookingDate, settings)) {
      return res.status(400).json({ error: 'Data fora da regra do salão.' });
    }

    const [[service]] = await pool.query('SELECT id, name, duration, price FROM services WHERE id = ? AND active = 1 LIMIT 1', [serviceId]);
    if (!service) return res.status(404).json({ error: 'Serviço não encontrado.' });

    if (!settings.hours.includes(bookingTime)) {
      return res.status(400).json({ error: 'Horário inválido.' });
    }

    const [[existing]] = await pool.query(
      'SELECT id FROM bookings WHERE booking_date = ? AND booking_time = ? AND status IN ("Pendente","Confirmado") LIMIT 1',
      [bookingDate, bookingTime]
    );
    if (existing) {
      return res.status(409).json({ error: 'Esse horário já está ocupado.' });
    }

    await pool.query(
      `INSERT INTO bookings
      (client_name, phone, service_id, service_name, price, duration, booking_date, booking_time, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [clientName, phone, service.id, service.name, service.price, service.duration, bookingDate, bookingTime, notes || null]
    );

    res.json({ ok: true, message: 'Agendamento enviado com sucesso.' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao salvar o agendamento.' });
  }
});

app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (username === process.env.ADMIN_USER && password === process.env.ADMIN_PASS) {
    req.session.isAdmin = true;
    return res.json({ ok: true });
  }
  res.status(401).json({ error: 'Usuário ou senha inválidos.' });
});

app.post('/api/admin/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/admin/me', (req, res) => {
  res.json({ authenticated: !!req.session?.isAdmin });
});

app.get('/api/admin/bookings', requireAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM bookings ORDER BY booking_date ASC, booking_time ASC');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao carregar agendamentos.' });
  }
});

app.patch('/api/admin/bookings/:id/status', requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['Pendente', 'Confirmado', 'Cancelado'].includes(status)) {
      return res.status(400).json({ error: 'Status inválido.' });
    }
    await pool.query('UPDATE bookings SET status = ? WHERE id = ?', [status, req.params.id]);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar status.' });
  }
});

app.delete('/api/admin/bookings/:id', requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM bookings WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao excluir agendamento.' });
  }
});

app.get('/api/admin/services', requireAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, name, duration, price, active FROM services ORDER BY created_at DESC');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao carregar serviços.' });
  }
});

app.post('/api/admin/services', requireAdmin, async (req, res) => {
  try {
    const { name, duration, price } = req.body;
    if (!name || !duration || !price) {
      return res.status(400).json({ error: 'Preencha nome, duração e valor.' });
    }
    await pool.query('INSERT INTO services (name, duration, price) VALUES (?, ?, ?)', [name, duration, price]);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao cadastrar serviço.' });
  }
});

app.delete('/api/admin/services/:id', requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM services WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao excluir serviço.' });
  }
});

app.get('/api/admin/settings', requireAdmin, async (req, res) => {
  try {
    const [[row]] = await pool.query('SELECT * FROM settings WHERE id = 1 LIMIT 1');
    res.json(parseSettingsRow(row));
  } catch (error) {
    res.status(500).json({ error: 'Erro ao carregar configurações.' });
  }
});

app.put('/api/admin/settings', requireAdmin, async (req, res) => {
  try {
    const { salonName, salonSubtitle, hours, workingDays, bookingLimitDays } = req.body;
    const hoursString = Array.isArray(hours) ? hours.join(',') : String(hours || '');
    const workingDaysString = Array.isArray(workingDays) ? workingDays.join(',') : String(workingDays || '1,2,3,4,5,6');
    await pool.query(
      `UPDATE settings
       SET salon_name = ?, salon_subtitle = ?, hours = ?, working_days = ?, booking_limit_days = ?
       WHERE id = 1`,
      [salonName, salonSubtitle, hoursString, workingDaysString, Number(bookingLimitDays || 15)]
    );
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao salvar configurações.' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});

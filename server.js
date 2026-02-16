require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const cors = require('cors');
const { getDb, saveDb } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

if (NODE_ENV === 'production' && !process.env.JWT_SECRET) {
    console.error('❌ FATAL: JWT_SECRET required in production');
    process.exit(1);
}
const JWT_SECRET = process.env.JWT_SECRET || 'smarttrack-ai-secret-key-2026';

// ─── Auto-Seed Admin User ──────────────────────────────────
async function ensureAdminExists() {
    try {
        const db = await getDb();
        const adminEmail = 'admin@smarttrack.ai';
        const rows = db.exec("SELECT * FROM users WHERE email=?", [adminEmail]);

        if (rows.length === 0 || rows[0].values.length === 0) {
            console.log('🌱 No admin found. Auto-seeding admin account...');
            const hash = bcrypt.hashSync('adminpassword123', 10);
            db.run("INSERT INTO users (email, password_hash, role, name) VALUES (?, ?, 'teacher', ?)",
                [adminEmail, hash, 'Administrator']);
            saveDb();
            console.log('✅ Admin auto-seeded successfully.');
        }
    } catch (err) {
        console.error('❌ Auto-seed error:', err);
    }
}

const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const upload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => cb(null, uploadsDir),
        filename: (req, file, cb) => cb(null, `photo-${req.user.id}-${Date.now()}${path.extname(file.originalname)}`)
    }),
    limits: { fileSize: 5 * 1024 * 1024 }
});

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "blob:", "*"],
            connectSrc: ["'self'"]
        }
    }
}));
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/health', (req, res) => res.json({ status: 'ok', env: NODE_ENV }));

function authMiddleware(req, res, next) {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ error: 'Not authenticated' });
    try { req.user = jwt.verify(token, JWT_SECRET); next(); } catch { res.status(401).json({ error: 'Invalid token' }); }
}
function requireRole(role) { return (req, res, next) => req.user.role === role ? next() : res.status(403).json({ error: 'Forbidden' }); }

function queryAll(db, sql, params = []) {
    const rows = db.exec(sql, params);
    if (!rows.length) return [];
    const cols = rows[0].columns;
    return rows[0].values.map(vals => { const obj = {}; cols.forEach((c, i) => obj[c] = vals[i]); return obj; });
}
function queryOne(db, sql, params = []) { const all = queryAll(db, sql, params); return all.length ? all[0] : null; }

function euclideanDistance(a, b) {
    return Math.sqrt(a.reduce((sum, val, i) => sum + Math.pow(val - b[i], 2), 0));
}

// ─── Auth Routes ─────────────────────────────────────────────
app.post('/api/auth/login', async (req, res) => {
    try {
        const db = await getDb();
        const { email, password } = req.body;
        const user = queryOne(db, 'SELECT * FROM users WHERE LOWER(email) = LOWER(?)', [email.trim()]);
        if (!user || !bcrypt.compareSync(password, user.password_hash)) return res.status(401).json({ error: 'Invalid credentials' });
        const token = jwt.sign({ id: user.id, email: user.email, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '24h' });
        res.cookie('token', token, { httpOnly: true, sameSite: 'lax', maxAge: 86400000 });
        res.json({ role: user.role, name: user.name });
    } catch (e) { res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/auth/login-face', async (req, res) => {
    try {
        const db = await getDb();
        const { descriptor } = req.body;
        if (!descriptor) return res.status(400).json({ error: 'Descriptor required' });

        const students = queryAll(db, "SELECT s.*, u.role FROM students s JOIN users u ON s.user_id = u.id WHERE s.face_descriptor != ''");
        let bestMatch = null;
        let minDistance = 0.45;

        for (const s of students) {
            const storedDesc = JSON.parse(s.face_descriptor);
            const dist = euclideanDistance(descriptor, storedDesc);
            if (dist < minDistance) {
                minDistance = dist;
                bestMatch = s;
            }
        }

        if (!bestMatch) return res.status(401).json({ error: 'Face not recognized' });

        const token = jwt.sign({ id: bestMatch.user_id, email: bestMatch.email, role: 'student', name: bestMatch.name }, JWT_SECRET, { expiresIn: '24h' });
        res.cookie('token', token, { httpOnly: true, sameSite: 'lax', maxAge: 86400000 });
        res.json({ role: 'student', name: bestMatch.name });
    } catch (e) { res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/auth/logout', (req, res) => { res.clearCookie('token'); res.json({ success: true }); });
app.get('/api/auth/me', authMiddleware, (req, res) => res.json(req.user));

// ─── Teacher Routes ──────────────────────────────────────────
app.get('/api/teacher/profile', authMiddleware, requireRole('teacher'), async (req, res) => {
    const db = await getDb();
    res.json(queryOne(db, 'SELECT id, email, name, default_subject, default_section FROM users WHERE id = ?', [req.user.id]));
});
app.put('/api/teacher/profile', authMiddleware, requireRole('teacher'), async (req, res) => {
    const db = await getDb();
    const { name, default_subject, default_section } = req.body;
    db.run('UPDATE users SET name=?, default_subject=?, default_section=? WHERE id=?', [name, default_subject, default_section, req.user.id]);
    saveDb();
    res.json({ success: true, name });
});
app.get('/api/teacher/students', authMiddleware, requireRole('teacher'), async (req, res) => {
    const db = await getDb();
    const { section } = req.query;
    const sql = section ? 'SELECT * FROM students WHERE section=? ORDER BY roll_number' : 'SELECT * FROM students ORDER BY section, roll_number';
    res.json(queryAll(db, sql, section ? [section] : []));
});
app.post('/api/teacher/students', authMiddleware, requireRole('teacher'), async (req, res) => {
    const db = await getDb();
    const { name, email, roll_number, section, usn, semester } = req.body;
    const hash = bcrypt.hashSync(`student${roll_number}`, 10);
    db.run('INSERT INTO users (email, password_hash, role, name) VALUES (?, ?, "student", ?)', [email, hash, name]);
    const uid = db.exec('SELECT last_insert_rowid()')[0].values[0][0];
    db.run('INSERT INTO students (user_id, name, email, roll_number, section, usn, semester) VALUES (?, ?, ?, ?, ?, ?, ?)', [uid, name, email, roll_number, section, usn, semester]);
    saveDb(); res.json({ success: true });
});
app.put('/api/teacher/students/:id', authMiddleware, requireRole('teacher'), async (req, res) => {
    try {
        const db = await getDb();
        const { name, roll_number, section, usn, semester, email } = req.body;
        const student = queryOne(db, 'SELECT user_id FROM students WHERE id = ?', [req.params.id]);
        if (student) {
            db.run('UPDATE users SET email = ?, name = ? WHERE id = ?', [email, name, student.user_id]);
            db.run('UPDATE students SET name=?, roll_number=?, section=?, usn=?, semester=?, email=? WHERE id=?', [name, roll_number, section, usn, semester, email, req.params.id]);
            saveDb();
        }
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'Server error' }); }
});
app.get('/api/teacher/sessions', authMiddleware, requireRole('teacher'), async (req, res) => {
    const db = await getDb();
    res.json(queryAll(db, 'SELECT * FROM sessions WHERE teacher_user_id=? ORDER BY date DESC', [req.user.id]));
});
app.post('/api/teacher/sessions', authMiddleware, requireRole('teacher'), async (req, res) => {
    const db = await getDb();
    const { subject, section, date, time_slot, room } = req.body;
    db.run('INSERT INTO sessions (teacher_user_id, subject, section, date, time_slot, room) VALUES (?, ?, ?, ?, ?, ?)', [req.user.id, subject, section, date, time_slot, room]);
    const id = db.exec('SELECT last_insert_rowid() as id')[0].values[0][0];
    saveDb(); res.json({ success: true, id });
});
app.post('/api/teacher/attendance', authMiddleware, requireRole('teacher'), async (req, res) => {
    const db = await getDb();
    const { session_id, records } = req.body;
    for (const r of records) db.run('INSERT OR REPLACE INTO attendance (session_id, student_id, status) VALUES (?, ?, ?)', [session_id, r.student_id, r.status]);
    saveDb(); res.json({ success: true, count: records.length });
});
app.get('/api/teacher/attendance/:sessionId', authMiddleware, requireRole('teacher'), async (req, res) => {
    const db = await getDb();
    const records = queryAll(db, `SELECT a.*, s.name as student_name, s.roll_number FROM attendance a JOIN students s ON a.student_id = s.id WHERE a.session_id = ?`, [req.params.sessionId]);
    res.json(records);
});

// ─── Student Routes ──────────────────────────────────────────
app.get('/api/student/dashboard', authMiddleware, requireRole('student'), async (req, res) => {
    try {
        const db = await getDb();
        const student = queryOne(db, 'SELECT * FROM students WHERE user_id = ?', [req.user.id]);
        const att = queryAll(db, `SELECT a.status, s.subject FROM attendance a JOIN sessions s ON a.session_id = s.id WHERE a.student_id = ?`, [student.id]);
        const total = att.length;
        const present = att.filter(x => x.status === 'Present').length;
        const overallPercentage = total ? Math.round((present / total) * 100) : 0;
        const subjectMap = {};
        att.forEach(a => {
            if (!subjectMap[a.subject]) subjectMap[a.subject] = { total: 0, present: 0 };
            subjectMap[a.subject].total++;
            if (a.status === 'Present') subjectMap[a.subject].present++;
        });
        const subjectStats = Object.entries(subjectMap).map(([subject, stats]) => ({
            subject, ...stats, percentage: Math.round((stats.present / stats.total) * 100)
        }));
        res.json({ overallPercentage, totalClasses: total, classesAttended: present, trendScore: overallPercentage, trendComment: 'Steady', shortageSubjects: subjectStats.filter(s => s.percentage < 75), subjectStats });
    } catch (e) { res.status(500).json({ error: 'Server error' }); }
});
app.get('/api/student/attendance', authMiddleware, requireRole('student'), async (req, res) => {
    const db = await getDb();
    const student = queryOne(db, 'SELECT id FROM students WHERE user_id = ?', [req.user.id]);
    const { period } = req.query;
    let sql = 'SELECT a.status, s.date, s.subject, s.time_slot, s.room FROM attendance a JOIN sessions s ON a.session_id = s.id WHERE a.student_id = ?';
    if (period === 'today') sql += " AND s.date = date('now')";
    sql += ' ORDER BY s.date DESC';
    res.json(queryAll(db, sql, [student.id]));
});
app.get('/api/student/upcoming', authMiddleware, requireRole('student'), async (req, res) => {
    const db = await getDb();
    const student = queryOne(db, 'SELECT section FROM students WHERE user_id = ?', [req.user.id]);
    res.json(queryAll(db, "SELECT * FROM upcoming_classes WHERE section = ? AND date >= date('now') ORDER BY date ASC", [student.section]));
});
app.get('/api/student/profile', authMiddleware, requireRole('student'), async (req, res) => {
    const db = await getDb();
    res.json(queryOne(db, 'SELECT * FROM students WHERE user_id = ?', [req.user.id]));
});
app.put('/api/student/profile', authMiddleware, requireRole('student'), async (req, res) => {
    const db = await getDb();
    const { usn, semester } = req.body;
    db.run('UPDATE students SET usn=?, semester=? WHERE user_id=?', [usn, semester, req.user.id]);
    saveDb(); res.json({ success: true });
});
app.post('/api/student/profile/photo', authMiddleware, requireRole('student'), upload.single('photo'), async (req, res) => {
    const db = await getDb();
    const url = `/uploads/${req.file.filename}`;
    db.run('UPDATE students SET photo_url=? WHERE user_id=?', [url, req.user.id]);
    saveDb(); res.json({ success: true, photo_url: url });
});
app.post('/api/student/profile/photo-url', authMiddleware, requireRole('student'), async (req, res) => {
    const db = await getDb();
    const { photo_url } = req.body;
    db.run('UPDATE students SET photo_url=? WHERE user_id=?', [photo_url, req.user.id]);
    saveDb(); res.json({ success: true, photo_url });
});
app.post('/api/student/face-register', authMiddleware, requireRole('student'), async (req, res) => {
    const db = await getDb();
    const { descriptor } = req.body;
    db.run('UPDATE students SET face_descriptor=? WHERE user_id=?', [JSON.stringify(descriptor), req.user.id]);
    saveDb(); res.json({ success: true });
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

async function start() {
    await getDb();
    await ensureAdminExists(); // Run auto-seed
    app.listen(PORT, () => console.log(`🚀 SmartTrack AI running at http://localhost:${PORT}`));
}
start();

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
const rateLimit = require('express-rate-limit');
const { getDb, saveDb } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// CRITICAL: JWT_SECRET must be set in production
if (NODE_ENV === 'production' && !process.env.JWT_SECRET) {
    console.error('❌ FATAL: JWT_SECRET environment variable is required in production');
    console.error('Generate a secret: openssl rand -base64 32');
    process.exit(1);
}

const JWT_SECRET = process.env.JWT_SECRET || 'smarttrack-ai-secret-key-2026';

if (NODE_ENV === 'development' && !process.env.JWT_SECRET) {
    console.warn('⚠️  WARNING: Using default JWT_SECRET in development. Set JWT_SECRET in .env for production.');
}

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer config for photo uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `photo-${req.user.id}-${Date.now()}${ext}`);
    }
});
const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = /jpeg|jpg|png|gif|webp/;
        const ext = allowed.test(path.extname(file.originalname).toLowerCase());
        const mime = allowed.test(file.mimetype);
        cb(null, ext && mime);
    }
});

// ─── Security Middleware ─────────────────────────────────────
// Helmet for security headers
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "blob:"],
            connectSrc: ["'self'"]
        }
    }
}));

// CORS Configuration
const corsOptions = {
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// ─── Health Check (Priority) ─────────────────────────────────
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString(), uptime: process.uptime(), environment: NODE_ENV });
});

app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString(), uptime: process.uptime(), environment: NODE_ENV });
});

// General rate limiter
const generalLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    message: { error: 'Too many requests, please try again later' },
    standardHeaders: true,
    legacyHeaders: false
});

// Stricter rate limiter for auth endpoints
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: parseInt(process.env.AUTH_RATE_LIMIT_MAX_REQUESTS) || 5,
    message: { error: 'Too many login attempts, please try again after 15 minutes' },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true
});

app.use('/api/', generalLimiter);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Debug logging for models
app.use('/models', (req, res, next) => {
    console.log(`[Models] Requesting: ${req.url}`);
    next();
});

app.use(express.static(path.join(__dirname, 'public')));

// ─── Auth Middleware ─────────────────────────────────────────
function authMiddleware(req, res, next) {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ error: 'Not authenticated' });
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch {
        return res.status(401).json({ error: 'Invalid token' });
    }
}

function requireRole(...roles) {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        next();
    };
}

// Helper functions
function queryAll(db, sql, params = []) {
    const rows = db.exec(sql, params);
    if (!rows.length) return [];
    const cols = rows[0].columns;
    return rows[0].values.map(vals => {
        const obj = {};
        cols.forEach((c, i) => obj[c] = vals[i]);
        return obj;
    });
}

function queryOne(db, sql, params = []) {
    const all = queryAll(db, sql, params);
    return all.length ? all[0] : null;
}

function euclideanDistance(a, b) {
    return Math.sqrt(a.reduce((sum, val, i) => sum + Math.pow(val - b[i], 2), 0));
}

// ─── Auth Routes ─────────────────────────────────────────────
app.post('/api/auth/login', authLimiter, async (req, res) => {
    try {
        const db = await getDb();
        const { email, password, faceToken } = req.body;

        if (faceToken) {
            const rows = db.exec(`SELECT s.*, u.id as uid, u.role, u.password_hash FROM students s JOIN users u ON s.user_id = u.id WHERE s.face_token = ?`, [faceToken]);
            if (!rows.length || !rows[0].values.length) {
                return res.status(401).json({ error: 'Face token not recognized' });
            }
            const cols = rows[0].columns;
            const vals = rows[0].values[0];
            const student = {};
            cols.forEach((c, i) => student[c] = vals[i]);

            const token = jwt.sign({ id: student.uid, email: student.email, role: 'student', name: student.name }, JWT_SECRET, { expiresIn: '24h' });
            res.cookie('token', token, { httpOnly: true, sameSite: 'lax', maxAge: 86400000 });
            return res.json({ role: 'student', name: student.name });
        }

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const rows = db.exec(`SELECT * FROM users WHERE LOWER(email) = LOWER(?)`, [email.trim()]);
        if (!rows.length || !rows[0].values.length) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const cols = rows[0].columns;
        const vals = rows[0].values[0];
        const user = {};
        cols.forEach((c, i) => user[c] = vals[i]);

        const valid = bcrypt.compareSync(password, user.password_hash);
        if (!valid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign({ id: user.id, email: user.email, role: user.role, name: user.name || '' }, JWT_SECRET, { expiresIn: '24h' });
        res.cookie('token', token, { httpOnly: true, sameSite: 'lax', maxAge: 86400000 });
        res.json({ role: user.role, name: user.name || user.email });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/auth/logout', (req, res) => {
    res.clearCookie('token');
    return res.json({ success: true });
});

app.post('/api/auth/login-face', authLimiter, async (req, res) => {
    try {
        const db = await getDb();
        const { descriptor } = req.body;
        if (!descriptor || !Array.isArray(descriptor)) {
            return res.status(400).json({ error: 'Invalid descriptor' });
        }

        const students = queryAll(db, `SELECT s.*, u.id as uid, u.role, u.password_hash FROM students s JOIN users u ON s.user_id = u.id WHERE s.face_descriptor != ''`);
        let bestMatch = null;
        let minDistance = 0.6;

        for (const s of students) {
            try {
                const storedDesc = JSON.parse(s.face_descriptor);
                const distance = euclideanDistance(descriptor, storedDesc);
                if (distance < minDistance) {
                    minDistance = distance;
                    bestMatch = s;
                }
            } catch (e) {
                console.warn(`Could not parse face_descriptor for student ${s.id}`);
            }
        }

        if (!bestMatch) {
            return res.status(401).json({ error: 'Face not recognized' });
        }

        const token = jwt.sign({ id: bestMatch.uid, email: bestMatch.email, role: 'student', name: bestMatch.name }, JWT_SECRET, { expiresIn: '24h' });
        res.cookie('token', token, { httpOnly: true, sameSite: 'lax', maxAge: 86400000 });
        return res.json({ role: 'student', name: bestMatch.name });
    } catch (err) {
        console.error('Face login error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
    res.json({ id: req.user.id, email: req.user.email, role: req.user.role, name: req.user.name });
});

// ─── Teacher Routes ──────────────────────────────────────────
app.get('/api/teacher/dashboard', authMiddleware, requireRole('teacher'), async (req, res) => {
    try {
        const db = await getDb();
        const totalStudents = queryAll(db, 'SELECT COUNT(*) as count FROM students')[0].count;
        const sessionsToday = queryAll(db, `SELECT COUNT(*) as count FROM sessions WHERE date = ?`, [new Date().toISOString().split('T')[0]])[0].count;
        const subjects = queryAll(db, 'SELECT DISTINCT subject FROM sessions').map(r => r.subject);
        const sections = queryAll(db, 'SELECT DISTINCT section FROM students').map(r => r.section);

        const recentSessions = queryAll(db, `
            SELECT s.*,
                   (SELECT COUNT(*) FROM attendance a WHERE a.session_id = s.id AND a.status = 'present') as present_count,
                   (SELECT COUNT(*) FROM attendance a WHERE a.session_id = s.id) as total_marked
            FROM sessions s
            ORDER BY s.created_at DESC
            LIMIT 5
        `);

        res.json({ totalStudents, sessionsToday, subjects, sections, recentSessions });
    } catch (err) {
        console.error('Dashboard error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/teacher/students', authMiddleware, requireRole('teacher'), async (req, res) => {
    try {
        const db = await getDb();
        const { name, email, rollNumber, section } = req.body;
        if (!name || !email || !rollNumber || !section) {
            return res.status(400).json({ error: 'All fields required' });
        }

        const existing = queryOne(db, 'SELECT * FROM users WHERE LOWER(email) = LOWER(?)', [email]);
        if (existing) return res.status(409).json({ error: 'Email already registered' });

        const existingRoll = queryOne(db, 'SELECT * FROM students WHERE roll_number = ? AND section = ?', [rollNumber, section]);
        if (existingRoll) return res.status(409).json({ error: 'Roll number already exists in this section' });

        const defaultPassword = `student${rollNumber}`;
        const hash = bcrypt.hashSync(defaultPassword, 10);

        db.run('INSERT INTO users (email, password_hash, role, name) VALUES (?, ?, ?, ?)', [email, hash, 'student', name]);
        const userId = db.exec('SELECT last_insert_rowid() as id')[0].values[0][0];

        db.run('INSERT INTO students (user_id, name, email, roll_number, section, face_descriptor, face_token) VALUES (?, ?, ?, ?, ?, ?, ?)', [userId, name, email, rollNumber, section, '', '']);

        saveDb();
        res.json({ success: true, defaultPassword, message: 'Student registered successfully' });
    } catch (err) {
        console.error('Student registration error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/teacher/students', authMiddleware, requireRole('teacher'), async (req, res) => {
    try {
        const db = await getDb();
        const { section } = req.query;
        let students = section ? queryAll(db, 'SELECT * FROM students WHERE section = ? ORDER BY roll_number', [section]) : queryAll(db, 'SELECT * FROM students ORDER BY section, roll_number');
        res.json(students);
    } catch (err) {
        console.error('Students list error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/teacher/session', authMiddleware, requireRole('teacher'), async (req, res) => {
    try {
        const db = await getDb();
        const { subject, section, date, timeSlot, room } = req.body;
        if (!subject || !section || !date || !timeSlot) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        db.run('INSERT INTO sessions (teacher_id, subject, section, date, time_slot, room, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [req.user.id, subject, section, date, timeSlot, room || '', new Date().toISOString()]);
        const sessionId = db.exec('SELECT last_insert_rowid() as id')[0].values[0][0];
        saveDb();
        res.json({ success: true, sessionId });
    } catch (err) {
        console.error('Session creation error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/teacher/attendance', authMiddleware, requireRole('teacher'), async (req, res) => {
    try {
        const db = await getDb();
        const { sessionId, studentId, status } = req.body;
        if (!sessionId || !studentId || !status) return res.status(400).json({ error: 'Missing required fields' });

        const existing = queryOne(db, 'SELECT * FROM attendance WHERE session_id = ? AND student_id = ?', [sessionId, studentId]);
        if (existing) {
            db.run('UPDATE attendance SET status = ?, marked_at = ? WHERE session_id = ? AND student_id = ?', [status, new Date().toISOString(), sessionId, studentId]);
        } else {
            db.run('INSERT INTO attendance (session_id, student_id, status, marked_at) VALUES (?, ?, ?, ?)', [sessionId, studentId, status, new Date().toISOString()]);
        }

        saveDb();
        res.json({ success: true });
    } catch (err) {
        console.error('Attendance marking error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/teacher/reports', authMiddleware, requireRole('teacher'), async (req, res) => {
    try {
        const db = await getDb();
        const { section, subject, studentId } = req.query;

        let query = `SELECT s.name, s.roll_number, s.section, COUNT(a.id) as total_classes, SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as classes_attended FROM students s LEFT JOIN attendance a ON s.id = a.student_id LEFT JOIN sessions sess ON a.session_id = sess.id WHERE 1=1`;
        const params = [];

        if (section) { query += ' AND s.section = ?'; params.push(section); }
        if (subject) { query += ' AND sess.subject = ?'; params.push(subject); }
        if (studentId) { query += ' AND s.id = ?'; params.push(studentId); }

        query += ' GROUP BY s.id ORDER BY s.section, s.roll_number';
        const report = queryAll(db, query, params).map(r => ({ ...r, percentage: r.total_classes > 0 ? Math.round((r.classes_attended / r.total_classes) * 100) : 0 }));
        res.json(report);
    } catch (err) {
        console.error('Reports error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/teacher/upload-photo', authMiddleware, requireRole('teacher'), upload.single('photo'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
        const { studentId } = req.body;
        if (!studentId) { fs.unlinkSync(req.file.path); return res.status(400).json({ error: 'Student ID required' }); }

        const db = await getDb();
        const photoUrl = `/uploads/${req.file.filename}`;
        db.run('UPDATE students SET photo_url = ? WHERE id = ?', [photoUrl, studentId]);
        saveDb();
        res.json({ success: true, photoUrl });
    } catch (err) {
        console.error('Photo upload error:', err);
        if (req.file) fs.unlinkSync(req.file.path);
        res.status(500).json({ error: 'Server error' });
    }
});

// ─── Student Routes ──────────────────────────────────────────
app.get('/api/student/dashboard', authMiddleware, requireRole('student'), async (req, res) => {
    try {
        const db = await getDb();
        const student = queryOne(db, 'SELECT * FROM students WHERE user_id = ?', [req.user.id]);
        if (!student) return res.status(404).json({ error: 'Student record not found' });

        const total = queryAll(db, 'SELECT COUNT(*) as count FROM attendance WHERE student_id = ?', [student.id])[0].count;
        const present = queryAll(db, 'SELECT COUNT(*) as count FROM attendance WHERE student_id = ? AND status = ?', [student.id, 'present'])[0].count;
        const percentage = total > 0 ? Math.round((present / total) * 100) : 0;

        const subjectStats = queryAll(db, `SELECT sess.subject, COUNT(a.id) as total, SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present FROM attendance a JOIN sessions sess ON a.session_id = sess.id WHERE a.student_id = ? GROUP BY sess.subject`, [student.id]);
        const shortageSubjects = subjectStats.filter(s => s.total > 0 && (s.present / s.total) < 0.75).map(s => s.subject);

        const last7Days = queryAll(db, `SELECT DATE(sess.date) as date, SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present, COUNT(a.id) as total FROM attendance a JOIN sessions sess ON a.session_id = sess.id WHERE a.student_id = ? AND sess.date >= date('now', '-7 days') GROUP BY DATE(sess.date) ORDER BY date DESC`, [student.id]);

        let trendScore = 0; let trendComment = 'Not enough data';
        if (last7Days.length >= 3) {
            const recent = last7Days.slice(0, 3);
            const avgRecent = recent.reduce((sum, d) => sum + (d.present / d.total), 0) / recent.length;
            if (avgRecent > 0.9) { trendScore = 2; trendComment = 'Excellent attendance streak!'; }
            else if (avgRecent > 0.75) { trendScore = 1; trendComment = 'Good attendance.'; }
            else if (avgRecent > 0.5) { trendScore = 0; trendComment = 'Needs improvement.'; }
            else { trendScore = -1; trendComment = 'Warning: Low attendance.'; }
        }

        res.json({ name: student.name, rollNumber: student.roll_number, section: student.section, photoUrl: student.photo_url || null, attendancePercentage: percentage, totalClasses: total, classesAttended: present, trendScore, trendComment, shortageSubjects, subjectStats: subjectStats.map(s => ({ subject: s.subject, percentage: Math.round((s.present / s.total) * 100), total: s.total, present: s.present })) });
    } catch (err) {
        console.error('Dashboard error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/student/attendance', authMiddleware, requireRole('student'), async (req, res) => {
    try {
        const db = await getDb();
        const student = queryOne(db, 'SELECT * FROM students WHERE user_id = ?', [req.user.id]);
        if (!student) return res.status(404).json({ error: 'Student record not found' });

        const { period } = req.query;
        const today = new Date();
        let dateFilter = '';
        if (period === 'today') dateFilter = today.toISOString().split('T')[0];
        else if (period === 'week') { const weekAgo = new Date(today); weekAgo.setDate(weekAgo.getDate() - 7); dateFilter = weekAgo.toISOString().split('T')[0]; }
        else if (period === 'month') { const monthAgo = new Date(today); monthAgo.setMonth(monthAgo.getMonth() - 1); dateFilter = monthAgo.toISOString().split('T')[0]; }

        let records = period === 'today' ? queryAll(db, `SELECT a.status, a.marked_at, s.subject, s.date, s.time_slot, s.room FROM attendance a JOIN sessions s ON a.session_id = s.id WHERE a.student_id = ? AND s.date = ? ORDER BY s.date DESC, s.time_slot DESC`, [student.id, dateFilter]) : (dateFilter ? queryAll(db, `SELECT a.status, a.marked_at, s.subject, s.date, s.time_slot, s.room FROM attendance a JOIN sessions s ON a.session_id = s.id WHERE a.student_id = ? AND s.date >= ? ORDER BY s.date DESC, s.time_slot DESC`, [student.id, dateFilter]) : queryAll(db, `SELECT a.status, a.marked_at, s.subject, s.date, s.time_slot, s.room FROM attendance a JOIN sessions s ON a.session_id = s.id WHERE a.student_id = ? ORDER BY s.date DESC, s.time_slot DESC`, [student.id]));
        res.json(records);
    } catch (err) {
        console.error('Attendance records error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/student/upcoming', authMiddleware, requireRole('student'), async (req, res) => {
    try {
        const db = await getDb();
        const student = queryOne(db, 'SELECT * FROM students WHERE user_id = ?', [req.user.id]);
        if (!student) return res.status(404).json({ error: 'Student record not found' });

        const today = new Date().toISOString().split('T')[0];
        const classes = queryAll(db, `SELECT * FROM upcoming_classes WHERE section = ? AND date >= ? ORDER BY date ASC, time_slot ASC`, [student.section, today]);
        res.json(classes);
    } catch (err) {
        console.error('Upcoming classes error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/student/face-register', authMiddleware, requireRole('student'), async (req, res) => {
    try {
        const db = await getDb();
        const { descriptor } = req.body;
        if (!descriptor || !Array.isArray(descriptor)) return res.status(400).json({ error: 'Invalid descriptor' });

        const otherStudents = queryAll(db, `SELECT s.face_descriptor, s.name, u.email FROM students s JOIN users u ON s.user_id = u.id WHERE s.user_id != ? AND s.face_descriptor != ''`, [req.user.id]);
        for (const s of otherStudents) {
            try {
                const storedDesc = JSON.parse(s.face_descriptor);
                const distance = euclideanDistance(descriptor, storedDesc);
                if (distance < 0.62) return res.status(409).json({ error: 'This face is already registered to another account' });
            } catch (e) { console.warn(`[Auth] Could not parse face_descriptor for student: ${s.email}`); }
        }

        db.run('UPDATE students SET face_descriptor = ? WHERE user_id = ?', [JSON.stringify(descriptor), req.user.id]);
        saveDb();
        res.json({ success: true });
    } catch (err) {
        console.error('Face register error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// ─── SPA fallback ────────────────────────────────────────────
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── Start Server ────────────────────────────────────────────
let server;
async function start() {
    await getDb();
    server = app.listen(PORT, () => {
        console.log(`\n🚀 SmartTrack AI server running at http://localhost:${PORT}`);
        console.log(`📊 Environment: ${NODE_ENV}`);
        console.log(`💾 Database: SQLite (smarttrack.db)\n`);
    });
}

function gracefulShutdown(signal) {
    console.log(`\n${signal} received. Starting graceful shutdown...`);
    if (server) {
        server.close(() => {
            console.log('✅ HTTP server closed');
            try { saveDb(); console.log('✅ Database saved successfully'); } catch (err) { console.error('❌ Error saving database:', err); }
            console.log('👋 Graceful shutdown complete\n');
            process.exit(0);
        });
        setTimeout(() => { console.error('⚠️  Forced shutdown after timeout'); process.exit(1); }, 10000);
    } else { process.exit(0); }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('uncaughtException', (err) => { console.error('❌ Uncaught Exception:', err); gracefulShutdown('UNCAUGHT_EXCEPTION'); });
process.on('unhandledRejection', (reason, promise) => { console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason); gracefulShutdown('UNHANDLED_REJECTION'); });

start().catch(err => { console.error('❌ Failed to start server:', err); process.exit(1); });

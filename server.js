const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getDb, saveDb } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'smarttrack-ai-secret-key-2026';

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

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
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

// ─── Auth Routes ─────────────────────────────────────────────
app.post('/api/auth/login', async (req, res) => {
    try {
        const db = await getDb();
        const { email, password, faceToken } = req.body;

        // Face token login path
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

        const rows = db.exec(`SELECT * FROM users WHERE email = ?`, [email]);
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

        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role, name: user.name || '' },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

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

app.post('/api/auth/login-face', async (req, res) => {
    try {
        const db = await getDb();
        const { descriptor } = req.body;
        if (!descriptor || !Array.isArray(descriptor)) {
            return res.status(400).json({ error: 'Invalid descriptor' });
        }

        // Get all students with face descriptors
        const students = queryAll(db, `SELECT s.*, u.id as uid, u.role, u.password_hash FROM students s JOIN users u ON s.user_id = u.id WHERE s.face_descriptor != ''`);

        // Find best match
        let bestMatch = null;
        let minDistance = 0.6; // Threshold

        for (const s of students) {
            try {
                const storedDesc = JSON.parse(s.face_descriptor);
                const distance = euclideanDistance(descriptor, storedDesc);
                if (distance < minDistance) {
                    minDistance = distance;
                    bestMatch = s;
                }
            } catch (e) {
                console.error('Error parsing descriptor for student', s.id);
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

// ─── Helper: parse sql.js result to array of objects ──────────
function queryAll(db, sql, params = []) {
    const result = db.exec(sql, params);
    if (!result.length) return [];
    const cols = result[0].columns;
    return result[0].values.map(row => {
        const obj = {};
        cols.forEach((c, i) => obj[c] = row[i]);
        return obj;
    });
}

function queryOne(db, sql, params = []) {
    const rows = queryAll(db, sql, params);
    return rows.length ? rows[0] : null;
}

function euclideanDistance(d1, d2) {
    if (!d1 || !d2 || d1.length !== d2.length) return 2.0;
    return Math.sqrt(d1.reduce((sum, val, i) => sum + Math.pow(val - d2[i], 2), 0));
}

// ─── Teacher Routes ──────────────────────────────────────────
app.get('/api/teacher/profile', authMiddleware, requireRole('teacher'), async (req, res) => {
    const db = await getDb();
    const user = queryOne(db, 'SELECT id, email, name, role, created_at, default_subject, default_section FROM users WHERE id = ?', [req.user.id]);
    res.json(user);
});

app.put('/api/teacher/profile', authMiddleware, requireRole('teacher'), async (req, res) => {
    try {
        const db = await getDb();
        const { name, default_subject, default_section } = req.body;
        db.run(
            'UPDATE users SET name = ?, default_subject = ?, default_section = ? WHERE id = ?',
            [name || '', default_subject || '', default_section || '', req.user.id]
        );
        saveDb();
        const user = queryOne(db, 'SELECT id, email, name, role, created_at, default_subject, default_section FROM users WHERE id = ?', [req.user.id]);
        res.json(user);
    } catch (err) {
        console.error('Update teacher profile error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/teacher/students', authMiddleware, requireRole('teacher'), async (req, res) => {
    const db = await getDb();
    const { section } = req.query;
    let students;
    if (section) {
        students = queryAll(db, 'SELECT * FROM students WHERE section = ? ORDER BY roll_number', [section]);
    } else {
        students = queryAll(db, 'SELECT * FROM students ORDER BY roll_number');
    }
    res.json(students);
});

app.post('/api/teacher/students', authMiddleware, requireRole('teacher'), async (req, res) => {
    try {
        const db = await getDb();
        const { name, roll_number, section, email, photo_url } = req.body;

        if (!name || !roll_number || !email) {
            return res.status(400).json({ error: 'Name, roll number, and email are required' });
        }

        // Check if user exists
        const existing = queryOne(db, 'SELECT id FROM users WHERE email = ?', [email]);
        if (existing) {
            return res.status(409).json({ error: 'A user with this email already exists' });
        }

        // Create user account with default password
        const hash = bcrypt.hashSync('student123', 10);
        db.run(
            `INSERT INTO users (email, password_hash, role, name, roll_number) VALUES (?, ?, 'student', ?, ?)`,
            [email, hash, name, roll_number]
        );
        const userId = db.exec('SELECT last_insert_rowid()')[0].values[0][0];

        // Create student record
        db.run(
            `INSERT INTO students (name, roll_number, section, email, photo_url, user_id) VALUES (?, ?, ?, ?, ?, ?)`,
            [name, roll_number, section || '', email, photo_url || '', userId]
        );
        const studentId = db.exec('SELECT last_insert_rowid()')[0].values[0][0];

        saveDb();
        const student = queryOne(db, 'SELECT * FROM students WHERE id = ?', [studentId]);
        res.status(201).json(student);
    } catch (err) {
        console.error('Add student error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/teacher/sessions', authMiddleware, requireRole('teacher'), async (req, res) => {
    const db = await getDb();
    const sessions = queryAll(db, 'SELECT * FROM sessions ORDER BY date DESC, time_slot DESC');
    res.json(sessions);
});

app.post('/api/teacher/sessions', authMiddleware, requireRole('teacher'), async (req, res) => {
    try {
        const db = await getDb();
        const { subject, section, date, time_slot, room } = req.body;

        if (!subject || !date) {
            return res.status(400).json({ error: 'Subject and date are required' });
        }

        db.run(
            `INSERT INTO sessions (teacher_name, subject, section, date, time_slot, room, teacher_user_id) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [req.user.name || 'Teacher', subject, section || '', date, time_slot || '', room || '', req.user.id]
        );
        const sessionId = db.exec('SELECT last_insert_rowid()')[0].values[0][0];
        saveDb();

        const session = queryOne(db, 'SELECT * FROM sessions WHERE id = ?', [sessionId]);
        res.status(201).json(session);
    } catch (err) {
        console.error('Create session error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/teacher/attendance/:sessionId', authMiddleware, requireRole('teacher'), async (req, res) => {
    const db = await getDb();
    const records = queryAll(db,
        `SELECT a.*, s.name as student_name, s.roll_number
     FROM attendance a
     JOIN students s ON a.student_id = s.id
     WHERE a.session_id = ?
     ORDER BY s.roll_number`,
        [req.params.sessionId]
    );
    res.json(records);
});

app.post('/api/teacher/attendance', authMiddleware, requireRole('teacher'), async (req, res) => {
    try {
        const db = await getDb();
        const { session_id, records } = req.body;

        if (!session_id || !records || !Array.isArray(records)) {
            return res.status(400).json({ error: 'session_id and records array required' });
        }

        // Delete existing attendance for this session
        db.run('DELETE FROM attendance WHERE session_id = ?', [session_id]);

        // Insert new records
        for (const r of records) {
            db.run(
                'INSERT INTO attendance (session_id, student_id, status) VALUES (?, ?, ?)',
                [session_id, r.student_id, r.status || 'Absent']
            );
        }

        saveDb();
        res.json({ success: true, count: records.length });
    } catch (err) {
        console.error('Mark attendance error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// ─── Student Routes ──────────────────────────────────────────
app.get('/api/student/profile', authMiddleware, requireRole('student'), async (req, res) => {
    const db = await getDb();
    const student = queryOne(db, 'SELECT * FROM students WHERE user_id = ?', [req.user.id]);
    if (!student) return res.status(404).json({ error: 'Student record not found' });
    res.json(student);
});

app.put('/api/student/profile', authMiddleware, requireRole('student'), async (req, res) => {
    try {
        const db = await getDb();
        const { usn, semester } = req.body;
        db.run(
            'UPDATE students SET usn = ?, semester = ? WHERE user_id = ?',
            [usn || '', semester || '', req.user.id]
        );
        saveDb();
        const student = queryOne(db, 'SELECT * FROM students WHERE user_id = ?', [req.user.id]);
        res.json(student);
    } catch (err) {
        console.error('Update profile error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/student/profile/photo', authMiddleware, requireRole('student'), upload.single('photo'), async (req, res) => {
    try {
        const db = await getDb();
        if (!req.file) return res.status(400).json({ error: 'No photo uploaded' });

        const photoUrl = `/uploads/${req.file.filename}`;
        db.run('UPDATE students SET photo_url = ? WHERE user_id = ?', [photoUrl, req.user.id]);
        saveDb();
        res.json({ photo_url: photoUrl });
    } catch (err) {
        console.error('Photo upload error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/student/dashboard', authMiddleware, requireRole('student'), async (req, res) => {
    try {
        const db = await getDb();
        const student = queryOne(db, 'SELECT * FROM students WHERE user_id = ?', [req.user.id]);
        if (!student) return res.status(404).json({ error: 'Student record not found' });

        // Overall attendance
        const totalRecords = queryAll(db,
            'SELECT COUNT(*) as total FROM attendance WHERE student_id = ?',
            [student.id]
        );
        const presentRecords = queryAll(db,
            "SELECT COUNT(*) as present FROM attendance WHERE student_id = ? AND status IN ('Present','Late')",
            [student.id]
        );
        const total = totalRecords[0]?.total || 0;
        const present = presentRecords[0]?.present || 0;
        const overallPercentage = total > 0 ? Math.round((present / total) * 100) : 0;

        // Last 7 days trend
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const sevenDaysStr = sevenDaysAgo.toISOString().split('T')[0];

        const recentTotal = queryAll(db,
            `SELECT COUNT(*) as total FROM attendance a JOIN sessions s ON a.session_id = s.id
       WHERE a.student_id = ? AND s.date >= ?`,
            [student.id, sevenDaysStr]
        );
        const recentPresent = queryAll(db,
            `SELECT COUNT(*) as present FROM attendance a JOIN sessions s ON a.session_id = s.id
       WHERE a.student_id = ? AND s.date >= ? AND a.status IN ('Present','Late')`,
            [student.id, sevenDaysStr]
        );
        const rTotal = recentTotal[0]?.total || 0;
        const rPresent = recentPresent[0]?.present || 0;
        const trendScore = rTotal > 0 ? Math.round((rPresent / rTotal) * 100) : 0;

        let trendComment = 'No recent data';
        if (rTotal > 0) {
            if (trendScore >= overallPercentage + 5) trendComment = '📈 Trending up this week!';
            else if (trendScore <= overallPercentage - 5) trendComment = '📉 Attendance dipping this week';
            else trendComment = '➡️ Consistent attendance';
        }

        // Shortage analysis by subject (< 75% threshold)
        const subjectStats = queryAll(db,
            `SELECT s.subject,
              COUNT(*) as total,
              SUM(CASE WHEN a.status IN ('Present','Late') THEN 1 ELSE 0 END) as present
       FROM attendance a
       JOIN sessions s ON a.session_id = s.id
       WHERE a.student_id = ?
       GROUP BY s.subject`,
            [student.id]
        );

        const shortageSubjects = subjectStats
            .map(s => ({ subject: s.subject, percentage: Math.round((s.present / s.total) * 100), total: s.total, present: s.present }))
            .filter(s => s.percentage < 75);

        res.json({
            overallPercentage,
            totalClasses: total,
            classesAttended: present,
            trendScore,
            trendComment,
            shortageSubjects,
            subjectStats: subjectStats.map(s => ({
                subject: s.subject,
                percentage: Math.round((s.present / s.total) * 100),
                total: s.total,
                present: s.present
            }))
        });
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

        if (period === 'today') {
            dateFilter = today.toISOString().split('T')[0];
        } else if (period === 'week') {
            const weekAgo = new Date(today);
            weekAgo.setDate(weekAgo.getDate() - 7);
            dateFilter = weekAgo.toISOString().split('T')[0];
        } else if (period === 'month') {
            const monthAgo = new Date(today);
            monthAgo.setMonth(monthAgo.getMonth() - 1);
            dateFilter = monthAgo.toISOString().split('T')[0];
        }

        let records;
        if (period === 'today') {
            records = queryAll(db,
                `SELECT a.status, a.marked_at, s.subject, s.date, s.time_slot, s.room
         FROM attendance a JOIN sessions s ON a.session_id = s.id
         WHERE a.student_id = ? AND s.date = ?
         ORDER BY s.date DESC, s.time_slot DESC`,
                [student.id, dateFilter]
            );
        } else if (dateFilter) {
            records = queryAll(db,
                `SELECT a.status, a.marked_at, s.subject, s.date, s.time_slot, s.room
         FROM attendance a JOIN sessions s ON a.session_id = s.id
         WHERE a.student_id = ? AND s.date >= ?
         ORDER BY s.date DESC, s.time_slot DESC`,
                [student.id, dateFilter]
            );
        } else {
            records = queryAll(db,
                `SELECT a.status, a.marked_at, s.subject, s.date, s.time_slot, s.room
         FROM attendance a JOIN sessions s ON a.session_id = s.id
         WHERE a.student_id = ?
         ORDER BY s.date DESC, s.time_slot DESC`,
                [student.id]
            );
        }

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
        const classes = queryAll(db,
            `SELECT * FROM upcoming_classes
       WHERE section = ? AND date >= ?
       ORDER BY date ASC, time_slot ASC`,
            [student.section, today]
        );
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
        if (!descriptor || !Array.isArray(descriptor)) {
            return res.status(400).json({ error: 'Invalid descriptor' });
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
async function start() {
    await getDb();
    app.listen(PORT, () => {
        console.log(`\n🚀 SmartTrack AI server running at http://localhost:${PORT}\n`);
    });
}

start().catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
});

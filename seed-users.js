const bcrypt = require('bcryptjs');
const { getDb, saveDb } = require('./database');

async function seed() {
    const db = await getDb();

    console.log('🌱 Seeding SmartTrack AI database...');

    // Clear existing data
    db.run('DELETE FROM attendance');
    db.run('DELETE FROM sessions');
    db.run('DELETE FROM upcoming_classes');
    db.run('DELETE FROM students');
    db.run('DELETE FROM users');

    // ─── TEACHER ACCOUNT (REAL) ──────────────────────────────────
    // Use these credentials to log in initially
    const teacherEmail = 'admin@smarttrack.ai';
    const teacherPassword = 'adminpassword123';
    const teacherName = 'Administrator';

    const teacherHash = bcrypt.hashSync(teacherPassword, 10);
    db.run(
        `INSERT INTO users (email, password_hash, role, name) VALUES (?, ?, 'teacher', ?)`,
        [teacherEmail, teacherHash, teacherName]
    );

    const rows = db.exec("SELECT id FROM users WHERE email=?", [teacherEmail]);
    const teacherUser = rows[0].values[0][0];

    // ─── DEMO STUDENT DATA ────────────────────────────────────────
    // You can keep these or delete them once you add real students via UI
    const studentHash = bcrypt.hashSync('student123', 10);
    const studentData = [
        { name: 'Demo Student', roll: '2026001', section: 'A', email: 'student@example.com' }
    ];

    const studentIds = [];
    for (const s of studentData) {
        db.run(
            `INSERT INTO users (email, password_hash, role, name, roll_number) VALUES (?, ?, 'student', ?, ?)`,
            [s.email, studentHash, s.name, s.roll]
        );
        const userIdRows = db.exec("SELECT id FROM users WHERE email=?", [s.email]);
        const userId = userIdRows[0].values[0][0];

        db.run(
            `INSERT INTO students (name, roll_number, section, email, user_id, usn, semester) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [s.name, s.roll, s.section, s.email, userId, '', '1']
        );
        const studentIdRows = db.exec("SELECT id FROM students WHERE email=?", [s.email]);
        const studentId = studentIdRows[0].values[0][0];
        studentIds.push(studentId);
    }

    saveDb();
    console.log('✅ Seeding complete!');
    console.log('');
    console.log('──────────────────────────────────────────────────');
    console.log('  INITIAL TEACHER LOGIN DETAILS:');
    console.log(`  Email:    ${teacherEmail}`);
    console.log(`  Password: ${teacherPassword}`);
    console.log('──────────────────────────────────────────────────');
    console.log('  After logging in, you can add real students');
    console.log('  from the Teacher Dashboard.');
    console.log('──────────────────────────────────────────────────');
}

seed().catch(err => {
    console.error('Seed error:', err);
    process.exit(1);
});

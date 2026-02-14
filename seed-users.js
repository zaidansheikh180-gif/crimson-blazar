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

    // Create teacher user
    const teacherHash = bcrypt.hashSync('teacher123', 10);
    db.run(
        `INSERT INTO users (email, password_hash, role, name) VALUES (?, ?, 'teacher', ?)`,
        ['teacher@college.edu', teacherHash, 'Prof. Sharma']
    );
    const teacherUser = db.exec("SELECT id FROM users WHERE email='teacher@college.edu'")[0].values[0][0];

    // Create student users and student records
    const studentHash = bcrypt.hashSync('student123', 10);
    const studentData = [
        { name: 'Aarav Patel', roll: 'CS21001', section: 'A', email: 'student1@college.edu' },
        { name: 'Priya Reddy', roll: 'CS21002', section: 'A', email: 'student2@college.edu' },
        { name: 'Rohan Gupta', roll: 'CS21003', section: 'A', email: 'student3@college.edu' },
        { name: 'Sneha Iyer', roll: 'CS21004', section: 'A', email: 'student4@college.edu' },
        { name: 'Vikram Singh', roll: 'CS21005', section: 'B', email: 'student5@college.edu' },
        { name: 'Ananya Joshi', roll: 'CS21006', section: 'B', email: 'student6@college.edu' },
        { name: 'Karthik Nair', roll: 'CS21007', section: 'B', email: 'student7@college.edu' },
        { name: 'Divya Menon', roll: 'CS21008', section: 'B', email: 'student8@college.edu' },
    ];

    const studentIds = [];
    for (const s of studentData) {
        db.run(
            `INSERT INTO users (email, password_hash, role, name, roll_number) VALUES (?, ?, 'student', ?, ?)`,
            [s.email, studentHash, s.name, s.roll]
        );
        const userId = db.exec(`SELECT id FROM users WHERE email='${s.email}'`)[0].values[0][0];

        db.run(
            `INSERT INTO students (name, roll_number, section, email, user_id, usn, semester) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [s.name, s.roll, s.section, s.email, userId, '', '5']
        );
        const studentId = db.exec(`SELECT id FROM students WHERE email='${s.email}'`)[0].values[0][0];
        studentIds.push(studentId);
    }

    // Create sessions with dates relative to today
    const today = new Date();
    const fmt = (d) => d.toISOString().split('T')[0];
    const daysAgo = (n) => { const d = new Date(today); d.setDate(d.getDate() - n); return fmt(d); };
    const daysFromNow = (n) => { const d = new Date(today); d.setDate(d.getDate() + n); return fmt(d); };

    const subjects = ['Data Structures', 'AIML Lab', 'Operating Systems', 'Database Systems', 'Computer Networks'];
    const sessionEntries = [
        { subject: subjects[0], section: 'A', date: daysAgo(6), time_slot: '09:00 - 10:00', room: 'LH-201' },
        { subject: subjects[1], section: 'A', date: daysAgo(5), time_slot: '10:00 - 12:00', room: 'Lab-3' },
        { subject: subjects[2], section: 'A', date: daysAgo(4), time_slot: '11:00 - 12:00', room: 'LH-202' },
        { subject: subjects[3], section: 'A', date: daysAgo(3), time_slot: '09:00 - 10:00', room: 'LH-201' },
        { subject: subjects[0], section: 'A', date: daysAgo(2), time_slot: '09:00 - 10:00', room: 'LH-201' },
        { subject: subjects[4], section: 'A', date: daysAgo(1), time_slot: '14:00 - 15:00', room: 'LH-203' },
        { subject: subjects[1], section: 'A', date: fmt(today), time_slot: '10:00 - 12:00', room: 'Lab-3' },
        { subject: subjects[2], section: 'B', date: daysAgo(3), time_slot: '14:00 - 15:00', room: 'LH-204' },
        { subject: subjects[3], section: 'B', date: daysAgo(1), time_slot: '11:00 - 12:00', room: 'LH-202' },
        { subject: subjects[0], section: 'B', date: fmt(today), time_slot: '09:00 - 10:00', room: 'LH-201' },
    ];

    const sessionIds = [];
    for (const s of sessionEntries) {
        db.run(
            `INSERT INTO sessions (teacher_name, subject, section, date, time_slot, room, teacher_user_id) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            ['Prof. Sharma', s.subject, s.section, s.date, s.time_slot, s.room, teacherUser]
        );
        const sid = db.exec(`SELECT last_insert_rowid()`)[0].values[0][0];
        sessionIds.push({ id: sid, section: s.section });
    }

    // Mark attendance for student sessions
    const statuses = ['Present', 'Absent', 'Present', 'Present', 'Late', 'Present', 'Present', 'Absent'];
    for (const session of sessionIds) {
        const sectionStudents = session.section === 'A' ? studentIds.slice(0, 4) : studentIds.slice(4, 8);
        sectionStudents.forEach((sid, i) => {
            // Vary attendance realistically
            const roll = Math.random();
            let status;
            if (roll < 0.7) status = 'Present';
            else if (roll < 0.9) status = 'Absent';
            else status = 'Late';

            db.run(
                `INSERT INTO attendance (session_id, student_id, status) VALUES (?, ?, ?)`,
                [session.id, sid, status]
            );
        });
    }

    // Make student1 have a clear pattern: mostly present this week for trending up
    // Override student1's recent attendance
    const student1Id = studentIds[0];
    const student1Sessions = sessionIds.filter(s => s.section === 'A');
    student1Sessions.forEach((session, i) => {
        db.run(`UPDATE attendance SET status = 'Present' WHERE session_id = ? AND student_id = ?`, [session.id, student1Id]);
    });
    // Make one older session absent for contrast
    if (student1Sessions.length > 2) {
        db.run(`UPDATE attendance SET status = 'Absent' WHERE session_id = ? AND student_id = ?`, [student1Sessions[0].id, student1Id]);
    }

    // Upcoming classes
    const upcomingEntries = [
        { subject: 'Data Structures', section: 'A', time_slot: '09:00 - 10:00', room: 'LH-201', faculty: 'Prof. Sharma', notes: 'Chapter 7 — Trees', date: daysFromNow(1) },
        { subject: 'AIML Lab', section: 'A', time_slot: '10:00 - 12:00', room: 'Lab-3', faculty: 'Dr. Verma', notes: 'Bring lab record', date: daysFromNow(1) },
        { subject: 'Operating Systems', section: 'A', time_slot: '11:00 - 12:00', room: 'LH-202', faculty: 'Prof. Kulkarni', notes: '', date: daysFromNow(2) },
        { subject: 'Database Systems', section: 'A', time_slot: '09:00 - 10:00', room: 'LH-201', faculty: 'Dr. Rao', notes: 'SQL quiz', date: daysFromNow(2) },
        { subject: 'Computer Networks', section: 'A', time_slot: '14:00 - 15:00', room: 'LH-203', faculty: 'Prof. Desai', notes: '', date: daysFromNow(3) },
        { subject: 'Data Structures', section: 'B', time_slot: '09:00 - 10:00', room: 'LH-201', faculty: 'Prof. Sharma', notes: 'Chapter 7 — Trees', date: daysFromNow(1) },
        { subject: 'Database Systems', section: 'B', time_slot: '11:00 - 12:00', room: 'LH-202', faculty: 'Dr. Rao', notes: '', date: daysFromNow(2) },
    ];

    for (const u of upcomingEntries) {
        db.run(
            `INSERT INTO upcoming_classes (subject, section, time_slot, room, faculty, notes, date) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [u.subject, u.section, u.time_slot, u.room, u.faculty, u.notes, u.date]
        );
    }

    saveDb();
    console.log('✅ Seeding complete!');
    console.log('');
    console.log('Demo accounts:');
    console.log('  Teacher: teacher@college.edu / teacher123');
    console.log('  Student: student1@college.edu / student123');
    console.log('');
}

seed().catch(err => {
    console.error('Seed error:', err);
    process.exit(1);
});

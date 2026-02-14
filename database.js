const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'smarttrack.db');

let db = null;

async function getDb() {
  if (db) return db;

  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('teacher','student')),
      name TEXT DEFAULT '',
      roll_number TEXT DEFAULT '',
      default_subject TEXT DEFAULT '',
      default_section TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      roll_number TEXT NOT NULL,
      section TEXT DEFAULT '',
      email TEXT UNIQUE NOT NULL,
      photo_url TEXT DEFAULT '',
      usn TEXT DEFAULT '',
      semester TEXT DEFAULT '',
      face_token TEXT DEFAULT '',
      user_id INTEGER,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      teacher_name TEXT DEFAULT '',
      subject TEXT NOT NULL,
      section TEXT DEFAULT '',
      date TEXT NOT NULL,
      time_slot TEXT DEFAULT '',
      room TEXT DEFAULT '',
      teacher_user_id INTEGER,
      FOREIGN KEY (teacher_user_id) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('Present','Absent','Late')),
      marked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES sessions(id),
      FOREIGN KEY (student_id) REFERENCES students(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS upcoming_classes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subject TEXT NOT NULL,
      section TEXT DEFAULT '',
      time_slot TEXT DEFAULT '',
      room TEXT DEFAULT '',
      faculty TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      date TEXT NOT NULL
    )
  `);

  // Migration for face_descriptor
  try {
    db.run("ALTER TABLE students ADD COLUMN face_descriptor TEXT DEFAULT ''");
  } catch (e) {
    // Column likely exists
  }

  saveDb();
  return db;
}

function saveDb() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  }
}

module.exports = { getDb, saveDb };

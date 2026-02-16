# 🎓 SmartTrack AI

**SmartTrack AI** is an intelligent attendance and student tracking web application with **face recognition** capabilities. Built for educational institutions to streamline attendance management and provide real-time insights.

---

## ✨ Features

- 🔐 **Secure Authentication** - JWT-based auth with role-based access control (Teacher/Student)
- 👤 **Face Recognition** - AI-powered face login using face-api.js
- 📊 **Real-time Dashboards** - Comprehensive analytics for both teachers and students
- 📅 **Session Management** - Track classes, subjects, sections, and time slots
- 📈 **Attendance Analytics** - Subject-wise attendance, trends, and shortage alerts
- 👥 **Student Management** - Register, manage, and track student profiles
- 📸 **Photo Upload** - Profile photo management with validation
- 🔔 **Upcoming Classes** - Schedule management for students

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** >= 18.0.0
- **npm** or **yarn**

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/zaidansheikh180-gif/crimson-blazar.git
cd crimson-blazar
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**
```bash
cp .env.example .env
```

Edit `.env` and configure:
```env
PORT=3000
NODE_ENV=development
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
```

> ⚠️ **CRITICAL**: Generate a strong JWT secret for production:
> ```bash
> openssl rand -base64 32
> ```

4. **Seed initial users (optional)**
```bash
npm run seed
```

This creates default accounts:
- **Teacher**: `teacher@example.com` / `teacher123`
- **Student**: `student@example.com` / `student123`

5. **Start the server**
```bash
# Development
npm run dev

# Production
npm start
```

6. **Access the application**
```
http://localhost:3000
```

---

## 📁 Project Structure

```
crimson-blazar/
├── public/              # Frontend assets
│   ├── index.html       # Landing page
│   ├── login.html       # Login page
│   ├── teacher.html     # Teacher dashboard
│   ├── student.html     # Student dashboard
│   ├── css/             # Stylesheets
│   ├── js/              # Client-side JavaScript
│   ├── models/          # Face recognition models (face-api.js)
│   └── uploads/         # User-uploaded photos
├── database.js          # SQLite database setup
├── server.js            # Express server & API routes
├── seed-users.js        # Database seeding script
├── package.json         # Dependencies and scripts
└── .env.example         # Environment variables template
```

---

## 🔑 Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `3000` | Server port |
| `NODE_ENV` | No | `development` | Environment mode |
| `JWT_SECRET` | **YES (production)** | ⚠️ Default (dev only) | JWT signing secret |
| `CORS_ORIGIN` | No | `*` | CORS allowed origin |
| `RATE_LIMIT_WINDOW_MS` | No | `900000` | Rate limit window (ms) |
| `RATE_LIMIT_MAX_REQUESTS` | No | `100` | Max requests per window |
| `AUTH_RATE_LIMIT_MAX_REQUESTS` | No | `5` | Max auth attempts per window |

---

## 🛠️ API Endpoints

### Authentication
- `POST /api/auth/login` - Email/password or face token login
- `POST /api/auth/login-face` - Face descriptor-based login
- `POST /api/auth/logout` - Logout and clear session
- `GET /api/auth/me` - Get current user info

### Teacher Routes
- `GET /api/teacher/dashboard` - Teacher dashboard stats
- `POST /api/teacher/students` - Register new student
- `GET /api/teacher/students` - List students by section
- `POST /api/teacher/session` - Start attendance session
- `POST /api/teacher/attendance` - Mark attendance
- `GET /api/teacher/reports` - Attendance reports
- `POST /api/teacher/upload-photo` - Upload student photo

### Student Routes
- `GET /api/student/dashboard` - Student dashboard with analytics
- `GET /api/student/attendance` - Attendance history (filtered by period)
- `GET /api/student/upcoming` - Upcoming classes schedule
- `POST /api/student/face-register` - Register face descriptor

### Health Check
- `GET /health` - Server health status
- `GET /api/health` - API health status

---

## 🗄️ Database

**SmartTrack AI** uses **SQLite** (file-based database) by default for simplicity.

### Schema Overview
- **users** - User accounts (teacher/student)
- **students** - Student profiles with face descriptors
- **sessions** - Class sessions
- **attendance** - Attendance records
- **upcoming_classes** - Scheduled classes

### ⚠️ Production Warning

**SQLite is file-based** and not suitable for production environments with:
- Ephemeral file systems (Vercel, Heroku free tier)
- Multiple instances (horizontal scaling)
- High concurrency

**For production, migrate to:**
- PostgreSQL (recommended)
- MySQL
- MongoDB

Or ensure:
- Persistent storage volumes (Docker, VPS)
- Regular database backups

---

## 🔒 Security Features

- ✅ **Helmet.js** - Security headers (CSP, XSS protection)
- ✅ **CORS** - Configurable cross-origin resource sharing
- ✅ **Rate Limiting** - DDoS protection and brute-force prevention
- ✅ **JWT Authentication** - Secure token-based auth
- ✅ **bcrypt** - Password hashing
- ✅ **Input Validation** - File type and size restrictions
- ✅ **HTTP-only Cookies** - XSS-resistant session management

---

## 📦 Deployment

### Deployment Checklist

Before deploying to production:

- [ ] Set `NODE_ENV=production`
- [ ] Generate strong `JWT_SECRET` (don't use default)
- [ ] Configure database (migrate from SQLite if needed)
- [ ] Set up persistent storage for uploads
- [ ] Configure CORS for your domain
- [ ] Enable HTTPS (SSL/TLS)
- [ ] Set up monitoring and logging
- [ ] Configure backups
- [ ] Test health check endpoint

See `DEPLOYMENT.md` for detailed platform-specific guides.

---

## 🤝 Contributing

Contributions are welcome! Please see `CONTRIBUTING.md` for guidelines.

---

## 📄 License

This project is licensed under the **MIT License**.

---

## 🐛 Known Issues & Limitations

1. **SQLite Database**: Not production-ready for cloud deployments with ephemeral file systems
2. **File Uploads**: Stored locally; use cloud storage (S3, Cloudinary) for production
3. **Face Recognition Models**: 6.8MB models committed to git (consider Git LFS or CDN)
4. **No Real-time Updates**: Polling-based; consider WebSockets for live updates
5. **Limited Error Tracking**: Console-based logging; integrate Sentry/LogRocket for production

---

## 📞 Support

For issues, questions, or suggestions:
- Open an [issue](https://github.com/zaidansheikh180-gif/crimson-blazar/issues)

---

## 🙏 Acknowledgments

- **face-api.js** - Face recognition library
- **sql.js** - SQLite compiled to JavaScript
- **Express.js** - Web framework
- **Helmet & CORS** - Security middleware

---

**Made with ❤️ for education**

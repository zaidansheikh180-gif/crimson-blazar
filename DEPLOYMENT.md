# 🚀 Deployment Guide

This document provides detailed instructions for deploying **SmartTrack AI** to various platforms.

---

## ⚠️ Pre-Deployment Checklist

Before deploying to production, ensure:

- [ ] `NODE_ENV=production` is set
- [ ] `JWT_SECRET` is a strong, randomly generated key (not the default)
- [ ] Database strategy is decided (SQLite + persistent storage OR migrate to PostgreSQL/MySQL)
- [ ] File uploads strategy is decided (local + persistent storage OR cloud storage like S3/Cloudinary)
- [ ] CORS origin is configured for your domain
- [ ] SSL/TLS certificate is ready (HTTPS)
- [ ] Health check endpoint is accessible at `/health`
- [ ] Environment variables are documented and secured

---

## 🗄️ Database Migration (Recommended for Production)

### Option 1: PostgreSQL Migration

**Why?** Production-grade, scalable, supports concurrent connections.

**Steps:**

1. **Install PostgreSQL adapter**
```bash
npm install pg
```

2. **Update `database.js`** to use PostgreSQL instead of SQLite

3. **Set `DATABASE_URL` in environment**
```env
DATABASE_URL=postgresql://username:password@host:5432/dbname
```

4. **Run migrations** (create tables, seed data)

### Option 2: Keep SQLite with Persistent Storage

**Requirements:**
- Use platforms that support persistent volumes (VPS, Docker, AWS EC2)
- Set up regular database backups
- Mount `smarttrack.db` to a persistent volume

---

## 📦 Platform-Specific Deployment

### 1. Vercel (Not Recommended for Production)

**⚠️ Warning:** Vercel uses ephemeral file systems. Your database will be **wiped on every deploy**.

**Workaround:** Use external database (PostgreSQL on Vercel Postgres, Supabase, or Neon).

**Deployment:**
```bash
npm install -g vercel
vercel --prod
```

**Environment Variables (Vercel Dashboard):**
```
NODE_ENV=production
JWT_SECRET=<strong-random-secret>
DATABASE_URL=<postgres-connection-string>
```

---

### 2. Heroku (Recommended)

**Heroku supports persistent storage and easy PostgreSQL integration.**

**Steps:**

1. **Create Heroku app**
```bash
heroku create smarttrack-ai
```

2. **Add PostgreSQL addon**
```bash
heroku addons:create heroku-postgresql:mini
```

3. **Set environment variables**
```bash
heroku config:set NODE_ENV=production
heroku config:set JWT_SECRET=$(openssl rand -base64 32)
heroku config:set CORS_ORIGIN=https://yourdomain.com
```

4. **Create `Procfile`** (already in repo or create one):
```
web: npm start
```

5. **Deploy**
```bash
git push heroku main
```

6. **Run seed script** (first time only):
```bash
heroku run npm run seed
```

7. **Check logs**
```bash
heroku logs --tail
```

**Cost:** Free tier available, paid plans for production.

---

### 3. Railway (Easy & Modern)

**Railway is developer-friendly with built-in PostgreSQL.**

**Steps:**

1. **Connect GitHub repo** at [railway.app](https://railway.app)

2. **Add PostgreSQL database**
   - Click "New" → "Database" → "PostgreSQL"
   - Railway auto-generates `DATABASE_URL`

3. **Set environment variables**
```
NODE_ENV=production
JWT_SECRET=<strong-random-secret>
```

4. **Deploy** (automatic on git push)

5. **View logs** in Railway dashboard

**Cost:** Free $5/month credit, paid plans available.

---

### 4. Render (Simple & Reliable)

**Steps:**

1. **Create Web Service** at [render.com](https://render.com)

2. **Connect GitHub repo**

3. **Configure build settings**
   - Build Command: `npm install`
   - Start Command: `npm start`

4. **Add PostgreSQL database**
   - Create new PostgreSQL instance
   - Copy `DATABASE_URL` to web service environment

5. **Set environment variables**
```
NODE_ENV=production
JWT_SECRET=<strong-random-secret>
DATABASE_URL=<postgres-internal-url>
```

6. **Deploy** (automatic on git push)

**Cost:** Free tier available (with sleep after inactivity), paid plans for always-on.

---

### 5. DigitalOcean App Platform

**Steps:**

1. **Create App** at DigitalOcean

2. **Connect GitHub repo**

3. **Add Managed PostgreSQL**
   - Create database cluster
   - Connect to app

4. **Set environment variables**
```
NODE_ENV=production
JWT_SECRET=<strong-random-secret>
DATABASE_URL=${db.DATABASE_URL}
```

5. **Deploy**

**Cost:** Starts at $5/month for app + database.

---

### 6. AWS (EC2 + RDS)

**For full control and scalability.**

**Steps:**

1. **Launch EC2 instance** (Ubuntu 22.04 LTS recommended)

2. **Install Node.js**
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo npm install -g pm2
```

3. **Create RDS PostgreSQL instance**
   - Set up VPC, security groups
   - Note connection string

4. **Clone repo on EC2**
```bash
git clone https://github.com/zaidansheikh180-gif/crimson-blazar.git
cd crimson-blazar
npm install --production
```

5. **Create `.env` file**
```bash
nano .env
```
```env
PORT=3000
NODE_ENV=production
JWT_SECRET=<strong-random-secret>
DATABASE_URL=postgresql://user:pass@rds-endpoint:5432/dbname
```

6. **Start with PM2**
```bash
pm2 start server.js --name smarttrack-ai
pm2 startup
pm2 save
```

7. **Set up Nginx reverse proxy**
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

8. **Enable HTTPS with Let's Encrypt**
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

**Cost:** EC2 + RDS starts at ~$15-20/month.

---

### 7. Docker + Docker Compose

**Dockerfile** (already in repo or create one):
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
```

**docker-compose.yml**:
```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - JWT_SECRET=${JWT_SECRET}
      - DATABASE_URL=postgresql://postgres:password@db:5432/smarttrack
    depends_on:
      - db
    volumes:
      - ./public/uploads:/app/public/uploads

  db:
    image: postgres:15-alpine
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
      - POSTGRES_DB=smarttrack
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

**Deploy:**
```bash
docker-compose up -d
```

**Access:**
```
http://localhost:3000
```

---

## 🔐 Security Best Practices

1. **Never commit `.env` file** (already in `.gitignore`)
2. **Use strong JWT secrets** (32+ characters, random)
3. **Enable HTTPS** in production (use Let's Encrypt or cloud provider SSL)
4. **Set proper CORS origins** (don't use `*` in production)
5. **Enable rate limiting** (already configured)
6. **Use secure session cookies** (already configured with `httpOnly`)
7. **Keep dependencies updated** (`npm audit fix`)
8. **Monitor logs** (use services like Logtail, Datadog, or CloudWatch)

---

## 📊 Monitoring & Logging

### Option 1: PM2 (for VPS deployments)
```bash
pm2 logs smarttrack-ai
pm2 monit
```

### Option 2: External Services
- **Sentry** - Error tracking
- **LogRocket** - Session replay
- **Datadog** - Full-stack monitoring
- **New Relic** - APM

**Integration:** Install client libraries and add initialization to `server.js`.

---

## 🔄 CI/CD Pipeline

### GitHub Actions (`.github/workflows/deploy.yml`)

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm test  # Add tests first!
      - name: Deploy to Heroku
        uses: akhileshns/heroku-deploy@v3.12.12
        with:
          heroku_api_key: ${{secrets.HEROKU_API_KEY}}
          heroku_app_name: "smarttrack-ai"
          heroku_email: "your-email@example.com"
```

---

## 🆘 Troubleshooting

### Problem: Database resets on every deploy
**Solution:** Migrate to external database (PostgreSQL) or use persistent storage.

### Problem: Face recognition models not loading
**Solution:** Ensure `/public/models` directory is included in deployment. Check file paths.

### Problem: File uploads not persisting
**Solution:** Use cloud storage (S3, Cloudinary) or mount persistent volume.

### Problem: CORS errors
**Solution:** Set `CORS_ORIGIN` to your frontend domain in `.env`.

### Problem: JWT errors in production
**Solution:** Ensure `JWT_SECRET` is set and matches across all instances.

---

## 📞 Support

For deployment issues:
1. Check health endpoint: `https://yourdomain.com/health`
2. Review server logs
3. Verify environment variables
4. Open an issue on GitHub

---

**Happy Deploying! 🚀**

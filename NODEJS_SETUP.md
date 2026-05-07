# 🚀 PATHFIT Tracking System - Node.js Version

## ✅ NOW YOU CAN USE npm install AND npm run dev!

I've converted your PHP application to **Node.js + Express**!

---

## 📦 Quick Start (3 Commands!)

```bash
# 1. Install dependencies
npm install

# 2. Setup environment variables
copy .env.example .env
# Then edit .env with your Supabase credentials

# 3. Start development server
npm run dev
```

**That's it!** Open http://localhost:3000

---

## 🛠️ Setup Steps

### Step 1: Install Node.js

**Download:** https://nodejs.org/

- Choose LTS version (recommended)
- Run installer (accept all defaults)
- Restart your terminal/PowerShell

**Verify installation:**
```bash
node --version
npm --version
```

### Step 2: Install Dependencies

Open PowerShell in this folder and run:

```bash
npm install
```

This will install:
- ✅ Express (web framework)
- ✅ EJS (templating engine)
- ✅ Supabase JS client
- ✅ Express session
- ✅ Nodemon (auto-restart on changes)

### Step 3: Configure Environment

1. Copy `.env.example` to `.env`:
   ```bash
   copy .env.example .env
   ```

2. Open `.env` in Notepad and add your Supabase credentials:
   ```
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_KEY=your-service-key
   ```

### Step 4: Setup Supabase Database

1. Go to https://supabase.com
2. Create a new project
3. Run `schema.sql` in SQL Editor
4. Copy credentials to `.env`

### Step 5: Start the Server

**Development mode (auto-restart on file changes):**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

---

## 📁 New Project Structure

```
PATHFIT TRACKING SYSTEM/
├── server.js                 # Main Express server
├── package.json              # npm dependencies
├── .env                      # Environment variables (create this!)
├── .env.example              # Environment template
├── routes/                   # Route handlers
│   ├── auth.js              # Login/register/logout
│   ├── student.js           # Student routes
│   └── instructor.js        # Instructor routes
├── views/                    # EJS templates
│   ├── login.ejs
│   ├── register.ejs
│   ├── student/
│   │   └── dashboard.ejs
│   └── instructor/
│       └── dashboard.ejs
├── public/                   # Static files
│   └── css/
│       └── style.css
└── schema.sql                # Database schema
```

---

## 🎯 Available Commands

| Command | Description |
|---------|-------------|
| `npm install` | Install all dependencies |
| `npm run dev` | Start development server with auto-reload |
| `npm start` | Start production server |

---

## 🌐 Available Routes

After starting the server:

- **Login:** http://localhost:3000/login
- **Register:** http://localhost:3000/register
- **Student Dashboard:** http://localhost:3000/student/dashboard
- **Instructor Dashboard:** http://localhost:3000/instructor/dashboard
- **Fitness Tests:** http://localhost:3000/student/fitness-tests
- **Attendance:** http://localhost:3000/instructor/attendance
- **Lesson Plans:** http://localhost:3000/student/lesson-plans
- **Portfolio:** http://localhost:3000/student/portfolio

---

## 🔧 Technology Stack

- **Backend:** Node.js + Express.js
- **Template Engine:** EJS
- **Database:** Supabase (PostgreSQL)
- **Session Management:** express-session
- **Authentication:** Supabase Auth
- **Dev Tool:** Nodemon (auto-restart)

---

## 🐛 Troubleshooting

### "npm is not recognized"
→ Install Node.js from https://nodejs.org/

### "Cannot find module 'express'"
→ Run `npm install`

### "SUPABASE_URL is not defined"
→ Create `.env` file from `.env.example` and add your credentials

### Port 3000 already in use
→ Change PORT in `.env` file or stop other applications using port 3000

### "Session secret not set"
→ Add `SESSION_SECRET=your-random-secret` to `.env`

---

## 🎨 Features

All original PHP features converted to Node.js:

✅ Role-based authentication (student/instructor)
✅ Student dashboard with fitness tracking
✅ Instructor dashboard with class management
✅ Fitness test entry with auto-rating
✅ Attendance tracking with 75% threshold
✅ 16-week lesson plans
✅ Health screening module
✅ Portfolio submission system
✅ Pre/post fitness comparison reports

---

## 🚀 Next Steps

1. ✅ Run `npm install`
2. ✅ Create `.env` file with Supabase credentials
3. ✅ Run `npm run dev`
4. ✅ Open http://localhost:3000
5. ✅ Register first user and change role to "instructor" in Supabase

---

## 📝 Development Notes

- **Auto-reload:** Nodemon watches for file changes and restarts automatically
- **Sessions:** Stored in memory (use Redis for production)
- **Static files:** Place in `public/` folder
- **Templates:** EJS files in `views/` folder
- **Environment:** Use `.env` for configuration (never commit this file!)

---

**Ready to start?** Run `npm install` now! 🎉

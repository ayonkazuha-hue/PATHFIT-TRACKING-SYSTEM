require('dotenv').config();
const express    = require('express');
const session    = require('express-session');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const path       = require('path');
const { createClient } = require('@supabase/supabase-js');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Supabase clients ─────────────────────────────────────────
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// ── Middleware ───────────────────────────────────────────────
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cookieParser());
app.use(session({
  secret: process.env.SESSION_SECRET || 'pathfit-secret-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

// Make user available in all views
app.use((req, res, next) => {
  res.locals.user    = req.session.user || null;
  res.locals.session = req.session;
  next();
});

// ── Auth guards ──────────────────────────────────────────────
const requireLogin = (req, res, next) => {
  if (!req.session.user) return res.redirect('/login');
  next();
};
const requireInstructor = (req, res, next) => {
  if (!req.session.user || req.session.user.role !== 'instructor') {
    return res.redirect('/student/dashboard');
  }
  next();
};

// ── Routes ───────────────────────────────────────────────────
app.get('/', (req, res) => {
  if (req.session.user) {
    return res.redirect(req.session.user.role === 'instructor'
      ? '/instructor/dashboard'
      : '/student/dashboard');
  }
  res.redirect('/login');
});

const authRoutes       = require('./routes/auth')(supabase, supabaseAdmin);
const studentRoutes    = require('./routes/student')(supabaseAdmin);
const instructorRoutes = require('./routes/instructor')(supabaseAdmin);

app.use('/', authRoutes);
app.use('/student',    requireLogin, studentRoutes);
app.use('/instructor', requireLogin, requireInstructor, instructorRoutes);

// ── 404 / Error handlers ─────────────────────────────────────
app.use((req, res) => {
  res.status(404).render('error', { title: '404 Not Found', message: 'Page not found.' });
});
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('error', { title: 'Server Error', message: err.message });
});

// ── Start ────────────────────────────────────────────────────
const server = app.listen(PORT, () => {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║   🏃  PATHFIT TRACKING SYSTEM — Node.js + Express  🏃‍♀️   ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`\n  ✓  http://localhost:${PORT}/login`);
  console.log(`  ✓  http://localhost:${PORT}/register`);
  console.log(`  ✓  http://localhost:${PORT}/student/dashboard`);
  console.log(`  ✓  http://localhost:${PORT}/instructor/dashboard`);
  console.log('\n  Press Ctrl+C to stop\n');
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n  ✗  Port ${PORT} is already in use.`);
    console.error(`  →  Run this to fix it: taskkill /F /IM node.exe\n`);
    process.exit(1);
  }
});

require('dotenv').config();
const express      = require('express');
const session      = require('express-session');
const bodyParser   = require('body-parser');
const cookieParser = require('cookie-parser');
const path         = require('path');
const { createClient } = require('@supabase/supabase-js');
const { escapeHtml } = require('./utils/sanitize');
const { probeUsersSchema } = require('./utils/usersSchema');

const app  = express();
const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === 'production';

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

// ── Session store ────────────────────────────────────────────
// Uses PostgreSQL for persistent sessions on Vercel if DATABASE_URL is set,
// falls back to memory store for local dev
let sessionStore;
const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
if (dbUrl) {
  try {
    const pgSession = require('connect-pg-simple')(session);
    const { Pool } = require('pg');
    const pgPool = new Pool({ connectionString: dbUrl, ssl: isProd ? { rejectUnauthorized: false } : false });
    sessionStore = new pgSession({
      pool:                 pgPool,
      tableName:            'user_sessions',
      createTableIfMissing: true,
      pruneSessionInterval: 60 * 15,
    });
    console.log('  ✓  Using PostgreSQL session store');
  } catch (e) {
    console.warn('  ⚠  PostgreSQL session store unavailable, using memory store:', e.message);
    sessionStore = undefined;
  }
} else {
  console.warn('  ⚠  DATABASE_URL not set — using in-memory session store (OK for local dev)');
}

app.use(session({
  store:             sessionStore,           // undefined = MemoryStore (local dev)
  secret:            process.env.SESSION_SECRET || 'pathfit-secret-2024',
  resave:            false,
  saveUninitialized: false,
  cookie: {
    secure:   isProd,
    httpOnly: true,
    sameSite: 'lax',
    maxAge:   24 * 60 * 60 * 1000,
  },
}));

// Make user available in all views
app.use((req, res, next) => {
  res.locals.user     = req.session.user || null;
  res.locals.session  = req.session;
  res.locals.escapeHtml = escapeHtml;
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
const requireStudent = (req, res, next) => {
  if (!req.session.user || req.session.user.role !== 'student') {
    return res.redirect(
      req.session.user?.role === 'instructor' ? '/instructor/dashboard' : '/login'
    );
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
app.use('/student',    requireLogin, requireStudent, studentRoutes);
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
  probeUsersSchema(supabaseAdmin, { refresh: true }).catch(() => {});
  require('./utils/rubrics').init(supabaseAdmin).catch(console.error);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n  ✗  Port ${PORT} is already in use.`);
    console.error(`  →  Run this to fix it: taskkill /F /IM node.exe\n`);
    process.exit(1);
  }
});

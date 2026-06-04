require('dotenv').config();
const express      = require('express');
const session      = require('express-session');
const bodyParser   = require('body-parser');
const cookieParser = require('cookie-parser');
const path         = require('path');
const net          = require('net');
const { createClient } = require('@supabase/supabase-js');
const { escapeHtml } = require('./utils/sanitize');
const { probeUsersSchema } = require('./utils/usersSchema');

const app  = express();
const DEFAULT_PORT = Number.isInteger(parseInt(process.env.PORT, 10))
  ? parseInt(process.env.PORT, 10)
  : 3001;
const PORT_SCAN_LIMIT = DEFAULT_PORT + 100;
const isProd = process.env.NODE_ENV === 'production';

const requiredEnv = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_KEY',
];
const missingEnv = requiredEnv.filter((key) => !process.env[key]);
if (missingEnv.length) {
  console.error(`Missing required environment variables: ${missingEnv.join(', ')}`);
  if (!isProd) {
    process.exit(1);
  }
}

if (isProd && !process.env.SESSION_SECRET) {
  console.error('Production requires SESSION_SECRET to be set.');
  process.exit(1);
}

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
// Uses Supabase REST API (service key) for persistent sessions.
// Works on Vercel without needing a direct DB password.
const SupabaseSessionStore = require('./utils/supabaseSessionStore');

app.use(session({
  store: new SupabaseSessionStore(supabaseAdmin, {
    table:           'user_sessions',
    ttl:             7 * 24 * 60 * 60,  // 7 days
    cleanupInterval: 15 * 60 * 1000,    // prune expired sessions every 15 min
  }),
  secret:            process.env.SESSION_SECRET || 'pathfit-secret-2024',
  resave:            false,
  saveUninitialized: false,
  rolling:           true,              // reset expiry on every request
  cookie: {
    secure:   isProd,
    httpOnly: true,
    sameSite: isProd ? 'none' : 'lax',
    maxAge:   7 * 24 * 60 * 60 * 1000, // 7 days
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

// ── Server startup helpers ─────────────────────────────────

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        resolve(false);
      } else {
        resolve(false);
      }
    });

    server.once('listening', () => {
      server.close(() => resolve(true));
    });

    server.listen(port);
  });
}

async function findAvailablePort(start = DEFAULT_PORT, end = PORT_SCAN_LIMIT) {
  for (let port = start; port <= end; port += 1) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  return 0;
}

async function startServer() {
  const port = await findAvailablePort();
  if (!port) {
    console.error(`\n  ✗  Could not start the app: no available port found between ${DEFAULT_PORT} and ${PORT_SCAN_LIMIT}.`);
    process.exit(1);
  }

  const server = app.listen(port, () => {
    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log('║   🏃  PATHFIT TRACKING SYSTEM — Node.js + Express  🏃‍♀️   ║');
    console.log('╚══════════════════════════════════════════════════════════╝');
    console.log(`\n  ✓  http://localhost:${port}/login`);
    console.log(`  ✓  http://localhost:${port}/register`);
    console.log(`  ✓  http://localhost:${port}/student/dashboard`);
    console.log(`  ✓  http://localhost:${port}/instructor/dashboard`);
    console.log('\n  Press Ctrl+C to stop\n');
    if (port !== DEFAULT_PORT) {
      console.log(`  ⚠  Default port ${DEFAULT_PORT} was busy. Running on port ${port} instead.`);
    }
  });

  server.on('error', (err) => {
    console.error(err);
    process.exit(1);
  });
}

// ── Start (local dev only — Vercel uses module.exports below) ─
if (!isProd) {
  probeUsersSchema(supabaseAdmin, { refresh: true }).catch(() => {});
  require('./utils/rubrics').init(supabaseAdmin).catch(console.error);
  startServer().catch((err) => {
    console.error(err);
    process.exit(1);
  });
} else {
  // Production (Vercel) — run schema probe without blocking
  probeUsersSchema(supabaseAdmin, { refresh: true }).catch(() => {});
  require('./utils/rubrics').init(supabaseAdmin).catch(console.error);
}

// Required for Vercel serverless — exports the app as the handler
module.exports = app;

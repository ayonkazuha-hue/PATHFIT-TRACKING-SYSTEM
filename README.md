# PATHFIT Tracking System — Setup Guide

## Prerequisites

You need a local PHP server environment. Choose ONE of these options:

### Option 1: XAMPP (Recommended for Windows)
1. Download XAMPP from: https://www.apachefriends.org/download.html
2. Install XAMPP (default location: `C:\xampp`)
3. Start Apache from XAMPP Control Panel

### Option 2: PHP Built-in Server (Simpler, but less features)
1. Download PHP from: https://windows.php.net/download/
2. Extract to `C:\php`
3. Add `C:\php` to your Windows PATH environment variable

### Option 3: Laragon (Modern alternative)
1. Download from: https://laragon.org/download/
2. Install and start Apache + PHP

---

## Setup Steps

### Step 1: Configure Supabase

1. Go to https://supabase.com and create a free account
2. Create a new project
3. Go to **SQL Editor** and run the entire `schema.sql` file
4. Go to **Project Settings → API** and copy:
   - Project URL (e.g., `https://abcxyz.supabase.co`)
   - `anon` public key
   - `service_role` secret key

### Step 2: Update config.php

Open `config.php` and replace these three lines:

```php
define('SUPABASE_URL', 'https://YOUR_PROJECT_ID.supabase.co');
define('SUPABASE_ANON_KEY', 'YOUR_ANON_KEY_HERE');
define('SUPABASE_SERVICE_KEY', 'YOUR_SERVICE_ROLE_KEY_HERE');
```

With your actual Supabase credentials.

### Step 3: Run the Application

#### If using XAMPP:
1. Copy all PHP files to `C:\xampp\htdocs\pathfit\`
2. Start Apache from XAMPP Control Panel
3. Open browser: http://localhost/pathfit/login.php

#### If using PHP built-in server:
1. Open Command Prompt in this folder
2. Run: `php -S localhost:8000`
3. Open browser: http://localhost:8000/login.php

#### If using Laragon:
1. Copy folder to `C:\laragon\www\pathfit\`
2. Start Laragon
3. Open browser: http://pathfit.test/login.php

---

## First Login

### Create Instructor Account

Since there's no instructor yet, you need to create one manually:

1. Go to http://localhost:8000/register.php (or your URL)
2. Register as a student first
3. Go to Supabase Dashboard → **Table Editor** → `users` table
4. Find your user record and change `role` from `student` to `instructor`
5. Log out and log back in — you'll now see the instructor dashboard

### Create Student Accounts

Students can self-register at the registration page. They will be prompted to complete health screening on first login.

---

## Troubleshooting

### "Call to undefined function curl_init"
- Enable cURL in php.ini: uncomment `;extension=curl` → `extension=curl`
- Restart Apache/PHP server

### "Session could not be started"
- Check that `session.save_path` in php.ini points to a writable directory
- Or add this to config.php: `ini_set('session.save_path', sys_get_temp_dir());`

### "Connection refused" or "Could not connect to Supabase"
- Verify your Supabase URL and keys in config.php
- Check that your Supabase project is active
- Ensure you ran the schema.sql file

### "Access denied" errors
- Make sure you're using the correct Supabase keys
- Verify RLS policies were created (check schema.sql execution)

---

## File Structure

```
PATHFIT TRACKING SYSTEM/
├── schema.sql                  # Database schema (run in Supabase)
├── config.php                  # Supabase credentials + helpers
├── login.php                   # Login page
├── register.php                # Student registration
├── logout.php                  # Logout handler
├── health_screening.php        # First-login health form
├── student_dashboard.php       # Student home page
├── instructor_dashboard.php    # Instructor home page
├── fitness_test_entry.php      # Record fitness tests
├── fitness_report.php          # Pre/post comparison
├── attendance_tracker.php      # Mark attendance
├── lesson_plans.php            # 16-week curriculum
└── portfolio.php               # Portfolio submission
```

---

## Default Test Credentials

After creating your instructor account, you can create test students via the registration form.

**Instructor** (after manual role change):
- Email: instructor@school.edu.ph
- Password: (whatever you set during registration)

**Students** (register via form):
- Any email/password combination
- Complete health screening on first login

---

## Color Scheme Reference

- Navy Blue Header: `#042C53`
- Blue Buttons: `#185FA5`
- White Cards: `#ffffff`
- Black Text: `#0a0a0a`
- Background: `#f0f4f8`

---

## Support

For issues or questions:
1. Check the Troubleshooting section above
2. Verify Supabase credentials in config.php
3. Check browser console for JavaScript errors (if any)
4. Check PHP error logs in XAMPP/Laragon

---

## License

Educational use only. Built for CHED PATHFit compliance.

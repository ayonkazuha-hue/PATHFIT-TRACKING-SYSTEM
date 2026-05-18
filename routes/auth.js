const express = require('express');

module.exports = function(supabase, supabaseAdmin) {
  const router = express.Router();

  // GET /login
  router.get('/login', (req, res) => {
    if (req.session.user) {
      return res.redirect(req.session.user.role === 'instructor' ? '/instructor/dashboard' : '/student/dashboard');
    }
    res.render('login', { error: null, email: '' });
  });

  // POST /login
  router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.render('login', { error: 'Please enter both email and password.', email });
    }
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error || !data.user) {
        return res.render('login', { error: 'Invalid email or password.', email });
      }

      // Fetch profile
      const { data: profile, error: profileErr } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('user_id', data.user.id)
        .single();

      if (profileErr || !profile) {
        return res.render('login', { error: 'User profile not found. Contact your instructor.', email });
      }

      // Block pending students
      if (profile.role === 'student' && profile.status === 'pending') {
        return res.render('login', {
          error: 'Your account is pending approval. Please wait for your instructor to approve your registration.',
          email,
        });
      }

      req.session.user = {
        user_id:       profile.user_id,
        name:          profile.name,
        email:         profile.email,
        role:          profile.role,
        pathfit_level: profile.pathfit_level,
        student_id:    profile.student_id,
        gender:        profile.gender,
        section:       profile.section,
        jwt:           data.session.access_token,
      };

      // Check health screening for students
      if (profile.role === 'student') {
        const { data: hs } = await supabaseAdmin
          .from('health_appraisal_record')
          .select('record_id')
          .eq('student_id', profile.user_id)
          .maybeSingle();

        if (!hs) return res.redirect('/health-screening');
        return res.redirect('/student/dashboard');
      }

      res.redirect('/instructor/dashboard');
    } catch (err) {
      console.error(err);
      res.render('login', { error: 'Server error. Please try again.', email });
    }
  });

  // GET /register
  router.get('/register', (req, res) => {
    if (req.session.user) return res.redirect('/');
    res.render('register', { error: null, success: null, old: {} });
  });

  // POST /register
  router.post('/register', async (req, res) => {
    const { name, student_id, email, password, confirm_pass,
            section, course, gender, year_level, pathfit_level, age } = req.body;
    const old = req.body;

    if (!name || !email || !password || !student_id) {
      return res.render('register', { error: 'Please fill in all required fields.', success: null, old });
    }
    if (password !== confirm_pass) {
      return res.render('register', { error: 'Passwords do not match.', success: null, old });
    }
    if (password.length < 8) {
      return res.render('register', { error: 'Password must be at least 8 characters.', success: null, old });
    }
    if (!['male','female'].includes(gender)) {
      return res.render('register', { error: 'Please select a valid gender.', success: null, old });
    }
    if (!['1','2'].includes(String(pathfit_level))) {
      return res.render('register', { error: 'Please select PATHFit level 1 or 2.', success: null, old });
    }
    if (!age || isNaN(parseInt(age)) || parseInt(age) < 1 || parseInt(age) > 120) {
      return res.render('register', { error: 'Please enter a valid age.', success: null, old });
    }

    try {
      // Check for duplicate student_id before creating auth user
      const { data: existingStudent } = await supabaseAdmin
        .from('users')
        .select('student_id')
        .eq('student_id', student_id)
        .maybeSingle();

      if (existingStudent) {
        return res.render('register', {
          error: `Student ID "${student_id}" is already registered. If this is your ID, please contact your instructor.`,
          success: null, old,
        });
      }

      // Check for duplicate email
      const { data: existingEmail } = await supabaseAdmin
        .from('users')
        .select('email')
        .eq('email', email)
        .maybeSingle();

      if (existingEmail) {
        return res.render('register', {
          error: 'This email address is already registered. Try logging in instead.',
          success: null, old,
        });
      }

      // Create auth user
      const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
        email, password, email_confirm: true
      });

      if (authErr || !authData.user) {
        return res.render('register', { error: authErr?.message || 'Registration failed. Email may already be in use.', success: null, old });
      }

      const uid = authData.user.id;

      // Insert profile with pending status
      const { error: profileErr } = await supabaseAdmin.from('users').insert({
        user_id:       uid,
        student_id,
        name,
        email,
        section,
        course,
        gender,
        age:           parseInt(age),
        year_level:    parseInt(year_level),
        pathfit_level: parseInt(pathfit_level),
        role:          'student',
        status:        'pending',
      });

      if (profileErr) {
        // Clean up the auth user if profile insert fails
        await supabaseAdmin.auth.admin.deleteUser(uid);
        const msg = profileErr.message.includes('student_id')
          ? `Student ID "${student_id}" is already registered. If this is your ID, contact your instructor.`
          : profileErr.message.includes('email')
          ? 'This email address is already registered.'
          : 'Could not save your profile. Please try again.';
        return res.render('register', { error: msg, success: null, old });
      }

      res.render('register', {
        error: null,
        success: 'Registration submitted! Your account is pending approval by the instructor. You will be able to log in once approved.',
        old: {},
      });
    } catch (err) {
      console.error(err);
      res.render('register', { error: 'Server error. Please try again.', success: null, old });
    }
  });

  // GET /health-screening
  router.get('/health-screening', (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    if (req.session.user.role === 'instructor') return res.redirect('/instructor/dashboard');
    res.render('health_screening', { error: null });
  });

  // POST /health-screening (Health Appraisal Record)
  router.post('/health-screening', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    
    const {
      name, gender, age,
      height_kg, weight_cm, resting_pulse_rate, waistline_inches, ideal_weight, bmi_classification,
      q1_hospitalization, q1_details,
      q2_injury, q2_details,
      q3_diagnosed, q3_conditions,
      q4_lower_back_pain,
      q5_movement_restriction,
      q6_medical_treatment,
      q7_regular_exercise, q7_details,
      q8_smoke, q8_details,
      q9_alcohol, q9_details,
      certify_correctness
    } = req.body;

    // Validation
    if (!name || !gender || !age) {
      return res.render('health_screening', { error: 'Please fill in all required fields (Name, Gender, Age).' });
    }

    if (!certify_correctness) {
      return res.render('health_screening', { error: 'You must certify the correctness of your answers.' });
    }

    try {
      // Parse Q3 conditions (checkboxes)
      const q3ConditionsArray = Array.isArray(q3_conditions) ? q3_conditions : (q3_conditions ? [q3_conditions] : []);
      
      const insertData = {
        student_id: req.session.user.user_id,
        name: name.trim(),
        gender,
        age: parseInt(age),
        
        // Physical check-up (optional fields)
        height_kg: height_kg ? parseFloat(height_kg) : null,
        weight_cm: weight_cm ? parseFloat(weight_cm) : null,
        resting_pulse_rate: resting_pulse_rate ? parseInt(resting_pulse_rate) : null,
        waistline_inches: waistline_inches ? parseFloat(waistline_inches) : null,
        ideal_weight: ideal_weight || null,
        bmi_classification: bmi_classification || null,
        
        // Questionnaire
        q1_hospitalization: q1_hospitalization === 'yes',
        q1_details: q1_hospitalization === 'yes' ? (q1_details || '') : null,
        
        q2_injury: q2_injury === 'yes',
        q2_details: q2_injury === 'yes' ? (q2_details || '') : null,
        
        q3_diagnosed: q3_diagnosed === 'yes',
        q3_1_chest_pain: q3ConditionsArray.includes('3.1 Chest pain'),
        q3_2_breathing: q3ConditionsArray.includes('3.2 Difficulty breathing'),
        q3_3_dizziness: q3ConditionsArray.includes('3.3 Dizziness or fainting spell'),
        q3_4_hypertension: q3ConditionsArray.includes('3.4 Hypertension (High Blood Pressure)'),
        q3_5_anemia: q3ConditionsArray.includes('3.5 Anemia'),
        q3_6_kidney: q3ConditionsArray.includes('3.6 Kidney problem'),
        q3_7_arthritis: q3ConditionsArray.includes('3.7 Arthritis'),
        q3_8_gout: q3ConditionsArray.includes('3.8 Gout'),
        q3_9_dislocation: q3ConditionsArray.includes('3.9 Dislocation'),
        q3_10_fracture: q3ConditionsArray.includes('3.10 Fracture'),
        
        q4_lower_back_pain: q4_lower_back_pain === 'yes',
        q5_movement_restriction: q5_movement_restriction === 'yes',
        q6_medical_treatment: q6_medical_treatment === 'yes',
        
        q7_regular_exercise: q7_regular_exercise === 'yes',
        q7_details: q7_regular_exercise === 'yes' ? (q7_details || '') : null,
        
        q8_smoke: q8_smoke === 'yes',
        q8_details: q8_smoke === 'yes' ? (q8_details || '') : null,
        
        q9_alcohol: q9_alcohol === 'yes',
        q9_details: q9_alcohol === 'yes' ? (q9_details || '') : null,
        
        certify_correctness: true,
        cleared: false,
      };

      const { error } = await supabaseAdmin.from('health_appraisal_record').insert(insertData);

      if (error) {
        console.error('[health-screening] insert error:', error);
        // Check if table doesn't exist
        if (error.message && error.message.includes('does not exist')) {
          return res.render('health_screening', {
            error: 'The Health Appraisal Record table is not set up yet. Please ask your instructor to run the database setup script (add_health_appraisal_record.sql).'
          });
        }
        return res.render('health_screening', { error: 'Could not save your health appraisal. Please try again.' });
      }

      // Get the inserted record ID
      const { data: insertedRecord } = await supabaseAdmin
        .from('health_appraisal_record')
        .select('record_id')
        .eq('student_id', req.session.user.user_id)
        .single();

      // Create notification for instructor
      if (insertedRecord?.record_id) {
        const { error: notifErr } = await supabaseAdmin
          .from('health_appraisal_notifications')
          .insert({
            student_id: req.session.user.user_id,
            record_id: insertedRecord.record_id,
            is_read: false,
          });

        if (notifErr) {
          console.error('[health-appraisal notification]', notifErr.message);
          // Don't block the student if notification fails
        }
      }

      res.redirect('/student/dashboard');
    } catch (err) {
      console.error('[health-screening] catch error:', err);
      res.render('health_screening', { error: 'Server error: ' + (err.message || 'Please try again.') });
    }
  });

  // GET /logout
  router.get('/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/login'));
  });

  // ── Forgot Password ──────────────────────────────────────

  // GET /forgot-password
  router.get('/forgot-password', (req, res) => {
    if (req.session.user) return res.redirect('/');
    res.render('forgot_password', { error: null, success: null, old: {} });
  });

  // POST /forgot-password
  router.post('/forgot-password', async (req, res) => {
    const { email, new_password, confirm_password } = req.body;
    const old = { email };

    if (!email || !new_password || !confirm_password) {
      return res.render('forgot_password', { error: 'Please fill in all fields.', success: null, old });
    }
    if (new_password !== confirm_password) {
      return res.render('forgot_password', { error: 'Passwords do not match.', success: null, old });
    }
    if (new_password.length < 8) {
      return res.render('forgot_password', { error: 'Password must be at least 8 characters.', success: null, old });
    }

    try {
      // Find the student by email
      const { data: profile, error: profileErr } = await supabaseAdmin
        .from('users')
        .select('user_id, name, role, status')
        .eq('email', email)
        .maybeSingle();

      if (profileErr || !profile) {
        // Don't reveal whether email exists — show generic success
        return res.render('forgot_password', {
          error: null,
          success: 'If that email is registered, your reset request has been submitted. Please wait for instructor approval.',
          old: {},
        });
      }

      if (profile.role !== 'student') {
        return res.render('forgot_password', {
          error: 'Password reset requests are only available for student accounts.',
          success: null, old,
        });
      }

      if (profile.status !== 'approved') {
        return res.render('forgot_password', {
          error: 'Your account is not yet active. Contact your instructor.',
          success: null, old,
        });
      }

      // Cancel any existing pending request for this user
      const { error: deleteErr } = await supabaseAdmin
        .from('password_reset_requests')
        .delete()
        .eq('user_id', profile.user_id)
        .eq('status', 'pending');

      if (deleteErr) {
        console.error('[forgot-password] delete error:', deleteErr);
        // If table doesn't exist, give a clear message
        if (deleteErr.message && deleteErr.message.includes('does not exist')) {
          return res.render('forgot_password', {
            error: 'The password reset feature is not set up yet. Please ask your instructor to run the database setup script (add_password_reset_table.sql).',
            success: null, old,
          });
        }
      }

      // Insert new request — store password temporarily
      const { error: insertErr } = await supabaseAdmin
        .from('password_reset_requests')
        .insert({
          user_id:      profile.user_id,
          new_password: new_password,
          status:       'pending',
        });

      if (insertErr) {
        console.error('[forgot-password] insert error:', insertErr);
        if (insertErr.message && insertErr.message.includes('does not exist')) {
          return res.render('forgot_password', {
            error: 'The password reset feature is not set up yet. Please ask your instructor to run the database setup script (add_password_reset_table.sql).',
            success: null, old,
          });
        }
        throw insertErr;
      }

      return res.render('forgot_password', {
        error: null,
        success: 'Your password reset request has been submitted! Your instructor will review it shortly. You will be able to log in with your new password once approved.',
        old: {},
      });
    } catch (err) {
      console.error('[forgot-password] catch block error:', err);
      return res.render('forgot_password', {
        error: 'Server error: ' + (err.message || 'Please try again.'),
        success: null, old,
      });
    }
  });

  return router;
};

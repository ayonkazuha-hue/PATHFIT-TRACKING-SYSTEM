const express = require('express');
const path = require('path');
const {
  probeUsersSchema,
  buildUserProfileInsert,
} = require('../utils/usersSchema');

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

      // Fetch profile by auth user_id
      const { data: profile, error: profileErr } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('user_id', data.user.id)
        .single();

      let resolvedProfile = profile;
      if (profileErr || !profile) {
        console.warn('[login] profile not found by user_id, trying email fallback for', email);
        const { data: emailProfile, error: emailProfileErr } = await supabaseAdmin
          .from('users')
          .select('*')
          .eq('email', email)
          .maybeSingle();

        if (emailProfileErr) {
          console.error('[login] email fallback error:', emailProfileErr.message);
        }

        resolvedProfile = emailProfile || null;
      }

      if (!resolvedProfile) {
        return res.render('login', { error: 'User profile not found. Contact your instructor.', email });
      }

      // Block pending students
      if (resolvedProfile.role === 'student' && resolvedProfile.status === 'pending') {
        return res.render('login', {
          error: 'Your account is pending approval. Please wait for your instructor to approve your registration.',
          email,
        });
      }
      if (resolvedProfile.role === 'student' && resolvedProfile.status === 'archived') {
        return res.render('login', {
          error: 'Your account has been archived. Please contact your instructor.',
          email,
        });
      }

      req.session.user = {
        user_id:       resolvedProfile.user_id,
        name:          resolvedProfile.name,
        email:         resolvedProfile.email,
        role:          resolvedProfile.role,
        pathfit_level: resolvedProfile.pathfit_level,
        student_id:    resolvedProfile.student_id,
        gender:        resolvedProfile.gender,
        section:       resolvedProfile.section,
        age:           resolvedProfile.age ?? null,
        jwt:           data.session.access_token,
      };

      // Instructor schedule permission (email-based)
      // - jrsaniel, adsanchez, mkoremotigue, and cmttutica: view schedules only (no edits)
      if (req.session.user.role === 'instructor') {
        const emailLower = String(req.session.user.email || '').toLowerCase().trim();
        req.session.user.can_edit_schedule = !['jrsaniel@nbsc.edu.ph', 'adsanchez@nbsc.edu.ph', 'mkoremotigue@nbsc.edu.ph', 'cmttutica@nbsc.edu.ph'].includes(emailLower);
      }

      // Check health screening for students
      if (resolvedProfile.role === 'student') {
        const { data: hs } = await supabaseAdmin
          .from('health_appraisal_record')
          .select('record_id')
          .eq('student_id', resolvedProfile.user_id)
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

      await probeUsersSchema(supabaseAdmin, { refresh: true });

      const profileRow = buildUserProfileInsert({
        user_id:       uid,
        student_id,
        name,
        email,
        section,
        course,
        gender,
        age:           parseInt(age, 10),
        year_level:    parseInt(year_level, 10),
        pathfit_level: parseInt(pathfit_level, 10),
        role:          'student',
        status:        'pending',
      });

      const { error: profileErr } = await supabaseAdmin.from('users').insert(profileRow);

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

  // POST /health-screening/get-upload-url
  router.post('/health-screening/get-upload-url', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
    const { filename } = req.body;
    if (!filename) return res.status(400).json({ error: 'Filename is required' });

    try {
      const ext = path.extname(filename);
      const uniqueFilename = `health_appraisal_photo-${req.session.user.user_id}-${Date.now()}${ext}`;
      const storagePath = `health_appraisal_photos/${uniqueFilename}`;

      const { data, error } = await supabaseAdmin
        .storage
        .from('modules')
        .createSignedUploadUrl(storagePath);

      if (error) throw error;

      const { data: urlData } = supabaseAdmin
        .storage
        .from('modules')
        .getPublicUrl(storagePath);

      res.json({ signedUrl: data.signedUrl, path: storagePath, publicUrl: urlData.publicUrl });
    } catch (err) {
      console.error('[health-screening get-upload-url]', err);
      res.status(500).json({ error: err.message || 'Unable to create upload URL' });
    }
  });

  // POST /health-screening (Health Appraisal Record)
  router.post('/health-screening', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    
    const {
      name, gender, age,
      height_kg, weight_cm, resting_pulse_rate, waistline_inches, bmi_value, bmi_classification,
      q1_hospitalization, q1_details,
      q2_injury, q2_details,
      q3_1_chest_pain, q3_2_breathing, q3_3_dizziness, q3_4_hypertension,
      q3_5_anemia, q3_6_kidney, q3_7_arthritis, q3_8_gout,
      q3_9_dislocation, q3_10_fracture,
      q4_lower_back_pain,
      q5_movement_restriction,
      q6_medical_treatment,
      q7_regular_exercise, q7_details,
      q8_smoke, q8_details,
      q9_alcohol, q9_details,
      photo_url,
      certify_correctness
    } = req.body;

    try {
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
        bmi_classification: bmi_classification || null,
        
        // Questionnaire
        q1_hospitalization: q1_hospitalization === 'yes',
        q1_details: q1_hospitalization === 'yes' ? (q1_details || '') : null,
        
        q2_injury: q2_injury === 'yes',
        q2_details: q2_injury === 'yes' ? (q2_details || '') : null,
        
        q3_1_chest_pain: q3_1_chest_pain === 'yes',
        q3_2_breathing: q3_2_breathing === 'yes',
        q3_3_dizziness: q3_3_dizziness === 'yes',
        q3_4_hypertension: q3_4_hypertension === 'yes',
        q3_5_anemia: q3_5_anemia === 'yes',
        q3_6_kidney: q3_6_kidney === 'yes',
        q3_7_arthritis: q3_7_arthritis === 'yes',
        q3_8_gout: q3_8_gout === 'yes',
        q3_9_dislocation: q3_9_dislocation === 'yes',
        q3_10_fracture: q3_10_fracture === 'yes',
        q3_diagnosed: (
          q3_1_chest_pain === 'yes' || q3_2_breathing === 'yes' || q3_3_dizziness === 'yes' ||
          q3_4_hypertension === 'yes' || q3_5_anemia === 'yes' || q3_6_kidney === 'yes' ||
          q3_7_arthritis === 'yes' || q3_8_gout === 'yes' || q3_9_dislocation === 'yes' ||
          q3_10_fracture === 'yes'
        ),
        
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
        cleared_at: null,
        cleared_by: null,
        submitted_at: new Date().toISOString(),
      };

      if (photo_url) insertData.photo_url = photo_url;

      // Compute BMI classification server-side if a numeric BMI value was provided
      let finalBmiClass = null;
      if (typeof bmi_value !== 'undefined' && bmi_value !== null && String(bmi_value).trim() !== '') {
        const v = parseFloat(bmi_value);
        if (!Number.isNaN(v)) {
          if (v < 18.5) finalBmiClass = 'Underweight';
          else if (v >= 18.5 && v <= 24.9) finalBmiClass = 'Normal';
          else if (v >= 25 && v <= 29.9) finalBmiClass = 'Overweight';
          else if (v >= 30 && v <= 34.9) finalBmiClass = 'Obese';
          else if (v >= 35 && v <= 39.9) finalBmiClass = 'Severely Obese';
          else finalBmiClass = 'Morbidly Obese';
        }
      }
      // Fallback to provided classification text if no numeric value
      if (!finalBmiClass && bmi_classification) finalBmiClass = bmi_classification;
      if (finalBmiClass) insertData.bmi_classification = finalBmiClass;

      const { data: existingRecord, error: fetchError } = await supabaseAdmin
        .from('health_appraisal_record')
        .select('record_id')
        .eq('student_id', req.session.user.user_id)
        .maybeSingle();

      let recordId = null;

      if (fetchError) {
        console.error('[health-screening] fetch existing record error:', fetchError);
        return res.render('health_screening', { error: 'Could not save your health appraisal. Please try again.' });
      }

      async function saveHealthRecord(data, isUpdate) {
        if (isUpdate) {
          return await supabaseAdmin
            .from('health_appraisal_record')
            .update(data)
            .eq('student_id', req.session.user.user_id);
        }
        return await supabaseAdmin
          .from('health_appraisal_record')
          .insert(data)
          .select('record_id')
          .single();
      }

      const attemptSave = async (data, isUpdate) => {
        const response = await saveHealthRecord(data, isUpdate);
        if (response.error && data.photo_url && response.error.message && response.error.message.includes('photo_url')) {
          const fallbackData = { ...data };
          delete fallbackData.photo_url;
          return await saveHealthRecord(fallbackData, isUpdate);
        }
        return response;
      };

      if (existingRecord) {
        const updateData = { ...insertData };
        const { error: updateError } = await attemptSave(updateData, true);

        if (updateError) {
          console.error('[health-screening] update error:', updateError);
          return res.render('health_screening', { error: 'Could not save your health appraisal. Please try again.' });
        }

        recordId = existingRecord.record_id;
      } else {
        const { data: insertedRecord, error: insertError } = await attemptSave(insertData, false);

        if (insertError) {
          console.error('[health-screening] insert error:', insertError);
          if (insertError.message && insertError.message.includes('does not exist')) {
            return res.render('health_screening', {
              error: 'The Health Appraisal Record table is not set up yet. Please ask your instructor to run the database setup script (SETUP_HEALTH_APPRAISAL.sql or add_health_appraisal_record.sql).'
            });
          }
          return res.render('health_screening', { error: 'Could not save your health appraisal. Please try again.' });
        }

        recordId = insertedRecord?.record_id;
      }

      if (recordId) {
        const { error: notifErr } = await supabaseAdmin
          .from('health_appraisal_notifications')
          .upsert({
            student_id: req.session.user.user_id,
            record_id: recordId,
            is_read: false,
          }, { onConflict: 'record_id' });

        if (notifErr) {
          console.error('[health-appraisal notification]', notifErr.message);
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

      if (profile.status === 'pending') {
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

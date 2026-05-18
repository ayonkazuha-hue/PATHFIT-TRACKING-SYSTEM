const express = require('express');

function getRating(testType, gender, age, value) {
  const v = parseFloat(value);
  const rubrics = {
    push_ups:      {
     
      male:   [[30,'excellent'],[20,'good'],[10,'fair'],[5,'needs_improvement'],[1,'needs_improvement']],
      female: [[20,'excellent'],[15,'good'],[10,'fair'],[5,'needs_improvement'],[1,'needs_improvement']],
    },
    sit_reach:     { male: [[27,'excellent'],[17,'good'],[6,'fair'],[0,'needs_improvement']],  female: [[30,'excellent'],[21,'good'],[11,'fair'],[0,'needs_improvement']] },
    zipper_test:   { male: [[0,'excellent'],[80,'good'],[90,'fair'],[100,'needs_improvement']], female: [[0,'excellent'],[85,'good'],[95,'fair'],[105,'needs_improvement']] },
    juggling:      { male: [[36,'excellent'],[29,'good'],[22,'fair'],[0,'needs_improvement']], female: [[20,'excellent'],[15,'good'],[10,'fair'],[0,'needs_improvement']] },
    sprint_40m:    { male: [[0,'excellent'],[6.0,'good'],[7.0,'fair'],[8.0,'needs_improvement']], female: [[0,'excellent'],[7.0,'good'],[8.0,'fair'],[9.0,'needs_improvement']] },
  };
  
  if (testType === 'step_test_3min') {
    const studentAge = age || 18;
    if (gender === 'female') {
      if (studentAge >= 18 && studentAge <= 25) {
        if (v <= 81) return 'excellent';
        if (v <= 102) return 'very_good';
        if (v <= 110) return 'good';
        if (v <= 120) return 'fair';
        if (v <= 169) return 'needs_improvement';
        return 'poor';
      } else if (studentAge >= 26 && studentAge <= 35) {
        if (v <= 80) return 'excellent';
        if (v <= 101) return 'very_good';
        if (v <= 110) return 'good';
        if (v <= 119) return 'fair';
        if (v <= 171) return 'needs_improvement';
        return 'poor';
      } else { // 36 and above
        if (v <= 84) return 'excellent';
        if (v <= 104) return 'very_good';
        if (v <= 112) return 'good';
        if (v <= 120) return 'fair';
        if (v <= 169) return 'needs_improvement';
        return 'poor';
      }
    } else { // male
      if (studentAge >= 18 && studentAge <= 25) {
        if (v <= 76) return 'excellent';
        if (v <= 93) return 'very_good';
        if (v <= 100) return 'good';
        if (v <= 107) return 'fair';
        if (v <= 157) return 'needs_improvement';
        return 'poor';
      } else if (studentAge >= 26 && studentAge <= 35) {
        if (v <= 67) return 'excellent';
        if (v <= 94) return 'very_good';
        if (v <= 102) return 'good';
        if (v <= 110) return 'fair';
        if (v <= 161) return 'needs_improvement';
        return 'poor';
      } else { // 36 and above
        if (v <= 76) return 'excellent';
        if (v <= 88) return 'very_good';
        if (v <= 105) return 'good';
        if (v <= 133) return 'fair';
        if (v <= 163) return 'needs_improvement';
        return 'poor';
      }
    }
  }
  const table = rubrics[testType]?.[gender];
  if (!table) return 'fair';
  if (['zipper_test','sprint_40m'].includes(testType)) {
    for (const [threshold, rating] of [...table].reverse()) {
      if (v >= threshold) return rating;
    }
    return 'excellent';
  }
  for (const [threshold, rating] of table) {
    if (v >= threshold) return rating;
  }
  return 'needs_improvement';
}

module.exports = function(supabaseAdmin) {
  const router = express.Router();

  
  async function getPendingRegistrations() {
    const { data } = await supabaseAdmin
      .from('users').select('*').eq('role', 'student').eq('status', 'pending').order('created_at', { ascending: false });
    return data || [];
  }

  
  async function getFitnessTestNotifications() {
    const { data } = await supabaseAdmin
      .from('fitness_test_notifications')
      .select('*, users(name, student_id, section, course)')
      .eq('is_read', false)
      .order('created_at', { ascending: false });
    return data || [];
  }

  // Helper: fetch unread health appraisal notifications for the nav bell
  async function getHealthAppraisalNotifications() {
    const { data } = await supabaseAdmin
      .from('health_appraisal_notifications')
      .select('*, users!fk_han_student(name, student_id, section, course)')
      .eq('is_read', false)
      .order('created_at', { ascending: false });
    return data || [];
  }

  
  async function getPendingPasswordResets() {
    const { data } = await supabaseAdmin
      .from('password_reset_requests')
      .select('*, users(name, email, student_id, section, course)')
      .eq('status', 'pending')
      .order('requested_at', { ascending: false });
    return data || [];
  }

  
  router.get('/dashboard', async (req, res) => {
    const { section = '', pathfit_level = '', gender = '', course = '', year_level = '', search = '' } = req.query;
    try {
      let query = supabaseAdmin.from('users').select('*').eq('role', 'student').eq('status', 'approved').order('name');
      if (section)       query = query.eq('section', section);
      if (pathfit_level) query = query.eq('pathfit_level', parseInt(pathfit_level));
      if (gender)        query = query.eq('gender', gender);
      if (course)        query = query.eq('course', course);
      if (year_level)    query = query.eq('year_level', parseInt(year_level));
      if (search)        query = query.ilike('name', `%${search}%`);

      const [studentsRes, pendingRes, pendingRegistrationsRes] = await Promise.all([
        query,
        supabaseAdmin.from('health_appraisal_record').select('record_id', { count: 'exact', head: false }).eq('cleared', false),
        supabaseAdmin.from('users').select('*').eq('role', 'student').eq('status', 'pending').order('created_at', { ascending: false }),
      ]);

      const students = studentsRes.data || [];
      const pendingScreenings = (pendingRes.data || []).length;
      const pendingRegistrations = pendingRegistrationsRes.data || [];
      const pendingPasswordResets = await getPendingPasswordResets();
      const fitnessTestNotifications = await getFitnessTestNotifications();
      const healthAppraisalNotifications = await getHealthAppraisalNotifications();

      res.render('instructor/dashboard', {
        students, pendingScreenings, pendingRegistrations, pendingPasswordResets, fitnessTestNotifications, healthAppraisalNotifications,
        filters: { section, pathfit_level, gender, course, year_level, search },
        stats: {
          total:   students.length,
          male:    students.filter(s => s.gender === 'male').length,
          female:  students.filter(s => s.gender === 'female').length,
          pf1:     students.filter(s => s.pathfit_level == 1).length,
          pf2:     students.filter(s => s.pathfit_level == 2).length,
        },
        approveSuccess: req.query.approveSuccess || null,
        approveError:   req.query.approveError   || null,
      });
    } catch (err) {
      res.render('error', { title: 'Error', message: err.message });
    }
  });

  
  router.post('/edit-student', async (req, res) => {
    const {
      user_id, name, student_id, email,
      section, course, year_level, gender, pathfit_level, age,
    } = req.body;

    if (!user_id || !name || !email) {
      return res.redirect('/instructor/dashboard?approveError=Missing required fields.');
    }

    try {
      const { error } = await supabaseAdmin
        .from('users')
        .update({
          name:          name.trim(),
          student_id:    student_id ? student_id.trim() : null,
          email:         email.trim(),
          section:       section       || null,
          course:        course        || null,
          year_level:    year_level    ? parseInt(year_level)    : null,
          gender:        gender        || null,
          age:           age           ? parseInt(age)           : null,
          pathfit_level: pathfit_level ? parseInt(pathfit_level) : null,
        })
        .eq('user_id', user_id);

      if (error) throw error;
      return res.redirect('/instructor/dashboard?approveSuccess=Student information updated successfully.');
    } catch (err) {
      return res.redirect('/instructor/dashboard?approveError=' + encodeURIComponent(err.message));
    }
  });

  // POST /instructor/approve-student
  router.post('/approve-student', async (req, res) => {
    const { user_id, action } = req.body;
    if (!user_id || !['approve', 'reject'].includes(action)) {
      return res.redirect('/instructor/dashboard?approveError=Invalid request.');
    }
    try {
      if (action === 'approve') {
        const { error } = await supabaseAdmin
          .from('users')
          .update({ status: 'approved' })
          .eq('user_id', user_id);
        if (error) throw error;
        return res.redirect('/instructor/dashboard?approveSuccess=Student approved successfully.');
      } else {
        // Reject: delete the auth user and profile
        await supabaseAdmin.from('users').delete().eq('user_id', user_id);
        await supabaseAdmin.auth.admin.deleteUser(user_id);
        return res.redirect('/instructor/dashboard?approveSuccess=Registration rejected and removed.');
      }
    } catch (err) {
      return res.redirect('/instructor/dashboard?approveError=' + encodeURIComponent(err.message));
    }
  });

  // GET /instructor/fitness-tests
  router.get('/fitness-tests', async (req, res) => {
    const selectedStudentId = req.query.student_id || '';
    try {
      const [studentsRes, studentRes] = await Promise.all([
        supabaseAdmin.from('users').select('user_id,name,gender,section').eq('role','student').order('name'),
        selectedStudentId
          ? supabaseAdmin.from('users').select('*').eq('user_id', selectedStudentId).single()
          : Promise.resolve({ data: null }),
      ]);

      const students2 = studentsRes.data || [];
      const selectedStudent = studentRes.data || null;
      let tests = [];

      if (selectedStudentId) {
        const testsRes = await supabaseAdmin
          .from('fitness_tests').select('*')
          .eq('student_id', selectedStudentId)
          .order('created_at', { ascending: false });
        tests = testsRes.data || [];
      }

      const pendingRegistrations = await getPendingRegistrations();
      const pendingPasswordResets = await getPendingPasswordResets();
      const fitnessTestNotifications = await getFitnessTestNotifications();
      const healthAppraisalNotifications = await getHealthAppraisalNotifications();
      res.render('instructor/fitness_tests', {
        students: students2, tests, selectedStudentId, selectedStudent,
        pendingRegistrations, pendingPasswordResets, fitnessTestNotifications, healthAppraisalNotifications,
        error: req.query.error || null, success: req.query.success || null,
      });
    } catch (err) {
      res.render('error', { title: 'Error', message: err.message });
    }
  });

  // POST /instructor/fitness-tests
  router.post('/fitness-tests', async (req, res) => {
    const { target_student_id, test_type, test_period, reps_or_cm, student_gender } = req.body;
    if (!target_student_id || !test_type || !test_period || !reps_or_cm) {
      return res.redirect(`/instructor/fitness-tests?student_id=${target_student_id}&error=Please fill in all fields.`);
    }

    const { data: stProfile } = await supabaseAdmin.from('users').select('age').eq('user_id', target_student_id).single();
    const age = stProfile ? stProfile.age : null;
    const rating = getRating(test_type, student_gender, age, parseFloat(reps_or_cm));

    try {
      await supabaseAdmin.from('fitness_tests').insert({
        student_id:  target_student_id,
        test_type,
        test_period,
        reps_or_cm:  parseFloat(reps_or_cm),
        rating,
        recorded_by: req.session.user.user_id,
      });
      res.redirect(`/instructor/fitness-tests?student_id=${target_student_id}&success=Test recorded! Rating: ${rating.replace(/_/g,' ')}`);
    } catch (err) {
      res.redirect(`/instructor/fitness-tests?student_id=${target_student_id}&error=${err.message}`);
    }
  });

  // GET /instructor/lesson-plans
  router.get('/lesson-plans', async (req, res) => {
    const level = parseInt(req.query.level) || 1;
    try {
      const { data: plans } = await supabaseAdmin
        .from('lesson_plans').select('*').eq('pathfit_level', level).order('week_number');
      const pendingRegistrations = await getPendingRegistrations();
      const pendingPasswordResets = await getPendingPasswordResets();
      const fitnessTestNotifications = await getFitnessTestNotifications();
      const healthAppraisalNotifications = await getHealthAppraisalNotifications();
      res.render('instructor/lesson_plans', {
        plans: plans || [], level,
        pendingRegistrations, pendingPasswordResets, fitnessTestNotifications, healthAppraisalNotifications,
        error: req.query.error || null, success: req.query.success || null,
      });
    } catch (err) {
      res.render('error', { title: 'Error', message: err.message });
    }
  });

  // POST /instructor/lesson-plans
  router.post('/lesson-plans', async (req, res) => {
    const { plan_id, topic, activity, objectives, level } = req.body;
    try {
      await supabaseAdmin.from('lesson_plans')
        .update({ topic, activity, objectives })
        .eq('plan_id', plan_id);
      res.redirect(`/instructor/lesson-plans?level=${level}&success=Lesson plan updated.`);
    } catch (err) {
      res.redirect(`/instructor/lesson-plans?level=${level}&error=${err.message}`);
    }
  });

  // GET /instructor/report
  router.get('/report', async (req, res) => {
    const targetId = req.query.student_id || null;
    try {
      const { data: studentsList } = await supabaseAdmin
        .from('users').select('user_id,name,section').eq('role','student').order('name');

      let tests = [];
      let studentInfo = null;

      if (targetId) {
        const [testsRes, studentRes] = await Promise.all([
          supabaseAdmin.from('fitness_tests').select('*').eq('student_id', targetId).order('created_at'),
          supabaseAdmin.from('users').select('*').eq('user_id', targetId).single(),
        ]);
        tests = testsRes.data || [];
        studentInfo = studentRes.data;
      } else {
        const { data } = await supabaseAdmin.from('fitness_tests').select('*').order('created_at');
        tests = data || [];
      }

      const testTypes = ['push_ups','sit_reach','zipper_test','juggling','sprint_40m','step_test_3min'];
      const grouped = {};
      testTypes.forEach(t => { grouped[t] = { pre: null, post: null }; });
      tests.forEach(t => {
        if (grouped[t.test_type]) grouped[t.test_type][t.test_period] = t;
      });

      // Rating distribution for class-wide
      const dist = { excellent: 0, good: 0, fair: 0, needs_improvement: 0 };
      tests.forEach(t => { if (t.rating) dist[t.rating]++; });

      const pendingRegistrations = await getPendingRegistrations();
      const pendingPasswordResets = await getPendingPasswordResets();
      const fitnessTestNotifications = await getFitnessTestNotifications();
      const healthAppraisalNotifications = await getHealthAppraisalNotifications();
      res.render('instructor/report', {
        studentsList: studentsList || [], studentInfo, grouped, testTypes,
        targetId, dist, totalTests: tests.length,
        pendingRegistrations, pendingPasswordResets, fitnessTestNotifications, healthAppraisalNotifications,
      });
    } catch (err) {
      res.render('error', { title: 'Error', message: err.message });
    }
  });

  // GET /instructor/health-appraisal
  router.get('/health-appraisal', async (req, res) => {
    try {
      const { data: screenings, error: fetchErr } = await supabaseAdmin
        .from('health_appraisal_record')
        .select('*, users!fk_har_student(name, student_id, section, course)')
        .order('submitted_at', { ascending: false });

      if (fetchErr) {
        console.error('[health-appraisal GET]', fetchErr.message);
      }

      const pendingRegistrations        = await getPendingRegistrations();
      const pendingPasswordResets       = await getPendingPasswordResets();
      const fitnessTestNotifications    = await getFitnessTestNotifications();
      const healthAppraisalNotifications = await getHealthAppraisalNotifications();

      res.render('instructor/health_appraisal', {
        screenings: screenings || [],
        pendingRegistrations,
        pendingPasswordResets,
        fitnessTestNotifications,
        healthAppraisalNotifications,
        fetchError: fetchErr ? fetchErr.message : null,
      });
    } catch (err) {
      console.error('[health-appraisal GET catch]', err);
      res.render('error', { title: 'Error', message: err.message });
    }
  });

  // POST /instructor/health-appraisal/clear
  router.post('/health-appraisal/clear', async (req, res) => {
    const { record_id, cleared } = req.body;
    try {
      await supabaseAdmin.from('health_appraisal_record')
        .update({ 
          cleared: cleared === 'true',
          cleared_at: cleared === 'true' ? new Date().toISOString() : null,
          cleared_by: cleared === 'true' ? req.session.user.user_id : null
        })
        .eq('record_id', record_id);
      res.redirect('/instructor/health-appraisal');
    } catch (err) {
      res.redirect('/instructor/health-appraisal');
    }
  });

  // ── Password Reset Approval ──────────────────────────────

  // POST /instructor/reset-password
  router.post('/reset-password', async (req, res) => {
    const { request_id, action } = req.body;
    if (!request_id || !['approve', 'decline'].includes(action)) {
      return res.redirect('/instructor/dashboard?approveError=Invalid password reset request.');
    }

    try {
      // Fetch the request
      const { data: request, error: fetchErr } = await supabaseAdmin
        .from('password_reset_requests')
        .select('*, users(email)')
        .eq('request_id', request_id)
        .eq('status', 'pending')
        .single();

      if (fetchErr || !request) {
        return res.redirect('/instructor/dashboard?approveError=Password reset request not found or already processed.');
      }

      if (action === 'approve') {
        // Actually reset the password via Supabase Admin
        const { error: resetErr } = await supabaseAdmin.auth.admin.updateUserById(
          request.user_id,
          { password: request.new_password }
        );

        if (resetErr) throw resetErr;

        // Mark as approved and clear the password
        await supabaseAdmin
          .from('password_reset_requests')
          .update({ status: 'approved', resolved_at: new Date().toISOString(), new_password: '' })
          .eq('request_id', request_id);

        return res.redirect('/instructor/dashboard?approveSuccess=Password reset approved. Student can now log in with the new password.');
      } else {
        // Decline — mark as declined and clear the password
        await supabaseAdmin
          .from('password_reset_requests')
          .update({ status: 'declined', resolved_at: new Date().toISOString(), new_password: '' })
          .eq('request_id', request_id);

        return res.redirect('/instructor/dashboard?approveSuccess=Password reset request declined.');
      }
    } catch (err) {
      console.error(err);
      return res.redirect('/instructor/dashboard?approveError=' + encodeURIComponent(err.message));
    }
  });

  // GET /instructor/view-test-notification/:notif_id
  // Marks the notification as read and redirects to that student's report
  router.get('/view-test-notification/:notif_id', async (req, res) => {
    const { notif_id } = req.params;
    try {
      // Fetch the notification to get the student_id
      const { data: notif } = await supabaseAdmin
        .from('fitness_test_notifications')
        .select('student_id')
        .eq('notif_id', notif_id)
        .single();

      // Mark as read
      await supabaseAdmin
        .from('fitness_test_notifications')
        .update({ is_read: true })
        .eq('notif_id', notif_id);

      // Redirect to the student's report
      if (notif?.student_id) {
        return res.redirect(`/instructor/report?student_id=${notif.student_id}`);
      }
      res.redirect('/instructor/report');
    } catch (err) {
      console.error('[view-test-notification]', err);
      res.redirect('/instructor/report');
    }
  });

  // POST /instructor/dismiss-test-notification
  router.post('/dismiss-test-notification', async (req, res) => {
    const { notif_id } = req.body;
    if (notif_id) {
      await supabaseAdmin
        .from('fitness_test_notifications')
        .update({ is_read: true })
        .eq('notif_id', notif_id);
    }
    // Redirect back to wherever the instructor was
    const ref = req.get('Referer') || '/instructor/dashboard';
    res.redirect(ref);
  });

  // GET /instructor/view-health-appraisal/:notification_id
  // Marks the notification as read and redirects to health appraisal page
  router.get('/view-health-appraisal/:notification_id', async (req, res) => {
    const { notification_id } = req.params;
    try {
      // Mark as read
      await supabaseAdmin
        .from('health_appraisal_notifications')
        .update({ is_read: true })
        .eq('notification_id', notification_id);

      // Redirect to health appraisal page
      res.redirect('/instructor/health-appraisal');
    } catch (err) {
      console.error('[view-health-appraisal]', err);
      res.redirect('/instructor/health-appraisal');
    }
  });

  // POST /instructor/dismiss-health-appraisal-notification
  router.post('/dismiss-health-appraisal-notification', async (req, res) => {
    const { notification_id } = req.body;
    if (notification_id) {
      await supabaseAdmin
        .from('health_appraisal_notifications')
        .update({ is_read: true })
        .eq('notification_id', notification_id);
    }
    // Redirect back to wherever the instructor was
    const ref = req.get('Referer') || '/instructor/dashboard';
    res.redirect(ref);
  });

  return router;
};

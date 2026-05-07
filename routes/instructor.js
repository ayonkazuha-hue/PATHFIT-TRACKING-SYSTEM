const express = require('express');

function getRating(testType, gender, value) {
  const v = parseFloat(value);
  const rubrics = {
    push_ups:    { male: [[36,'excellent'],[29,'good'],[22,'fair'],[0,'needs_improvement']], female: [[20,'excellent'],[15,'good'],[10,'fair'],[0,'needs_improvement']] },
    sit_ups:     { male: [[38,'excellent'],[31,'good'],[24,'fair'],[0,'needs_improvement']], female: [[32,'excellent'],[25,'good'],[18,'fair'],[0,'needs_improvement']] },
    sit_reach:   { male: [[27,'excellent'],[17,'good'],[6,'fair'],[0,'needs_improvement']],  female: [[30,'excellent'],[21,'good'],[11,'fair'],[0,'needs_improvement']] },
    step_test:   { male: [[0,'excellent'],[80,'good'],[90,'fair'],[100,'needs_improvement']], female: [[0,'excellent'],[85,'good'],[95,'fair'],[105,'needs_improvement']] },
    shuttle_run: { male: [[0,'excellent'],[10.0,'good'],[11.0,'fair'],[12.0,'needs_improvement']], female: [[0,'excellent'],[11.5,'good'],[12.5,'fair'],[13.5,'needs_improvement']] },
  };
  const table = rubrics[testType]?.[gender];
  if (!table) return 'fair';
  if (['step_test','shuttle_run'].includes(testType)) {
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

  // GET /instructor/dashboard
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

      const [studentsRes, sectionsRes, pendingRes, pendingRegistrationsRes] = await Promise.all([
        query,
        supabaseAdmin.from('users').select('section').eq('role', 'student').eq('status', 'approved'),
        supabaseAdmin.from('health_screening').select('screen_id').eq('cleared', false),
        supabaseAdmin.from('users').select('*').eq('role', 'student').eq('status', 'pending').order('created_at', { ascending: false }),
      ]);

      const students = studentsRes.data || [];
      const sections = [...new Set((sectionsRes.data || []).map(s => s.section).filter(Boolean))].sort();
      const pendingScreenings = (pendingRes.data || []).length;
      const pendingRegistrations = pendingRegistrationsRes.data || [];

      res.render('instructor/dashboard', {
        students, sections, pendingScreenings, pendingRegistrations,
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
      const { data: students } = await supabaseAdmin
        .from('users').select('user_id,name,gender,section').eq('role','student').order('name');

      let tests = [];
      let selectedStudent = null;
      if (selectedStudentId) {
        const [testsRes, studentRes] = await Promise.all([
          supabaseAdmin.from('fitness_tests').select('*').eq('student_id', selectedStudentId).order('created_at', { ascending: false }),
          supabaseAdmin.from('users').select('*').eq('user_id', selectedStudentId).single(),
        ]);
        tests = testsRes.data || [];
        selectedStudent = studentRes.data;
      }

      res.render('instructor/fitness_tests', {
        students: students || [], tests, selectedStudentId, selectedStudent,
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

    const rating = getRating(test_type, student_gender, parseFloat(reps_or_cm));

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

  // GET /instructor/attendance
  router.get('/attendance', async (req, res) => {
    const { section = '', student_id = '' } = req.query;
    try {
      let sQuery = supabaseAdmin.from('users').select('user_id,name,section,pathfit_level').eq('role','student').order('name');
      if (section) sQuery = sQuery.eq('section', section);
      const { data: students } = await sQuery;

      let attQuery = supabaseAdmin.from('attendance').select('*').order('week_number');
      if (student_id) attQuery = attQuery.eq('student_id', student_id);
      const { data: attendance } = await attQuery;

      const { data: sectionsRaw } = await supabaseAdmin.from('users').select('section').eq('role','student');
      const sections = [...new Set((sectionsRaw || []).map(s => s.section).filter(Boolean))].sort();

      // Group attendance by student
      const attByStudent = {};
      (attendance || []).forEach(r => {
        if (!attByStudent[r.student_id]) attByStudent[r.student_id] = [];
        attByStudent[r.student_id].push(r);
      });

      res.render('instructor/attendance', {
        students: students || [], attByStudent, sections,
        filters: { section, student_id },
        attendance: attendance || [],
        error: req.query.error || null, success: req.query.success || null,
      });
    } catch (err) {
      res.render('error', { title: 'Error', message: err.message });
    }
  });

  // POST /instructor/attendance
  router.post('/attendance', async (req, res) => {
    const { student_id, week_number, date, status } = req.body;
    if (!student_id || !week_number || !date || !['present','absent','excused'].includes(status)) {
      return res.redirect('/instructor/attendance?error=Please fill in all fields correctly.');
    }
    try {
      await supabaseAdmin.from('attendance').upsert({
        student_id, week_number: parseInt(week_number), date, status,
      }, { onConflict: 'student_id,date' });
      res.redirect('/instructor/attendance?success=Attendance saved successfully.');
    } catch (err) {
      res.redirect('/instructor/attendance?error=' + err.message);
    }
  });

  // GET /instructor/lesson-plans
  router.get('/lesson-plans', async (req, res) => {
    const level = parseInt(req.query.level) || 1;
    try {
      const { data: plans } = await supabaseAdmin
        .from('lesson_plans').select('*').eq('pathfit_level', level).order('week_number');
      res.render('instructor/lesson_plans', {
        plans: plans || [], level,
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

      const testTypes = ['push_ups','sit_ups','sit_reach','step_test','shuttle_run'];
      const grouped = {};
      testTypes.forEach(t => { grouped[t] = { pre: null, post: null }; });
      tests.forEach(t => {
        if (grouped[t.test_type]) grouped[t.test_type][t.test_period] = t;
      });

      // Rating distribution for class-wide
      const dist = { excellent: 0, good: 0, fair: 0, needs_improvement: 0 };
      tests.forEach(t => { if (t.rating) dist[t.rating]++; });

      res.render('instructor/report', {
        studentsList: studentsList || [], studentInfo, grouped, testTypes,
        targetId, dist, totalTests: tests.length,
      });
    } catch (err) {
      res.render('error', { title: 'Error', message: err.message });
    }
  });

  // GET /instructor/health-screening
  router.get('/health-screening', async (req, res) => {
    try {
      const { data: screenings } = await supabaseAdmin
        .from('health_screening')
        .select('*, users(name, student_id, section)')
        .order('screened_at', { ascending: false });

      res.render('instructor/health_screening', { screenings: screenings || [] });
    } catch (err) {
      res.render('error', { title: 'Error', message: err.message });
    }
  });

  // POST /instructor/health-screening/clear
  router.post('/health-screening/clear', async (req, res) => {
    const { screen_id, cleared } = req.body;
    try {
      await supabaseAdmin.from('health_screening')
        .update({ cleared: cleared === 'true' })
        .eq('screen_id', screen_id);
      res.redirect('/instructor/health-screening');
    } catch (err) {
      res.redirect('/instructor/health-screening');
    }
  });

  return router;
};

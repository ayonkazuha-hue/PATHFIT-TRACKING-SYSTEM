const express = require('express');

// Auto-rating rubric
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
    for (const [threshold, rating] of table.slice().reverse()) {
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

  // GET /student/dashboard
  router.get('/dashboard', async (req, res) => {
    const uid   = req.session.user.user_id;
    const level = req.session.user.pathfit_level || 1;

    try {
      const [attRes, ftRes, lpRes, hsRes] = await Promise.all([
        supabaseAdmin.from('attendance').select('*').eq('student_id', uid).order('week_number'),
        supabaseAdmin.from('fitness_tests').select('*').eq('student_id', uid).order('created_at', { ascending: false }),
        supabaseAdmin.from('lesson_plans').select('*').eq('pathfit_level', level).order('week_number'),
        supabaseAdmin.from('health_screening').select('*').eq('student_id', uid).maybeSingle(),
      ]);

      const attendance  = attRes.data  || [];
      const tests       = ftRes.data   || [];
      const plans       = lpRes.data   || [];
      const screening   = hsRes.data;
      const portfolios  = [];

      const presentCount  = attendance.filter(r => r.status === 'present').length;
      const excusedCount  = attendance.filter(r => r.status === 'excused').length;
      const attendedCount = presentCount + excusedCount;
      const attendancePct = Math.round((attendedCount / 16) * 100);
      const currentWeek   = Math.min(Math.max(1, plans.length > 0 ? 1 : 1), 16);
      const currentPlan   = plans[currentWeek - 1] || null;

      res.render('student/dashboard', {
        attendance, tests, screening,
        attendancePct, attendedCount,
        preTests:  tests.filter(t => t.test_period === 'pre'),
        postTests: tests.filter(t => t.test_period === 'post'),
        currentPlan, level,
      });
    } catch (err) {
      console.error(err);
      res.render('error', { title: 'Error', message: err.message });
    }
  });

  // GET /student/fitness-tests
  router.get('/fitness-tests', async (req, res) => {
    const uid = req.session.user.user_id;
    try {
      const { data: tests } = await supabaseAdmin
        .from('fitness_tests').select('*').eq('student_id', uid).order('created_at', { ascending: false });
      res.render('student/fitness_tests', { tests: tests || [], error: null, success: null });
    } catch (err) {
      res.render('error', { title: 'Error', message: err.message });
    }
  });

  // GET /student/lesson-plans
  router.get('/lesson-plans', async (req, res) => {
    const level = parseInt(req.query.level) || req.session.user.pathfit_level || 1;
    try {
      const { data: plans } = await supabaseAdmin
        .from('lesson_plans').select('*').eq('pathfit_level', level).order('week_number');
      res.render('student/lesson_plans', { plans: plans || [], level });
    } catch (err) {
      res.render('error', { title: 'Error', message: err.message });
    }
  });

  // GET /student/portfolio
  router.get('/portfolio', async (req, res) => {
    const uid = req.session.user.user_id;
    try {
      const [pfRes, ftRes, attRes, hsRes] = await Promise.all([
        supabaseAdmin.from('fitness_portfolio').select('*').eq('student_id', uid).order('submitted_at', { ascending: false }),
        supabaseAdmin.from('fitness_tests').select('test_type,test_period').eq('student_id', uid),
        supabaseAdmin.from('attendance').select('status').eq('student_id', uid),
        supabaseAdmin.from('health_screening').select('cleared').eq('student_id', uid).maybeSingle(),
      ]);

      const portfolios  = pfRes.data  || [];
      const tests       = ftRes.data  || [];
      const attendance  = attRes.data || [];
      const screening   = hsRes.data;

      const hasPreTests  = tests.some(t => t.test_period === 'pre');
      const hasPostTests = tests.some(t => t.test_period === 'post');
      const attended     = attendance.filter(r => ['present','excused'].includes(r.status)).length;
      const attPct       = Math.round((attended / 16) * 100);

      const checklist = [
        { label: 'Pre-test fitness results recorded',  done: hasPreTests },
        { label: 'Post-test fitness results recorded', done: hasPostTests },
        { label: 'Attendance ≥ 75%',                   done: attPct >= 75 },
        { label: 'Health screening completed',          done: !!screening },
        { label: 'Health screening cleared',            done: !!(screening?.cleared) },
        { label: 'Portfolio reflection submitted',      done: portfolios.length > 0 },
      ];

      const year = new Date().getFullYear();
      const semesters = [
        `1st Semester ${year}-${year+1}`,
        `2nd Semester ${year}-${year+1}`,
        `Summer ${year+1}`,
      ];

      res.render('student/portfolio', { portfolios, checklist, semesters, error: null, success: null });
    } catch (err) {
      res.render('error', { title: 'Error', message: err.message });
    }
  });

  // POST /student/portfolio
  router.post('/portfolio', async (req, res) => {
    const uid = req.session.user.user_id;
    const { semester, reflection_notes } = req.body;

    if (!semester || !reflection_notes) {
      return res.redirect('/student/portfolio?error=Please fill in all fields.');
    }

    try {
      await supabaseAdmin.from('fitness_portfolio').upsert({
        student_id:       uid,
        semester,
        reflection_notes,
        submitted_at:     new Date().toISOString(),
      }, { onConflict: 'student_id,semester' });

      res.redirect('/student/portfolio?success=Portfolio submitted successfully!');
    } catch (err) {
      res.render('error', { title: 'Error', message: err.message });
    }
  });

  // GET /student/report
  router.get('/report', async (req, res) => {
    const uid = req.session.user.user_id;
    try {
      const { data: tests } = await supabaseAdmin
        .from('fitness_tests').select('*').eq('student_id', uid).order('created_at');

      const grouped = {};
      const testTypes = ['push_ups','sit_ups','sit_reach','step_test','shuttle_run'];
      testTypes.forEach(t => { grouped[t] = { pre: null, post: null }; });

      (tests || []).forEach(t => {
        if (grouped[t.test_type]) grouped[t.test_type][t.test_period] = t;
      });

      res.render('student/report', { grouped, testTypes });
    } catch (err) {
      res.render('error', { title: 'Error', message: err.message });
    }
  });

  return router;
};

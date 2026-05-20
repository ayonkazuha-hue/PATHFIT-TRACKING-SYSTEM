const express = require('express');

module.exports = function(supabaseAdmin) {
  const router = express.Router();

  // GET /student/dashboard
  router.get('/dashboard', async (req, res) => {
    const uid   = req.session.user.user_id;
    const level = req.session.user.pathfit_level || 1;

    try {
      const [ftRes, lpRes, hsRes] = await Promise.all([
        supabaseAdmin.from('fitness_tests').select('*').eq('student_id', uid).order('created_at', { ascending: false }),
        supabaseAdmin.from('lesson_plans').select('*').eq('pathfit_level', level).order('week_number'),
        supabaseAdmin.from('health_appraisal_record').select('*').eq('student_id', uid).maybeSingle(),
      ]);

      const tests       = ftRes.data   || [];
      const plans       = lpRes.data   || [];
      const screening   = hsRes.data;

      const currentPlan = plans[0] || null;

      res.render('student/dashboard', {
        tests, screening,
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
    const uid    = req.session.user.user_id;
    const gender = req.session.user.gender || '';
    let age = req.session.user.age;
    if (age === undefined) {
      const { data: userProfile } = await supabaseAdmin.from('users').select('age').eq('user_id', uid).single();
      age = userProfile ? userProfile.age : null;
      req.session.user.age = age;
    }
    try {
      const { data: tests } = await supabaseAdmin
        .from('fitness_tests').select('*').eq('student_id', uid).order('created_at', { ascending: false });
      res.render('student/fitness_tests', {
        tests: tests || [],
        gender,
        age,
        error:   req.query.error   || null,
        success: req.query.success || null,
      });
    } catch (err) {
      res.render('error', { title: 'Error', message: err.message });
    }
  });

  // POST /student/fitness-tests — student self-entry
  router.post('/fitness-tests', async (req, res) => {
    const uid    = req.session.user.user_id;
    const gender = req.session.user.gender || '';
    const { test_type, test_period, reps_or_cm, hr_before } = req.body;

    if (!test_type || !test_period || !reps_or_cm) {
      return res.redirect('/student/fitness-tests?error=Please fill in all fields.');
    }

    // Auto-rating rubric
    function getRating(testType, g, age, value) {
      const v = parseFloat(value);
      const rubrics = {
        push_ups:    {
          male:   [[30,'excellent'],[20,'very_good'],[10,'good'],[5,'fair'],[1,'needs_improvement'],[0,'poor']],
          female: [[20,'excellent'],[15,'very_good'],[10,'good'],[5,'fair'],[1,'needs_improvement'],[0,'poor']],
        },
        sit_reach:   { male: [[61,'excellent'],[46,'very_good'],[31,'good'],[16,'fair'],[5,'needs_improvement'],[0,'poor']], female: [[61,'excellent'],[46,'very_good'],[31,'good'],[16,'fair'],[5,'needs_improvement'],[0,'poor']] },
        zipper_test: { male: [[6,'excellent'],[4,'very_good'],[2,'good'],[0.1,'fair'],[0,'needs_improvement'],[-9999,'poor']], female: [[6,'excellent'],[4,'very_good'],[2,'good'],[0.1,'fair'],[0,'needs_improvement'],[-9999,'poor']] },
        juggling:    { male: [[41,'excellent'],[31,'very_good'],[21,'good'],[11,'fair'],[1,'needs_improvement'],[0,'poor']], female: [[41,'excellent'],[31,'very_good'],[21,'good'],[11,'fair'],[1,'needs_improvement'],[0,'poor']] },
        sprint_40m:  { male: [[0,'excellent'],[4.1,'very_good'],[5.5,'good'],[6.6,'fair'],[7.6,'needs_improvement']], female: [[0,'excellent'],[4.6,'very_good'],[6.0,'good'],[7.1,'fair'],[8.2,'needs_improvement']] },
      };
      
      if (testType === 'step_test_3min') {
        const studentAge = age || 18;
        if (g === 'female') {
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
      const table = rubrics[testType]?.[g];
      if (!table) return 'fair';
      if (['sprint_40m'].includes(testType)) {
        if (v <= 0) return 'poor';
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

    let age = req.session.user.age;
    if (age === undefined) {
      const { data: userProfile } = await supabaseAdmin.from('users').select('age').eq('user_id', uid).single();
      age = userProfile ? userProfile.age : null;
      req.session.user.age = age;
    }
    const rating = getRating(test_type, gender, age, parseFloat(reps_or_cm));

    try {
      const insertData = {
        student_id:  uid,
        test_type,
        test_period,
        reps_or_cm:  parseFloat(reps_or_cm),
        rating,
        recorded_by: uid,
      };
      // Store pre-exercise HR if provided (step test)
      if (hr_before && !isNaN(parseFloat(hr_before))) {
        insertData.hr_before = parseFloat(hr_before);
      }
      // Insert the fitness test and get back the new row's ID
      const { data: insertedTest, error: insertErr } = await supabaseAdmin
        .from('fitness_tests')
        .insert(insertData)
        .select('test_id')
        .single();

      if (insertErr) throw insertErr;

      // Notify instructor — insert notification row
      const { error: notifErr } = await supabaseAdmin
        .from('fitness_test_notifications')
        .insert({
          student_id:  uid,
          test_id:     insertedTest?.test_id || null,
          test_type,
          test_period,
          rating,
          is_read:     false,
        });

      if (notifErr) {
        // Log but don't block the student — table may not exist yet
        console.error('[fitness-test notification]', notifErr.message);
      }

      res.redirect('/student/fitness-tests?success=Test recorded! Your rating: ' + rating.replace(/_/g, ' '));
    } catch (err) {
      res.redirect('/student/fitness-tests?error=' + encodeURIComponent(err.message));
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
      const [pfRes, ftRes, hsRes] = await Promise.all([
        supabaseAdmin.from('fitness_portfolio').select('*').eq('student_id', uid).order('submitted_at', { ascending: false }),
        supabaseAdmin.from('fitness_tests').select('test_type,test_period').eq('student_id', uid),
        supabaseAdmin.from('health_appraisal_record').select('cleared').eq('student_id', uid).maybeSingle(),
      ]);

      const portfolios  = pfRes.data  || [];
      const tests       = ftRes.data  || [];
      const screening   = hsRes.data;

      const hasPreTests  = tests.some(t => t.test_period === 'pre');
      const hasPostTests = tests.some(t => t.test_period === 'post');

      const checklist = [
        { label: 'Pre-test fitness results recorded',  done: hasPreTests },
        { label: 'Post-test fitness results recorded', done: hasPostTests },
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
      const testTypes = ['push_ups','sit_reach','zipper_test','juggling','sprint_40m','step_test_3min'];
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

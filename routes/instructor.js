const express = require('express');
const multer = require('multer');
const path = require('path');
const usersSchema = require('../utils/usersSchema');
const { probeUsersSchema, buildUserProfileUpdate } = usersSchema;

// Use memory storage — Vercel's filesystem is read-only
// Files are uploaded directly to Supabase Storage instead
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB max
});

function getRating(testType, gender, age, value) {
  const v = parseFloat(value);
  const rubrics = {
    push_ups:      {
      male:   [[30,'excellent'],[20,'very_good'],[10,'good'],[5,'fair'],[1,'needs_improvement'],[0,'poor']],
      female: [[20,'excellent'],[15,'very_good'],[10,'good'],[5,'fair'],[1,'needs_improvement'],[0,'poor']],
    },
    sit_reach:     { male: [[61,'excellent'],[46,'very_good'],[31,'good'],[16,'fair'],[5,'needs_improvement'],[0,'poor']], female: [[61,'excellent'],[46,'very_good'],[31,'good'],[16,'fair'],[5,'needs_improvement'],[0,'poor']] },
    zipper_test:   { male: [[6,'excellent'],[4,'very_good'],[2,'good'],[0.1,'fair'],[0,'needs_improvement'],[-9999,'poor']], female: [[6,'excellent'],[4,'very_good'],[2,'good'],[0.1,'fair'],[0,'needs_improvement'],[-9999,'poor']] },
    juggling:      { male: [[41,'excellent'],[31,'very_good'],[21,'good'],[11,'fair'],[1,'needs_improvement'],[0,'poor']], female: [[41,'excellent'],[31,'very_good'],[21,'good'],[11,'fair'],[1,'needs_improvement'],[0,'poor']] },
    sprint_40m:    { male: [[0,'excellent'],[4.1,'very_good'],[5.5,'good'],[6.6,'fair'],[7.6,'needs_improvement']], female: [[0,'excellent'],[4.6,'very_good'],[6.0,'good'],[7.1,'fair'],[8.2,'needs_improvement']] },
    stork_balance: { male: [[161,'excellent'],[121,'very_good'],[81,'good'],[41,'fair'],[21,'needs_improvement'],[0,'poor']], female: [[161,'excellent'],[121,'very_good'],[81,'good'],[41,'fair'],[21,'needs_improvement'],[0,'poor']] },
    stick_drop:    { male: [[0,'excellent'],[5.8,'very_good'],[12.7,'good'],[20.32,'fair'],[27.94,'needs_improvement'],[30.49,'poor']], female: [[0,'excellent'],[5.8,'very_good'],[12.7,'good'],[20.32,'fair'],[27.94,'needs_improvement'],[30.49,'poor']] },
    agility_test:  { male: [[0,'excellent'],[5.01,'very_good'],[10.01,'good'],[15.01,'fair'],[20.01,'needs_improvement'],[25.01,'poor']], female: [[0,'excellent'],[5.01,'very_good'],[10.01,'good'],[15.01,'fair'],[20.01,'needs_improvement'],[25.01,'poor']] },
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
  if (['sprint_40m', 'stick_drop', 'agility_test'].includes(testType)) {
    if (testType === 'sprint_40m' && v <= 0) return 'poor';
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
    const { data, error } = await supabaseAdmin
      .from('users').select('*').eq('role', 'student').order('created_at', { ascending: false });
    if (error) {
      console.error('[getPendingRegistrations]', error.message);
      return [];
    }
    return (data || []).filter(s => s.status === 'pending');
  }

  
  async function getFitnessTestNotifications() {
    try {
      const { data: notifications, error } = await supabaseAdmin
        .from('fitness_test_notifications')
        .select('*')
        .eq('is_read', false)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[getFitnessTestNotifications] Error:', error.message);
        return [];
      }

      const studentIds = [...new Set((notifications || []).map(n => n.student_id).filter(Boolean))];
      if (studentIds.length === 0) return notifications || [];

      const { data: users, error: usersErr } = await supabaseAdmin
        .from('users')
        .select('user_id, name, student_id, section, course')
        .in('user_id', studentIds);

      const userMap = {};
      if (users) users.forEach(u => { userMap[u.user_id] = u; });

      return (notifications || []).map(n => ({
        ...n,
        users: userMap[n.student_id] || null,
      }));
    } catch (err) {
      console.error('[getFitnessTestNotifications] Catch Error:', err);
      return [];
    }
  }

  // Helper: fetch unread health appraisal notifications for the nav bell
  async function getHealthAppraisalNotifications() {
    try {
      const { data: notifications, error } = await supabaseAdmin
        .from('health_appraisal_notifications')
        .select('*')
        .eq('is_read', false)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[getHealthAppraisalNotifications] Error:', error.message);
        return [];
      }

      const studentIds = [...new Set((notifications || []).map(n => n.student_id).filter(Boolean))];
      if (studentIds.length === 0) return notifications || [];

      const { data: users, error: usersErr } = await supabaseAdmin
        .from('users')
        .select('user_id, name, student_id, section, course')
        .in('user_id', studentIds);

      const userMap = {};
      if (users) users.forEach(u => { userMap[u.user_id] = u; });

      return (notifications || []).map(n => ({
        ...n,
        users: userMap[n.student_id] || null,
      }));
    } catch (err) {
      console.error('[getHealthAppraisalNotifications] Catch Error:', err);
      return [];
    }
  }

  
  async function getPendingPasswordResets() {
    const { data: resets, error } = await supabaseAdmin
      .from('password_reset_requests')
      .select('*')
      .eq('status', 'pending')
      .order('requested_at', { ascending: false });
      
    if (error) {
      console.error('[getPendingPasswordResets] Error:', error.message);
      return [];
    }
    if (!resets || resets.length === 0) return [];

    const userIds = resets.map(r => r.user_id);
    const { data: users } = await supabaseAdmin
      .from('users')
      .select('user_id, name, email, student_id, section, course')
      .in('user_id', userIds);

    const userMap = {};
    if (users) {
      users.forEach(u => { userMap[u.user_id] = u; });
    }

    return resets.map(r => ({
      ...r,
      users: userMap[r.user_id] || { name: 'Unknown', email: '', student_id: '', section: '', course: '' }
    }));
  }

  
  // Approved list: explicit approved, or legacy rows with no status column/value
  function isApprovedStudent(s) {
    return !s.status || s.status === 'approved';
  }

  router.get('/dashboard', async (req, res) => {
    const { section = '', pathfit_level = '', gender = '', course = '', year_level = '', search = '' } = req.query;
    try {
      await probeUsersSchema(supabaseAdmin);
      let query = supabaseAdmin.from('users').select('*').eq('role', 'student').order('name');
      if (section)       query = query.eq('section', section);
      if (pathfit_level) query = query.eq('pathfit_level', parseInt(pathfit_level));
      if (gender)        query = query.eq('gender', gender);
      if (course)        query = query.eq('course', course);
      if (year_level)    query = query.eq('year_level', parseInt(year_level));
      if (search)        query = query.ilike('name', `%${search}%`);

      const [studentsRes, pendingRes, allStudentsRes] = await Promise.all([
        query,
        supabaseAdmin.from('health_appraisal_record').select('record_id', { count: 'exact', head: false }).eq('cleared', false),
        supabaseAdmin.from('users').select('*').eq('role', 'student').order('created_at', { ascending: false }),
      ]);

      if (studentsRes.error) {
        console.error('[dashboard] students query error:', studentsRes.error.message);
        throw new Error(studentsRes.error.message);
      }

      const students = (studentsRes.data || []).filter(isApprovedStudent);
      const pendingScreenings = (pendingRes.data || []).length;
      const pendingRegistrations = (allStudentsRes.data || []).filter(s => s.status === 'pending');
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
      await probeUsersSchema(supabaseAdmin, { refresh: true });

      const updates = buildUserProfileUpdate({
        name, student_id, email, section, course,
        year_level, gender, pathfit_level, age,
      });

      const { error } = await supabaseAdmin
        .from('users')
        .update(updates)
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
        await probeUsersSchema(supabaseAdmin, { refresh: true });
        if (usersSchema.usersHasStatusColumn) {
          const { error } = await supabaseAdmin
            .from('users')
            .update({ status: 'approved' })
            .eq('user_id', user_id);
          if (error) throw error;
        }
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

      const students2 = (studentsRes.data || []).filter(isApprovedStudent);
      const selectedStudent = studentRes.data && isApprovedStudent(studentRes.data) ? studentRes.data : null;
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

    await probeUsersSchema(supabaseAdmin, { refresh: true });
    let age = null;
    if (usersSchema.usersHasAgeColumn) {
      const { data: stProfile } = await supabaseAdmin.from('users').select('age').eq('user_id', target_student_id).single();
      age = stProfile ? stProfile.age : null;
    }
    const rating = getRating(test_type, student_gender, age, parseFloat(reps_or_cm));

    try {
      const { error: insertErr } = await supabaseAdmin.from('fitness_tests').insert({
        student_id:  target_student_id,
        test_type,
        test_period,
        reps_or_cm:  parseFloat(reps_or_cm),
        rating,
        recorded_by: req.session.user.user_id,
      });
      if (insertErr) throw insertErr;
      res.redirect(`/instructor/fitness-tests?student_id=${target_student_id}&success=Test recorded! Rating: ${rating.replace(/_/g,' ')}`);
    } catch (err) {
      res.redirect(`/instructor/fitness-tests?student_id=${target_student_id}&error=${encodeURIComponent(err.message)}`);
    }
  });

  // GET /instructor/lesson-plans
  router.get('/lesson-plans', async (req, res) => {
    const level = parseInt(req.query.level) || 1;
    try {
      const { data: plans } = await supabaseAdmin
        .from('lesson_plans').select('*').eq('pathfit_level', level).neq('week_number', 16).order('week_number');
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

  // POST /instructor/lesson-plans/get-upload-url
  router.post('/lesson-plans/get-upload-url', async (req, res) => {
    const { filename } = req.body;
    if (!filename) return res.status(400).json({ error: 'Filename is required' });

    try {
      const ext = path.extname(filename);
      const uniqueFilename = `module_file-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
      const storagePath = `modules/${uniqueFilename}`;

      const { data, error } = await supabaseAdmin
        .storage
        .from('modules')
        .createSignedUploadUrl(storagePath);

      if (error) throw error;

      // Also generate the public URL to return so frontend knows what to save
      const { data: urlData } = supabaseAdmin
        .storage
        .from('modules')
        .getPublicUrl(storagePath);

      res.json({
        signedUrl: data.signedUrl,
        path: storagePath,
        publicUrl: urlData.publicUrl
      });
    } catch (err) {
      console.error('[get-upload-url]', err);
      res.status(500).json({ error: err.message });
    }
  });

  // POST /instructor/lesson-plans
  router.post('/lesson-plans', async (req, res) => {
    const { plan_id, topic, level, activity_url } = req.body;
    try {
      const updateData = { topic };

      if (activity_url) {
        updateData.activity = activity_url;
      }

      await supabaseAdmin.from('lesson_plans')
        .update(updateData)
        .eq('plan_id', plan_id);

      res.redirect(`/instructor/lesson-plans?level=${level}&success=Lesson plan updated.`);
    } catch (err) {
      console.error('[lesson-plans update]', err);
      res.redirect(`/instructor/lesson-plans?level=${level}&error=${encodeURIComponent(err.message)}`);
    }
  });

  // POST /instructor/lesson-plans/remove-file
  router.post('/lesson-plans/remove-file', async (req, res) => {
    const { plan_id, level } = req.body;
    try {
      await supabaseAdmin.from('lesson_plans')
        .update({ activity: null })
        .eq('plan_id', plan_id);
      res.redirect(`/instructor/lesson-plans?level=${level}&success=Module file removed.`);
    } catch (err) {
      res.redirect(`/instructor/lesson-plans?level=${level}&error=${err.message}`);
    }
  });

  // POST /instructor/lesson-plans/toggle-publish
  router.post('/lesson-plans/toggle-publish', async (req, res) => {
    const { plan_id, level, action } = req.body;
    try {
      const { data: plan } = await supabaseAdmin.from('lesson_plans').select('objectives').eq('plan_id', plan_id).single();
      if (!plan) throw new Error('Lesson plan not found');

      let flags = (plan.objectives || '').split(',').map(s => s.trim()).filter(Boolean);
      
      if (action === 'publish') {
        if (!flags.includes('PUBLISHED')) flags.push('PUBLISHED');
      } else {
        flags = flags.filter(f => f !== 'PUBLISHED');
      }

      await supabaseAdmin.from('lesson_plans').update({ objectives: flags.join(',') }).eq('plan_id', plan_id);
      res.redirect(`/instructor/lesson-plans?level=${level}&success=Module visibility updated.`);
    } catch (err) {
      res.redirect(`/instructor/lesson-plans?level=${level}&error=${err.message}`);
    }
  });

  // POST /instructor/lesson-plans/set-current
  router.post('/lesson-plans/set-current', async (req, res) => {
    const { plan_id, level } = req.body;
    try {
      const { data: plans } = await supabaseAdmin.from('lesson_plans').select('plan_id, objectives').eq('pathfit_level', level);
      for (const plan of plans) {
        let flags = (plan.objectives || '').split(',').map(s => s.trim()).filter(Boolean);
        flags = flags.filter(f => f !== 'CURRENT');
        if (plan.plan_id == plan_id) {
          flags.push('CURRENT');
          // Automatically publish if made current
          if (!flags.includes('PUBLISHED')) flags.push('PUBLISHED');
        }
        await supabaseAdmin.from('lesson_plans').update({ objectives: flags.join(',') }).eq('plan_id', plan.plan_id);
      }
      res.redirect(`/instructor/lesson-plans?level=${level}&success=Current module updated.`);
    } catch (err) {
      res.redirect(`/instructor/lesson-plans?level=${level}&error=${err.message}`);
    }
  });

  // GET /instructor/report
  router.get('/report', async (req, res) => {
    const targetId = req.query.student_id || null;
    const section = (req.query.section || '').toUpperCase().trim() || null;
    const searchQuery = req.query.query || '';
    const viewType = req.query.view || 'report';
    const isSectionSearch = !!section && !targetId;
    try {
      const { data: studentsListRaw } = await supabaseAdmin
        .from('users').select('user_id,name,student_id,section,course,status').eq('role','student').order('name');
      const studentsList = (studentsListRaw || []).filter(isApprovedStudent);

      let tests = [];
      let studentInfo = null;
      let sectionStudents = [];
      let sectionTests = [];
      let sectionSummary = [];
      let sectionTestRecords = [];

      if (targetId) {
        const [testsRes, studentRes] = await Promise.all([
          supabaseAdmin.from('fitness_tests').select('*').eq('student_id', targetId).order('created_at'),
          supabaseAdmin.from('users').select('*').eq('user_id', targetId).single(),
        ]);
        tests = testsRes.data || [];
        studentInfo = studentRes.data;
      } else if (section) {
        const { data: studentsInSect } = await supabaseAdmin
          .from('users').select('*').eq('role','student').ilike('section', `%${section}%`).order('name');
        sectionStudents = (studentsInSect || []).filter(isApprovedStudent);
        const studentIds = sectionStudents.map(s => s.user_id);
        if (studentIds.length) {
          const { data: sectionTestsData } = await supabaseAdmin
            .from('fitness_tests').select('*').in('student_id', studentIds).order('student_id').order('created_at');
          sectionTests = sectionTestsData || [];
        }

        const summaryMap = sectionStudents.reduce((acc, s) => {
          acc[s.user_id] = { ...s, test_count: 0, last_test: null };
          return acc;
        }, {});

        sectionTests.forEach(t => {
          const summary = summaryMap[t.student_id];
          if (!summary) return;
          summary.test_count += 1;
          if (!summary.last_test || new Date(t.created_at) > new Date(summary.last_test)) {
            summary.last_test = t.created_at;
          }
        });

        sectionSummary = Object.values(summaryMap);
        const studentMap = sectionStudents.reduce((acc, s) => {
          acc[s.user_id] = s;
          return acc;
        }, {});
        sectionTestRecords = sectionTests.map(t => ({
          ...t,
          student_name: studentMap[t.student_id]?.name || 'Unknown',
          student_id: studentMap[t.student_id]?.student_id || '',
          section: studentMap[t.student_id]?.section || section,
          pathfit_level: studentMap[t.student_id]?.pathfit_level || ''
        }));
      }

      const testTypes = ['push_ups','sit_reach','zipper_test','juggling','sprint_40m','stork_balance','stick_drop','agility_test','step_test_3min'];
      const grouped = {};
      testTypes.forEach(t => { grouped[t] = { pre: null, post: null }; });
      tests.forEach(t => {
        if (grouped[t.test_type]) grouped[t.test_type][t.test_period] = t;
      });

      // Rating distribution for class-wide (all rating tiers)
      const dist = { excellent: 0, very_good: 0, good: 0, fair: 0, needs_improvement: 0, poor: 0 };
      const countSource = targetId ? tests : section ? sectionTests : [];
      countSource.forEach(t => { if (t.rating && dist[t.rating] !== undefined) dist[t.rating]++; });

      const pendingRegistrations = await getPendingRegistrations();
      const pendingPasswordResets = await getPendingPasswordResets();
      const fitnessTestNotifications = await getFitnessTestNotifications();
      const healthAppraisalNotifications = await getHealthAppraisalNotifications();
      res.render('instructor/report', {
        studentsList: studentsList || [], studentInfo, grouped, testTypes,
        targetId, section, sectionStudents, sectionTests, sectionSummary,
        sectionTestRecords: sectionTestRecords || [],
        searchQuery,
        showClassSummary: viewType === 'summary' || isSectionSearch,
        // When the instructor clicks "Class Summary", we allow the report to show the per-test rows.
        showSectionTestDetails: viewType === 'summary',
        dist, totalTests: countSource.length,
        pendingRegistrations, pendingPasswordResets, fitnessTestNotifications, healthAppraisalNotifications,
      });
    } catch (err) {
      res.render('error', { title: 'Error', message: err.message });
    }
  });

  // GET /instructor/report/download
  router.get('/report/download', async (req, res) => {
    const section = (req.query.section || '').toUpperCase().trim();
    if (!section) {
      return res.redirect('/instructor/report');
    }

    try {
      const { data: sectionStudentsRaw } = await supabaseAdmin
        .from('users').select('*').eq('role','student').ilike('section', section).order('name');
      const sectionStudents = (sectionStudentsRaw || []).filter(isApprovedStudent);

      const studentIds = (sectionStudents || []).map(s => s.user_id);
      let sectionTests = [];
      if (studentIds.length) {
        const { data } = await supabaseAdmin
          .from('fitness_tests').select('*').in('student_id', studentIds).order('student_id').order('created_at');
        sectionTests = data || [];
      }

      const testsByStudent = sectionTests.reduce((acc, t) => {
        if (!acc[t.student_id]) acc[t.student_id] = [];
        acc[t.student_id].push(t);
        return acc;
      }, {});

      const formatCsvRow = (cells) => cells.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',');

      const csvRows = ['Name,Student ID,Section,PATHFit Level,Test Type,Test Period,Score,Rating,Recorded At'];
      const studentsWithTests = sectionStudents.filter(s => (testsByStudent[s.user_id] || []).length > 0);

      if (studentsWithTests.length) {
        studentsWithTests.forEach((student, studentIdx) => {
          const tests = testsByStudent[student.user_id] || [];
          tests.forEach((t, testIdx) => {
            const showName = testIdx === 0;
            csvRows.push(formatCsvRow([
              showName ? (student.name || '') : '',
              student.student_id || '',
              student.section || '',
              student.pathfit_level ?? '',
              t.test_type || '',
              t.test_period || '',
              t.reps_or_cm != null ? t.reps_or_cm : '',
              t.rating || '',
              t.created_at || '',
            ]));
          });
          if (studentIdx < studentsWithTests.length - 1) {
            csvRows.push(formatCsvRow(['', '', '', '', '', '', '', '', '']));
          }
        });
      } else {
        csvRows.push(`"No records found for section ${section}"`);
      }

      const csv = `\uFEFF${csvRows.join('\r\n')}`;
      res.setHeader('Content-Disposition', `attachment; filename=section_${section}_summary.csv`);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.send(csv);
    } catch (err) {
      res.render('error', { title: 'Error', message: err.message });
    }
  });

  // GET /instructor/health-appraisal
  router.get('/health-appraisal', async (req, res) => {
    try {
      const { data: screeningsRaw, error: fetchErr } = await supabaseAdmin
        .from('health_appraisal_record')
        .select('*')
        .order('submitted_at', { ascending: false });

      if (fetchErr) {
        console.error('[health-appraisal GET]', fetchErr.message);
      }

      const screenings = screeningsRaw || [];
      const studentIds = [...new Set(screenings.map(s => s.student_id).filter(Boolean))];
      let screeningsWithUsers = screenings;

      if (studentIds.length > 0) {
        const { data: users, error: usersErr } = await supabaseAdmin
          .from('users')
          .select('user_id, name, student_id, section, course')
          .in('user_id', studentIds);

        if (!usersErr && users) {
          const userMap = {};
          users.forEach(u => { userMap[u.user_id] = u; });
          screeningsWithUsers = screenings.map(s => ({
            ...s,
            users: userMap[s.student_id] || null,
          }));
        }
      }

      const pendingRegistrations        = await getPendingRegistrations();

      const recordsWithSignedPhoto = await Promise.all((screeningsWithUsers || []).map(async (record) => {
        if (!record.photo_url || record.photo_url.startsWith('http')) {
          return record;
        }
        try {
          const { data: signedData, error: signedError } = await supabaseAdmin
            .storage
            .from('modules')
            .createSignedUrl(record.photo_url, 60);
          if (!signedError && signedData?.signedUrl) {
            return { ...record, photo_url: signedData.signedUrl };
          }
        } catch (err) {
          console.error('[health-appraisal signed photo]', err);
        }
        return record;
      }));

      const pendingPasswordResets       = await getPendingPasswordResets();
      const fitnessTestNotifications    = await getFitnessTestNotifications();
      const healthAppraisalNotifications = await getHealthAppraisalNotifications();

      res.render('instructor/health_appraisal', {
        screenings: recordsWithSignedPhoto,
        pendingRegistrations,
        pendingPasswordResets,
        fitnessTestNotifications,
        healthAppraisalNotifications,
        fetchError: fetchErr ? fetchErr.message : null,
        error: req.query.error || null,
        success: req.query.success || null,
      });
    } catch (err) {
      console.error('[health-appraisal GET catch]', err);
      res.render('error', { title: 'Error', message: err.message });
    }
  });

  // POST /instructor/health-appraisal/clear
  router.post('/health-appraisal/clear', async (req, res) => {
    const { record_id, cleared } = req.body;
    if (!record_id) {
      return res.redirect('/instructor/health-appraisal?error=Missing record ID.');
    }
    try {
      const { error } = await supabaseAdmin.from('health_appraisal_record')
        .update({ 
          cleared: cleared === 'true',
          cleared_at: cleared === 'true' ? new Date().toISOString() : null,
          cleared_by: cleared === 'true' ? req.session.user.user_id : null
        })
        .eq('record_id', record_id);
      if (error) throw error;
      const msg = cleared === 'true' ? 'Student cleared successfully.' : 'Clearance revoked.';
      res.redirect('/instructor/health-appraisal?success=' + encodeURIComponent(msg));
    } catch (err) {
      console.error('[health-appraisal/clear]', err);
      res.redirect('/instructor/health-appraisal?error=' + encodeURIComponent(err.message));
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
        .select('*')
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

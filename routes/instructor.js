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

const { getRating, get, set } = require('../utils/rubrics');

module.exports = function (supabaseAdmin) {
  const router = express.Router();

  function canEditSchedule(req) {
    return req?.session?.user?.can_edit_schedule !== false;
  }


  async function getPendingRegistrations() {
    const { data, error } = await supabaseAdmin
      .from('users').select('*').eq('role', 'student').order('created_at', { ascending: false });
    if (error) {
      console.error('[getPendingRegistrations]', error.message);
      return [];
    }
    return (data || []).filter(s => s.status === 'pending');
  }


  function wantsJson(req) {
    return req.get('X-Requested-With') === 'fetch'
      || (req.get('Accept') || '').includes('application/json');
  }

  async function getFitnessTestNotifications(opts = {}) {
    const { limit = null, unreadOnly = false } = opts;
    try {
      let query = supabaseAdmin
        .from('fitness_test_notifications')
        .select('*')
        .order('created_at', { ascending: false });
      if (unreadOnly) query = query.eq('is_read', false);
      if (limit) query = query.limit(limit);

      const { data: notifications, error } = await query;

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

  async function getHealthAppraisalNotifications(opts = {}) {
    const { limit = null, unreadOnly = false } = opts;
    try {
      let query = supabaseAdmin
        .from('health_appraisal_notifications')
        .select('*')
        .order('created_at', { ascending: false });
      if (unreadOnly) query = query.eq('is_read', false);
      if (limit) query = query.limit(limit);

      const { data: notifications, error } = await query;

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

  async function loadInstructorNavNotifications() {
    const [
      fitnessTestNotifications,
      healthAppraisalNotifications,
      ftUnread,
      haUnread,
      pendingRegistrations,
      pendingPasswordResets,
    ] = await Promise.all([
      getFitnessTestNotifications({ limit: 5 }),
      getHealthAppraisalNotifications({ limit: 5 }),
      getFitnessTestNotifications({ unreadOnly: true }),
      getHealthAppraisalNotifications({ unreadOnly: true }),
      getPendingRegistrations(),
      getPendingPasswordResets(),
    ]);
    return {
      fitnessTestNotifications,
      healthAppraisalNotifications,
      fitnessTestUnreadCount: ftUnread.length,
      healthAppraisalUnreadCount: haUnread.length,
      pendingRegistrations,
      pendingPasswordResets,
    };
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

  function isArchivedStudent(s) {
    return s.status === 'archived';
  }

  function dashboardRedirect(query = {}, msg = {}) {
    const params = new URLSearchParams();
    ['section', 'pathfit_level', 'gender', 'course', 'year_level', 'search', 'rating_section', 'show_archived'].forEach((key) => {
      if (query[key]) params.set(key, query[key]);
    });
    if (msg.approveSuccess) params.set('approveSuccess', msg.approveSuccess);
    if (msg.approveError) params.set('approveError', msg.approveError);
    const qs = params.toString();
    return `/instructor/dashboard${qs ? `?${qs}` : ''}`;
  }

  const DEFAULT_TEACHING_TIME_SLOTS = [
    { id: '7-9', label: '7:00-9:00', lunch: false },
    { id: '9-11', label: '9:00-11:00', lunch: false },
    { id: '11-12', label: '11:00-12:00', lunch: false },
    { id: '12-1', label: '12:00-1:00', lunch: true },
    { id: '1-3', label: '1:00-3:00', lunch: false },
    { id: '3-5', label: '3:00-5:00', lunch: false },
  ];
  const TEACHING_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri'];

  function getDefaultTimeSlots() {
    return DEFAULT_TEACHING_TIME_SLOTS.map(s => ({ ...s }));
  }

  function normalizeTimeSlots(raw) {
    const defaults = getDefaultTimeSlots();
    if (!Array.isArray(raw) || !raw.length) return defaults;
    const normalized = raw.map((slot, idx) => {
      const label = (slot.label || '').trim().slice(0, 40) || `Time ${idx + 1}`;
      const id = (slot.id || `slot-${idx}`).trim().slice(0, 40) || `slot-${idx}`;
      return {
        id,
        label,
        lunch: !!slot.lunch,
      };
    }).filter(s => s.label);
    return normalized.length ? normalized : defaults;
  }

  function buildEmptyScheduleSlots(timeSlots) {
    const slots = {};
    (timeSlots || getDefaultTimeSlots()).forEach(slot => {
      if (slot.lunch) return;
      slots[slot.id] = {};
      TEACHING_DAYS.forEach(day => { slots[slot.id][day] = ''; });
    });
    return slots;
  }

  function parseScheduleBundle(raw) {
    const defaultTimes = getDefaultTimeSlots();
    if (!raw || typeof raw !== 'object') {
      return { timeSlots: defaultTimes, cells: buildEmptyScheduleSlots(defaultTimes) };
    }
    if (raw.slots && raw.timeSlots) {
      const timeSlots = normalizeTimeSlots(raw.timeSlots);
      return { timeSlots, cells: normalizeScheduleCells(raw.slots, timeSlots) };
    }
    return { timeSlots: defaultTimes, cells: normalizeScheduleCells(raw, defaultTimes) };
  }

  function packScheduleBundle(timeSlots, cells) {
    return { timeSlots: normalizeTimeSlots(timeSlots), slots: normalizeScheduleCells(cells, timeSlots) };
  }

  function normalizeScheduleCells(raw, timeSlots) {
    const slots = buildEmptyScheduleSlots(timeSlots);
    if (raw && typeof raw === 'object') {
      (timeSlots || getDefaultTimeSlots()).forEach(slot => {
        if (slot.lunch) return;
        TEACHING_DAYS.forEach(day => {
          const val = raw[slot.id]?.[day];
          slots[slot.id][day] = typeof val === 'string' ? val.trim() : '';
        });
      });
    }
    return slots;
  }

  function getDefaultTeachingSchedule(displayName) {
    const timeSlots = getDefaultTimeSlots();
    return {
      schedule_id: null,
      display_name: displayName || 'INSTRUCTOR NAME',
      semester_label: 'SY 2026-2027 1st Semester (PATHFIT 1 & 3 FACULTY TEACHING LOAD)',
      schedule_data: buildEmptyScheduleSlots(timeSlots),
      deload_units: '',
      regular_load: '',
      overload: '',
      total_units: '',
      is_locked: false,
    };
  }

  function mapScheduleRow(data, timeSlotsOverride) {
    const parsed = parseScheduleBundle(data.schedule_data);
    const timeSlots = timeSlotsOverride || parsed.timeSlots;
    return {
      schedule_id: data.schedule_id,
      display_name: data.display_name || 'INSTRUCTOR NAME',
      semester_label: data.semester_label || 'SY 2026-2027 1st Semester (PATHFIT 1 & 3 FACULTY TEACHING LOAD)',
      schedule_data: normalizeScheduleCells(parsed.cells, timeSlots),
      deload_units: data.deload_units || '',
      regular_load: data.regular_load || '',
      overload: data.overload || '',
      total_units: data.total_units || '',
      is_locked: !!data.is_locked,
      sort_order: data.sort_order || 0,
      time_slots: timeSlots,
    };
  }

  async function loadAllTeachingSchedules() {
    const defaultSemester = 'SY 2026-2027 1st Semester (PATHFIT 1 & 3 FACULTY TEACHING LOAD)';
    try {
      const { data, error } = await supabaseAdmin
        .from('instructor_schedules')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) {
        console.error('[loadAllTeachingSchedules]', error.message);
        return { schedules: [], semesterLabel: defaultSemester, timeSlots: getDefaultTimeSlots() };
      }
      const rows = data || [];
      const schedules = rows.map(row => mapScheduleRow(row));
      const semesterLabel = schedules[0]?.semester_label || defaultSemester;
      const timeSlots = schedules[0]?.time_slots || getDefaultTimeSlots();
      return { schedules, semesterLabel, timeSlots };
    } catch (err) {
      console.error('[loadAllTeachingSchedules]', err);
      return { schedules: [], semesterLabel: defaultSemester, timeSlots: getDefaultTimeSlots() };
    }
  }

  async function syncGlobalScheduleSettings(semesterLabel) {
    await supabaseAdmin
      .from('instructor_schedules')
      .update({
        semester_label: semesterLabel,
        updated_at: new Date().toISOString(),
      })
      .not('schedule_id', 'is', null);
  }

  async function getScheduleById(scheduleId) {
    const { data, error } = await supabaseAdmin
      .from('instructor_schedules')
      .select('*')
      .eq('schedule_id', scheduleId)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  router.post('/rubrics', express.json(), async (req, res) => {
    try {
      if (!req.body || typeof req.body !== 'object') {
        return res.status(400).json({ error: 'Invalid rubrics data' });
      }
      await set(supabaseAdmin, req.body);
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to update rubrics' });
    }
  });

  router.get('/dashboard', async (req, res) => {
    const { section = '', pathfit_level = '', gender = '', course = '', year_level = '', search = '', rating_section = '', show_archived = '' } = req.query;
    const showArchived = show_archived === '1';
    try {
      await probeUsersSchema(supabaseAdmin);
      let query = supabaseAdmin.from('users').select('*').eq('role', 'student').order('name');
      if (section) query = query.ilike('section', section);
      if (pathfit_level) query = query.eq('pathfit_level', parseInt(pathfit_level));
      if (gender) query = query.eq('gender', gender);
      if (course) query = query.eq('course', course);
      if (year_level) query = query.eq('year_level', parseInt(year_level));
      if (search) query = query.ilike('name', `%${search}%`);

      const [studentsRes, pendingRes, allStudentsRes] = await Promise.all([
        query,
        supabaseAdmin.from('health_appraisal_record').select('record_id', { count: 'exact', head: false }).eq('cleared', false),
        supabaseAdmin.from('users').select('*').eq('role', 'student').order('created_at', { ascending: false }),
      ]);

      if (studentsRes.error) {
        console.error('[dashboard] students query error:', studentsRes.error.message);
        throw new Error(studentsRes.error.message);
      }

      const students = (studentsRes.data || []).filter(showArchived ? isArchivedStudent : isApprovedStudent);
      const pendingScreenings = (pendingRes.data || []).length;
      const allApprovedStudents = (allStudentsRes.data || []).filter(isApprovedStudent);
      const pendingRegistrations = (allStudentsRes.data || []).filter(s => s.status === 'pending');
      const allStudentRows = allStudentsRes.data || [];
      const sectionCounts = {};
      allStudentRows.forEach((s) => {
        const code = (s.section || '').toString().trim().toUpperCase();
        if (!code) return;
        if (!sectionCounts[code]) sectionCounts[code] = { code, active: 0, archived: 0 };
        if (isArchivedStudent(s)) sectionCounts[code].archived += 1;
        else if (isApprovedStudent(s)) sectionCounts[code].active += 1;
      });
      const sectionArchiveStats = Object.values(sectionCounts)
        .filter((s) => s.active > 0 || s.archived > 0)
        .sort((a, b) => a.code.localeCompare(b.code));
      const availableSections = [...new Set(
        allApprovedStudents
          .map(s => (s.section || '').toString().trim().toUpperCase())
          .filter(Boolean)
      )].sort();
      const sectionFilterUpper = (section || '').toString().trim().toUpperCase();
      const requestedRatingSection = (rating_section || '').toString().trim().toUpperCase();
      const selectedRatingSection = availableSections.includes(requestedRatingSection)
        ? requestedRatingSection
        : (availableSections.includes(sectionFilterUpper) ? sectionFilterUpper : (availableSections[0] || ''));
      const ratingDist = { excellent: 0, very_good: 0, good: 0, fair: 0, needs_improvement: 0, poor: 0 };
      let ratingTotal = 0;
      if (selectedRatingSection) {
        const sectionStudentIds = allApprovedStudents
          .filter(s => (s.section || '').toString().trim().toUpperCase() === selectedRatingSection)
          .map(s => s.user_id);
        if (sectionStudentIds.length) {
          const { data: ratingTests } = await supabaseAdmin
            .from('fitness_tests')
            .select('rating')
            .in('student_id', sectionStudentIds);
          (ratingTests || []).forEach(t => {
            if (t.rating && ratingDist[t.rating] !== undefined) {
              ratingDist[t.rating] += 1;
              ratingTotal += 1;
            }
          });
        }
      }
      const navNotifs = await loadInstructorNavNotifications();

      // Fetch instructor-managed sections for the Section Management panel
      const { data: managedSections } = await supabaseAdmin
        .from('sections')
        .select('section_id, code, description')
        .order('code');

      res.render('instructor/dashboard', {
        students, pendingScreenings, showArchived, sectionArchiveStats,
        managedSections: managedSections || [],
        ...navNotifs,
        filters: { section, pathfit_level, gender, course, year_level, search, rating_section: selectedRatingSection },
        ratingDistribution: {
          selectedSection: selectedRatingSection,
          sections: availableSections,
          dist: ratingDist,
          totalTests: ratingTotal,
        },
        stats: {
          total: students.length,
          male: students.filter(s => s.gender === 'male').length,
          female: students.filter(s => s.gender === 'female').length,
          pf1: students.filter(s => s.pathfit_level == 1).length,
          pf2: students.filter(s => s.pathfit_level == 2).length,
        },
        approveSuccess: req.query.approveSuccess || null,
        approveError: req.query.approveError || null,
      });
    } catch (err) {
      res.render('error', { title: 'Error', message: err.message });
    }
  });

  // GET /instructor/schedules
  router.get('/schedules', async (req, res) => {
    try {
      const navNotifs = await loadInstructorNavNotifications();
      const { schedules: teachingSchedules, semesterLabel: teachingSemesterLabel, timeSlots: teachingTimeSlots } = await loadAllTeachingSchedules();
      const allSchedulesLocked = teachingSchedules.length > 0 && teachingSchedules.every(s => s.is_locked);

      res.render('instructor/schedules', {
        ...navNotifs,
        teachingSchedules, teachingSemesterLabel, teachingTimeSlots, teachingDays: TEACHING_DAYS, allSchedulesLocked,
        scheduleSuccess: req.query.scheduleSuccess || null,
        scheduleError: req.query.scheduleError || null,
      });
    } catch (err) {
      res.render('error', { title: 'Error', message: err.message });
    }
  });

  // POST /instructor/schedule/add
  router.post('/schedule/add', async (req, res) => {
    const redirectBase = '/instructor/schedules';
    const userId = req.session.user.user_id;
    try {
      if (!canEditSchedule(req)) {
        return res.redirect(`${redirectBase}?scheduleError=${encodeURIComponent('You do not have permission to edit schedules.')}`);
      }
      const { schedules, timeSlots: existingTimes } = await loadAllTeachingSchedules();
      const displayName = (req.body.display_name || 'NEW INSTRUCTOR').trim().slice(0, 150) || 'NEW INSTRUCTOR';
      const semesterLabel = (req.body.semester_label || schedules[0]?.semester_label || '').trim().slice(0, 250) ||
        'SY 2026-2027 1st Semester (PATHFIT 1 & 3 FACULTY TEACHING LOAD)';
      let timeSlots = existingTimes;
      try {
        if (req.body.time_slots) timeSlots = normalizeTimeSlots(JSON.parse(req.body.time_slots));
      } catch { /* keep existing */ }

      const { error } = await supabaseAdmin.from('instructor_schedules').insert({
        display_name: displayName,
        semester_label: semesterLabel,
        schedule_data: packScheduleBundle(timeSlots, buildEmptyScheduleSlots(timeSlots)),
        sort_order: schedules.length,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      });
      if (!error && schedules.length) {
        await syncGlobalScheduleSettings(semesterLabel);
      }
      if (error) throw error;
      res.redirect(`${redirectBase}?scheduleSuccess=${encodeURIComponent('Instructor schedule added. Fill in the grid and save.')}`);
    } catch (err) {
      console.error('[schedule/add]', err);
      res.redirect(`${redirectBase}?scheduleError=${encodeURIComponent(err.message)}`);
    }
  });

  // POST /instructor/schedule/save
  router.post('/schedule/save', async (req, res) => {
    const redirectBase = '/instructor/schedules';
    const userId = req.session.user.user_id;
    const scheduleId = (req.body.schedule_id || '').trim();

    try {
      if (!canEditSchedule(req)) {
        return res.redirect(`${redirectBase}?scheduleError=${encodeURIComponent('You do not have permission to edit schedules.')}`);
      }
      if (!scheduleId) {
        return res.redirect(`${redirectBase}?scheduleError=${encodeURIComponent('Missing schedule ID.')}`);
      }

      const existing = await getScheduleById(scheduleId);
      if (!existing) {
        return res.redirect(`${redirectBase}?scheduleError=${encodeURIComponent('Schedule not found.')}`);
      }
      if (existing.is_locked) {
        return res.redirect(`${redirectBase}?scheduleError=${encodeURIComponent('This schedule is locked. Unlock it first to make changes.')}`);
      }

      let scheduleCells = {};
      let timeSlots = parseScheduleBundle(existing.schedule_data).timeSlots;
      try {
        scheduleCells = JSON.parse(req.body.schedule_data || '{}');
      } catch {
        return res.redirect(`${redirectBase}?scheduleError=${encodeURIComponent('Invalid schedule data.')}`);
      }
      try {
        if (req.body.time_slots) timeSlots = normalizeTimeSlots(JSON.parse(req.body.time_slots));
      } catch {
        return res.redirect(`${redirectBase}?scheduleError=${encodeURIComponent('Invalid time slot data.')}`);
      }

      const semesterLabel = (req.body.semester_label || '').trim().slice(0, 250) ||
        existing.semester_label;

      const payload = {
        display_name: (req.body.display_name || '').trim().slice(0, 150) || 'INSTRUCTOR NAME',
        semester_label: semesterLabel,
        schedule_data: packScheduleBundle(timeSlots, scheduleCells),
        deload_units: (req.body.deload_units || '').trim().slice(0, 500),
        regular_load: (req.body.regular_load || '').trim().slice(0, 500),
        overload: (req.body.overload || '').trim().slice(0, 500),
        total_units: (req.body.total_units || '').trim().slice(0, 20),
        updated_by: userId,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabaseAdmin
        .from('instructor_schedules')
        .update(payload)
        .eq('schedule_id', scheduleId);

      if (error) throw error;

      await syncGlobalScheduleSettings(semesterLabel);

      res.redirect(`${redirectBase}?scheduleSuccess=${encodeURIComponent('Schedule saved for ' + payload.display_name + '.')}`);
    } catch (err) {
      console.error('[schedule/save]', err);
      res.redirect(`${redirectBase}?scheduleError=${encodeURIComponent(err.message)}`);
    }
  });

  // POST /instructor/schedule/toggle-lock
  router.post('/schedule/toggle-lock', async (req, res) => {
    const redirectBase = '/instructor/schedules';
    const lock = req.body.lock === 'true';
    const scheduleId = (req.body.schedule_id || '').trim();

    try {
      if (!canEditSchedule(req)) {
        return res.redirect(`${redirectBase}?scheduleError=${encodeURIComponent('You do not have permission to edit schedules.')}`);
      }
      if (!scheduleId) {
        return res.redirect(`${redirectBase}?scheduleError=${encodeURIComponent('Missing schedule ID.')}`);
      }

      const existing = await getScheduleById(scheduleId);
      if (!existing) {
        return res.redirect(`${redirectBase}?scheduleError=${encodeURIComponent('Schedule not found.')}`);
      }

      const { error } = await supabaseAdmin
        .from('instructor_schedules')
        .update({ is_locked: lock, updated_at: new Date().toISOString() })
        .eq('schedule_id', scheduleId);

      if (error) throw error;
      const name = existing.display_name || 'instructor';
      const msg = lock
        ? `Schedule locked for ${name}.`
        : `Schedule unlocked for ${name}. You can now edit.`;
      res.redirect(`${redirectBase}?scheduleSuccess=${encodeURIComponent(msg)}`);
    } catch (err) {
      console.error('[schedule/toggle-lock]', err);
      res.redirect(`${redirectBase}?scheduleError=${encodeURIComponent(err.message)}`);
    }
  });

  // POST /instructor/schedule/delete
  router.post('/schedule/delete', async (req, res) => {
    const redirectBase = '/instructor/schedules';
    const scheduleId = (req.body.schedule_id || '').trim();

    try {
      if (!canEditSchedule(req)) {
        return res.redirect(`${redirectBase}?scheduleError=${encodeURIComponent('You do not have permission to edit schedules.')}`);
      }
      if (!scheduleId) {
        return res.redirect(`${redirectBase}?scheduleError=${encodeURIComponent('Missing schedule ID.')}`);
      }

      const existing = await getScheduleById(scheduleId);
      if (!existing) {
        return res.redirect(`${redirectBase}?scheduleError=${encodeURIComponent('Schedule not found.')}`);
      }
      if (existing.is_locked) {
        return res.redirect(`${redirectBase}?scheduleError=${encodeURIComponent('Unlock this schedule before removing it.')}`);
      }

      const { error } = await supabaseAdmin
        .from('instructor_schedules')
        .delete()
        .eq('schedule_id', scheduleId);

      if (error) throw error;
      res.redirect(`${redirectBase}?scheduleSuccess=${encodeURIComponent('Instructor schedule removed.')}`);
    } catch (err) {
      console.error('[schedule/delete]', err);
      res.redirect(`${redirectBase}?scheduleError=${encodeURIComponent(err.message)}`);
    }
  });


  // ── Section Management ──────────────────────────────────────

  // GET /instructor/sections — returns JSON list of sections
  router.get('/sections', async (req, res) => {
    try {
      const { data, error } = await supabaseAdmin
        .from('sections')
        .select('section_id, code, description')
        .order('code');
      if (error) return res.status(500).json({ error: error.message });
      res.json(data || []);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /instructor/sections — add a new section
  router.post('/sections', async (req, res) => {
    const { code, description } = req.body;
    const trimmed = (code || '').trim().toUpperCase();
    if (!trimmed) return res.redirect('/instructor/dashboard?approveError=Section code is required.');
    try {
      const { error } = await supabaseAdmin
        .from('sections')
        .insert({ code: trimmed, description: (description || '').trim() || null });
      if (error) {
        const msg = error.message.includes('unique') || error.message.includes('duplicate')
          ? `Section code "${trimmed}" already exists.`
          : error.message;
        return res.redirect('/instructor/dashboard?approveError=' + encodeURIComponent(msg));
      }
      res.redirect('/instructor/dashboard?approveSuccess=Section "' + trimmed + '" added successfully.');
    } catch (err) {
      res.redirect('/instructor/dashboard?approveError=' + encodeURIComponent(err.message));
    }
  });

  // POST /instructor/sections/update — rename a section
  router.post('/sections/update', async (req, res) => {
    const { section_id, code, description } = req.body;
    const trimmed = (code || '').trim().toUpperCase();
    if (!section_id || !trimmed) return res.redirect('/instructor/dashboard?approveError=Invalid request.');
    try {
      const { error } = await supabaseAdmin
        .from('sections')
        .update({ code: trimmed, description: (description || '').trim() || null })
        .eq('section_id', section_id);
      if (error) throw error;
      res.redirect('/instructor/dashboard?approveSuccess=Section updated successfully.');
    } catch (err) {
      res.redirect('/instructor/dashboard?approveError=' + encodeURIComponent(err.message));
    }
  });

  // POST /instructor/sections/delete — delete a section
  router.post('/sections/delete', async (req, res) => {
    const { section_id } = req.body;
    if (!section_id) return res.redirect('/instructor/dashboard?approveError=Invalid request.');
    try {
      const { error } = await supabaseAdmin
        .from('sections')
        .delete()
        .eq('section_id', section_id);
      if (error) throw error;
      res.redirect('/instructor/dashboard?approveSuccess=Section deleted successfully.');
    } catch (err) {
      res.redirect('/instructor/dashboard?approveError=' + encodeURIComponent(err.message));
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
        name, student_id, email,
        section: section ? String(section).trim().toUpperCase() : null,
        course,
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

  router.post('/archive-student', async (req, res) => {
    const { user_id } = req.body;
    const redirectQuery = req.body;
    if (!user_id) {
      return res.redirect(dashboardRedirect(redirectQuery, { approveError: 'Missing student ID.' }));
    }
    try {
      await probeUsersSchema(supabaseAdmin, { refresh: true });
      if (!usersSchema.usersHasStatusColumn) {
        return res.redirect(dashboardRedirect(redirectQuery, { approveError: 'Archive requires status column. Run add_student_archive_status.sql in Supabase.' }));
      }
      const { error } = await supabaseAdmin.from('users').update({ status: 'archived' }).eq('user_id', user_id).eq('role', 'student');
      if (error) throw error;
      return res.redirect(dashboardRedirect(redirectQuery, { approveSuccess: 'Student archived successfully.' }));
    } catch (err) {
      return res.redirect(dashboardRedirect(redirectQuery, { approveError: err.message }));
    }
  });

  router.post('/restore-student', async (req, res) => {
    const { user_id } = req.body;
    const redirectQuery = { ...req.body, show_archived: '1' };
    if (!user_id) {
      return res.redirect(dashboardRedirect(redirectQuery, { approveError: 'Missing student ID.' }));
    }
    try {
      await probeUsersSchema(supabaseAdmin, { refresh: true });
      if (!usersSchema.usersHasStatusColumn) {
        return res.redirect(dashboardRedirect(redirectQuery, { approveError: 'Restore requires status column. Run add_student_archive_status.sql in Supabase.' }));
      }
      const { error } = await supabaseAdmin.from('users').update({ status: 'approved' }).eq('user_id', user_id).eq('role', 'student');
      if (error) throw error;
      return res.redirect(dashboardRedirect(redirectQuery, { approveSuccess: 'Student restored successfully.' }));
    } catch (err) {
      return res.redirect(dashboardRedirect(redirectQuery, { approveError: err.message }));
    }
  });

  router.post('/archive-section', async (req, res) => {
    const section = (req.body.section || '').trim();
    const redirectQuery = req.body;
    if (!section) {
      return res.redirect(dashboardRedirect(redirectQuery, { approveError: 'Select a section to archive.' }));
    }
    try {
      await probeUsersSchema(supabaseAdmin, { refresh: true });
      if (!usersSchema.usersHasStatusColumn) {
        return res.redirect(dashboardRedirect(redirectQuery, { approveError: 'Archive requires status column. Run add_student_archive_status.sql in Supabase.' }));
      }
      const { data, error: fetchErr } = await supabaseAdmin
        .from('users').select('user_id,status,section').eq('role', 'student').ilike('section', section);
      if (fetchErr) throw fetchErr;
      const ids = (data || []).filter(isApprovedStudent).map(s => s.user_id);
      if (!ids.length) {
        return res.redirect(dashboardRedirect(redirectQuery, { approveError: `No active students found in section ${section}.` }));
      }
      const { error } = await supabaseAdmin.from('users').update({ status: 'archived' }).in('user_id', ids);
      if (error) throw error;
      return res.redirect(dashboardRedirect(redirectQuery, { approveSuccess: `Archived ${ids.length} student(s) in section ${section}.` }));
    } catch (err) {
      return res.redirect(dashboardRedirect(redirectQuery, { approveError: err.message }));
    }
  });

  router.post('/restore-section', async (req, res) => {
    const section = (req.body.section || '').trim();
    const redirectQuery = { ...req.body, show_archived: '1' };
    if (!section) {
      return res.redirect(dashboardRedirect(redirectQuery, { approveError: 'Select a section to restore.' }));
    }
    try {
      await probeUsersSchema(supabaseAdmin, { refresh: true });
      if (!usersSchema.usersHasStatusColumn) {
        return res.redirect(dashboardRedirect(redirectQuery, { approveError: 'Restore requires status column. Run add_student_archive_status.sql in Supabase.' }));
      }
      const { data, error: fetchErr } = await supabaseAdmin
        .from('users').select('user_id,status,section').eq('role', 'student').ilike('section', section);
      if (fetchErr) throw fetchErr;
      const ids = (data || []).filter(isArchivedStudent).map(s => s.user_id);
      if (!ids.length) {
        return res.redirect(dashboardRedirect(redirectQuery, { approveError: `No archived students found in section ${section}.` }));
      }
      const { error } = await supabaseAdmin.from('users').update({ status: 'approved' }).in('user_id', ids);
      if (error) throw error;
      return res.redirect(dashboardRedirect(redirectQuery, { approveSuccess: `Restored ${ids.length} student(s) in section ${section}.` }));
    } catch (err) {
      return res.redirect(dashboardRedirect(redirectQuery, { approveError: err.message }));
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
        supabaseAdmin.from('users').select('user_id,name,gender,section').eq('role', 'student').order('name'),
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

      const navNotifs = await loadInstructorNavNotifications();
      res.render('instructor/fitness_tests', {
        students: students2, tests, selectedStudentId, selectedStudent,
        ...navNotifs,
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
        student_id: target_student_id,
        test_type,
        test_period,
        reps_or_cm: parseFloat(reps_or_cm),
        rating,
        recorded_by: req.session.user.user_id,
      });
      if (insertErr) throw insertErr;
      res.redirect(`/instructor/fitness-tests?student_id=${target_student_id}&success=Test recorded! Rating: ${rating.replace(/_/g, ' ')}`);
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
      const navNotifs = await loadInstructorNavNotifications();
      res.render('instructor/lesson_plans', {
        plans: plans || [], level,
        ...navNotifs,
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
        .from('users').select('user_id,name,student_id,section,course,status').eq('role', 'student').order('name');
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
          .from('users').select('*').eq('role', 'student').ilike('section', `%${section}%`).order('name');
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

      const testTypes = ['push_ups', 'sit_reach', 'zipper_test', 'juggling', 'sprint_40m', 'stork_balance', 'stick_drop', 'agility_test', 'step_test_3min'];
      const grouped = {};
      testTypes.forEach(t => { grouped[t] = { pre: null, post: null }; });
      tests.forEach(t => {
        if (grouped[t.test_type]) grouped[t.test_type][t.test_period] = t;
      });

      // Rating distribution for class-wide (all rating tiers)
      const dist = { excellent: 0, very_good: 0, good: 0, fair: 0, needs_improvement: 0, poor: 0 };
      const countSource = targetId ? tests : section ? sectionTests : [];
      countSource.forEach(t => { if (t.rating && dist[t.rating] !== undefined) dist[t.rating]++; });

      const navNotifs = await loadInstructorNavNotifications();
      res.render('instructor/report', {
        studentsList: studentsList || [], studentInfo, grouped, testTypes,
        targetId, section, sectionStudents, sectionTests, sectionSummary,
        rubrics: get(),
        sectionTestRecords: sectionTestRecords || [],
        searchQuery,
        showClassSummary: viewType === 'summary' || isSectionSearch,
        // When the instructor clicks "Class Summary", we allow the report to show the per-test rows.
        showSectionTestDetails: viewType === 'summary',
        dist, totalTests: countSource.length,
        ...navNotifs,
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
        .from('users').select('*').eq('role', 'student').ilike('section', section).order('name');
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

      const pendingRegistrations = await getPendingRegistrations();

      // Photos are stored as permanent public URLs, but when the storage bucket is private
      // we need to resolve a signed access URL for the instructor view.
      const recordsWithSignedPhoto = await Promise.all(screeningsWithUsers.map(async record => {
        if (!record.photo_url || typeof record.photo_url !== 'string') return record;

        let resolvedPhotoUrl = record.photo_url;
        try {
          const moduleBucket = supabaseAdmin.storage.from('modules');
          const storagePathMatch = resolvedPhotoUrl.match(/\/storage\/v1\/object\/(?:public|private)\/modules\/(.+)$/);

          if (storagePathMatch) {
            const storagePath = decodeURIComponent(storagePathMatch[1]);
            const { data: signedData, error: signedError } = await moduleBucket.createSignedUrl(storagePath, 60 * 60);
            if (!signedError && signedData?.signedUrl) {
              resolvedPhotoUrl = signedData.signedUrl;
            }
          } else if (!resolvedPhotoUrl.startsWith('http')) {
            const { data: signedData, error: signedError } = await moduleBucket.createSignedUrl(resolvedPhotoUrl, 60 * 60);
            if (!signedError && signedData?.signedUrl) {
              resolvedPhotoUrl = signedData.signedUrl;
            }
          }
        } catch (err) {
          console.error('[health-appraisal photo URL]', err);
        }

        return { ...record, photo_url: resolvedPhotoUrl };
      }));

      const navNotifs = await loadInstructorNavNotifications();

      res.render('instructor/health_appraisal', {
        screenings: recordsWithSignedPhoto,
        ...navNotifs,
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

  // GET /instructor/notifications
  router.get('/notifications', async (req, res) => {
    try {
      const navNotifs = await loadInstructorNavNotifications();
      const fitnessTestNotifications = await getFitnessTestNotifications({ limit: 50 });
      const healthAppraisalNotifications = await getHealthAppraisalNotifications({ limit: 50 });

      res.render('instructor/notifications', {
        ...navNotifs,
        fitnessTestNotifications, healthAppraisalNotifications,
      });
    } catch (err) {
      res.render('error', { title: 'Error', message: err.message });
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
    if (wantsJson(req)) return res.json({ ok: true });
    const ref = req.get('Referer') || '/instructor/notifications';
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
    if (wantsJson(req)) return res.json({ ok: true });
    const ref = req.get('Referer') || '/instructor/notifications';
    res.redirect(ref);
  });

  return router;
};

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


DROP TABLE IF EXISTS public.fitness_portfolio  CASCADE;
DROP TABLE IF EXISTS public.health_screening   CASCADE;
DROP TABLE IF EXISTS public.fitness_tests      CASCADE;
DROP TABLE IF EXISTS public.attendance         CASCADE;
DROP TABLE IF EXISTS public.lesson_plans       CASCADE;
DROP TABLE IF EXISTS public.users              CASCADE;


CREATE TABLE public.users (
    user_id       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id    VARCHAR(20) UNIQUE,
    name          VARCHAR(100) NOT NULL,
    email         VARCHAR(150) UNIQUE NOT NULL,
    section       VARCHAR(50),
    course        VARCHAR(100),
    year_level    SMALLINT CHECK (year_level BETWEEN 1 AND 5),
    gender        VARCHAR(10) CHECK (gender IN ('male','female')),
    pathfit_level SMALLINT CHECK (pathfit_level IN (1,2)),
    role          VARCHAR(20) NOT NULL DEFAULT 'student' CHECK (role IN ('student','instructor')),
    created_at    TIMESTAMPTZ DEFAULT NOW()
);


CREATE TABLE public.fitness_tests (
    test_id     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id  UUID NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
    test_type   VARCHAR(30) NOT NULL CHECK (test_type IN ('push_ups','sit_ups','sit_reach','step_test','shuttle_run')),
    test_period VARCHAR(10) NOT NULL CHECK (test_period IN ('pre','post')),
    reps_or_cm  NUMERIC(8,2),
    rating      VARCHAR(25) CHECK (rating IN ('excellent','good','fair','needs_improvement')),
    recorded_by UUID REFERENCES public.users(user_id),
    created_at  TIMESTAMPTZ DEFAULT NOW()
);


CREATE TABLE public.attendance (
    record_id   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id  UUID NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
    week_number SMALLINT NOT NULL CHECK (week_number BETWEEN 1 AND 16),
    date        DATE NOT NULL,
    status      VARCHAR(10) NOT NULL CHECK (status IN ('present','absent','excused')),
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (student_id, date)
);


CREATE TABLE public.lesson_plans (
    plan_id       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pathfit_level SMALLINT NOT NULL CHECK (pathfit_level IN (1,2)),
    week_number   SMALLINT NOT NULL CHECK (week_number BETWEEN 1 AND 16),
    topic         VARCHAR(200) NOT NULL,
    activity      TEXT,
    objectives    TEXT,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (pathfit_level, week_number)
);


CREATE TABLE public.health_screening (
    screen_id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id        UUID NOT NULL UNIQUE REFERENCES public.users(user_id) ON DELETE CASCADE,
    injury_history    TEXT,
    health_conditions TEXT,
    cleared           BOOLEAN DEFAULT FALSE,
    screened_at       TIMESTAMPTZ DEFAULT NOW()
);


CREATE TABLE public.fitness_portfolio (
    portfolio_id     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id       UUID NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
    semester         VARCHAR(30) NOT NULL,
    reflection_notes TEXT,
    submitted_at     TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (student_id, semester)
);




ALTER TABLE public.users             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fitness_tests     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_plans      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_screening  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fitness_portfolio ENABLE ROW LEVEL SECURITY;


CREATE POLICY "users_select" ON public.users FOR SELECT USING (
    auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM public.users u WHERE u.user_id = auth.uid() AND u.role = 'instructor')
);
CREATE POLICY "users_insert" ON public.users FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_update" ON public.users FOR UPDATE USING (auth.uid() = user_id);


CREATE POLICY "users_service_all" ON public.users FOR ALL USING (auth.role() = 'service_role');


CREATE POLICY "fitness_tests_select" ON public.fitness_tests FOR SELECT USING (
    student_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.users u WHERE u.user_id = auth.uid() AND u.role = 'instructor')
);

CREATE POLICY "fitness_tests_insert" ON public.fitness_tests FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.users u WHERE u.user_id = auth.uid() AND u.role = 'instructor')
);
CREATE POLICY "fitness_tests_update" ON public.fitness_tests FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.user_id = auth.uid() AND u.role = 'instructor')
);
CREATE POLICY "fitness_tests_service" ON public.fitness_tests FOR ALL USING (auth.role() = 'service_role');


CREATE POLICY "attendance_select" ON public.attendance FOR SELECT USING (
    student_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.users u WHERE u.user_id = auth.uid() AND u.role = 'instructor')
);
CREATE POLICY "attendance_insert" ON public.attendance FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.users u WHERE u.user_id = auth.uid() AND u.role = 'instructor')
);
CREATE POLICY "attendance_update" ON public.attendance FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.user_id = auth.uid() AND u.role = 'instructor')
);
CREATE POLICY "attendance_service" ON public.attendance FOR ALL USING (auth.role() = 'service_role');


CREATE POLICY "lesson_plans_read"    ON public.lesson_plans FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "lesson_plans_service" ON public.lesson_plans FOR ALL   USING (auth.role() = 'service_role');


CREATE POLICY "health_select"  ON public.health_screening FOR SELECT USING (
    student_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.users u WHERE u.user_id = auth.uid() AND u.role = 'instructor')
);
CREATE POLICY "health_insert"  ON public.health_screening FOR INSERT WITH CHECK (student_id = auth.uid());
CREATE POLICY "health_update"  ON public.health_screening FOR UPDATE USING (
    student_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.users u WHERE u.user_id = auth.uid() AND u.role = 'instructor')
);
CREATE POLICY "health_service" ON public.health_screening FOR ALL USING (auth.role() = 'service_role');

-- fitness_portfolio policies
CREATE POLICY "portfolio_select"  ON public.fitness_portfolio FOR SELECT USING (
    student_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.users u WHERE u.user_id = auth.uid() AND u.role = 'instructor')
);
CREATE POLICY "portfolio_insert"  ON public.fitness_portfolio FOR INSERT WITH CHECK (student_id = auth.uid());
CREATE POLICY "portfolio_update"  ON public.fitness_portfolio FOR UPDATE USING (student_id = auth.uid());
CREATE POLICY "portfolio_service" ON public.fitness_portfolio FOR ALL USING (auth.role() = 'service_role');


INSERT INTO public.users (user_id, student_id, name, email, section, course, year_level, gender, pathfit_level, role)
SELECT
    id,
    'INST-001',
    'GP Quiblat',
    'gpquiblat@nbsc.edu.ph',
    'N/A',
    'Physical Education',
    1,
    'male',
    1,
    'instructor'
FROM auth.users
WHERE email = 'gpquiblat@nbsc.edu.ph'
ON CONFLICT (email) DO UPDATE
    SET role = 'instructor', student_id = 'INST-001', name = 'GP Quiblat';

-- Insert STUDENT profile (20211428@nbsc.edu.ph)
INSERT INTO public.users (user_id, student_id, name, email, section, course, year_level, gender, pathfit_level, role)
SELECT
    id,
    '20211428',
    '20211428 Student',
    '20211428@nbsc.edu.ph',
    'A',
    'BSIT',
    1,
    'male',
    1,
    'student'
FROM auth.users
WHERE email = '20211428@nbsc.edu.ph'
ON CONFLICT (email) DO UPDATE
    SET role = 'student', student_id = '20211428';



INSERT INTO public.health_screening (student_id, injury_history, health_conditions, cleared)
SELECT user_id, 'None', 'None of the above', TRUE
FROM public.users
WHERE email = '20211428@nbsc.edu.ph'
ON CONFLICT (student_id) DO UPDATE SET cleared = TRUE;



INSERT INTO public.lesson_plans (pathfit_level, week_number, topic, activity, objectives) VALUES
(1, 1,  'Orientation & Health Screening',      'Introduction, health forms, PAR-Q',                    'Understand course requirements; complete health screening'),
(1, 2,  'Physical Fitness Pre-Test',           'Push-ups, sit-ups, sit-reach, step test, shuttle run', 'Establish baseline fitness levels'),
(1, 3,  'Fundamentals of Physical Fitness',    'Lecture + light aerobic warm-up',                      'Define components of health-related fitness'),
(1, 4,  'Flexibility Training',                'Static & dynamic stretching routines',                 'Improve range of motion; prevent injury'),
(1, 5,  'Muscular Strength – Upper Body',      'Push-up progressions, resistance band exercises',      'Develop upper body strength'),
(1, 6,  'Muscular Strength – Core',            'Plank variations, sit-up progressions',                'Strengthen core stabilizers'),
(1, 7,  'Muscular Endurance',                  'Circuit training (bodyweight)',                         'Sustain repeated muscle contractions'),
(1, 8,  'Cardiovascular Endurance I',          'Brisk walking / jogging intervals',                    'Improve aerobic capacity'),
(1, 9,  'Cardiovascular Endurance II',         'Continuous run + step test practice',                  'Build aerobic base; monitor heart rate'),
(1, 10, 'Speed & Agility',                     'Shuttle run drills, ladder drills',                    'Enhance reaction time and agility'),
(1, 11, 'Balance & Coordination',              'Balance board, single-leg exercises',                  'Improve proprioception and coordination'),
(1, 12, 'Integrated Circuit Training',         'Full-body circuit combining all components',           'Apply all fitness components in one session'),
(1, 13, 'Stress Management & Active Recovery', 'Yoga basics, breathing exercises',                     'Understand recovery; manage stress through movement'),
(1, 14, 'Personal Fitness Planning',           'Goal-setting workshop, FITT principle',                'Create a personal fitness plan'),
(1, 15, 'Physical Fitness Post-Test',          'Push-ups, sit-ups, sit-reach, step test, shuttle run', 'Measure fitness improvement from pre-test'),
(1, 16, 'Portfolio Submission & Reflection',   'Portfolio review, class reflection, closing ceremony', 'Submit fitness portfolio; reflect on semester progress'),
(2, 1,  'Orientation & Review of PATHFit 1',  'Course overview, fitness level review',                'Set goals based on PATHFit 1 results'),
(2, 2,  'Physical Fitness Pre-Test',           'Push-ups, sit-ups, sit-reach, step test, shuttle run', 'Establish new semester baseline'),
(2, 3,  'Sports Science Fundamentals',         'Lecture: biomechanics, energy systems',                'Understand physiological basis of sport performance'),
(2, 4,  'Sport-Specific Warm-Up & Mobility',  'Dynamic warm-up routines for chosen sport',            'Prepare body for sport-specific demands'),
(2, 5,  'Team Sports – Fundamentals',          'Basketball / volleyball basic skills',                 'Develop fundamental team sport skills'),
(2, 6,  'Team Sports – Tactics & Play',        'Scrimmage games, positional play',                     'Apply tactics in game situations'),
(2, 7,  'Individual Sports – Fundamentals',    'Badminton / table tennis basics',                      'Develop individual sport skills'),
(2, 8,  'Individual Sports – Competition',     'Round-robin tournament',                               'Compete and apply learned skills'),
(2, 9,  'Strength & Conditioning for Sport',  'Sport-specific resistance training',                   'Build sport-relevant strength'),
(2, 10, 'Speed, Power & Plyometrics',          'Jump training, sprint drills',                         'Develop explosive power'),
(2, 11, 'Injury Prevention & First Aid',       'Taping, RICE method, common sports injuries',          'Identify and respond to common sports injuries'),
(2, 12, 'Nutrition & Hydration for Athletes', 'Lecture + meal planning activity',                     'Apply sports nutrition principles'),
(2, 13, 'Mental Toughness & Sports Psychology','Visualization, goal-setting, team building',          'Develop mental resilience in sport'),
(2, 14, 'Integrated Sport Performance Day',   'Multi-sport festival / sports day',                    'Demonstrate all competencies in a festive setting'),
(2, 15, 'Physical Fitness Post-Test',          'Push-ups, sit-ups, sit-reach, step test, shuttle run', 'Measure fitness improvement from pre-test'),
(2, 16, 'Portfolio Submission & Reflection',   'Portfolio review, awards, closing ceremony',           'Submit portfolio; celebrate achievements')
ON CONFLICT (pathfit_level, week_number) DO NOTHING;




SELECT
    u.name,
    u.email,
    u.role,
    u.student_id,
    u.pathfit_level,
    CASE WHEN a.email_confirmed_at IS NOT NULL
         THEN '✓ Can Login' ELSE '✗ Not Confirmed' END AS auth_status,
    CASE WHEN hs.screen_id IS NOT NULL
         THEN '✓ Done' ELSE '— Not needed' END AS health_screening
FROM public.users u
JOIN auth.users a ON a.id = u.user_id
LEFT JOIN public.health_screening hs ON hs.student_id = u.user_id
ORDER BY u.role DESC;

INSERT INTO public.users (user_id, student_id, name, email, section, course, year_level, gender, pathfit_level, role)
SELECT
    id,
    'INST-002',
    'Grace PQ',
    'gracepq@nbsc.edu.ph',
    'N/A',
    'Physical Education',
    1,
    'female',
    1,
    'instructor'
FROM auth.users
WHERE email = 'gracepq@nbsc.edu.ph'
ON CONFLICT (email) DO UPDATE
    SET role = 'instructor', student_id = 'INST-002', name = 'Grace PQ';

-- Verify the instructor was added
SELECT
    u.name,
    u.email,
    u.role,
    u.student_id,
    CASE WHEN a.email_confirmed_at IS NOT NULL
         THEN '✓ Can Login' ELSE '✗ Not Confirmed' END AS auth_status
FROM public.users u
JOIN auth.users a ON a.id = u.user_id
WHERE u.role = 'instructor'
ORDER BY u.name;

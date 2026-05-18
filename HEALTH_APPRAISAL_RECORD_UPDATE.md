# Health Appraisal Record (PAR-Q) Implementation

**Date**: May 18, 2026  
**Status**: ✅ Complete - Ready to Deploy

---

## Overview

The simple health screening has been replaced with a comprehensive **Health Appraisal Record (PAR-Q)** form based on the NBSC official format. This form collects detailed medical and physical information from students before they participate in PATHFit activities.

---

## What Changed

### ❌ Removed:
- Simple `health_screening` table with basic injury history and conditions
- Basic health screening form with checkboxes

### ✅ Added:
- Comprehensive `health_appraisal_record` table with 30+ fields
- Professional PAR-Q form matching NBSC official format
- Detailed medical questionnaire with 9 questions
- Physical check-up result fields (height, weight, BMI, etc.)
- Certification checkbox requirement
- Enhanced instructor view with modal to see full details

---

## Database Changes

### New Table: `health_appraisal_record`

**Columns:**
- `record_id` (UUID, Primary Key)
- `student_id` (UUID, Foreign Key to users)

**I. Personal Data:**
- `name` (VARCHAR)
- `gender` (VARCHAR)
- `age` (INTEGER)

**II. Physical Check-up Result:**
- `height_kg` (DECIMAL)
- `weight_cm` (DECIMAL)
- `resting_pulse_rate` (INTEGER)
- `waistline_inches` (DECIMAL)
- `ideal_weight` (VARCHAR)
- `bmi_classification` (VARCHAR)

**III. Medical-related Questionnaire:**
- `q1_hospitalization` (BOOLEAN) + `q1_details` (TEXT)
- `q2_injury` (BOOLEAN) + `q2_details` (TEXT)
- `q3_diagnosed` (BOOLEAN) + 10 condition checkboxes
- `q4_lower_back_pain` (BOOLEAN)
- `q5_movement_restriction` (BOOLEAN)
- `q6_medical_treatment` (BOOLEAN)
- `q7_regular_exercise` (BOOLEAN) + `q7_details` (TEXT)
- `q8_smoke` (BOOLEAN) + `q8_details` (TEXT)
- `q9_alcohol` (BOOLEAN) + `q9_details` (TEXT)

**Certification:**
- `certify_correctness` (BOOLEAN) - **Required**

**Clearance:**
- `cleared` (BOOLEAN)
- `cleared_at` (TIMESTAMPTZ)
- `cleared_by` (UUID, Foreign Key to users)
- `submitted_at` (TIMESTAMPTZ)

---

## Form Features

### For Students:

#### Section I: Personal Data
- Name (auto-filled from profile, read-only)
- Gender (dropdown: Male/Female)
- Age (number input, required)

#### Section II: Physical Check-up Result
- Height (kg)
- Weight (cm)
- Resting Pulse Rate
- Waistline (inches)
- Ideal Weight
- BMI Classification

#### Section III: Medical-related Questionnaire

**Q1:** Have you had any hospitalization/surgery for the last 5 years?
- Yes/No radio buttons
- If Yes: Text area for details

**Q2:** Have you sustained or had major injury for the last 5 years?
- Yes/No radio buttons
- If Yes: Text area for details

**Q3:** Have you experienced or have been diagnosed with any of the following:
- Yes/No radio buttons
- If Yes: Checkboxes for 10 conditions:
  - 3.1 Chest pain
  - 3.2 Difficulty breathing
  - 3.3 Dizziness or fainting spell
  - 3.4 Hypertension (High Blood Pressure)
  - 3.5 Anemia
  - 3.6 Kidney problem
  - 3.7 Arthritis
  - 3.8 Gout
  - 3.9 Dislocation
  - 3.10 Fracture

**Q4:** Have you experienced lower back pain?
- Yes/No radio buttons

**Q5:** Do you have ailments which restrict movement or physical activity?
- Yes/No radio buttons

**Q6:** Are you under medical treatment?
- Yes/No radio buttons

**Q7:** Do you engage in regular exercise (at least 3 times a week)?
- Yes/No radio buttons
- If Yes: Text area for exercise duration details

**Q8:** Do you smoke?
- Yes/No radio buttons
- If Yes: Text area for frequency details

**Q9:** Do you drink alcoholic beverages?
- Yes/No radio buttons
- If Yes: Text area for frequency details

#### Certification Section
- **Required checkbox**: "Yes, I certify that all information provided is accurate and complete."
- Form cannot be submitted without checking this box

---

### For Instructors:

#### Health Appraisal Records Page (`/instructor/health-screening`)

**Table View:**
- Student Name
- Student ID
- Section
- Age
- Gender
- Submitted Date
- Clearance Status (✔ Cleared / ⏳ Pending)
- Actions:
  - **👁️ View** button - Opens detailed modal
  - **Clear/Revoke** button - Toggle clearance status

**Detailed Modal View:**
- Shows all sections of the PAR-Q form
- Personal Data
- Physical Check-up Results
- All 9 medical questions with answers
- Highlighted YES answers in red
- Highlighted NO answers in green
- Details/follow-up answers displayed
- Conditions checklist (Q3) shown as badges
- Certification status
- Clearance status and submission date

---

## Files Created

1. **`add_health_appraisal_record.sql`**
   - Drops old `health_screening` table
   - Creates new `health_appraisal_record` table
   - Sets up Row Level Security policies
   - Creates indexes for performance

---

## Files Modified

### Backend Routes:

1. **`routes/auth.js`**
   - Updated login route to check `health_appraisal_record` table
   - Updated health screening GET route
   - Completely rewrote POST route to handle comprehensive form data
   - Added validation for required fields
   - Added certification checkbox validation
   - Parses Q3 conditions array
   - Stores all questionnaire responses

2. **`routes/student.js`**
   - Updated dashboard route to query `health_appraisal_record`
   - Updated portfolio route to query `health_appraisal_record`

3. **`routes/instructor.js`**
   - Updated dashboard route to query `health_appraisal_record`
   - Updated health screening GET route to query `health_appraisal_record`
   - Updated health screening POST route to use `record_id` instead of `screen_id`
   - Added `cleared_at` and `cleared_by` tracking

### Frontend Views:

4. **`views/health_screening.ejs`**
   - Complete redesign with professional styling
   - Comprehensive PAR-Q form layout
   - Dynamic show/hide for follow-up questions
   - Certification checkbox with validation
   - Responsive grid layout
   - JavaScript for conditional field display

5. **`views/instructor/health_screening.ejs`**
   - Updated table to show PAR-Q data
   - Added "View" button for each record
   - Created detailed modal view
   - Shows all questionnaire responses
   - Color-coded YES/NO answers
   - Displays conditions as badges
   - Shows certification status

---

## Deployment Steps

### Step 1: Run Database Migration

**IMPORTANT:** This will **delete** the old `health_screening` table and all existing data.

```sql
-- Run this in Supabase SQL Editor:
-- File: add_health_appraisal_record.sql
```

⚠️ **Warning:** All existing health screening data will be lost. Students will need to re-submit the new comprehensive form.

### Step 2: Restart the Server

```bash
npm run dev
```

### Step 3: Test the Flow

1. **Student Registration:**
   - Register a new student account
   - Wait for instructor approval

2. **Student Login (First Time):**
   - After approval, student logs in
   - Automatically redirected to Health Appraisal Record form
   - Fill out all sections
   - **Must check certification checkbox**
   - Submit form

3. **Student Dashboard:**
   - After submission, redirected to dashboard
   - Health Screening card shows "⏳ Pending" status

4. **Instructor Review:**
   - Go to `/instructor/health-screening`
   - See list of submitted records
   - Click "👁️ View" to see full details
   - Click "Clear" to approve the student
   - Status changes to "✔ Cleared"

5. **Student Dashboard Update:**
   - Student's dashboard now shows "✔ Cleared" status

---

## Validation Rules

### Required Fields:
- ✅ Name (auto-filled)
- ✅ Gender
- ✅ Age
- ✅ Certification checkbox

### Optional Fields:
- All Physical Check-up fields
- All questionnaire follow-up details

### Form Submission:
- Cannot submit without checking certification checkbox
- JavaScript validation alerts user if checkbox is unchecked
- Server-side validation also checks certification

---

## Key Features

### 1. Dynamic Form Behavior
- Follow-up questions only appear when "Yes" is selected
- Smooth show/hide transitions
- Prevents clutter and confusion

### 2. Professional Design
- Matches NBSC official PAR-Q format
- Clean, modern UI with NBSC color scheme
- Responsive layout works on all devices
- Clear section headers and labels

### 3. Data Integrity
- Certification checkbox ensures student accountability
- Tracks who cleared the record and when
- Unique constraint prevents duplicate submissions
- Row Level Security protects student privacy

### 4. Instructor Efficiency
- Quick table view for overview
- Detailed modal for comprehensive review
- One-click clearance toggle
- Color-coded status indicators

---

## Database Schema

```sql
CREATE TABLE health_appraisal_record (
  record_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  
  -- Personal Data
  name VARCHAR(255) NOT NULL,
  gender VARCHAR(10) NOT NULL,
  age INTEGER NOT NULL,
  
  -- Physical Check-up
  height_kg DECIMAL(5,2),
  weight_cm DECIMAL(5,2),
  resting_pulse_rate INTEGER,
  waistline_inches DECIMAL(5,2),
  ideal_weight VARCHAR(50),
  bmi_classification VARCHAR(50),
  
  -- Questionnaire (9 questions + details)
  q1_hospitalization BOOLEAN DEFAULT FALSE,
  q1_details TEXT,
  q2_injury BOOLEAN DEFAULT FALSE,
  q2_details TEXT,
  q3_diagnosed BOOLEAN DEFAULT FALSE,
  q3_1_chest_pain BOOLEAN DEFAULT FALSE,
  q3_2_breathing BOOLEAN DEFAULT FALSE,
  q3_3_dizziness BOOLEAN DEFAULT FALSE,
  q3_4_hypertension BOOLEAN DEFAULT FALSE,
  q3_5_anemia BOOLEAN DEFAULT FALSE,
  q3_6_kidney BOOLEAN DEFAULT FALSE,
  q3_7_arthritis BOOLEAN DEFAULT FALSE,
  q3_8_gout BOOLEAN DEFAULT FALSE,
  q3_9_dislocation BOOLEAN DEFAULT FALSE,
  q3_10_fracture BOOLEAN DEFAULT FALSE,
  q4_lower_back_pain BOOLEAN DEFAULT FALSE,
  q5_movement_restriction BOOLEAN DEFAULT FALSE,
  q6_medical_treatment BOOLEAN DEFAULT FALSE,
  q7_regular_exercise BOOLEAN DEFAULT FALSE,
  q7_details TEXT,
  q8_smoke BOOLEAN DEFAULT FALSE,
  q8_details TEXT,
  q9_alcohol BOOLEAN DEFAULT FALSE,
  q9_details TEXT,
  
  -- Certification
  certify_correctness BOOLEAN DEFAULT FALSE,
  
  -- Clearance
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  cleared BOOLEAN DEFAULT FALSE,
  cleared_at TIMESTAMPTZ,
  cleared_by UUID REFERENCES users(user_id),
  
  UNIQUE(student_id)
);
```

---

## Testing Checklist

- [ ] Run `add_health_appraisal_record.sql` in Supabase
- [ ] Restart Node.js server
- [ ] Register new student account
- [ ] Instructor approves student
- [ ] Student logs in and sees PAR-Q form
- [ ] Try submitting without certification checkbox (should fail)
- [ ] Fill out form and check certification checkbox
- [ ] Submit form successfully
- [ ] Student dashboard shows "⏳ Pending" status
- [ ] Instructor views health screening page
- [ ] Instructor clicks "View" to see full details
- [ ] Instructor clicks "Clear" to approve
- [ ] Student dashboard updates to "✔ Cleared"
- [ ] Test "Revoke" button to remove clearance

---

## Known Issues / Future Enhancements

### Current Limitations:
- Old health screening data will be lost after migration
- Students must re-submit the new comprehensive form

### Possible Enhancements:
- Add PDF export for health appraisal records
- Add digital signature field
- Add parent/guardian signature for minors
- Add medical certificate upload
- Add email notification when cleared
- Add bulk clearance for multiple students

---

## Support

If you encounter any issues:

1. Check that `add_health_appraisal_record.sql` was run successfully
2. Verify the table exists: `SELECT * FROM health_appraisal_record LIMIT 1;`
3. Check server logs for errors
4. Ensure all routes are updated to use `health_appraisal_record` instead of `health_screening`

---

**End of Documentation**

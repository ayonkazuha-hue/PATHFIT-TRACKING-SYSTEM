# Health Appraisal Record Notifications

**Date**: May 18, 2026  
**Status**: ✅ Complete - Ready to Deploy

---

## Overview

Instructors now receive real-time notifications when students submit their Health Appraisal Record (PAR-Q) forms. This ensures timely review and clearance of student health records.

---

## Features

### For Students:
- ✅ Submit Health Appraisal Record form
- ✅ Automatically creates notification for instructors
- ✅ No additional action required

### For Instructors:
- ✅ **Bell icon** shows notification count
- ✅ **"🏥 New Health Appraisal Records"** section in dropdown
- ✅ Shows student name and submission date
- ✅ **Click notification** → Marks as read and redirects to Health Screening page
- ✅ **Dismiss button (✕)** → Marks as read without viewing

---

## Database Changes

### New Table: `health_appraisal_notifications`

**Columns:**
- `notification_id` (UUID, Primary Key)
- `student_id` (UUID, Foreign Key to users)
- `record_id` (UUID, Foreign Key to health_appraisal_record)
- `is_read` (BOOLEAN, default: false)
- `created_at` (TIMESTAMPTZ, default: NOW())

**Constraints:**
- Unique constraint on `record_id` (one notification per submission)

**Indexes:**
- `idx_health_appraisal_notif_read` on `is_read`
- `idx_health_appraisal_notif_created` on `created_at DESC`

**Row Level Security:**
- Instructors can view all notifications
- Instructors can update notifications (mark as read)
- Students can insert their own notifications

---

## Files Created

1. **`add_health_appraisal_notifications.sql`**
   - Creates `health_appraisal_notifications` table
   - Sets up Row Level Security policies
   - Creates indexes for performance

---

## Files Modified

### Backend Routes:

1. **`routes/auth.js`**
   - Updated POST `/health-screening` route
   - After successful submission, creates notification
   - Gets the inserted `record_id` and creates notification entry
   - Logs error if notification fails (doesn't block student)

2. **`routes/instructor.js`**
   - Added `getHealthAppraisalNotifications()` helper function
   - Updated all instructor routes to fetch and pass notifications:
     - `/instructor/dashboard`
     - `/instructor/fitness-tests`
     - `/instructor/lesson-plans`
     - `/instructor/report`
     - `/instructor/health-screening`
   - Added new routes:
     - `GET /instructor/view-health-appraisal/:notification_id` - Marks as read and redirects
     - `POST /instructor/dismiss-health-appraisal-notification` - Marks as read without viewing

### Frontend Views:

3. **`views/partials/header.ejs`**
   - Updated notification count calculation to include health appraisal notifications
   - Added "🏥 New Health Appraisal Records" section in dropdown
   - Shows student name, submission date, and "Submitted Health Appraisal Record (PAR-Q)" message
   - Clickable notification redirects to health screening page
   - Dismiss button (✕) marks as read without viewing

---

## Notification Flow

### Step 1: Student Submits Form
```
Student fills out Health Appraisal Record
↓
Clicks "📋 Submit Health Appraisal Record"
↓
Form data saved to health_appraisal_record table
↓
Notification created in health_appraisal_notifications table
↓
Student redirected to dashboard
```

### Step 2: Instructor Receives Notification
```
Instructor sees bell icon with notification count
↓
Clicks bell icon
↓
Dropdown shows "🏥 New Health Appraisal Records" section
↓
Lists all unread submissions with student names
```

### Step 3: Instructor Reviews Submission
```
Option A: Click notification
  ↓
  Marks as read
  ↓
  Redirects to /instructor/health-screening
  ↓
  Instructor can view full details and clear student

Option B: Click dismiss (✕)
  ↓
  Marks as read
  ↓
  Stays on current page
```

---

## Deployment Steps

### Step 1: Run Database Migration

```sql
-- Run this in Supabase SQL Editor:
-- File: add_health_appraisal_notifications.sql
```

### Step 2: Restart the Server

```bash
npm run dev
```

### Step 3: Test the Flow

1. **Student submits Health Appraisal Record**
   - Login as student
   - Fill out and submit PAR-Q form
   - Check that submission is successful

2. **Instructor receives notification**
   - Login as instructor
   - Check bell icon shows notification count
   - Click bell to see dropdown
   - Verify "🏥 New Health Appraisal Records" section appears
   - Verify student name and date are correct

3. **Instructor clicks notification**
   - Click on the notification
   - Verify redirect to health screening page
   - Verify notification is marked as read (disappears from dropdown)

4. **Test dismiss button**
   - Submit another health appraisal as student
   - As instructor, click dismiss (✕) button
   - Verify notification is marked as read without redirect

---

## Notification Display

### Bell Dropdown Structure:
```
Notifications
[X pending]

📊 New Test Results
  - Student Name
    Test Type · Pre-Test/Post-Test · Rating
    Date
    [✕ Dismiss]

🏥 New Health Appraisal Records
  - Student Name
    Submitted Health Appraisal Record (PAR-Q)
    Date
    [✕ Dismiss]

New Registrations
  - Student Name
    Registered · awaiting approval
    Date

Password Reset Requests
  - Student Name
    Password reset · awaiting approval
    Date
```

---

## Database Schema

```sql
CREATE TABLE health_appraisal_notifications (
  notification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  record_id UUID NOT NULL REFERENCES health_appraisal_record(record_id) ON DELETE CASCADE,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(record_id)
);
```

---

## API Endpoints

### GET /instructor/view-health-appraisal/:notification_id
- **Purpose**: Mark notification as read and redirect to health screening page
- **Method**: GET
- **Parameters**: `notification_id` (URL parameter)
- **Response**: Redirect to `/instructor/health-screening`

### POST /instructor/dismiss-health-appraisal-notification
- **Purpose**: Mark notification as read without viewing
- **Method**: POST
- **Body**: `notification_id`
- **Response**: Redirect to referer or `/instructor/dashboard`

---

## Testing Checklist

- [ ] Run `add_health_appraisal_notifications.sql` in Supabase
- [ ] Restart Node.js server
- [ ] Student submits Health Appraisal Record
- [ ] Instructor sees notification in bell dropdown
- [ ] Notification count increases by 1
- [ ] Click notification redirects to health screening page
- [ ] Notification is marked as read (disappears)
- [ ] Submit another record
- [ ] Click dismiss (✕) button
- [ ] Notification is marked as read without redirect
- [ ] Verify no duplicate notifications for same record

---

## Error Handling

### If Notification Table Doesn't Exist:
- Error is logged to console
- Student submission still succeeds
- Instructor won't receive notification
- Solution: Run `add_health_appraisal_notifications.sql`

### If Notification Insert Fails:
- Error is logged: `[health-appraisal notification] <error message>`
- Student submission still succeeds
- Student is not blocked
- Instructor won't receive notification for that submission

---

## Benefits

1. **Timely Review**: Instructors are immediately notified of new submissions
2. **No Manual Checking**: No need to constantly check health screening page
3. **Efficient Workflow**: Click notification to go directly to review page
4. **Organized**: All notifications in one place (bell dropdown)
5. **Non-Blocking**: Notification failures don't prevent student submissions

---

## Future Enhancements

- Email notifications for instructors
- Push notifications (if mobile app is developed)
- Notification history page
- Bulk mark as read
- Filter notifications by date/student
- Notification preferences (enable/disable specific types)

---

**End of Documentation**

# CarePoint Complete Feature Guide: Sign Up to Appointment Completion

This guide documents the complete end-to-end operational lifecycle of CarePoint across all three user roles: **Patient**, **Doctor**, and **Administrator**.

---

## 1. Authentication & Onboarding

### 1.1 Patient Registration & Sign In
- **Sign Up:** Patients register using their Full Name, Email, Password, and Phone Number.
- **Auto-Role:** Default account role is set to `'patient'`.
- **Profile Initialization:** Automatically sets up personal medical preferences, local caching, and links to Firestore user collection.
- **Login:** Sign in with Email and Password. Password visibility toggle is supported.

### 1.2 Doctor Registration & Verification Gate
- **Specialized Sign Up:** Doctors register with full medical credentials:
  - Medical Specialty (e.g. Cardiology, Dermatology, Pediatrics, General Medicine, etc.)
  - Medical Qualifications / Degrees (e.g. MBBS, FCPS, MD)
  - Years of Clinical Experience
  - Consultation Fee (in BDT ৳)
  - Hospital / Clinic affiliation
  - Clinical biography
- **Verification Gate:** Doctor accounts are created in `'pending'` approval status.
- **Admin Review:** Doctors cannot be booked by patients until an Administrator reviews and approves their medical credentials.

### 1.3 Administrator Access
- Pre-configured administrator accounts have access to the system dashboard to manage doctors, verify credentials, monitor all appointment queues, and track patients.

---

## 2. Doctor Availability & Practice Management

### 2.1 Live Weekly Availability Configuration
Doctors control their live schedule directly from the **Availability** tab:
- **Global Toggle:** Turn accepting appointments ON/OFF.
- **Weekday Rules:** Select active practice days (Saturday through Friday).
- **Time Slots:** Configure daily consultation start time, end time, and slot duration (15m, 20m, 30m, 45m, 60m).
- **Buffer & Capacity:** Set max daily patient load and break buffers.

### 2.2 Doctor Practice Subscriptions
Doctors can upgrade their practice visibility directly from `/subscribe` or their Profile:
- **Doctor Starter Practice (৳0/mo):** Baseline listing and standard scheduling.
- **Doctor Pro Practice (৳2,499/mo or ৳23,999/yr):**
  - Verified `PRO` shield badge displayed in doctor directory.
  - Priority ranking at the top of patient doctor search results.
  - Unlimited monthly appointments and instant WhatsApp booking slips.
- **Doctor Clinic Elite (৳49,999/yr):**
  - Multi-chamber schedule support.
  - Featured banner placement across patient home feeds.
  - VIP priority support and administrative assistance.

---

## 3. Patient Journey & Appointment Booking

### 3.1 Finding a Doctor
- **Universal Multi-Field Search:** Search approved doctors in real-time by doctor name, specialty, hospital, degrees, or biography keywords.
- **Specialty Chips:** 1-tap filtering across medical specialties.
- **Doctor Badging:** Subscribed Pro doctors are highlighted with verified badges and prioritized in search results.

### 3.2 Patient Intake & Slot Selection
- **Calendar & Live Slots:** Patients pick an appointment date and select from available time slots generated according to the doctor's active schedule.
- **Collision Avoidance:** Slots already booked for active appointments are automatically locked.
- **Medical Intake Questionnaire:**
  - Patient Full Name, Age, Gender, Phone, and Blood Group.
  - Chief Medical Complaint / Reason for visit.
  - Allergies, Current Medications, and Past Medical History.
  - Medical Document & Prescription Upload (supports PDF, PNG, JPG).

### 3.3 Flexible Payment Options
CarePoint supports three transparent payment methods at checkout:
1. **Pay Online with Stripe:**
   - In-app payment sheet accepting Visa, Mastercard, and American Express.
   - 1-tap sandbox test card fill for instant verification.
   - Instant booking confirmation with Stripe receipt number.
2. **Pay at Clinic Counter:**
   - Cash settlement at the clinic reception desk prior to entering the consultation room.
3. **I Will Pay Later (Flexible Booking):**
   - Book urgent appointments instantly without upfront payment.
   - Shows distinctive purple "Pay Later" status chip across patient, doctor, and admin dashboards.
   - Settle consultation fee on or before the appointment date.

### 3.4 Patient CarePoint Plus & VIP Discounts
- **CarePoint Plus (৳299/mo):** 20% discount automatically applied to all consultation fees.
- **CarePoint VIP Family Pass (৳599/mo):** 30% discount applied to all consultation fees.

---

## 4. Confirmation, Notifications & WhatsApp

### 4.1 Unique Serial Number Generation
- Each appointment is assigned a sequential, clean serial number (`SL-01`, `SL-02`, etc.) per doctor and date.
- Serial numbers are recycled if an appointment is rejected or cancelled, ensuring sequential patient queues.

### 4.2 Emoji-Free WhatsApp Booking Slips
- Patients can trigger a formatted plain-text WhatsApp booking slip with 1-tap.
- Formatted without emojis or decorative symbols for clean SMS and WhatsApp rendering.
- Includes Doctor Name, Specialty, Serial Number, Date, Time, Fee, and Payment Notice.

---

## 5. Doctor & Administrator Lifecycle Management

### 5.1 Doctor Queue & Consultation Flow
1. **Pending Review:** New appointments appear under the Doctor's **Pending** queue.
2. **Accept Appointment:** Doctor confirms the booking; status changes to `confirmed`.
3. **Reject Appointment:**
   - Doctor can reject unsuitable or conflicting requests.
   - **Automatic Slot Re-Enabling:** The rejected slot immediately becomes available again for other patients to book.
4. **Mark Patient Absent (Unlocked at Scheduled Time):**
   - Once the doctor's scheduled appointment time arrives or passes (`isSlotInPast`), the **Mark Absent** button unlocks.
   - Before the scheduled time, the button remains safely locked with an indicator (`Absent option unlocks at {time}`).
   - If marked absent, doctors can still re-confirm or complete the consultation if the patient arrives late.
5. **Complete Consultation:** Doctor marks the appointment as `completed` after the visit.

### 5.2 Admin Oversight & Date-Wise Schedule Management
- **Live Clinical Schedule on Dashboard:** Admin dashboard displays 1-tap schedule cards for **Today's Approved Visits** and **Next Day's Approved Visits**.
- **Date-Wise Schedule Filtering:** In Appointment Management, administrators can filter bookings by:
  - **Today's Schedule:** Direct view of appointments scheduled for the current date.
  - **Next Day / Tomorrow's Schedule:** Direct view of appointments scheduled for the following day.
  - **Next 7 Days:** Comprehensive view of the upcoming week.
  - **Pick Any Date (Interactive Calendar):** Select any date on a dot-marked calendar displaying days with approved appointments.
- **Approved Appointments Only Mode:** Dedicated 1-tap quick switch to isolate confirmed doctor visits from pending, cancelled, or rejected bookings.
- **Patient Absent Administration:**
  - When the scheduled consultation time arrives for an approved visit, administrators can mark the patient as `absent`.
  - Prior to the scheduled consultation time, the action is locked with an indicator pill showing the scheduled unlock time.
  - Marking absent prompts a confirmation dialogue, syncs status to Firestore in real-time, dispatches an in-app alert to the patient, and shows a distinct `ABSENT` status badge.
  - Instant `Re-Confirm` and `Complete` actions remain available on absent bookings.
  - Status filter bar includes a dedicated `absent` chip to filter absent patients.
- **Day Summary Metrics:** Displays total appointment count, confirmed count, and total clinical fees scheduled for the selected date.
- **Serial & Slot Control:** Full authority to manually re-assign serials, auto-generate collision-free serials, or permanently delete appointments.
- **Real-Time Audit Logs:** Complete access to patient intake details, uploaded prescriptions, payment statuses (Paid Stripe, Pay at Clinic, Pay Later), and WhatsApp slips.

---

*CarePoint Healthcare Platform Documentation*

# CarePoint — Digital Doctor Appointment Management System
**React Native | Expo | TypeScript | Firebase | Zustand | Stripe**

> **Developed a cross-platform digital doctor appointment management application using React Native and Expo, with Firebase Cloud Firestore for data management. The application features three role-based panels (Admin, Doctor, and Patient), appointment scheduling, doctor availability management, payment simulation, attendance tracking, and automated notifications.**

---

### Project Objective
To build a centralized digital healthcare platform that simplifies doctor-patient communication, appointment scheduling, availability management, and attendance tracking while providing payment simulation, subscription functionality, and automated appointment notifications.

---

## 📱 Role-Based System Architecture & Features

### 1. Patient Panel
- Patient registration and login.
- Search and browse admin-approved doctors.
- View doctor profiles, consultation fees, and availability schedules.
- Book appointments with specific doctors by providing the required information.
- Choose online payment when confirming appointments.
- View payment details and appointment history.
- Receive WhatsApp messages after appointment confirmation.
- Update personal profile information.
- Receive appointment reminders 10 minutes before scheduled appointments using Expo Notifications.

### 2. Doctor Panel
- Doctor registration and login.
- Newly registered doctor profiles require admin approval before becoming visible to patients.
- View, approve, or reject patient appointment requests.
- Manage availability schedules and consultation fees.
- Update professional and personal profile information.
- View upcoming appointments and patient serial numbers.
- Manage subscription-related features.

### 3. Admin Panel
- Admin login using dummy credentials for demonstration purposes.
- Approve or reject newly registered doctor profiles.
- View all registered doctors and patients.
- View daily doctor-wise patient appointment lists.
- Track daily patient attendance.
- Mark patients as Present or Absent.
- Manage doctor profiles and appointments.
- Delete or reject doctor profiles and appointments.
- Monitor appointment details and payment information.
- Access platform-wide doctor, patient, and appointment records.

### 4. Payment & Subscription Management
- Subscription management functionality.
- Stripe test-mode payment simulation.
- Custom TypeScript payment service.
- Card number formatting and Luhn algorithm validation.
- Card brand detection (Visa, Mastercard, and American Express).
- Card expiry date and CVC validation.
- Appointment payment selection and transaction status handling.
- Simulated transaction receipt generation.
- BDT currency support.

### 5. Technologies, Integrations & Testing
- **React Native & Expo:** Cross-platform mobile application development.
- **TypeScript:** Type-safe application development.
- **Zustand:** Centralized global state management (auth, appointments, doctor queues, and subscriptions).
- **Expo Router:** File-based navigation and routing.
- **Firebase Cloud Firestore:** Cloud database and real-time data management.
- **Expo Notifications:** Appointment reminders and notifications.
- **Stripe:** Test-mode payment configuration and simulated payment processing.
- **WhatsApp Integration:** Appointment confirmation messaging.
- **Xcode:** iOS build, deployment, and application testing.
- **Role-Based Access Control:** Separate dashboards and permissions for Admin, Doctor, and Patient.

---

## 📥 Download Standalone Android APK

- **Direct APK Download Link:** [Download CarePoint APK (v1.0.0)](https://expo.dev/artifacts/eas/o_YB7ysE-IZo219QyMjm7nJtZH3dTmthtqmaP28v3Lw.apk)
- **EAS Build Dashboard:** [EAS Build Details](https://expo.dev/accounts/sajid-chowdhury/projects/CarePoint/builds/10ac8abb-30bb-4684-8505-a05d87a61d75)

---

## 📖 Complete App Features Guide

For a detailed step-by-step documentation of all workflows from user registration to appointment completion, read the **[CarePoint Full Feature Guide](APP_FEATURES_GUIDE.md)**.

---

## 🚀 Quick Start

### Prerequisites
- Node.js (v18+)
- npm or bun

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Development Server
```bash
npx expo start
```

### 3. Verify Code Quality & Types
```bash
npx tsc --noEmit
```

### 4. Build Android Release APK (via EAS)
```bash
npx eas-cli@latest build -p android --profile preview
```

---

## 🏗️ Project Architecture

```text
CarePoint/
├── src/
│   ├── app/                    # Expo Router screens (file-based navigation)
│   │   ├── (admin)/            # Admin portal (dashboard, doctors, review, patients, appointments)
│   │   ├── (auth)/             # Authentication (login, signup)
│   │   ├── (doctor)/           # Doctor portal (queue, availability, profile)
│   │   ├── (tabs)/             # Patient portal (home, find doctors, my appointments, profile)
│   │   ├── appointments/       # Booking & patient intake screen (book.tsx)
│   │   └── subscribe.tsx       # CarePoint Plus & VIP subscription tiers screen
│   ├── components/             # Reusable UI components (DoctorAvatar, StripePaymentModal, ApiSyncIndicator)
│   ├── config/                 # Firebase app, db, auth configuration
│   ├── constants/              # Default availability settings & weekday schedules
│   ├── services/               # Firestore & Stripe API services (auth, doctors, appointments, stripeService)
│   ├── store/                  # Zustand state stores (authStore, doctorStore, appointmentStore, subscriptionStore)
│   └── utils/                  # WhatsApp plain-text integration & notification utilities
├── APP_FEATURES_GUIDE.md       # Complete end-to-end feature lifecycle documentation
└── app.json                    # Native Expo configuration & Continuous Native Generation
```

---

*CarePoint Healthcare Platform*

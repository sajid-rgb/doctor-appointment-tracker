# CarePoint — Healthcare & Doctor Appointment Management System

> **A modern React Native & Expo mobile application connecting patients, doctors, and healthcare administrators with real-time scheduling, digital medical intake, and WhatsApp notifications.**

---

## 🌟 Key Features

- **Multi-Role Access Control:** Custom tailored dashboards for **Patients**, **Doctors**, and **Administrators**.
- **Real-Time Doctor Approval:** Administrator review system to verify, approve, or reject medical practitioners before they appear publicly.
- **Dynamic Weekly Availability:** Doctors can customize working days, consultation start/end times, and slot intervals (e.g. 15m, 20m, 30m).
- **Universal Multi-Field Search:** Real-time search across doctors, patient lists, and appointment queues by name, specialty, serial number, phone, and symptoms.
- **Intelligent Slot Management:** Automatic collision avoidance, past-slot filtering, and **instant slot re-enabling upon appointment rejection**.
- **Admin Date-Wise Schedule Management & Patient Absent Tracking:** Full calendar filtering allowing administrators to monitor **Today's approved appointments**, **Next Day's schedule**, or **Pick Any Date** via an interactive dot-marked calendar, daily clinical fee metrics, and **Patient Absent tracking** (unlocked when doctor schedule time arrives, with in-app patient alert and instant re-confirm/complete actions).
- **Unique Serial Numbering:** Sequential non-overlapping serial generation (`SL-01`, `SL-02`, etc.) with recycling of rejected or cancelled visits.
- **Digital Medical Intake:** Patients submit symptoms, blood group, medications, allergies, and attach medical documents/prescriptions via DocumentPicker.
- **CarePoint Subscriptions (Patients & Doctors):**
  - **Patients:** Multi-tier membership options (`CarePoint Plus` & `CarePoint VIP Family Pass`) with monthly or annual billing offering **20% to 30% discounts** on consultation fees.
  - **Doctors:** Practice enhancement plans (`Doctor Starter`, `Doctor Pro Practice`, `Doctor Clinic Elite`) unlocking PRO badges, search ranking boosts, and verified practice recognition.
- **Flexible Multi-Channel Payments:**
  - **Stripe In-App Card Payments:** Secure online card checkout (Visa, Mastercard, Amex) with client-side Luhn validation, 1-tap test card quick-fill, and instant transaction receipts.
  - **Pay at Clinic Reception:** Pay cash at clinic reception before entering consultation room.
  - **I Will Pay Later:** Book urgent appointments instantly without upfront payment and settle fees on or before the visit.
- **Emoji-Free WhatsApp Slips:** Clean, professional plain-text booking confirmation message formatted for SMS and WhatsApp without decorative icons or emojis.
- **Real-Time Sync & In-App Alerts:** Live Firestore subscriptions (`onSnapshot`) with an in-app notification bell and unread badge.
- **Resilient Offline Caching:** Isolated storage layer with in-memory fallback map preventing circular dependencies and crashes.

---

## 📖 Complete App Features Guide

For a detailed step-by-step documentation of all workflows from user registration to appointment completion, read the **[CarePoint Full Feature Guide](file:///Users/sajid/Code/React%20native/CarePoint/APP_FEATURES_GUIDE.md)**.

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

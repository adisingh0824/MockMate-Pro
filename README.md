# MockMate Pro 🚀

> **AI-Powered Technical Assessment & Live Interview Simulation Platform**  
> Built by **Aditya Singh** ([sadityasingh7990@gmail.com](mailto:sadityasingh7990@gmail.com))

[![Node.js](https://img.shields.io/badge/Node.js-v20+-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19.2-blue.svg)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8.0-purple.svg)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-3.4-38bdf8.svg)](https://tailwindcss.com/)
[![License: ISC](https://img.shields.io/badge/License-ISC-yellow.svg)](https://opensource.org/licenses/ISC)

---

## 🌟 Overview

**MockMate Pro** is an end-to-end technical interview preparation and assessment engine designed for engineers targeting top-tier product and enterprise software teams (Google, Amazon, Microsoft, Meta, and more). It delivers:

1. **Adaptive MCQ Practice Drills**: Role-tailored question sets across 10+ engineering tracks (Frontend, Backend, Full Stack, DevOps, Data Science, Machine Learning, etc.) with real-time countdowns, proctoring violation alerts, and deep diagnostic explanations.
2. **Interactive Live Technical Interviews**: Conversational AI technical interviews with browser Speech-to-Text (STT) and Text-to-Speech (TTS), real-time evaluation reactions, dynamic follow-ups, and full quantitative rubric scorecards.
3. **Company-Targeted Preparation Tracks**: Specialized interview tracks tailored to specific engineering bars, levels (Entry, Mid, Senior), and question volumes for top companies.
4. **Subscription & Payment System**: Integrated Razorpay workflow supporting monthly and yearly access tiers with automated transaction tracking and cancellation handling.
5. **Resilient Development Defaults**: Built-in question/evaluation fallbacks and simulated OTP delivery keep core practice usable without optional AI, email, or payment credentials.

---

## 🏗️ Architecture & Tech Stack

```mermaid
flowchart TD
    Client["Client (React 19 + Vite 8 + Tailwind CSS)"] -->|REST API / Bearer JWT| Backend["Backend (Express 5.2 + Node.js)"]
    Backend -->|Firebase Admin / Firestore| DB[("Google Cloud Firestore")]
    Backend -->|Firebase Auth| FA["Firebase Authentication"]
    Backend -->|OpenAI SDK / Fallback Engine| AI["OpenRouter / OpenAI AI Service"]
    Backend -->|Transaction Verification| Razorpay["Razorpay Payment Gateway"]
    Backend -->|Email & OTP Dispatch| Resend["Resend API / Sandbox Simulation"]
```

- **Frontend**: React 19, Vite 8, Tailwind CSS, Firebase Client SDK, React Router v7, React Hot Toast, Axios.
- **Backend**: Node.js, Express 5.2, Firebase Admin SDK, Cloud Firestore, JWT, bcryptjs.
- **AI & Evaluation**: OpenRouter / OpenAI SDK with role-specialized curated fallback banks.
- **Audio / Voice**: Web Speech API (`SpeechRecognition` & `speechSynthesis`).

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- Node.js 20.19+ or 22.12+
- npm (v9 or newer)

### 2. Installation

Clone the repository and install dependencies for both the backend and client:

```bash
# Clone the repository
git clone https://github.com/adisingh0824/MockMate-Pro.git
cd MockMate-Pro

# Install backend dependencies
cd backend
npm install

# Install client dependencies
cd ../client
npm install
```

### 3. Environment Variables Configuration

#### Backend Configuration (`backend/.env`):
Copy `backend/.env.example` to `backend/.env`. Configure Firebase Admin credentials with `FIREBASE_SERVICE_ACCOUNT_JSON`, `FIREBASE_SERVICE_ACCOUNT_PATH`, or Google Application Default Credentials. The backend needs Firestore access to start. Keep service account credentials out of source control.

```env
PORT=5800
NODE_ENV=development
JWT_SECRET=replace-with-a-long-random-local-development-secret
JWT_EXPIRES_IN=7d
CORS_ORIGIN=http://localhost:3000
FIREBASE_PROJECT_ID=mockmate-pro-f2f13
OTP_LENGTH=6
OTP_EXPIRY_SECONDS=600
OTP_MAX_ATTEMPTS=5
BCRYPT_SALT_ROUNDS=10

# Email (Resend) - Optional in dev (falls back to terminal OTP output); required in production for registration and password reset
RESEND_API_KEY=
RESEND_SENDER_EMAIL=reply@yourdomain.com
RESEND_SENDER_NAME=MockMate Pro
EMAIL_FROM=MockMate Pro <reply@yourdomain.com>
# Set true only after verifying the sender domain with Resend
RESEND_VERIFIED_DOMAIN=false

# Razorpay - Optional for dev testing
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=

# AI Provider - Optional (falls back to built-in curated question banks)
OPENROUTER_API_KEY=
OPENROUTER_MODEL=gpt-4o-mini
```

#### Client Configuration (`client/.env`):
```env
VITE_API_BASE_URL=http://localhost:5800/api
VITE_RAZORPAY_KEY_ID=rzp_test_your_key_id
```

To enable checkout, configure both Razorpay keys on the backend and `VITE_RAZORPAY_KEY_ID` in the frontend deployment environment. Payment checkout is unavailable until those provider keys are supplied.

For production registration and password reset, configure `RESEND_API_KEY` and a sender address authorized by Resend. Set `RESEND_VERIFIED_DOMAIN=true` only after verifying that domain in Resend. If email delivery is unavailable in production, OTP endpoints return an error and never reveal the code in the API response.

### 4. Running the Application

In terminal 1 (Backend; configure Firebase Admin credentials first):
```bash
cd backend
npm start
# Runs on http://localhost:5800
```

In terminal 2 (Client):
```bash
cd client
npm run dev
# Vite dev server opens on http://localhost:3000
```

---

## 🧪 Testing & Verification

MockMate Pro comes with an automated end-to-end verification suite testing all API endpoints, authentication flows, session generation, evaluation rubric generation, and fallback engines:

```bash
cd backend
npm test
```

To run frontend linting and production build:
```bash
cd client
npm run lint
npm run build
```

---

## 🔑 Default Demo Credentials

For local development, the database auto-seeds a demo account on initial startup. The demo account is not created in production:
- **Email**: `testuser@gmail.com`
- **Password**: `testpassword@1234`

---

## 📡 Core API Endpoints

| Category | Method | Endpoint | Description |
| :--- | :--- | :--- | :--- |
| **Auth** | `POST` | `/api/auth/register` | Register new user & dispatch OTP |
| **Auth** | `POST` | `/api/auth/verify-otp` | Verify OTP code & activate account |
| **Auth** | `POST` | `/api/auth/login` | Authenticate & retrieve JWT token |
| **Auth** | `GET` | `/api/auth/me` | Fetch active profile |
| **Sessions** | `GET` | `/api/sessions/roles` | List available engineering roles |
| **Sessions** | `GET` | `/api/sessions/config` | Retrieve session difficulties & volumes |
| **Sessions** | `POST` | `/api/sessions/start` | Start practice session & generate questions |
| **Sessions** | `POST` | `/api/sessions/:id/submit` | Submit answers & receive evaluation |
| **Interview** | `POST` | `/api/interview/start` | Launch live AI interview round |
| **Interview** | `POST` | `/api/interview/:id/respond` | Submit verbal/typed answer & receive follow-up |
| **Interview** | `POST` | `/api/interview/:id/finish` | Conclude interview & receive full rubric score |
| **Companies** | `GET` | `/api/companies` | List company tracks and roles |
| **Payments** | `POST` | `/api/payments/create-order` | Initiate Razorpay order |
| **Payments** | `POST` | `/api/payments/verify` | Verify signature and activate premium |

---

## 👤 Author

Developed by **Aditya Singh**  
- **Email**: [sadityasingh7990@gmail.com](mailto:sadityasingh7990@gmail.com)  
- **GitHub**: [@adisingh0824](https://github.com/adisingh0824)

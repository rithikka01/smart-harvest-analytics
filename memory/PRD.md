# AgriSmart / Smart Harvest Analytics — PRD

## Original problem statement
Help farmers monitor their farm in real time, predict crop health and yield, and make data-driven decisions using IoT sensors, weather data and AI/ML. UI must be simple, visual, multilingual (EN/HI/TA/TE/ML) and usable by non-technical farmers. Requirements A–Q (June 2026 upgrade request): farm wizard + multi-farm, 5-sensor dashboard with honest data-source labelling, weather, real ML (inspect first), smart tools (crop reco, yield, irrigation, NPK), farm-aware chatbot, voice with fallback, analytics + PDF, schemes, multilingual UI, roles, PWA, security, GitHub/Vercel readiness.

## Users
Farmer (primary), Individual, Agricultural Officer (read all farms), Admin (users/stats).

## Architecture
React 19 (CRA) + FastAPI + MongoDB; Firebase RTDB for IoT (read via service account); weatherapi.com; Gemini 3 Flash + OpenAI Whisper/TTS-1 via Emergent LLM key; scikit-learn models in backend.

## Verified ML facts (do not invent)
- `crop_yield_model.pkl`: RandomForestRegressor, 200 trees, 17 features, target `water_usage_efficiency`. Test R² ≈ -0.05, RMSE 1.15 → no predictive power; used only as a "factor". Health/yield are rule-based.
- `crop_recommendation_model.pkl` (added 2026-06): RandomForestClassifier, 200 trees, features temperature/humidity/ph/rainfall → 22 crops, dataset 2,200 rows, held-out accuracy 0.9568, macro-F1 0.9561.

## Integration truth
- Firebase: service account (project smart-harvest-a9436) is rejected by Google (invalid_grant) and DB URL is for project smart-harvest-analytics-8c1ec → NOT connected. All sensor readings are SIMULATED and labelled so. Code is Firebase-ready (env FIREBASE_DATABASE_URL, FIREBASE_CREDENTIALS_PATH/JSON).
- Weather: live (key configured). AI chat/voice: live via Emergent key. Google OAuth: not implemented.

## Implemented (2026-06 upgrade)
- 401 interceptor → auto logout; roles in register/login/me; /auth/language
- Farms CRUD (+ soil_type, water_source, season, area_unit), 3-step wizard with GPS, FarmContext + switcher on all pages, manage farms in Settings
- Sensors endpoint returns source/metric_status/status/timestamp; history endpoint (real or simulated); computed alerts endpoint
- Crop recommendation endpoint + autofill; irrigation (Water Now/Wait/Not needed + litres); fertilizer NPK rating + Gemini advice
- Chatbot with farm/sensor/weather context, Mongo history, quick questions (5 langs), TTS endpoint, Whisper with language hint; frontend Web Speech fallback
- Analytics page (5 charts, 24h/7d) + PDF report (ReportLab)
- Schemes: added PMKSY, MSP; softened unverifiable numbers
- i18n (react-i18next) EN/HI/TA/TE/ML; language selector on Login & Settings
- PWA: SW v3 (network-first API cache for offline last-synced data), PNG icons
- Security: JWT_SECRET required, Firebase URL from env, firebase_config.json untracked + ignored, .env.example files, CORS env
- Docs: README (setup, env, Firebase structure, Vercel + backend host deployment), backend Dockerfile, frontend vercel.json

## Backlog
- P1: GPS map view (Leaflet), push notifications, sensor-history retention job when Firebase goes live
- P2: Officer/admin UI pages (endpoints exist: /api/officer/farms, /api/admin/users, /api/admin/stats), PDF in regional languages (needs Unicode fonts)

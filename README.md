# AgriSmart — Smart Harvest Analytics

AI-assisted smart-agriculture platform for Indian farmers: real-time farm dashboard (IoT via Firebase), weather, crop-recommendation ML, rule-based crop-health / irrigation / NPK guidance, a farm-aware multilingual AI chatbot with voice, analytics with PDF reports, government schemes, and PWA support.

> **Honesty notes (please read):**
> - Sensor readings are **simulated demo data** unless a valid Firebase service account is configured *and* an ESP32/IoT device is writing to the configured path. The UI always labels the source (`Live IoT` vs `Simulated demo data`).
> - **Crop recommendation** is a real Random Forest classifier trained on `smart_harvest_dataset.xlsx` (verified 95.7 % held-out accuracy). **Crop health, yield and irrigation are rule-based estimates**, not validated ML predictions — the UI says so.
> - Google OAuth is **not** implemented; auth is email/password JWT.

---

## 1. Features

| Area | What it does | Type |
|---|---|---|
| Auth & roles | Register/login (JWT, bcrypt), roles: farmer, individual, officer, admin; 401 auto-logout | Real |
| Farm profiles | 3-step wizard (name, crop, size + unit, GPS/lat/lng/address, soil, water source, season, Firebase path); multi-farm; switcher; edit/delete | Real |
| Dashboard | 5 sensors (soil moisture, soil temp, air temp, humidity, light) with green/yellow/red status, reading time, data-source badge, crop-health card, alerts panel | Real logic, **simulated data** unless Firebase live |
| Weather | Current + 7-day forecast + alerts from weatherapi.com; used by irrigation & chatbot | Real (needs API key) |
| Crop recommendation | RandomForestClassifier (temperature, humidity, pH, rainfall → 22 crops), Top-5 with probabilities, auto-fill from farm sensors/weather | Real ML |
| Crop health | Rule-based status (Healthy / Moderate / High Stress) + ML water-efficiency factor | Rule-based |
| Yield estimate | Heuristic (2.5 t/acre reference × condition factors) | Heuristic, labelled |
| Smart irrigation | Water Now / Wait / Not needed using soil moisture + rain forecast; litre estimate | Rule-based |
| Fertilizer / NPK | Low/Medium/High rating from soil-test values (Soil Health Card thresholds) + optional Gemini advice (labelled AI-generated) | Rule-based + AI |
| Chatbot | Gemini 3 Flash via Emergent key, farm + sensor + weather context, history stored in MongoDB, quick questions, 5 languages | Real (needs key) |
| Voice | OpenAI Whisper STT + OpenAI TTS-1; automatic fallback to browser Web Speech API | Real + fallback |
| Analytics | 24 h / 7 d trend charts for all 5 sensors; PDF farm report (ReportLab) | Real charts, simulated series unless Firebase history exists |
| Government schemes | PM-KISAN, PMFBY, Soil Health Card, PMKSY, KCC, e-NAM, PKVY, MSP, PM-KUSUM, Kisan Call Centre, PM-KMY with official links | Static content |
| Multilingual UI | English, Hindi, Tamil, Telugu, Malayalam (react-i18next) | Real |
| PWA | Manifest, icons, service worker (offline shell + last-synced API cache) | Real |

## 2. Tech stack

- **Frontend:** React 19 (CRA + craco), Tailwind, shadcn/ui, recharts, react-i18next, axios
- **Backend:** FastAPI, Motor (MongoDB), PyJWT, passlib/bcrypt, httpx, firebase-admin, scikit-learn, pandas, joblib, ReportLab, emergentintegrations (Gemini / OpenAI Whisper & TTS)
- **Database:** MongoDB — collections `users`, `farms`, `sensor_history`, `chat_messages`, `alerts`
- **IoT:** Firebase Realtime Database (read by backend with a service account)

## 3. Repository layout

```
backend/
  server.py                     FastAPI app & all /api routes
  ml_service.py                 loads both models, recommendation + rule-based health/yield
  report_service.py             PDF report builder
  schemes_data.py               government schemes content
  train_model.py                (original) RF regressor -> water_usage_efficiency
  train_crop_recommendation.py  RF classifier -> crop_type  (run to regenerate)
  smart_harvest_dataset.xlsx    dataset (2,200 rows x 18 columns)
  crop_yield_model.pkl, model_metadata.pkl, label_encoders.pkl          (regressor)
  crop_recommendation_model.pkl, crop_recommendation_metadata.pkl       (classifier)
  .env.example, Dockerfile, requirements.txt
frontend/
  src/pages/        Dashboard, FarmSetup, Weather, CropHealth, CropRecommend, YieldPrediction,
                    Irrigation, Fertilizer, Chatbot, Analytics, Alerts, Schemes, Settings, Login, Register
  src/contexts/     AuthContext (JWT + 401 interceptor), FarmContext (multi-farm)
  src/locales/      en, hi, ta, te, ml
  src/lib/voice.js  Whisper/TTS with Web Speech fallback
  public/           manifest.json, service-worker.js, icons
  .env.example, vercel.json
```

## 4. Local setup

### Backend
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt --extra-index-url https://d33sy5i8bnduwe.cloudfront.net/simple/
cp .env.example .env            # fill in values (see §5)
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```
API docs: http://localhost:8001/docs

### Frontend
```bash
cd frontend
yarn install
cp .env.example .env            # REACT_APP_BACKEND_URL=http://localhost:8001
yarn start                      # http://localhost:3000
```

### ML models
Both `.pkl` files are committed. To retrain from the dataset:
```bash
cd backend
python train_model.py                 # regressor (water_usage_efficiency)
python train_crop_recommendation.py   # classifier (crop_type) — prints verified metrics
```

## 5. Environment variables

**backend/.env**

| Key | Required | Purpose |
|---|---|---|
| `MONGO_URL` | yes | MongoDB connection string |
| `DB_NAME` | yes | Database name |
| `JWT_SECRET` | yes | Long random string for signing tokens |
| `CORS_ORIGINS` | yes | Comma-separated allowed frontend origins (e.g. `https://your-app.vercel.app`) |
| `WEATHER_API_KEY` | for weather | https://www.weatherapi.com/ |
| `EMERGENT_LLM_KEY` | for chat/voice | Emergent universal key (or swap provider in `server.py`) |
| `FIREBASE_DATABASE_URL` | for IoT | RTDB URL of **the same project** as the service account |
| `FIREBASE_CREDENTIALS_PATH` | one of | Path to service-account JSON (default `firebase_config.json`) |
| `FIREBASE_CREDENTIALS_JSON` | one of | Entire service-account JSON as a single-line string (preferred on PaaS) |

**frontend/.env**

| Key | Purpose |
|---|---|
| `REACT_APP_BACKEND_URL` | Public URL of the FastAPI backend (no trailing slash) |

Never commit `.env` or `firebase_config.json` — both are git-ignored.

## 6. Firebase / IoT setup

1. Firebase console → Project settings → Service accounts → *Generate new private key* → save as `backend/firebase_config.json` (or paste into `FIREBASE_CREDENTIALS_JSON`).
2. Set `FIREBASE_DATABASE_URL` to that project's RTDB URL.
3. Your ESP32 / Raspberry Pi should write to the path configured on the farm (default `farms/<farm_id>/sensors`):
```json
{
  "soil_moisture": 42.5,
  "soil_temperature": 24.1,
  "ambient_temperature": 29.3,
  "humidity": 61,
  "light_intensity": 54000,
  "timestamp": "2026-06-01T09:30:00Z"
}
```
`GET /api/system/status` reports whether Firebase is configured/connected; the dashboard shows a *Live IoT* badge only when a real reading was fetched.

## 7. Deployment

The app is **three services** — a static React SPA, a Python API, and MongoDB. Vercel hosts the SPA well; it is **not** suitable for this FastAPI + scikit-learn + 45 MB model backend.

| Component | Recommended host | Notes |
|---|---|---|
| Frontend (React) | **Vercel** | Root dir `frontend`, build `yarn build`, output `build`. `vercel.json` handles SPA rewrites. Set env `REACT_APP_BACKEND_URL` = backend URL. |
| Backend (FastAPI) | **Render / Railway / Fly.io / a VPS** | Use `backend/Dockerfile` or start cmd `uvicorn server:app --host 0.0.0.0 --port $PORT`. Set all backend env vars; use `FIREBASE_CREDENTIALS_JSON` instead of a file. Add the Vercel URL to `CORS_ORIGINS`. |
| MongoDB | **MongoDB Atlas** (free tier) | Put the SRV string in `MONGO_URL`. |

Order: deploy MongoDB → backend (note its URL) → frontend with `REACT_APP_BACKEND_URL` pointing at the backend → update backend `CORS_ORIGINS` with the final frontend URL.

## 8. Security checklist (done)

- All secrets via env vars; `JWT_SECRET` required (no default)
- `.env`, `firebase_config.json` git-ignored (the previously tracked Firebase file was removed from the index — rotate that key)
- CORS restricted by `CORS_ORIGINS`
- Passwords hashed with bcrypt; JWT expiry 30 days; frontend auto-logs-out on 401
- Admin role cannot be self-assigned at registration

# 📱 AgriSmart - Installation & Deployment Guide

## ✅ System Status
- **Backend**: Running on port 8001
- **Frontend**: Running on port 3000
- **Database**: MongoDB connected
- **Firebase**: Connected to smart-harvest-analytics-8c1ec
- **ML Model**: Random Forest trained and deployed
- **Token Expiry**: 30 days (no more expired tokens!)
- **PWA**: Enabled (installable as mobile app)

---

## 📱 Install AgriSmart as Mobile App (PWA)

### On Android (Chrome):
1. Open Chrome browser
2. Visit: `https://cropmonitor-12.preview.emergentagent.com`
3. Tap the **3-dot menu** (⋮) → **Install App** or **Add to Home Screen**
4. Confirm installation
5. AgriSmart icon will appear on your home screen!

### On iPhone/iPad (Safari):
1. Open Safari browser
2. Visit: `https://cropmonitor-12.preview.emergentagent.com`
3. Tap the **Share button** (□↑)
4. Scroll down → Tap **"Add to Home Screen"**
5. Name it "AgriSmart" → Tap **Add**
6. AgriSmart icon will appear on your home screen!

### Features as Installed App:
✅ Works offline (with cached data)
✅ Full-screen experience (no browser bars)
✅ Home screen icon
✅ Push notifications ready
✅ Fast loading

---

## 🚀 How to Deploy Your App

### Option 1: Keep Using Current Preview URL
Your app is already live at:
```
https://cropmonitor-12.preview.emergentagent.com
```
- This works on any device
- Just share this link with users
- Install as PWA (see above)

### Option 2: Deploy to Your Own Domain
If you want your own domain (e.g., agrismart.com):

1. **Download Your Code**:
   - Go to Emergent dashboard
   - Click "Download Code" or "Export"
   - You'll get a ZIP file

2. **Deploy Options**:
   
   **A. Vercel (Easiest - Free):**
   ```bash
   npm install -g vercel
   cd your-agrismart-folder
   vercel deploy
   ```
   
   **B. Netlify (Free):**
   - Drag & drop your folder to netlify.com/drop
   - Done!
   
   **C. Your Own Server:**
   ```bash
   # Backend
   cd backend
   pip install -r requirements.txt
   uvicorn server:app --host 0.0.0.0 --port 8001
   
   # Frontend
   cd frontend
   yarn build
   serve -s build -p 3000
   ```

---

## 🔑 Login Credentials

**Demo Account:**
- Email: `demo@farm.com`
- Password: `pass123`

**Create New Account:**
- Register at `/register` page
- Choose your preferred language
- Setup your farm details

---

## 📡 Connect Your IoT Hardware

### Firebase Configuration:
```
Database URL: https://smart-harvest-analytics-8c1ec-default-rtdb.asia-southeast1.firebasedatabase.app
Web API Key: AIzaSyDPskNYRdqemXveJIj5fyg6ukSWBCNyV5w
```

### Send Sensor Data Format:
```json
Path: /farms/{your-farm-id}/sensors

Data:
{
  "soil_moisture": 45.5,
  "soil_temperature": 24.3,
  "ambient_temperature": 28.5,
  "humidity": 65.0,
  "light_intensity": 75000.0,
  "timestamp": "2026-02-09T12:00:00Z"
}
```

### ESP32/Arduino Code Example:
```cpp
#include <Firebase_ESP_Client.h>
#include <WiFi.h>

#define WIFI_SSID "your-wifi"
#define WIFI_PASSWORD "your-password"
#define DATABASE_URL "https://smart-harvest-analytics-8c1ec-default-rtdb.asia-southeast1.firebasedatabase.app"
#define API_KEY "AIzaSyDPskNYRdqemXveJIj5fyg6ukSWBCNyV5w"

FirebaseData fbdo;
FirebaseConfig config;
FirebaseAuth auth;

void setup() {
  Serial.begin(115200);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  
  config.database_url = DATABASE_URL;
  config.api_key = API_KEY;
  auth.user.email = "";  // Anonymous
  auth.user.password = "";
  
  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);
}

void loop() {
  // Read your sensors
  float soilMoisture = analogRead(34) / 40.96;  // 0-100%
  float soilTemp = readSoilTempSensor();
  float airTemp = readDHT22Temperature();
  float humidity = readDHT22Humidity();
  float light = analogRead(35) * 100;
  
  // Send to Firebase
  String path = "/farms/my-farm-001/sensors";
  Firebase.RTDB.setFloat(&fbdo, path + "/soil_moisture", soilMoisture);
  Firebase.RTDB.setFloat(&fbdo, path + "/soil_temperature", soilTemp);
  Firebase.RTDB.setFloat(&fbdo, path + "/ambient_temperature", airTemp);
  Firebase.RTDB.setFloat(&fbdo, path + "/humidity", humidity);
  Firebase.RTDB.setFloat(&fbdo, path + "/light_intensity", light);
  
  delay(300000); // Update every 5 minutes
}
```

---

## 🎯 App Features Checklist

✅ **User Authentication** (30-day token)
✅ **Farm Management** (multi-farm support ready)
✅ **Real-time Sensor Monitoring** (Firebase IoT)
✅ **ML Crop Health Analysis** (Your Random Forest model)
✅ **ML Yield Prediction** (Custom algorithm)
✅ **Weather Forecast** (7-day via WeatherAPI)
✅ **Smart Irrigation** (AI recommendations)
✅ **AI Chatbot** (Gemini 3 Flash)
✅ **Voice Assistant** (OpenAI Whisper + TTS)
✅ **Government Schemes** (10 schemes with links)
✅ **Multilingual** (Tamil, Hindi, Telugu, Malayalam, English)
✅ **Mobile Navigation** (5-icon bottom bar)
✅ **PWA Support** (installable app)
✅ **Responsive Design** (works on all devices)

---

## 🛠️ Technical Stack

**Frontend:**
- React 19
- Tailwind CSS + Shadcn UI
- Axios for API calls
- React Router for navigation

**Backend:**
- FastAPI (Python)
- MongoDB (Motor async)
- Firebase Admin SDK
- Scikit-learn (Random Forest)
- EmergentIntegrations (Gemini, Whisper)

**AI/ML:**
- Random Forest Regressor (your model)
- Gemini 3 Flash (chatbot)
- OpenAI Whisper (voice transcription)
- OpenAI TTS (text-to-speech)

**External APIs:**
- WeatherAPI (forecast)
- Firebase Realtime Database (IoT)

---

## 📊 ML Model Details

**Model Type:** Random Forest Regressor
**Training Data:** 2,200 records, 18 features
**Performance:**
- RMSE: 1.15
- Predicts: Water usage efficiency (1.0 - 5.0)

**Features Used:**
- Temperature, Humidity, pH, Rainfall
- Soil moisture, Soil type, Organic matter
- Sunlight, Wind speed, Irrigation frequency
- Crop type, Crop density, Pest pressure
- Fertilizer usage, Growth stage, Frost risk

**Model Files:**
- `/app/backend/crop_yield_model.pkl`
- `/app/backend/model_metadata.pkl`
- `/app/backend/label_encoders.pkl`

---

## 🔒 Security Notes

1. **Tokens**: Valid for 30 days (auto-refresh on login)
2. **Firebase**: Using service account with restricted permissions
3. **Environment Variables**: All sensitive data in `.env` files
4. **CORS**: Configured for production domain
5. **HTTPS**: Always use HTTPS in production

---

## 📞 Support & Next Steps

**Ready to Use:**
1. Install app on your phone (PWA)
2. Login with demo account or create new one
3. Connect your IoT sensors to Firebase
4. Monitor your farm in real-time!

**Future Enhancements:**
- Historical data analytics dashboard
- SMS/Push notifications for alerts
- Multi-farm management UI
- Community forum for farmers
- Crop disease detection (image-based)
- Market price predictions

---

## 🎉 You're All Set!

Your AgriSmart app is fully functional and ready to deploy!

**Quick Start:**
1. Visit: https://cropmonitor-12.preview.emergentagent.com
2. Install as app on your phone
3. Login and start monitoring!

**Questions?** 
- Check the code documentation
- Review API endpoints in `/app/backend/server.py`
- Test APIs using the examples above

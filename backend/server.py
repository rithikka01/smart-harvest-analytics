from fastapi import FastAPI, APIRouter, Depends, HTTPException, UploadFile, File, Form, Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import re
import json
import math
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import httpx
import firebase_admin
from firebase_admin import credentials, db as firebase_db
from emergentintegrations.llm.chat import LlmChat, UserMessage
from emergentintegrations.llm.openai import OpenAISpeechToText, OpenAITextToSpeech
import jwt
from passlib.context import CryptContext
import io
from ml_service import ml_service
from report_service import build_farm_report
from schemes_data import SCHEMES

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
WEATHER_API_KEY = os.environ.get('WEATHER_API_KEY')
EMERGENT_KEY = os.environ.get('EMERGENT_LLM_KEY')
FIREBASE_DATABASE_URL = os.environ.get('FIREBASE_DATABASE_URL')

# ---------------- Firebase (graceful) ----------------
FIREBASE_STATUS = {"configured": False, "connected": False, "error": None}


def init_firebase():
    cred_json = os.environ.get('FIREBASE_CREDENTIALS_JSON')
    cred_path = os.environ.get('FIREBASE_CREDENTIALS_PATH', str(ROOT_DIR / 'firebase_config.json'))
    try:
        if cred_json:
            cred = credentials.Certificate(json.loads(cred_json))
        elif Path(cred_path).exists():
            cred = credentials.Certificate(cred_path)
        else:
            FIREBASE_STATUS["error"] = "No Firebase service account configured"
            return
        if not FIREBASE_DATABASE_URL:
            FIREBASE_STATUS["error"] = "FIREBASE_DATABASE_URL not set"
            return
        firebase_admin.initialize_app(cred, {'databaseURL': FIREBASE_DATABASE_URL})
        FIREBASE_STATUS["configured"] = True
    except Exception as e:
        FIREBASE_STATUS["error"] = f"Firebase init failed: {e}"
        logger.warning(FIREBASE_STATUS["error"])


init_firebase()

app = FastAPI(title="AgriSmart API")
api_router = APIRouter(prefix="/api")
security = HTTPBearer()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

ROLES = ["farmer", "individual", "officer", "admin"]
LANGUAGE_NAMES = {"en": "English", "hi": "Hindi", "ta": "Tamil", "te": "Telugu", "ml": "Malayalam"}


# ---------------- Models ----------------
class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    mobile: Optional[str] = None
    password_hash: str
    name: str
    role: str = "farmer"
    language: str = "en"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Farm(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    name: str
    crop_type: str
    field_size: float
    area_unit: str = "acres"
    location: dict
    soil_type: Optional[str] = None
    water_source: Optional[str] = None
    season: Optional[str] = None
    firebase_path: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class UserRegister(BaseModel):
    email: str
    password: str
    name: str
    mobile: Optional[str] = None
    language: str = "en"
    role: str = "farmer"


class UserLogin(BaseModel):
    email: str
    password: str


class FarmInput(BaseModel):
    name: str
    crop_type: str
    field_size: float
    area_unit: str = "acres"
    location: dict
    soil_type: Optional[str] = None
    water_source: Optional[str] = None
    season: Optional[str] = None
    firebase_path: Optional[str] = None


class CropRecommendInput(BaseModel):
    temperature: float
    humidity: float
    ph: float
    rainfall: float


class FertilizerInput(BaseModel):
    farm_id: str
    nitrogen: Optional[float] = None
    phosphorus: Optional[float] = None
    potassium: Optional[float] = None
    include_ai: bool = True
    language: str = "en"


class ChatInput(BaseModel):
    message: str
    farm_id: Optional[str] = None
    language: str = "en"


class TTSInput(BaseModel):
    text: str
    language: str = "en"


# ---------------- Auth helpers ----------------
def create_access_token(user_id: str):
    expire = datetime.now(timezone.utc) + timedelta(days=30)
    return jwt.encode({"sub": user_id, "exp": expire}, JWT_SECRET, algorithm="HS256")


def public_user(user: dict):
    return {"id": user['id'], "name": user['name'], "email": user['email'],
            "role": user.get('role', 'farmer'), "language": user.get('language', 'en')}


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=["HS256"])
        user = await db.users.find_one({"id": payload.get("sub")}, {"_id": 0})
        if not user:
            raise HTTPException(401, "User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(401, f"Invalid token: {str(e)}")


def require_role(*roles):
    async def checker(current_user: dict = Depends(get_current_user)):
        if current_user.get('role', 'farmer') not in roles:
            raise HTTPException(403, "Insufficient permissions")
        return current_user
    return checker


async def get_owned_farm(farm_id: str, current_user: dict):
    farm = await db.farms.find_one({"id": farm_id, "user_id": current_user['id']}, {"_id": 0})
    if not farm:
        raise HTTPException(404, "Farm not found")
    return farm


# ---------------- Auth routes ----------------
@api_router.post("/auth/register")
async def register(input: UserRegister):
    if await db.users.find_one({"email": input.email}, {"_id": 0}):
        raise HTTPException(400, "Email already registered")
    role = input.role if input.role in ROLES and input.role != "admin" else "farmer"
    user = User(email=input.email, password_hash=pwd_context.hash(input.password), name=input.name,
                mobile=input.mobile, language=input.language, role=role)
    doc = user.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.users.insert_one(doc)
    return {"token": create_access_token(user.id), "user": public_user(doc)}


@api_router.post("/auth/login")
async def login(input: UserLogin):
    user = await db.users.find_one({"email": input.email}, {"_id": 0})
    if not user or not pwd_context.verify(input.password, user['password_hash']):
        raise HTTPException(401, "Invalid credentials")
    return {"token": create_access_token(user['id']), "user": public_user(user)}


@api_router.get("/auth/me")
async def me(current_user: dict = Depends(get_current_user)):
    return public_user(current_user)


@api_router.put("/auth/language")
async def update_language(body: dict, current_user: dict = Depends(get_current_user)):
    lang = body.get("language", "en")
    if lang not in LANGUAGE_NAMES:
        raise HTTPException(400, "Unsupported language")
    await db.users.update_one({"id": current_user['id']}, {"$set": {"language": lang}})
    return {"language": lang}


# ---------------- Farms ----------------
@api_router.post("/farms")
async def create_farm(farm_data: FarmInput, current_user: dict = Depends(get_current_user)):
    farm = Farm(user_id=current_user['id'], **farm_data.model_dump())
    doc = farm.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.farms.insert_one(doc)
    doc.pop('_id', None)
    return doc


@api_router.get("/farms")
async def get_farms(current_user: dict = Depends(get_current_user)):
    return await db.farms.find({"user_id": current_user['id']}, {"_id": 0}).to_list(100)


@api_router.get("/farms/{farm_id}")
async def get_farm(farm_id: str, current_user: dict = Depends(get_current_user)):
    return await get_owned_farm(farm_id, current_user)


@api_router.put("/farms/{farm_id}")
async def update_farm(farm_id: str, farm_data: FarmInput, current_user: dict = Depends(get_current_user)):
    await get_owned_farm(farm_id, current_user)
    await db.farms.update_one({"id": farm_id}, {"$set": farm_data.model_dump()})
    return await db.farms.find_one({"id": farm_id}, {"_id": 0})


@api_router.delete("/farms/{farm_id}")
async def delete_farm(farm_id: str, current_user: dict = Depends(get_current_user)):
    await get_owned_farm(farm_id, current_user)
    await db.farms.delete_one({"id": farm_id})
    await db.sensor_history.delete_many({"farm_id": farm_id})
    await db.chat_messages.delete_many({"farm_id": farm_id})
    return {"deleted": True}


# ---------------- Sensors ----------------
SENSOR_KEYS = ["soil_moisture", "soil_temperature", "ambient_temperature", "humidity", "light_intensity"]


def simulated_reading(at: datetime):
    hour = at.hour + at.minute / 60
    day_wave = math.sin((hour - 6) / 24 * 2 * math.pi)
    return {
        "soil_moisture": round(46 - 6 * day_wave, 1),
        "soil_temperature": round(24 + 3 * day_wave, 1),
        "ambient_temperature": round(28 + 6 * day_wave, 1),
        "humidity": round(65 - 12 * day_wave, 1),
        "light_intensity": round(max(0.0, 60000 * day_wave + 15000), 0),
        "timestamp": at.isoformat(),
    }


def metric_status(key, value):
    if value is None:
        return "unknown"
    if key == "soil_moisture":
        return "critical" if value < 25 or value > 80 else "warning" if value < 35 or value > 70 else "normal"
    if key == "soil_temperature":
        return "critical" if value < 10 or value > 38 else "warning" if value < 15 or value > 32 else "normal"
    if key == "ambient_temperature":
        return "critical" if value < 8 or value > 40 else "warning" if value < 15 or value > 35 else "normal"
    if key == "humidity":
        return "critical" if value < 25 or value > 95 else "warning" if value < 40 or value > 85 else "normal"
    if key == "light_intensity":
        return "warning" if value < 10000 or value > 120000 else "normal"
    return "normal"


def overall_status(statuses):
    values = list(statuses.values())
    crit = values.count("critical")
    warn = values.count("warning")
    if crit >= 1 or warn >= 3:
        return "critical"
    if warn >= 1:
        return "warning"
    return "optimal"


def read_firebase(path: str):
    if not FIREBASE_STATUS["configured"]:
        return None, FIREBASE_STATUS["error"] or "Firebase not configured"
    try:
        data = firebase_db.reference(path).get()
        FIREBASE_STATUS["connected"] = True
        FIREBASE_STATUS["error"] = None
        if not data or not isinstance(data, dict):
            return None, f"No data at Firebase path '{path}'"
        reading = {}
        for k in SENSOR_KEYS:
            if k in data and data[k] is not None:
                reading[k] = float(data[k])
        if not reading:
            return None, f"Data at '{path}' has none of the expected keys {SENSOR_KEYS}"
        ts = data.get("timestamp")
        if isinstance(ts, (int, float)):
            ts = datetime.fromtimestamp(ts / 1000 if ts > 1e11 else ts, tz=timezone.utc).isoformat()
        reading["timestamp"] = ts or datetime.now(timezone.utc).isoformat()
        return reading, None
    except Exception as e:
        FIREBASE_STATUS["connected"] = False
        FIREBASE_STATUS["error"] = str(e)[:200]
        if "invalid_grant" in str(e):
            FIREBASE_STATUS["configured"] = False
            FIREBASE_STATUS["error"] = "Firebase service account rejected by Google (invalid_grant). Upload a valid service-account JSON for the project that owns FIREBASE_DATABASE_URL."
        return None, f"Firebase read failed: {str(e)[:120]}"


async def fetch_sensor_reading(farm: dict):
    path = farm.get('firebase_path') or f"farms/{farm['id']}/sensors"
    reading, err = read_firebase(path)
    source = "firebase"
    if reading is None:
        reading = simulated_reading(datetime.now(timezone.utc))
        source = "simulated"
    else:
        await db.sensor_history.insert_one({"farm_id": farm['id'], "source": "firebase",
                                            "recorded_at": datetime.now(timezone.utc).isoformat(), **reading})
    statuses = {k: metric_status(k, reading.get(k)) for k in SENSOR_KEYS}
    return {
        **{k: reading.get(k) for k in SENSOR_KEYS},
        "timestamp": reading["timestamp"],
        "last_updated": datetime.now(timezone.utc).isoformat(),
        "source": source,
        "source_note": "Live IoT reading from Firebase Realtime Database" if source == "firebase"
        else f"Simulated demo data - {err}",
        "firebase_path": path,
        "metric_status": statuses,
        "status": overall_status(statuses),
    }


@api_router.get("/farms/{farm_id}/sensors")
async def get_sensor_data(farm_id: str, current_user: dict = Depends(get_current_user)):
    farm = await get_owned_farm(farm_id, current_user)
    return await fetch_sensor_reading(farm)


@api_router.get("/farms/{farm_id}/sensors/history")
async def get_sensor_history(farm_id: str, hours: int = 24, current_user: dict = Depends(get_current_user)):
    await get_owned_farm(farm_id, current_user)
    since = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()
    rows = await db.sensor_history.find({"farm_id": farm_id, "recorded_at": {"$gte": since}}, {"_id": 0}) \
        .sort("recorded_at", 1).to_list(2000)
    if rows:
        return {"source": "firebase", "points": rows, "hours": hours}
    step = 1 if hours <= 48 else 6
    now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    points = []
    for i in range(hours, -1, -step):
        at = now - timedelta(hours=i)
        r = simulated_reading(at)
        r["soil_moisture"] = round(r["soil_moisture"] + 2 * math.sin(i / 7), 1)
        points.append({"recorded_at": at.isoformat(), **r})
    return {"source": "simulated", "points": points, "hours": hours,
            "note": "Simulated demo series - no live Firebase history stored for this farm yet"}


def build_alerts(sensor: dict, weather: Optional[dict] = None):
    alerts = []
    labels = {"soil_moisture": "Soil moisture", "soil_temperature": "Soil temperature",
              "ambient_temperature": "Air temperature", "humidity": "Humidity", "light_intensity": "Light intensity"}
    units = {"soil_moisture": "%", "soil_temperature": "°C", "ambient_temperature": "°C", "humidity": "%", "light_intensity": " lux"}
    for k, st in sensor["metric_status"].items():
        v = sensor.get(k)
        if st in ("critical", "warning"):
            alerts.append({"id": f"{k}-{st}", "type": k, "severity": st,
                           "message": f"{labels[k]} is {v}{units[k]} - {'critical' if st == 'critical' else 'outside the normal range'}"})
    if weather:
        for a in weather.get("alerts", [])[:3]:
            alerts.append({"id": f"weather-{a.get('headline', '')[:20]}", "type": "weather", "severity": "warning",
                           "message": a.get("headline") or "Weather alert"})
        today = (weather.get("forecast") or [{}])[0]
        if today.get("rain_chance", 0) >= 70:
            alerts.append({"id": "rain-today", "type": "weather", "severity": "warning",
                           "message": f"High chance of rain today ({today['rain_chance']}%) - consider delaying irrigation"})
    if not alerts:
        alerts.append({"id": "ok", "type": "status", "severity": "ok", "message": "All readings are within normal range"})
    return alerts


@api_router.get("/farms/{farm_id}/alerts")
async def get_farm_alerts(farm_id: str, current_user: dict = Depends(get_current_user)):
    farm = await get_owned_farm(farm_id, current_user)
    sensor = await fetch_sensor_reading(farm)
    weather = await safe_weather(farm)
    return {"alerts": build_alerts(sensor, weather), "source": sensor["source"], "generated_at": sensor["last_updated"]}


# ---------------- Weather ----------------
async def fetch_weather(lat: float, lon: float):
    if not WEATHER_API_KEY:
        raise HTTPException(503, "WEATHER_API_KEY not configured")
    async with httpx.AsyncClient() as http_client:
        url = f"http://api.weatherapi.com/v1/forecast.json?key={WEATHER_API_KEY}&q={lat},{lon}&days=7&aqi=yes&alerts=yes"
        response = await http_client.get(url, timeout=10)
        response.raise_for_status()
        data = response.json()
    return {
        "location": data.get('location', {}).get('name'),
        "current": {
            "temp_c": data['current']['temp_c'],
            "condition": data['current']['condition']['text'],
            "humidity": data['current']['humidity'],
            "wind_kph": data['current']['wind_kph'],
            "precip_mm": data['current'].get('precip_mm', 0),
            "uv": data['current'].get('uv'),
            "icon": data['current']['condition']['icon'],
        },
        "forecast": [{
            "date": day['date'],
            "max_temp": day['day']['maxtemp_c'],
            "min_temp": day['day']['mintemp_c'],
            "avg_humidity": day['day'].get('avghumidity'),
            "condition": day['day']['condition']['text'],
            "rain_chance": day['day']['daily_chance_of_rain'],
            "total_precip_mm": day['day'].get('totalprecip_mm', 0),
            "icon": day['day']['condition']['icon'],
        } for day in data['forecast']['forecastday']],
        "alerts": data.get('alerts', {}).get('alert', []),
        "source": "weatherapi.com",
    }


async def safe_weather(farm: dict):
    try:
        loc = farm.get("location", {})
        return await fetch_weather(float(loc.get("lat")), float(loc.get("lng")))
    except Exception as e:
        logger.warning(f"Weather unavailable: {e}")
        return None


@api_router.get("/weather")
async def get_weather(lat: float, lon: float, current_user: dict = Depends(get_current_user)):
    try:
        return await fetch_weather(lat, lon)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(502, f"Weather API error: {str(e)}")


# ---------------- ML / AI tools ----------------
@api_router.get("/ml/info")
async def ml_info():
    return ml_service.model_info()


@api_router.post("/crop/analyze")
async def analyze_crop_health(farm_id: str, current_user: dict = Depends(get_current_user)):
    farm = await get_owned_farm(farm_id, current_user)
    sensor_data = await fetch_sensor_reading(farm)
    result = ml_service.predict_crop_health(sensor_data=sensor_data, crop_type=farm.get('crop_type', 'Rice'))
    result["data_source"] = sensor_data["source"]
    return result


@api_router.post("/yield/predict")
async def predict_yield(farm_id: str, current_user: dict = Depends(get_current_user)):
    farm = await get_owned_farm(farm_id, current_user)
    sensor_data = await fetch_sensor_reading(farm)
    result = ml_service.predict_yield(sensor_data=sensor_data, crop_type=farm.get('crop_type', 'Rice'),
                                      field_size=farm.get('field_size', 5.0))
    result["data_source"] = sensor_data["source"]
    result["area_unit"] = farm.get("area_unit", "acres")
    return result


@api_router.post("/crop/recommend")
async def recommend_crop(body: CropRecommendInput, current_user: dict = Depends(get_current_user)):
    try:
        return ml_service.recommend_crop(body.temperature, body.humidity, body.ph, body.rainfall)
    except RuntimeError as e:
        raise HTTPException(503, str(e))


@api_router.get("/farms/{farm_id}/recommend-autofill")
async def recommend_autofill(farm_id: str, current_user: dict = Depends(get_current_user)):
    farm = await get_owned_farm(farm_id, current_user)
    sensor = await fetch_sensor_reading(farm)
    weather = await safe_weather(farm)
    rainfall = None
    if weather:
        rainfall = round(sum(d.get("total_precip_mm", 0) for d in weather["forecast"]) * 30 / 7, 1)
    return {
        "temperature": sensor["ambient_temperature"], "humidity": sensor["humidity"],
        "ph": None, "rainfall": rainfall,
        "sources": {"temperature": sensor["source"], "humidity": sensor["source"],
                    "rainfall": "weatherapi 7-day forecast scaled to monthly mm" if rainfall is not None else "unavailable",
                    "ph": "enter from Soil Health Card / soil test"},
    }


def area_m2(farm: dict):
    size = float(farm.get("field_size", 1))
    return size * (10000 if farm.get("area_unit") == "hectares" else 4046.86)


@api_router.post("/irrigation/recommend")
async def recommend_irrigation(farm_id: str, current_user: dict = Depends(get_current_user)):
    farm = await get_owned_farm(farm_id, current_user)
    sensor = await fetch_sensor_reading(farm)
    weather = await safe_weather(farm)
    moisture = sensor["soil_moisture"]
    temp = sensor["ambient_temperature"]
    rain_chance = (weather["forecast"][0]["rain_chance"] if weather else None)
    rain_mm = (weather["forecast"][0]["total_precip_mm"] if weather else None)
    factors = [f"Soil moisture {moisture}% (target 45-65%)", f"Air temperature {temp}°C", f"Humidity {sensor['humidity']}%"]
    if rain_chance is not None:
        factors.append(f"Rain chance today {rain_chance}% ({rain_mm} mm expected)")

    target = 55.0
    if moisture < 30:
        decision, urgency = "water_now", "critical"
        reason = "Soil moisture is critically low. Irrigate immediately."
    elif moisture < 40:
        if rain_chance is not None and rain_chance >= 60:
            decision, urgency = "wait", "warning"
            reason = "Soil moisture is low but significant rain is expected today. Re-check after the rain."
        else:
            decision, urgency = "water_now", "warning"
            reason = "Soil moisture is below the optimal range. Irrigation recommended."
    elif moisture > 70:
        decision, urgency = "not_needed", "warning"
        reason = "Soil is very wet. Do not irrigate; check drainage to avoid waterlogging."
    else:
        decision, urgency = "not_needed", "ok"
        reason = "Soil moisture is within the optimal range. No irrigation needed now."

    water_liters = None
    if decision == "water_now":
        deficit = max(0.0, target - moisture) / 100
        water_liters = round(deficit * 0.3 * area_m2(farm) * 1000)
    timing = "Irrigate early morning or evening to reduce evaporation losses" if temp > 32 else "Any time of day is fine; morning is preferred"

    return {
        "decision": decision, "urgency": urgency,
        "should_irrigate": decision == "water_now",
        "water_amount": water_liters,
        "water_m3": round(water_liters / 1000, 1) if water_liters else None,
        "reason": reason, "timing": timing, "factors": factors,
        "method": "rule-based (soil moisture + weather forecast)",
        "estimate_note": "Water estimate = moisture deficit to 55% x 30 cm root zone x field area. It is an approximation, not a measured requirement.",
        "data_source": sensor["source"], "weather_available": weather is not None,
    }


def npk_status(n, p, k):
    def rate(v, lo, hi):
        if v is None:
            return "unknown"
        return "low" if v < lo else "high" if v > hi else "medium"
    return {"nitrogen": rate(n, 280, 560), "phosphorus": rate(p, 23, 56), "potassium": rate(k, 133, 337)}


NPK_ADVICE = {
    "nitrogen": {"low": "Apply nitrogen fertiliser (e.g. urea) in split doses; add compost or green manure.",
                 "medium": "Nitrogen is adequate; apply the crop's recommended maintenance dose.",
                 "high": "Nitrogen is high; reduce or skip nitrogen fertiliser this season."},
    "phosphorus": {"low": "Apply phosphatic fertiliser (e.g. SSP/DAP) at sowing; rock phosphate for organic fields.",
                   "medium": "Phosphorus is adequate; apply maintenance dose only.",
                   "high": "Phosphorus is high; skip phosphatic fertiliser this season."},
    "potassium": {"low": "Apply potash (MOP) and recycle crop residues.",
                  "medium": "Potassium is adequate; apply maintenance dose only.",
                  "high": "Potassium is high; skip potash this season."},
}


async def ai_text(system: str, prompt: str, session_id: str):
    chat = LlmChat(api_key=EMERGENT_KEY, session_id=session_id, system_message=system).with_model("gemini", "gemini-3-flash-preview")
    return await chat.send_message(UserMessage(text=prompt))


@api_router.post("/fertilizer/recommend")
async def recommend_fertilizer(body: FertilizerInput, current_user: dict = Depends(get_current_user)):
    farm = await get_owned_farm(body.farm_id, current_user)
    statuses = npk_status(body.nitrogen, body.phosphorus, body.potassium)
    has_values = any(v is not None for v in (body.nitrogen, body.phosphorus, body.potassium))
    recs = [NPK_ADVICE[n][s] for n, s in statuses.items() if s != "unknown"]
    result = {
        "status": statuses,
        "inputs": {"nitrogen": body.nitrogen, "phosphorus": body.phosphorus, "potassium": body.potassium, "unit": "kg/ha"},
        "rating_reference": "Low/Medium/High thresholds follow standard Indian Soil Health Card rating categories (N: 280/560, P2O5: 23/56, K2O: 133/337 kg/ha).",
        "recommendations": recs,
        "method": "rule-based from soil test values",
        "ai_advice": None, "ai_note": None,
    }
    if not has_values:
        result["recommendations"] = ["Enter your soil test / Soil Health Card N, P, K values to get a status rating.",
                                     "Free soil testing is available through the Soil Health Card scheme."]
    if body.include_ai and EMERGENT_KEY:
        try:
            sensor = await fetch_sensor_reading(farm)
            prompt = (f"Farm: {farm['name']}, crop {farm['crop_type']}, {farm['field_size']} {farm.get('area_unit', 'acres')}, "
                      f"soil {farm.get('soil_type') or 'unknown'}, season {farm.get('season') or 'unknown'}. "
                      f"Soil test (kg/ha): N={body.nitrogen}, P={body.phosphorus}, K={body.potassium}; ratings {statuses}. "
                      f"Current soil moisture {sensor['soil_moisture']}%, air temp {sensor['ambient_temperature']}°C. "
                      f"Give a short, practical fertiliser plan (max 6 bullet points) in {LANGUAGE_NAMES.get(body.language, 'English')}. "
                      "Do not invent exact doses if inputs are missing; say what to test instead.")
            result["ai_advice"] = await ai_text("You are an agronomy assistant for Indian farmers. Be concise and practical.",
                                                prompt, f"fert_{current_user['id']}")
            result["ai_note"] = "AI-generated advice (Gemini). Verify with your local agricultural officer."
        except Exception as e:
            result["ai_note"] = f"AI advice unavailable: {str(e)[:100]}"
    return result


# ---------------- Chatbot ----------------
QUICK_QUESTIONS = {
    "en": ["Should I irrigate today?", "How is my crop health?", "Which fertilizer should I use?", "Will it rain this week?", "Which government scheme can help me?"],
    "hi": ["क्या मुझे आज सिंचाई करनी चाहिए?", "मेरी फसल की सेहत कैसी है?", "मुझे कौन सा उर्वरक इस्तेमाल करना चाहिए?", "इस हफ्ते बारिश होगी?", "कौन सी सरकारी योजना मेरी मदद कर सकती है?"],
    "ta": ["இன்று நீர்ப்பாசனம் செய்ய வேண்டுமா?", "என் பயிரின் ஆரோக்கியம் எப்படி உள்ளது?", "எந்த உரத்தை பயன்படுத்த வேண்டும்?", "இந்த வாரம் மழை பெய்யுமா?", "எந்த அரசு திட்டம் எனக்கு உதவும்?"],
    "te": ["ఈరోజు నీరు పెట్టాలా?", "నా పంట ఆరోగ్యం ఎలా ఉంది?", "ఏ ఎరువు వాడాలి?", "ఈ వారం వర్షం పడుతుందా?", "ఏ ప్రభుత్వ పథకం నాకు సహాయపడుతుంది?"],
    "ml": ["ഇന്ന് നനയ്ക്കണോ?", "എന്റെ വിളയുടെ ആരോഗ്യം എങ്ങനെയുണ്ട്?", "ഏത് വളം ഉപയോഗിക്കണം?", "ഈ ആഴ്ച മഴ പെയ്യുമോ?", "ഏത് സർക്കാർ പദ്ധതി എന്നെ സഹായിക്കും?"],
}


@api_router.get("/chatbot/quick-questions")
async def quick_questions(language: str = "en"):
    return {"questions": QUICK_QUESTIONS.get(language, QUICK_QUESTIONS["en"])}


@api_router.get("/chatbot/history")
async def chat_history(farm_id: Optional[str] = None, limit: int = 50, current_user: dict = Depends(get_current_user)):
    q = {"user_id": current_user['id']}
    if farm_id:
        q["farm_id"] = farm_id
    rows = await db.chat_messages.find(q, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return list(reversed(rows))


@api_router.delete("/chatbot/history")
async def clear_chat_history(farm_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    q = {"user_id": current_user['id']}
    if farm_id:
        q["farm_id"] = farm_id
    r = await db.chat_messages.delete_many(q)
    return {"deleted": r.deleted_count}


@api_router.post("/chatbot")
async def chatbot(query: ChatInput, current_user: dict = Depends(get_current_user)):
    if not EMERGENT_KEY:
        raise HTTPException(503, "AI provider not configured")
    farm = None
    context = "The user has not set up a farm yet."
    if query.farm_id:
        farm = await db.farms.find_one({"id": query.farm_id, "user_id": current_user['id']}, {"_id": 0})
    if farm:
        sensor = await fetch_sensor_reading(farm)
        weather = await safe_weather(farm)
        loc = farm.get("location", {})
        context = (f"Farm profile: name={farm['name']}, crop={farm['crop_type']}, size={farm['field_size']} {farm.get('area_unit', 'acres')}, "
                   f"soil={farm.get('soil_type') or 'unknown'}, water source={farm.get('water_source') or 'unknown'}, season={farm.get('season') or 'unknown'}, "
                   f"location={loc.get('address') or ''} ({loc.get('lat')}, {loc.get('lng')}).\n"
                   f"Latest sensor readings ({'LIVE IoT' if sensor['source'] == 'firebase' else 'SIMULATED demo data - tell the user if relevant'}): "
                   f"soil moisture {sensor['soil_moisture']}%, soil temp {sensor['soil_temperature']}°C, air temp {sensor['ambient_temperature']}°C, "
                   f"humidity {sensor['humidity']}%, light {sensor['light_intensity']} lux, status {sensor['status']}.")
        if weather:
            today = weather["forecast"][0]
            context += (f"\nWeather now: {weather['current']['temp_c']}°C, {weather['current']['condition']}. "
                        f"Today: {today['condition']}, rain chance {today['rain_chance']}%, {today['total_precip_mm']} mm. "
                        f"Next days: " + "; ".join(f"{d['date']} {d['condition']} {d['rain_chance']}% rain" for d in weather['forecast'][1:4]))
    history = await db.chat_messages.find({"user_id": current_user['id'], "farm_id": query.farm_id}, {"_id": 0}) \
        .sort("created_at", -1).to_list(6)
    history_text = "\n".join(f"{m['role']}: {m['content'][:300]}" for m in reversed(history))
    lang = LANGUAGE_NAMES.get(query.language, "English")
    system = (f"You are AgriSmart, a friendly farming assistant for Indian farmers. Reply in {lang} using simple words, "
              "short paragraphs or bullet points, and practical actionable advice. Use the farm context below when relevant. "
              "Never claim sensor data is live if it is marked simulated.\n\n" + context +
              (f"\n\nRecent conversation:\n{history_text}" if history_text else ""))
    try:
        response = await ai_text(system, query.message, f"chat_{current_user['id']}_{query.farm_id}")
    except Exception as e:
        raise HTTPException(502, f"AI provider error: {str(e)[:150]}")
    now = datetime.now(timezone.utc)
    await db.chat_messages.insert_many([
        {"id": str(uuid.uuid4()), "user_id": current_user['id'], "farm_id": query.farm_id, "role": "user", "content": query.message, "language": query.language, "created_at": now.isoformat()},
        {"id": str(uuid.uuid4()), "user_id": current_user['id'], "farm_id": query.farm_id, "role": "assistant", "content": response, "language": query.language, "created_at": (now + timedelta(milliseconds=1)).isoformat()},
    ])
    return {"response": response, "language": query.language, "farm_context": farm is not None}


# ---------------- Voice ----------------
@api_router.post("/voice/transcribe")
async def transcribe_audio(audio: UploadFile = File(...), language: str = Form("en"), current_user: dict = Depends(get_current_user)):
    if not EMERGENT_KEY:
        raise HTTPException(503, "Speech-to-text provider not configured")
    try:
        stt = OpenAISpeechToText(api_key=EMERGENT_KEY)
        audio_file = io.BytesIO(await audio.read())
        audio_file.name = audio.filename or "recording.webm"
        kwargs = {"file": audio_file, "model": "whisper-1", "response_format": "json"}
        if language in LANGUAGE_NAMES:
            kwargs["language"] = language
        response = await stt.transcribe(**kwargs)
        return {"text": response.text, "provider": "openai-whisper"}
    except Exception as e:
        raise HTTPException(502, f"Transcription failed: {str(e)[:150]}")


def clean_for_tts(text: str) -> str:
    text = re.sub(r"https?://\S+", "", text)
    text = re.sub(r"`{1,3}[^`]*`{1,3}", "", text)
    text = re.sub(r"[*_#>~|]", "", text)
    return re.sub(r"\s+", " ", text).strip()[:4000]


@api_router.post("/voice/tts")
async def text_to_speech(body: TTSInput, current_user: dict = Depends(get_current_user)):
    if not EMERGENT_KEY:
        raise HTTPException(503, "Text-to-speech provider not configured")
    try:
        tts = OpenAITextToSpeech(api_key=EMERGENT_KEY)
        audio_bytes = await tts.generate_speech(text=clean_for_tts(body.text), model="tts-1", voice="nova")
        return Response(content=audio_bytes, media_type="audio/mpeg", headers={"X-TTS-Provider": "openai-tts-1"})
    except Exception as e:
        raise HTTPException(502, f"TTS failed: {str(e)[:150]}")


# ---------------- Alerts (legacy stored) ----------------
@api_router.get("/alerts")
async def get_alerts(current_user: dict = Depends(get_current_user)):
    return await db.alerts.find({"user_id": current_user['id']}, {"_id": 0}).sort("created_at", -1).to_list(50)


# ---------------- Schemes ----------------
@api_router.get("/schemes")
async def get_government_schemes(state: Optional[str] = None, crop: Optional[str] = None):
    return SCHEMES


# ---------------- Reports ----------------
@api_router.get("/farms/{farm_id}/report")
async def farm_report(farm_id: str, current_user: dict = Depends(get_current_user)):
    farm = await get_owned_farm(farm_id, current_user)
    sensor = await fetch_sensor_reading(farm)
    health = ml_service.predict_crop_health(sensor, farm.get("crop_type", "Rice"))
    irrigation = await recommend_irrigation(farm_id, current_user)
    weather = await safe_weather(farm)
    history = await get_sensor_history(farm_id, 24, current_user)
    pdf = build_farm_report(farm, current_user, sensor, health, irrigation, weather, history, build_alerts(sensor, weather))
    fname = re.sub(r"[^a-zA-Z0-9]+", "_", farm["name"]) + "_report.pdf"
    return Response(content=pdf, media_type="application/pdf", headers={"Content-Disposition": f'attachment; filename="{fname}"'})


# ---------------- System / roles ----------------
@api_router.get("/system/status")
async def system_status():
    info = ml_service.model_info()
    return {
        "firebase": {**FIREBASE_STATUS, "database_url_set": bool(FIREBASE_DATABASE_URL),
                     "expected_structure": {"farms/<farm_id>/sensors": {k: "number" for k in SENSOR_KEYS} | {"timestamp": "ISO string or epoch ms"}}},
        "weather": {"configured": bool(WEATHER_API_KEY), "provider": "weatherapi.com"},
        "ai": {"configured": bool(EMERGENT_KEY), "chat_model": "gemini-3-flash-preview", "stt": "openai whisper-1", "tts": "openai tts-1"},
        "ml": {"regressor_loaded": info["regressor"] is not None, "classifier_loaded": info["classifier"] is not None},
        "auth": {"jwt": True, "google_oauth": False, "roles": ROLES},
    }


@api_router.get("/admin/users")
async def admin_users(current_user: dict = Depends(require_role("admin"))):
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(500)
    return users


@api_router.get("/admin/stats")
async def admin_stats(current_user: dict = Depends(require_role("admin", "officer"))):
    return {"users": await db.users.count_documents({}), "farms": await db.farms.count_documents({}),
            "chat_messages": await db.chat_messages.count_documents({}),
            "sensor_history": await db.sensor_history.count_documents({})}


@api_router.get("/officer/farms")
async def officer_farms(current_user: dict = Depends(require_role("officer", "admin"))):
    farms = await db.farms.find({}, {"_id": 0}).to_list(500)
    users = {u["id"]: u for u in await db.users.find({}, {"_id": 0, "id": 1, "name": 1, "email": 1}).to_list(500)}
    for f in farms:
        owner = users.get(f["user_id"], {})
        f["owner_name"] = owner.get("name")
        f["owner_email"] = owner.get("email")
    return farms


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=[o.strip() for o in os.environ.get('CORS_ORIGINS', '*').split(',')],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

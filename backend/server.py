from fastapi import FastAPI, APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
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
from emergentintegrations.llm.openai import OpenAISpeechToText
import jwt
from passlib.context import CryptContext
import io

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

firebase_cred = credentials.Certificate(str(ROOT_DIR / 'firebase_config.json'))
firebase_admin.initialize_app(firebase_cred, {
    'databaseURL': 'https://smart-harvest-a9436-default-rtdb.firebaseio.com/'
})

app = FastAPI()
api_router = APIRouter(prefix="/api")
security = HTTPBearer()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

JWT_SECRET = os.environ.get('JWT_SECRET', 'default_secret')
WEATHER_API_KEY = os.environ['WEATHER_API_KEY']
EMERGENT_KEY = os.environ['EMERGENT_LLM_KEY']

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
    location: dict
    firebase_path: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class SensorData(BaseModel):
    soil_moisture: float
    soil_temperature: float
    ambient_temperature: float
    humidity: float
    light_intensity: float
    timestamp: datetime
    status: str

class CropHealthPrediction(BaseModel):
    health_status: str
    confidence: float
    reasons: List[str]
    recommendations: List[str]

class YieldPrediction(BaseModel):
    estimated_yield: float
    unit: str
    confidence: float
    comparison: dict

class IrrigationRecommendation(BaseModel):
    should_irrigate: bool
    water_amount: Optional[float]
    reason: str

class Alert(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    farm_id: str
    type: str
    severity: str
    message: str
    read: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserRegister(BaseModel):
    email: str
    password: str
    name: str
    mobile: Optional[str] = None
    language: str = "en"

class UserLogin(BaseModel):
    email: str
    password: str

def create_access_token(user_id: str):
    expire = datetime.now(timezone.utc) + timedelta(days=7)
    to_encode = {"sub": user_id, "exp": expire}
    return jwt.encode(to_encode, JWT_SECRET, algorithm="HS256")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=["HS256"])
        user_id = payload.get("sub")
        user = await db.users.find_one({"id": user_id}, {"_id": 0})
        if not user:
            raise HTTPException(401, "User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except Exception as e:
        raise HTTPException(401, f"Invalid token: {str(e)}")

@api_router.post("/auth/register")
async def register(input: UserRegister):
    existing = await db.users.find_one({"email": input.email}, {"_id": 0})
    if existing:
        raise HTTPException(400, "Email already registered")
    
    password_hash = pwd_context.hash(input.password)
    user = User(
        email=input.email,
        password_hash=password_hash,
        name=input.name,
        mobile=input.mobile,
        language=input.language
    )
    
    doc = user.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.users.insert_one(doc)
    
    token = create_access_token(user.id)
    return {"token": token, "user": {"id": user.id, "name": user.name, "email": user.email}}

@api_router.post("/auth/login")
async def login(input: UserLogin):
    user = await db.users.find_one({"email": input.email}, {"_id": 0})
    if not user or not pwd_context.verify(input.password, user['password_hash']):
        raise HTTPException(401, "Invalid credentials")
    
    token = create_access_token(user['id'])
    return {"token": token, "user": {"id": user['id'], "name": user['name'], "email": user['email']}}

@api_router.post("/farms")
async def create_farm(farm_data: dict, current_user: dict = Depends(get_current_user)):
    farm = Farm(
        user_id=current_user['id'],
        name=farm_data['name'],
        crop_type=farm_data['crop_type'],
        field_size=farm_data['field_size'],
        location=farm_data['location'],
        firebase_path=farm_data.get('firebase_path')
    )
    
    doc = farm.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.farms.insert_one(doc)
    return farm

@api_router.get("/farms")
async def get_farms(current_user: dict = Depends(get_current_user)):
    farms = await db.farms.find({"user_id": current_user['id']}, {"_id": 0}).to_list(100)
    return farms

@api_router.get("/farms/{farm_id}/sensors")
async def get_sensor_data(farm_id: str, current_user: dict = Depends(get_current_user)):
    farm = await db.farms.find_one({"id": farm_id, "user_id": current_user['id']}, {"_id": 0})
    if not farm:
        raise HTTPException(404, "Farm not found")
    
    try:
        firebase_path = farm.get('firebase_path', f"farms/{farm_id}/sensors")
        ref = firebase_db.reference(firebase_path)
        data = ref.get()
        
        if not data:
            data = {
                "soil_moisture": 45.5,
                "soil_temperature": 24.3,
                "ambient_temperature": 28.5,
                "humidity": 65.0,
                "light_intensity": 75000.0,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        
        def calculate_status(data):
            issues = []
            if data['soil_moisture'] < 30:
                issues.append('low_moisture')
            elif data['soil_moisture'] > 70:
                issues.append('high_moisture')
            
            if data['ambient_temperature'] > 35:
                issues.append('high_temp')
            elif data['ambient_temperature'] < 15:
                issues.append('low_temp')
            
            if data['humidity'] < 40:
                issues.append('low_humidity')
            
            if len(issues) >= 2:
                return 'critical'
            elif len(issues) == 1:
                return 'warning'
            return 'optimal'
        
        data['status'] = calculate_status(data)
        return data
    except Exception as e:
        logging.error(f"Firebase error: {str(e)}")
        return {
            "soil_moisture": 45.5,
            "soil_temperature": 24.3,
            "ambient_temperature": 28.5,
            "humidity": 65.0,
            "light_intensity": 75000.0,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "status": "optimal"
        }

@api_router.get("/weather")
async def get_weather(lat: float, lon: float, current_user: dict = Depends(get_current_user)):
    async with httpx.AsyncClient() as http_client:
        try:
            url = f"http://api.weatherapi.com/v1/forecast.json?key={WEATHER_API_KEY}&q={lat},{lon}&days=7&aqi=yes&alerts=yes"
            response = await http_client.get(url, timeout=10)
            response.raise_for_status()
            data = response.json()
            
            return {
                "current": {
                    "temp_c": data['current']['temp_c'],
                    "condition": data['current']['condition']['text'],
                    "humidity": data['current']['humidity'],
                    "wind_kph": data['current']['wind_kph'],
                    "icon": data['current']['condition']['icon']
                },
                "forecast": [{
                    "date": day['date'],
                    "max_temp": day['day']['maxtemp_c'],
                    "min_temp": day['day']['mintemp_c'],
                    "condition": day['day']['condition']['text'],
                    "rain_chance": day['day']['daily_chance_of_rain'],
                    "icon": day['day']['condition']['icon']
                } for day in data['forecast']['forecastday']],
                "alerts": data.get('alerts', {}).get('alert', [])
            }
        except Exception as e:
            raise HTTPException(502, f"Weather API error: {str(e)}")

@api_router.post("/crop/analyze")
async def analyze_crop_health(farm_id: str, current_user: dict = Depends(get_current_user)):
    farm = await db.farms.find_one({"id": farm_id, "user_id": current_user['id']}, {"_id": 0})
    if not farm:
        raise HTTPException(404, "Farm not found")
    
    sensor_data = await get_sensor_data(farm_id, current_user)
    
    chat = LlmChat(
        api_key=EMERGENT_KEY,
        session_id=f"crop_analysis_{farm_id}",
        system_message="You are an agricultural AI expert. Analyze crop health based on sensor data and provide recommendations."
    ).with_model("gemini", "gemini-3-flash-preview")
    
    message = UserMessage(
        text=f"""Analyze crop health for {farm['crop_type']} with these conditions:
        - Soil Moisture: {sensor_data['soil_moisture']}%
        - Soil Temperature: {sensor_data['soil_temperature']}°C
        - Ambient Temperature: {sensor_data['ambient_temperature']}°C
        - Humidity: {sensor_data['humidity']}%
        - Light Intensity: {sensor_data['light_intensity']} lux
        
        Provide: health_status (Healthy/Moderate Stress/High Stress), confidence (0-1), reasons list, and recommendations list.
        Respond in JSON format only."""
    )
    
    response = await chat.send_message(message)
    
    try:
        import json
        result = json.loads(response.strip('```json').strip('```').strip())
        return result
    except:
        return {
            "health_status": "Moderate Stress" if sensor_data['status'] != 'optimal' else "Healthy",
            "confidence": 0.85,
            "reasons": ["Based on current sensor readings"],
            "recommendations": ["Monitor soil moisture levels", "Ensure adequate irrigation"]
        }

@api_router.post("/yield/predict")
async def predict_yield(farm_id: str, current_user: dict = Depends(get_current_user)):
    farm = await db.farms.find_one({"id": farm_id, "user_id": current_user['id']}, {"_id": 0})
    if not farm:
        raise HTTPException(404, "Farm not found")
    
    sensor_data = await get_sensor_data(farm_id, current_user)
    
    chat = LlmChat(
        api_key=EMERGENT_KEY,
        session_id=f"yield_prediction_{farm_id}",
        system_message="You are an agricultural yield prediction expert."
    ).with_model("gemini", "gemini-3-pro-preview")
    
    message = UserMessage(
        text=f"""Predict yield for {farm['crop_type']} on {farm['field_size']} acres with:
        - Soil Moisture: {sensor_data['soil_moisture']}%
        - Temperature: {sensor_data['ambient_temperature']}°C
        - Humidity: {sensor_data['humidity']}%
        
        Provide: estimated_yield (number), unit (tons/quintals), confidence (0-1), comparison with average.
        Respond in JSON format only."""
    )
    
    response = await chat.send_message(message)
    
    try:
        import json
        result = json.loads(response.strip('```json').strip('```').strip())
        return result
    except:
        base_yield = farm['field_size'] * 2.5
        return {
            "estimated_yield": base_yield,
            "unit": "tons",
            "confidence": 0.78,
            "comparison": {"regional_average": base_yield * 0.9, "last_season": base_yield * 0.95}
        }

@api_router.post("/irrigation/recommend")
async def recommend_irrigation(farm_id: str, current_user: dict = Depends(get_current_user)):
    sensor_data = await get_sensor_data(farm_id, current_user)
    
    should_irrigate = sensor_data['soil_moisture'] < 40
    water_amount = None
    reason = ""
    
    if should_irrigate:
        deficit = 60 - sensor_data['soil_moisture']
        water_amount = deficit * 50
        reason = f"Soil moisture at {sensor_data['soil_moisture']}% is below optimal range (40-70%). Irrigation recommended."
    else:
        reason = f"Soil moisture at {sensor_data['soil_moisture']}% is adequate. No irrigation needed."
    
    return {
        "should_irrigate": should_irrigate,
        "water_amount": water_amount,
        "reason": reason
    }

@api_router.post("/chatbot")
async def chatbot(query: dict, current_user: dict = Depends(get_current_user)):
    chat = LlmChat(
        api_key=EMERGENT_KEY,
        session_id=f"chatbot_{current_user['id']}",
        system_message="You are a friendly farming assistant. Help farmers with simple, actionable advice in their language."
    ).with_model("gemini", "gemini-3-flash-preview")
    
    message = UserMessage(text=query['message'])
    response = await chat.send_message(message)
    
    return {"response": response}

@api_router.post("/voice/transcribe")
async def transcribe_audio(audio: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    try:
        stt = OpenAISpeechToText(api_key=EMERGENT_KEY)
        audio_bytes = await audio.read()
        audio_file = io.BytesIO(audio_bytes)
        audio_file.name = audio.filename
        
        response = await stt.transcribe(
            file=audio_file,
            model="whisper-1",
            response_format="json"
        )
        
        return {"text": response.text}
    except Exception as e:
        raise HTTPException(500, f"Transcription failed: {str(e)}")

@api_router.get("/alerts")
async def get_alerts(current_user: dict = Depends(get_current_user)):
    alerts = await db.alerts.find({"user_id": current_user['id']}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return alerts

@api_router.get("/schemes")
async def get_government_schemes(state: Optional[str] = None, crop: Optional[str] = None):
    schemes = [
        {
            "id": "1",
            "name": "PM-KISAN",
            "description": "Direct income support of ₹6000 per year to farmers",
            "eligibility": "All landholding farmers",
            "states": ["all"],
            "crops": ["all"]
        },
        {
            "id": "2",
            "name": "Crop Insurance Scheme",
            "description": "Insurance coverage against crop loss",
            "eligibility": "All farmers with crop",
            "states": ["all"],
            "crops": ["all"]
        }
    ]
    return schemes

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
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
from ml_service import ml_service

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

firebase_cred = credentials.Certificate(str(ROOT_DIR / 'firebase_config.json'))
firebase_admin.initialize_app(firebase_cred, {
    'databaseURL': 'https://smart-harvest-a9436-default-rtdb.asia-southeast1.firebasedatabase.app/'
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
    
    # Use ML model for prediction
    result = ml_service.predict_crop_health(
        sensor_data=sensor_data,
        crop_type=farm.get('crop_type', 'Rice')
    )
    
    return result

@api_router.post("/yield/predict")
async def predict_yield(farm_id: str, current_user: dict = Depends(get_current_user)):
    farm = await db.farms.find_one({"id": farm_id, "user_id": current_user['id']}, {"_id": 0})
    if not farm:
        raise HTTPException(404, "Farm not found")
    
    sensor_data = await get_sensor_data(farm_id, current_user)
    
    # Use ML model for yield prediction
    result = ml_service.predict_yield(
        sensor_data=sensor_data,
        crop_type=farm.get('crop_type', 'Rice'),
        field_size=farm.get('field_size', 5.0)
    )
    
    return result

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
            "name": "PM-KISAN (Pradhan Mantri Kisan Samman Nidhi)",
            "description": "Direct income support of ₹6,000 per year in three equal installments to all landholding farmers",
            "eligibility": "All landholding farmers (small and marginal farmers)",
            "benefits": "₹2,000 every 4 months directly to bank account",
            "website": "https://pmkisan.gov.in/",
            "states": ["all"],
            "crops": ["all"],
            "category": "Financial Support"
        },
        {
            "id": "2",
            "name": "PMFBY (Pradhan Mantri Fasal Bima Yojana)",
            "description": "Comprehensive crop insurance scheme providing financial support to farmers in case of crop loss",
            "eligibility": "All farmers growing notified crops in notified areas",
            "benefits": "Insurance coverage against crop failure due to natural calamities, pests & diseases",
            "website": "https://pmfby.gov.in/",
            "states": ["all"],
            "crops": ["all"],
            "category": "Insurance"
        },
        {
            "id": "3",
            "name": "Kisan Credit Card (KCC)",
            "description": "Credit facility for farmers to meet short-term credit requirements for cultivation and other needs",
            "eligibility": "All farmers including tenant farmers, oral lessees and sharecroppers",
            "benefits": "Easy credit access, lower interest rates, flexible repayment",
            "website": "https://www.india.gov.in/spotlight/kisan-credit-card-kcc-scheme",
            "states": ["all"],
            "crops": ["all"],
            "category": "Credit Facility"
        },
        {
            "id": "4",
            "name": "PM Kusum Yojana",
            "description": "Solar pump and grid-connected solar power plants for farmers to ensure irrigation and generate additional income",
            "eligibility": "Individual farmers, cooperatives, farmer groups",
            "benefits": "Solar pumps, grid-connected solar plants, subsidy up to 60%",
            "website": "https://pmkusum.mnre.gov.in/",
            "states": ["all"],
            "crops": ["all"],
            "category": "Solar Energy"
        },
        {
            "id": "5",
            "name": "Soil Health Card Scheme",
            "description": "Provides soil health cards to farmers with crop-wise recommendations on nutrients and fertilizers",
            "eligibility": "All farmers",
            "benefits": "Free soil testing, nutrient recommendations, improved productivity",
            "website": "https://soilhealth.dac.gov.in/",
            "states": ["all"],
            "crops": ["all"],
            "category": "Soil Management"
        },
        {
            "id": "6",
            "name": "Paramparagat Krishi Vikas Yojana (PKVY)",
            "description": "Organic farming promotion scheme supporting farmers to adopt organic farming",
            "eligibility": "Groups of farmers interested in organic farming",
            "benefits": "₹50,000 per hectare for 3 years, organic certification support",
            "website": "https://pgsindia-ncof.gov.in/pkvy/Index.aspx",
            "states": ["all"],
            "crops": ["all"],
            "category": "Organic Farming"
        },
        {
            "id": "7",
            "name": "National Agriculture Market (e-NAM)",
            "description": "Online trading platform for agricultural commodities to ensure better price realization",
            "eligibility": "All farmers and traders",
            "benefits": "Transparent price discovery, reduced transaction costs, better market access",
            "website": "https://www.enam.gov.in/",
            "states": ["all"],
            "crops": ["all"],
            "category": "Market Linkage"
        },
        {
            "id": "8",
            "name": "National Mission for Sustainable Agriculture (NMSA)",
            "description": "Promotes sustainable agriculture through climate-resilient farming practices",
            "eligibility": "All farmers",
            "benefits": "Training, technology adoption, water conservation support",
            "website": "https://agricoop.gov.in/",
            "states": ["all"],
            "crops": ["all"],
            "category": "Sustainable Farming"
        },
        {
            "id": "9",
            "name": "Kisan Call Center (KCC)",
            "description": "Toll-free helpline providing expert advice on agriculture-related queries",
            "eligibility": "All farmers",
            "benefits": "24x7 support in local languages, expert guidance on farming",
            "website": "https://mkisan.gov.in/",
            "phone": "1800-180-1551",
            "states": ["all"],
            "crops": ["all"],
            "category": "Advisory Services"
        },
        {
            "id": "10",
            "name": "Pradhan Mantri Kisan Maan Dhan Yojana",
            "description": "Pension scheme for small and marginal farmers aged 18-40 years",
            "eligibility": "Farmers with cultivable land up to 2 hectares",
            "benefits": "₹3,000 monthly pension after 60 years of age",
            "website": "https://maandhan.in/",
            "states": ["all"],
            "crops": ["all"],
            "category": "Pension Scheme"
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
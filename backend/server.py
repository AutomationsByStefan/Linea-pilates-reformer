from fastapi import FastAPI, APIRouter, HTTPException, Request, Response
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

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# ============== MODELS ==============

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    email: Optional[str] = None
    name: str
    phone: Optional[str] = None
    picture: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserSession(BaseModel):
    model_config = ConfigDict(extra="ignore")
    session_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    session_token: str
    expires_at: datetime
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PhoneAuthRequest(BaseModel):
    phone: str

class PhoneVerifyRequest(BaseModel):
    phone: str
    otp: str

class RegisterRequest(BaseModel):
    phone: str
    ime: str
    prezime: str
    email: str

class Membership(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    naziv: str
    tip: str  # "aktivna" or "prethodna"
    preostali_termini: int
    ukupni_termini: int
    datum_isteka: datetime
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Training(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    datum: datetime
    vrijeme: str
    instruktor: str
    tip: str  # "predstojeći" or "prethodni"
    trajanje: int = 50

# ============== HELPER FUNCTIONS ==============

async def get_current_user(request: Request) -> User:
    """Get current user from session token in cookie or Authorization header"""
    session_token = request.cookies.get("session_token")
    
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header[7:]
    
    if not session_token:
        raise HTTPException(status_code=401, detail="Niste prijavljeni")
    
    session_doc = await db.user_sessions.find_one(
        {"session_token": session_token},
        {"_id": 0}
    )
    
    if not session_doc:
        raise HTTPException(status_code=401, detail="Nevalidna sesija")
    
    expires_at = session_doc["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Sesija je istekla")
    
    user_doc = await db.users.find_one(
        {"user_id": session_doc["user_id"]},
        {"_id": 0}
    )
    
    if not user_doc:
        raise HTTPException(status_code=404, detail="Korisnik nije pronađen")
    
    return User(**user_doc)

# ============== AUTH ENDPOINTS ==============

@api_router.post("/auth/session")
async def create_session(request: Request, response: Response):
    """Exchange session_id for session data from Emergent Auth"""
    session_id = request.headers.get("X-Session-ID")
    
    if not session_id:
        raise HTTPException(status_code=400, detail="X-Session-ID header je obavezan")
    
    async with httpx.AsyncClient() as client:
        try:
            auth_response = await client.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": session_id}
            )
            
            if auth_response.status_code != 200:
                raise HTTPException(status_code=401, detail="Neuspješna autentifikacija")
            
            auth_data = auth_response.json()
        except Exception as e:
            logging.error(f"Auth error: {e}")
            raise HTTPException(status_code=500, detail="Greška pri autentifikaciji")
    
    # Check if user exists
    existing_user = await db.users.find_one(
        {"email": auth_data["email"]},
        {"_id": 0}
    )
    
    if existing_user:
        user_id = existing_user["user_id"]
        # Update user info
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {
                "name": auth_data["name"],
                "picture": auth_data.get("picture")
            }}
        )
    else:
        # Create new user
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        new_user = {
            "user_id": user_id,
            "email": auth_data["email"],
            "name": auth_data["name"],
            "picture": auth_data.get("picture"),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(new_user)
        
        # Create mock membership and training for new user
        await create_mock_data_for_user(user_id)
    
    # Create session
    session_token = auth_data.get("session_token", str(uuid.uuid4()))
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    
    session_doc = {
        "session_id": str(uuid.uuid4()),
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Remove old sessions for this user
    await db.user_sessions.delete_many({"user_id": user_id})
    await db.user_sessions.insert_one(session_doc)
    
    # Set cookie
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=7 * 24 * 60 * 60,
        path="/"
    )
    
    user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    
    return user_doc

@api_router.get("/auth/me")
async def get_me(request: Request):
    """Get current authenticated user"""
    user = await get_current_user(request)
    return user.model_dump()

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    """Logout user and clear session"""
    session_token = request.cookies.get("session_token")
    
    if session_token:
        await db.user_sessions.delete_many({"session_token": session_token})
    
    response.delete_cookie(key="session_token", path="/")
    
    return {"message": "Uspješno ste se odjavili"}

# ============== PHONE AUTH (MOCK) ==============

@api_router.post("/auth/phone/send-otp")
async def send_otp(data: PhoneAuthRequest):
    """Mock: Send OTP to phone number"""
    # Check if user exists with this phone
    existing_user = await db.users.find_one({"phone": data.phone}, {"_id": 0})
    
    # Store OTP (mock - always 123456)
    await db.otp_codes.delete_many({"phone": data.phone})
    await db.otp_codes.insert_one({
        "phone": data.phone,
        "otp": "123456",  # Mock OTP
        "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {
        "success": True,
        "user_exists": existing_user is not None,
        "message": "OTP kod je poslan" if existing_user else "Korisnik ne postoji, potrebna registracija"
    }

@api_router.post("/auth/phone/verify")
async def verify_otp(data: PhoneVerifyRequest, response: Response):
    """Mock: Verify OTP and login user"""
    otp_doc = await db.otp_codes.find_one({"phone": data.phone}, {"_id": 0})
    
    if not otp_doc:
        raise HTTPException(status_code=400, detail="OTP kod nije pronađen")
    
    if otp_doc["otp"] != data.otp:
        raise HTTPException(status_code=400, detail="Neispravan OTP kod")
    
    # Check expiry
    expires_at = datetime.fromisoformat(otp_doc["expires_at"])
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="OTP kod je istekao")
    
    # Get or create user
    user_doc = await db.users.find_one({"phone": data.phone}, {"_id": 0})
    
    if not user_doc:
        raise HTTPException(status_code=404, detail="Korisnik nije pronađen, potrebna registracija")
    
    # Create session
    session_token = str(uuid.uuid4())
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    
    session_doc = {
        "session_id": str(uuid.uuid4()),
        "user_id": user_doc["user_id"],
        "session_token": session_token,
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.user_sessions.delete_many({"user_id": user_doc["user_id"]})
    await db.user_sessions.insert_one(session_doc)
    
    # Delete used OTP
    await db.otp_codes.delete_many({"phone": data.phone})
    
    # Set cookie
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=7 * 24 * 60 * 60,
        path="/"
    )
    
    return user_doc

@api_router.post("/auth/register")
async def register_user(data: RegisterRequest, response: Response):
    """Register new user with phone"""
    # Check if phone already exists
    existing = await db.users.find_one({"phone": data.phone}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Korisnik sa ovim brojem već postoji")
    
    # Create user
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    new_user = {
        "user_id": user_id,
        "phone": data.phone,
        "name": f"{data.ime} {data.prezime}",
        "email": data.email,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(new_user)
    
    # Create mock data
    await create_mock_data_for_user(user_id)
    
    # Create session
    session_token = str(uuid.uuid4())
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    
    session_doc = {
        "session_id": str(uuid.uuid4()),
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.user_sessions.insert_one(session_doc)
    
    # Set cookie
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=7 * 24 * 60 * 60,
        path="/"
    )
    
    user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return user_doc

# ============== HELPER: CREATE MOCK DATA ==============

async def create_mock_data_for_user(user_id: str):
    """Create mock memberships and trainings for new user"""
    # Create mock membership
    membership = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "naziv": "Mjesečna članarina",
        "tip": "aktivna",
        "preostali_termini": 8,
        "ukupni_termini": 12,
        "datum_isteka": (datetime.now(timezone.utc) + timedelta(days=25)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.memberships.insert_one(membership)
    
    # Create mock upcoming training
    training = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "datum": (datetime.now(timezone.utc) + timedelta(days=2)).isoformat(),
        "vrijeme": "10:00",
        "instruktor": "Ana Marić",
        "tip": "predstojeći",
        "trajanje": 50,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.trainings.insert_one(training)

# ============== MEMBERSHIPS ==============

@api_router.get("/memberships")
async def get_memberships(request: Request):
    """Get user's memberships"""
    user = await get_current_user(request)
    memberships = await db.memberships.find(
        {"user_id": user.user_id},
        {"_id": 0}
    ).to_list(100)
    return memberships

@api_router.get("/memberships/active")
async def get_active_memberships(request: Request):
    """Get user's active memberships"""
    user = await get_current_user(request)
    memberships = await db.memberships.find(
        {"user_id": user.user_id, "tip": "aktivna"},
        {"_id": 0}
    ).to_list(100)
    return memberships

# ============== TRAININGS ==============

@api_router.get("/trainings")
async def get_trainings(request: Request):
    """Get user's trainings"""
    user = await get_current_user(request)
    trainings = await db.trainings.find(
        {"user_id": user.user_id},
        {"_id": 0}
    ).to_list(100)
    return trainings

@api_router.get("/trainings/upcoming")
async def get_upcoming_trainings(request: Request):
    """Get user's upcoming trainings"""
    user = await get_current_user(request)
    trainings = await db.trainings.find(
        {"user_id": user.user_id, "tip": "predstojeći"},
        {"_id": 0}
    ).to_list(100)
    return trainings

@api_router.get("/trainings/past")
async def get_past_trainings(request: Request):
    """Get user's past trainings"""
    user = await get_current_user(request)
    trainings = await db.trainings.find(
        {"user_id": user.user_id, "tip": "prethodni"},
        {"_id": 0}
    ).to_list(100)
    return trainings

# ============== SCHEDULE (MOCK DATA) ==============

@api_router.get("/schedule")
async def get_schedule():
    """Get available training slots (mock data)"""
    now = datetime.now(timezone.utc)
    schedule = []
    
    instructors = ["Ana Marić", "Maja Kovač", "Ivana Petrović"]
    times = ["09:00", "10:00", "11:00", "16:00", "17:00", "18:00", "19:00"]
    
    for day_offset in range(7):
        date = now + timedelta(days=day_offset)
        for time in times:
            schedule.append({
                "id": str(uuid.uuid4()),
                "datum": date.strftime("%Y-%m-%d"),
                "vrijeme": time,
                "instruktor": instructors[day_offset % 3],
                "slobodna_mjesta": 3 + (day_offset % 4),
                "ukupno_mjesta": 6,
                "trajanje": 50
            })
    
    return schedule

# ============== PACKAGES (MOCK DATA) ==============

@api_router.get("/packages")
async def get_packages():
    """Get available membership packages"""
    packages = [
        {
            "id": "pkg_1",
            "naziv": "Pojedinačni termin",
            "opis": "Jedan trening na Reformer-u",
            "cijena": 25,
            "valuta": "KM",
            "termini": 1,
            "trajanje_dana": 30
        },
        {
            "id": "pkg_4",
            "naziv": "Paket 4 termina",
            "opis": "Idealno za početak",
            "cijena": 90,
            "valuta": "KM",
            "termini": 4,
            "trajanje_dana": 30
        },
        {
            "id": "pkg_8",
            "naziv": "Paket 8 termina",
            "opis": "Najpopularniji izbor",
            "cijena": 160,
            "valuta": "KM",
            "termini": 8,
            "trajanje_dana": 30,
            "popular": True
        },
        {
            "id": "pkg_12",
            "naziv": "Paket 12 termina",
            "opis": "Najbolja vrijednost",
            "cijena": 220,
            "valuta": "KM",
            "termini": 12,
            "trajanje_dana": 30
        }
    ]
    return packages

# ============== STUDIO INFO ==============

@api_router.get("/studio-info")
async def get_studio_info():
    """Get studio contact information"""
    return {
        "naziv": "Linea Reformer Pilates",
        "telefon": "+387 59 123 456",
        "instagram": "https://instagram.com/linea.pilates.trebinje",
        "instagram_handle": "@linea.pilates.trebinje",
        "adresa": "Trg Slobode 15, 89101 Trebinje",
        "grad": "Trebinje",
        "drzava": "Bosna i Hercegovina",
        "latitude": 42.7117,
        "longitude": 18.3438,
        "radno_vrijeme": {
            "pon_pet": "08:00 - 21:00",
            "sub": "09:00 - 14:00",
            "ned": "Zatvoreno"
        }
    }

# ============== ROOT ==============

@api_router.get("/")
async def root():
    return {"message": "Linea Reformer Pilates API"}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

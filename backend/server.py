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
from passlib.hash import bcrypt
from apscheduler.schedulers.asyncio import AsyncIOScheduler
import asyncio

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

class PhoneLoginRequest(BaseModel):
    phone: str
    pin: str

class RegisterRequest(BaseModel):
    phone: str
    ime: str
    prezime: str
    email: str
    pin: str

class Membership(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    naziv: str
    tip: str  # "aktivna" or "prethodna"
    preostali_termini: int
    ukupni_termini: int
    datum_isteka: datetime
    datum_pocetka: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Training(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    datum: datetime
    vrijeme: str
    instruktor: str
    tip: str  # "predstojeći" or "prethodni" or "završen"
    trajanje: int = 50
    feedback_submitted: bool = False

class BookingRequest(BaseModel):
    slot_id: str
    datum: str
    vrijeme: str
    instruktor: str

class FeedbackRequest(BaseModel):
    training_id: str
    fizicko_stanje: int  # 1-5
    kvalitet_treninga: int  # 1-5
    osjecaj_napretka: int  # 1-5

class WeightEntry(BaseModel):
    weight: float
    date: Optional[str] = None

class ShareInviteRequest(BaseModel):
    training_id: str
    recipient_user_id: Optional[str] = None  # For in-app sharing
    generate_link: bool = False  # For external sharing

class AdminLoginRequest(BaseModel):
    email: str
    password: str

class AdminSlotRequest(BaseModel):
    datum: str  # YYYY-MM-DD
    vrijeme: str  # HH:MM
    instruktor: str
    ukupno_mjesta: int = 3
    trajanje: int = 50

class AdminCancelRequest(BaseModel):
    razlog: Optional[str] = None

class PackageRequestModel(BaseModel):
    package_id: str

class AdminNoteRequest(BaseModel):
    notes: str

class AdminFreezeRequest(BaseModel):
    start_date: str
    end_date: str

class AdminStatusRequest(BaseModel):
    status: str  # "active", "pending", "expired", "frozen"

class AdminCustomMembershipRequest(BaseModel):
    user_id: str
    package_id: str
    naziv: str
    cijena: float
    termini: int
    trajanje_dana: int = 30

class ManualIncomeRequest(BaseModel):
    iznos: float
    opis: str
    datum: Optional[str] = None
    kategorija: str = "ostalo"

class AdminReminderRequest(BaseModel):
    tekst: str
    datum: Optional[str] = None

class PackageCreateRequest(BaseModel):
    naziv: str
    opis: str = "Mala grupa do 3 osobe"
    cijena: float
    termini: int
    trajanje_dana: int = 30
    popular: bool = False
    active: bool = True

def detect_phone_country(phone: str) -> str:
    """Detect country from phone number prefix"""
    cleaned = phone.replace(" ", "").replace("-", "").replace("(", "").replace(")", "")
    if cleaned.startswith("+381") or cleaned.startswith("00381"):
        return "RS"
    if cleaned.startswith("+387") or cleaned.startswith("00387"):
        return "BA"
    if cleaned.startswith("06") or cleaned.startswith("07"):
        return "RS"  # Serbian mobile prefixes
    if cleaned.startswith("06"):
        return "BA"  # Bosnian mobile prefixes
    return "BA"  # Default to Bosnia

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

async def get_admin_user(request: Request) -> dict:
    """Get current admin - supports both admin session and regular user session with is_admin flag"""
    # First try regular user session with is_admin flag (unified auth)
    try:
        session_token = request.cookies.get("session_token")
        if not session_token:
            auth_header = request.headers.get("Authorization")
            if auth_header and auth_header.startswith("Bearer "):
                session_token = auth_header[7:]
        if session_token:
            session_doc = await db.user_sessions.find_one({"session_token": session_token}, {"_id": 0})
            if session_doc:
                user_doc = await db.users.find_one({"user_id": session_doc["user_id"]}, {"_id": 0})
                if user_doc and user_doc.get("is_admin"):
                    return user_doc
    except Exception:
        pass
    # Fallback to old admin session
    session_token = request.cookies.get("admin_session_token")
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header[7:]
    if not session_token:
        raise HTTPException(status_code=401, detail="Admin prijava je potrebna")
    session_doc = await db.admin_sessions.find_one(
        {"session_token": session_token}, {"_id": 0}
    )
    if not session_doc:
        raise HTTPException(status_code=401, detail="Nevalidna admin sesija")
    expires_at = session_doc.get("expires_at", "")
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Admin sesija je istekla")
    admin = await db.admins.find_one(
        {"admin_id": session_doc["admin_id"]}, {"_id": 0}
    )
    if not admin:
        raise HTTPException(status_code=404, detail="Admin nije pronađen")
    return admin

def format_bosnian_date(dt):
    """Format date in Bosnian"""
    if isinstance(dt, str):
        dt = datetime.fromisoformat(dt.replace('Z', '+00:00'))
    months = ['januar', 'februar', 'mart', 'april', 'maj', 'juni', 
              'juli', 'august', 'septembar', 'oktobar', 'novembar', 'decembar']
    return f"{dt.day}. {months[dt.month - 1]} {dt.year}."

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
        # Update user info and last activity
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {
                "name": auth_data["name"],
                "picture": auth_data.get("picture"),
                "last_activity": datetime.now(timezone.utc).isoformat()
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
            "is_admin": False,
            "status": "active",
            "notes": "",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "last_activity": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(new_user)
    
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
    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0, "pin_hash": 0})
    await db.users.update_one(
        {"user_id": user.user_id},
        {"$set": {"last_activity": datetime.now(timezone.utc).isoformat()}}
    )
    return user_doc

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    """Logout user and clear session"""
    session_token = request.cookies.get("session_token")
    
    if session_token:
        await db.user_sessions.delete_many({"session_token": session_token})
    
    response.delete_cookie(key="session_token", path="/")
    
    return {"message": "Uspješno ste se odjavili"}

# ============== PHONE AUTH (PIN-BASED) ==============

@api_router.post("/auth/phone/check")
async def check_phone(data: PhoneAuthRequest):
    """Check if phone number exists in the system"""
    existing_user = await db.users.find_one({"phone": data.phone}, {"_id": 0})
    return {
        "exists": existing_user is not None,
        "name": existing_user.get("name", "") if existing_user else ""
    }

@api_router.post("/auth/phone/send-otp")
async def send_otp_compat(data: PhoneAuthRequest):
    """Backward compatible: check phone exists"""
    existing_user = await db.users.find_one({"phone": data.phone}, {"_id": 0})
    return {
        "success": True,
        "user_exists": existing_user is not None,
        "message": "Unesite PIN" if existing_user else "Potrebna registracija"
    }

@api_router.post("/auth/phone/login")
async def phone_login(data: PhoneLoginRequest, response: Response):
    """Login with phone + 4-digit PIN"""
    user_doc = await db.users.find_one({"phone": data.phone}, {"_id": 0, "pin_hash": 1, "user_id": 1})
    if not user_doc:
        raise HTTPException(status_code=404, detail="Korisnik nije pronadjen")
    pin_hash = user_doc.get("pin_hash")
    if not pin_hash:
        raise HTTPException(status_code=400, detail="PIN nije postavljen. Kontaktirajte studio.")
    if not bcrypt.verify(data.pin, pin_hash):
        raise HTTPException(status_code=400, detail="Neispravan PIN")
    # Get full user doc without pin_hash
    full_user = await db.users.find_one({"user_id": user_doc["user_id"]}, {"_id": 0, "pin_hash": 0})
    await db.users.update_one(
        {"user_id": full_user["user_id"]},
        {"$set": {"last_activity": datetime.now(timezone.utc).isoformat()}}
    )
    # Create session
    session_token = str(uuid.uuid4())
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    session_doc = {
        "session_id": str(uuid.uuid4()),
        "user_id": full_user["user_id"],
        "session_token": session_token,
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.user_sessions.delete_many({"user_id": full_user["user_id"]})
    await db.user_sessions.insert_one(session_doc)
    response.set_cookie(
        key="session_token", value=session_token,
        httponly=True, secure=True, samesite="none",
        max_age=7 * 24 * 60 * 60, path="/"
    )
    return full_user

@api_router.post("/auth/phone/verify")
async def verify_otp(data: PhoneLoginRequest, response: Response):
    """Backward compat: same as login"""
    return await phone_login(data, response)

@api_router.post("/auth/register")
async def register_user(data: RegisterRequest, response: Response):
    """Register new user with phone and 4-digit PIN"""
    # Check if phone already exists
    existing = await db.users.find_one({"phone": data.phone}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Korisnik sa ovim brojem već postoji")
    
    if not data.pin or len(data.pin) != 4 or not data.pin.isdigit():
        raise HTTPException(status_code=400, detail="PIN mora biti 4 cifre")
    
    # Hash the PIN
    pin_hash = bcrypt.hash(data.pin)
    
    # Create user
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    country_code = detect_phone_country(data.phone)
    new_user = {
        "user_id": user_id,
        "phone": data.phone,
        "name": f"{data.ime} {data.prezime}",
        "email": data.email,
        "country_code": country_code,
        "is_admin": False,
        "status": "active",
        "notes": "",
        "pin_hash": pin_hash,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "last_activity": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(new_user)
    
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
    now = datetime.now(timezone.utc)
    
    # Create mock membership with start date
    membership = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "naziv": "Mjesečna članarina",
        "tip": "aktivna",
        "preostali_termini": 8,
        "ukupni_termini": 12,
        "datum_pocetka": now.isoformat(),
        "datum_isteka": (now + timedelta(days=30)).isoformat(),
        "created_at": now.isoformat()
    }
    await db.memberships.insert_one(membership)
    
    # Create mock upcoming training
    training = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "datum": (now + timedelta(days=2)).isoformat(),
        "vrijeme": "10:00",
        "instruktor": "Marija Trisic",
        "tip": "predstojeći",
        "trajanje": 50,
        "feedback_submitted": False,
        "created_at": now.isoformat()
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
        {"user_id": user.user_id, "tip": {"$in": ["prethodni", "završen"]}},
        {"_id": 0}
    ).to_list(100)
    return trainings

@api_router.get("/trainings/{training_id}")
async def get_training(training_id: str, request: Request):
    """Get single training by ID"""
    user = await get_current_user(request)
    training = await db.trainings.find_one(
        {"id": training_id, "user_id": user.user_id},
        {"_id": 0}
    )
    if not training:
        raise HTTPException(status_code=404, detail="Trening nije pronađen")
    return training

# ============== BOOKING ==============

@api_router.post("/bookings")
async def create_booking(data: BookingRequest, request: Request):
    """Book a training slot"""
    user = await get_current_user(request)
    
    # Check if user has active membership with remaining slots
    membership = await db.memberships.find_one(
        {"user_id": user.user_id, "tip": "aktivna", "preostali_termini": {"$gt": 0}},
        {"_id": 0}
    )
    
    if not membership:
        raise HTTPException(status_code=400, detail="Nemate aktivnu članarinu ili preostalih termina")
    
    # Check one booking per day limit
    existing_today = await db.trainings.find_one({
        "user_id": user.user_id,
        "datum": {"$regex": f"^{data.datum}"},
        "tip": "predstojeći"
    })
    if existing_today:
        raise HTTPException(status_code=400, detail="Već imate zakazan termin za ovaj dan. Možete imati samo jedan termin dnevno.")
    
    # Check actual slot availability
    slot = await db.schedule_slots.find_one({"id": data.slot_id}, {"_id": 0})
    if slot:
        booked_count = await db.trainings.count_documents({
            "slot_id": data.slot_id, "tip": {"$in": ["predstojeći", "završen"]}
        })
        if booked_count >= slot.get("ukupno_mjesta", 3):
            raise HTTPException(status_code=400, detail="Ovaj termin je popunjen")
    
    # Create training record
    training_id = str(uuid.uuid4())
    training = {
        "id": training_id,
        "user_id": user.user_id,
        "slot_id": data.slot_id,
        "datum": data.datum,
        "vrijeme": data.vrijeme,
        "instruktor": data.instruktor,
        "tip": "predstojeći",
        "trajanje": 50,
        "feedback_submitted": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.trainings.insert_one(training)
    
    # Decrement membership slots
    await db.memberships.update_one(
        {"id": membership["id"]},
        {"$inc": {"preostali_termini": -1}}
    )
    
    # Update last activity
    await db.users.update_one(
        {"user_id": user.user_id},
        {"$set": {"last_activity": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {
        "success": True,
        "training_id": training_id,
        "message": "Termin je uspješno rezervisan!"
    }

class RescheduleRequest(BaseModel):
    new_slot_id: str
    new_datum: str
    new_vrijeme: str
    new_instruktor: str

@api_router.post("/bookings/{training_id}/reschedule")
async def reschedule_booking(training_id: str, data: RescheduleRequest, request: Request):
    """Reschedule a booking within 30 minutes of creation"""
    user = await get_current_user(request)
    training = await db.trainings.find_one(
        {"id": training_id, "user_id": user.user_id, "tip": "predstojeći"},
        {"_id": 0}
    )
    if not training:
        raise HTTPException(status_code=404, detail="Rezervacija nije pronađena")
    # Check 30 minute window
    created_at = training.get("created_at", "")
    if isinstance(created_at, str):
        created_at = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)
    minutes_since = (datetime.now(timezone.utc) - created_at).total_seconds() / 60
    if minutes_since > 30:
        raise HTTPException(status_code=400, detail="Preraspodjela je moguća samo u prvih 30 minuta od rezervacije.")
    # Check one booking per day for new date (exclude current booking)
    existing_on_new_date = await db.trainings.find_one({
        "user_id": user.user_id,
        "datum": {"$regex": f"^{data.new_datum}"},
        "tip": "predstojeći",
        "id": {"$ne": training_id}
    })
    if existing_on_new_date:
        raise HTTPException(status_code=400, detail="Već imate zakazan termin za taj dan.")
    # Check new slot availability
    new_slot = await db.schedule_slots.find_one({"id": data.new_slot_id}, {"_id": 0})
    if new_slot:
        booked_count = await db.trainings.count_documents({
            "slot_id": data.new_slot_id,
            "tip": {"$in": ["predstojeći", "završen"]},
            "id": {"$ne": training_id}
        })
        if booked_count >= new_slot.get("ukupno_mjesta", 3):
            raise HTTPException(status_code=400, detail="Novi termin je popunjen")
    # Update the training
    await db.trainings.update_one(
        {"id": training_id},
        {"$set": {
            "slot_id": data.new_slot_id,
            "datum": data.new_datum,
            "vrijeme": data.new_vrijeme,
            "instruktor": data.new_instruktor
        }}
    )
    return {"success": True, "message": "Termin je uspješno promijenjen!"}

@api_router.post("/trainings/share")
async def share_training(data: ShareInviteRequest, request: Request):
    """Share training with a friend"""
    user = await get_current_user(request)
    
    # Get the training
    training = await db.trainings.find_one(
        {"id": data.training_id, "user_id": user.user_id},
        {"_id": 0}
    )
    
    if not training:
        raise HTTPException(status_code=404, detail="Trening nije pronađen")
    
    invite_id = str(uuid.uuid4())
    
    if data.generate_link:
        # Generate shareable link
        invite = {
            "id": invite_id,
            "type": "link",
            "training_id": data.training_id,
            "sender_user_id": user.user_id,
            "sender_name": user.name,
            "datum": training["datum"],
            "vrijeme": training["vrijeme"],
            "instruktor": training["instruktor"],
            "status": "pending",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
        }
        await db.training_invites.insert_one(invite)
        
        return {
            "success": True,
            "invite_id": invite_id,
            "share_link": f"/pozivnica/{invite_id}",
            "message": "Link za dijeljenje je kreiran"
        }
    
    elif data.recipient_user_id:
        # In-app sharing
        recipient = await db.users.find_one(
            {"user_id": data.recipient_user_id},
            {"_id": 0}
        )
        
        if not recipient:
            raise HTTPException(status_code=404, detail="Korisnik nije pronađen")
        
        # Create invite notification
        invite = {
            "id": invite_id,
            "type": "in_app",
            "training_id": data.training_id,
            "sender_user_id": user.user_id,
            "sender_name": user.name,
            "recipient_user_id": data.recipient_user_id,
            "datum": training["datum"],
            "vrijeme": training["vrijeme"],
            "instruktor": training["instruktor"],
            "status": "pending",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.training_invites.insert_one(invite)
        
        # Create notification for recipient
        notification = {
            "id": str(uuid.uuid4()),
            "user_id": data.recipient_user_id,
            "type": "training_invite",
            "title": "Poziv na trening",
            "message": f"Tvoja prijateljica te poziva na zajednički Pilates Reformer trening 💪\nTermin: {format_bosnian_date(training['datum'])} u {training['vrijeme']}",
            "data": {"invite_id": invite_id},
            "read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.notifications.insert_one(notification)
        
        return {
            "success": True,
            "invite_id": invite_id,
            "message": "Poziv je poslan"
        }
    
    raise HTTPException(status_code=400, detail="Morate navesti korisnika ili zatražiti link")

@api_router.post("/trainings/invites/{invite_id}/accept")
async def accept_training_invite(invite_id: str, request: Request):
    """Accept a training invite"""
    user = await get_current_user(request)
    
    invite = await db.training_invites.find_one(
        {"id": invite_id},
        {"_id": 0}
    )
    
    if not invite:
        raise HTTPException(status_code=404, detail="Pozivnica nije pronađena")
    
    if invite["status"] != "pending":
        raise HTTPException(status_code=400, detail="Pozivnica je već iskorištena")
    
    # Check available spots (mock check - in real implementation check actual capacity)
    # For now, simulate random availability
    import random
    spots_available = random.choice([True, True, True, False])  # 75% chance of availability
    
    if not spots_available:
        return {
            "success": False,
            "message": "Nažalost, ovaj termin je upravo popunjen 😕\nMolimo te da odabereš drugi dostupni termin."
        }
    
    # Check if user has membership
    membership = await db.memberships.find_one(
        {"user_id": user.user_id, "tip": "aktivna", "preostali_termini": {"$gt": 0}},
        {"_id": 0}
    )
    
    if not membership:
        raise HTTPException(status_code=400, detail="Nemate aktivnu članarinu ili preostalih termina")
    
    # Create training for the user
    training = {
        "id": str(uuid.uuid4()),
        "user_id": user.user_id,
        "datum": invite["datum"],
        "vrijeme": invite["vrijeme"],
        "instruktor": invite["instruktor"],
        "tip": "predstojeći",
        "trajanje": 50,
        "feedback_submitted": False,
        "invited_by": invite["sender_user_id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.trainings.insert_one(training)
    
    # Decrement membership slots
    await db.memberships.update_one(
        {"id": membership["id"]},
        {"$inc": {"preostali_termini": -1}}
    )
    
    # Update invite status
    await db.training_invites.update_one(
        {"id": invite_id},
        {"$set": {"status": "accepted", "accepted_by": user.user_id}}
    )
    
    return {
        "success": True,
        "message": "Termin je uspješno rezervisan! Vidimo se na treningu."
    }

@api_router.get("/trainings/invites/pending")
async def get_pending_invites(request: Request):
    """Get pending training invites for user"""
    user = await get_current_user(request)
    
    invites = await db.training_invites.find(
        {"recipient_user_id": user.user_id, "status": "pending"},
        {"_id": 0}
    ).to_list(100)
    
    return invites

@api_router.get("/invites/{invite_id}")
async def get_invite_details(invite_id: str):
    """Get invite details (public endpoint for share links)"""
    invite = await db.training_invites.find_one(
        {"id": invite_id},
        {"_id": 0}
    )
    
    if not invite:
        raise HTTPException(status_code=404, detail="Pozivnica nije pronađena")
    
    return invite

# ============== FEEDBACK ==============

@api_router.post("/feedback")
async def submit_feedback(data: FeedbackRequest, request: Request):
    """Submit feedback for a completed training"""
    user = await get_current_user(request)
    
    # Validate ratings
    for rating in [data.fizicko_stanje, data.kvalitet_treninga, data.osjecaj_napretka]:
        if not 1 <= rating <= 5:
            raise HTTPException(status_code=400, detail="Ocjene moraju biti između 1 i 5")
    
    # Check if training exists and belongs to user
    training = await db.trainings.find_one(
        {"id": data.training_id, "user_id": user.user_id},
        {"_id": 0}
    )
    
    if not training:
        raise HTTPException(status_code=404, detail="Trening nije pronađen")
    
    if training.get("feedback_submitted"):
        raise HTTPException(status_code=400, detail="Povratna informacija je već poslana za ovaj trening")
    
    # Save feedback
    feedback = {
        "id": str(uuid.uuid4()),
        "user_id": user.user_id,
        "training_id": data.training_id,
        "training_date": training["datum"],
        "fizicko_stanje": data.fizicko_stanje,
        "kvalitet_treninga": data.kvalitet_treninga,
        "osjecaj_napretka": data.osjecaj_napretka,
        "average": round((data.fizicko_stanje + data.kvalitet_treninga + data.osjecaj_napretka) / 3, 1),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.training_feedback.insert_one(feedback)
    
    # Mark training as feedback submitted
    await db.trainings.update_one(
        {"id": data.training_id},
        {"$set": {"feedback_submitted": True}}
    )
    
    return {
        "success": True,
        "message": "Hvala na povratnoj informaciji! 💪"
    }

@api_router.get("/feedback/pending")
async def get_pending_feedback(request: Request):
    """Get trainings that need feedback (completed but no feedback submitted)"""
    user = await get_current_user(request)
    
    # Get completed trainings without feedback
    trainings = await db.trainings.find(
        {
            "user_id": user.user_id,
            "tip": {"$in": ["završen", "prethodni"]},
            "feedback_submitted": {"$ne": True}
        },
        {"_id": 0}
    ).to_list(10)
    
    return trainings

@api_router.get("/feedback/history")
async def get_feedback_history(request: Request):
    """Get user's feedback history"""
    user = await get_current_user(request)
    
    feedback = await db.training_feedback.find(
        {"user_id": user.user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    return feedback

# ============== TRAINING COMMENTS ==============

class TrainingCommentRequest(BaseModel):
    training_id: str
    komentar: str

@api_router.post("/trainings/comment")
async def add_training_comment(data: TrainingCommentRequest, request: Request):
    """Add a private comment to a past training"""
    user = await get_current_user(request)
    training = await db.trainings.find_one(
        {"id": data.training_id, "user_id": user.user_id},
        {"_id": 0}
    )
    if not training:
        raise HTTPException(status_code=404, detail="Trening nije pronadjen")
    await db.trainings.update_one(
        {"id": data.training_id},
        {"$set": {"komentar": data.komentar, "komentar_datum": datetime.now(timezone.utc).isoformat()}}
    )
    return {"success": True, "message": "Komentar je sačuvan"}

# ============== WEIGHT TRACKING ==============

@api_router.post("/weight")
async def add_weight_entry(data: WeightEntry, request: Request):
    """Add a weight entry"""
    user = await get_current_user(request)
    
    entry_date = data.date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    entry = {
        "id": str(uuid.uuid4()),
        "user_id": user.user_id,
        "weight": data.weight,
        "date": entry_date,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Update or insert for the same date
    await db.weight_entries.update_one(
        {"user_id": user.user_id, "date": entry_date},
        {"$set": entry},
        upsert=True
    )
    
    return {
        "success": True,
        "message": "Težina je zabilježena"
    }

@api_router.get("/weight")
async def get_weight_history(request: Request):
    """Get user's weight history"""
    user = await get_current_user(request)
    
    entries = await db.weight_entries.find(
        {"user_id": user.user_id},
        {"_id": 0}
    ).sort("date", -1).to_list(100)
    
    return entries

@api_router.delete("/weight/{entry_id}")
async def delete_weight_entry(entry_id: str, request: Request):
    """Delete a weight entry"""
    user = await get_current_user(request)
    
    result = await db.weight_entries.delete_one(
        {"id": entry_id, "user_id": user.user_id}
    )
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Unos nije pronađen")
    
    return {"success": True, "message": "Unos je obrisan"}

# ============== NOTIFICATIONS ==============

@api_router.get("/notifications")
async def get_notifications(request: Request):
    """Get user's notifications"""
    user = await get_current_user(request)
    
    notifications = await db.notifications.find(
        {"user_id": user.user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    return notifications

@api_router.get("/notifications/unread")
async def get_unread_notifications(request: Request):
    """Get user's unread notifications"""
    user = await get_current_user(request)
    
    notifications = await db.notifications.find(
        {"user_id": user.user_id, "read": False},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    return notifications

@api_router.post("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, request: Request):
    """Mark a notification as read"""
    user = await get_current_user(request)
    
    await db.notifications.update_one(
        {"id": notification_id, "user_id": user.user_id},
        {"$set": {"read": True}}
    )
    
    return {"success": True}

@api_router.post("/notifications/read-all")
async def mark_all_notifications_read(request: Request):
    """Mark all notifications as read"""
    user = await get_current_user(request)
    
    await db.notifications.update_many(
        {"user_id": user.user_id, "read": False},
        {"$set": {"read": True}}
    )
    
    return {"success": True}

# ============== SCHEDULE (FROM DATABASE) ==============

@api_router.get("/schedule")
async def get_schedule():
    """Get available training slots from database"""
    now = datetime.now(timezone.utc)
    today_str = now.strftime("%Y-%m-%d")
    
    slots = await db.schedule_slots.find(
        {"datum": {"$gte": today_str}},
        {"_id": 0}
    ).sort([("datum", 1), ("vrijeme", 1)]).to_list(5000)
    
    # Enrich with actual availability
    result = []
    for slot in slots:
        booked = await db.trainings.count_documents({
            "slot_id": slot["id"], "tip": {"$in": ["predstojeći", "završen"]}
        })
        result.append({
            **slot,
            "slobodna_mjesta": max(0, slot["ukupno_mjesta"] - booked),
            "ukupno_mjesta": slot["ukupno_mjesta"]
        })
    
    return result

# ============== PACKAGES (FROM DATABASE) ==============

@api_router.get("/packages")
async def get_packages():
    """Get available membership packages from database"""
    packages = await db.packages.find(
        {"active": {"$ne": False}},
        {"_id": 0}
    ).sort("cijena", 1).to_list(50)
    return packages

# ============== STUDIO INFO ==============

@api_router.get("/studio-info")
async def get_studio_info():
    """Get studio contact information"""
    return {
        "naziv": "Linea Reformer Pilates",
        "telefon": "+38766024148",
        "instagram": "https://www.instagram.com/lineapilatesreformer/",
        "instagram_handle": "@lineapilatesreformer",
        "adresa": "Kralja Petra I Oslobodioca 55, 89101 Trebinje",
        "grad": "Trebinje",
        "drzava": "Bosna i Hercegovina",
        "latitude": 42.71239,
        "longitude": 18.34223,
        "radno_vrijeme": {
            "pon_pet": "08:00 - 21:00",
            "sub": "09:00 - 14:00",
            "ned": "Zatvoreno"
        }
    }

# ============== USER STATS ==============

@api_router.get("/user/stats")
async def get_user_stats(request: Request):
    """Get user statistics including membership info"""
    user = await get_current_user(request)
    
    # Get active membership
    membership = await db.memberships.find_one(
        {"user_id": user.user_id, "tip": "aktivna"},
        {"_id": 0}
    )
    
    # Check for pending package request
    pending_request = await db.package_requests.find_one(
        {"user_id": user.user_id, "status": "pending"},
        {"_id": 0}
    )
    
    # Count completed trainings
    completed_count = await db.trainings.count_documents(
        {"user_id": user.user_id, "tip": {"$in": ["završen", "prethodni"]}}
    )
    
    # Count upcoming trainings
    upcoming_count = await db.trainings.count_documents(
        {"user_id": user.user_id, "tip": "predstojeći"}
    )
    
    # Get last training date
    last_training = await db.trainings.find_one(
        {"user_id": user.user_id, "tip": {"$in": ["završen", "prethodni"]}},
        {"_id": 0},
        sort=[("datum", -1)]
    )
    
    # Calculate weeks active
    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    created_at = user_doc.get("created_at")
    if isinstance(created_at, str):
        created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
    if created_at and created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)
    weeks_active = max(1, (datetime.now(timezone.utc) - created_at).days // 7) if created_at else 1
    
    return {
        "preostali_termini": membership.get("preostali_termini", 0) if membership else 0,
        "ukupni_termini": membership.get("ukupni_termini", 0) if membership else 0,
        "naziv_paketa": membership.get("naziv", "") if membership else "",
        "datum_pocetka": membership.get("datum_pocetka") if membership else None,
        "datum_isteka": membership.get("datum_isteka") if membership else None,
        "trajanje_dana": 30,
        "zavrseni_treninzi": completed_count,
        "predstojeći_treninzi": upcoming_count,
        "sedmice_aktivnosti": weeks_active,
        "posljednji_trening": last_training.get("datum") if last_training else None,
        "ima_aktivnu_clanarinu": membership is not None,
        "pending_paket": pending_request.get("package_name") if pending_request else None
    }

# ============== INACTIVITY CHECK ==============

@api_router.get("/user/activity-status")
async def get_activity_status(request: Request):
    """Check if user has been inactive for 7+ days"""
    user = await get_current_user(request)
    
    # Get last activity
    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    last_activity = user_doc.get("last_activity")
    
    # Get last training
    last_training = await db.trainings.find_one(
        {"user_id": user.user_id},
        {"_id": 0},
        sort=[("datum", -1)]
    )
    
    # Check for upcoming trainings
    upcoming = await db.trainings.count_documents(
        {"user_id": user.user_id, "tip": "predstojeći"}
    )
    
    # Determine inactivity
    days_inactive = 0
    if last_training:
        last_date = last_training.get("datum")
        if isinstance(last_date, str):
            last_date = datetime.fromisoformat(last_date.replace('Z', '+00:00'))
        if last_date.tzinfo is None:
            last_date = last_date.replace(tzinfo=timezone.utc)
        days_inactive = (datetime.now(timezone.utc) - last_date).days
    
    should_show_reminder = days_inactive >= 7 and upcoming == 0
    
    return {
        "days_inactive": days_inactive,
        "has_upcoming": upcoming > 0,
        "should_show_reminder": should_show_reminder,
        "reminder_message": "Nedostaješ nam u studiju 😊\nVrijeme je da rezervišeš novi Pilates Reformer trening." if should_show_reminder else None
    }

# ============== SEARCH USERS (for sharing) ==============

@api_router.get("/users/search")
async def search_users(q: str, request: Request):
    """Search users by name or email for sharing"""
    user = await get_current_user(request)
    
    if len(q) < 2:
        return []
    
    # Search by name or email (exclude current user)
    users = await db.users.find(
        {
            "user_id": {"$ne": user.user_id},
            "$or": [
                {"name": {"$regex": q, "$options": "i"}},
                {"email": {"$regex": q, "$options": "i"}}
            ]
        },
        {"_id": 0, "user_id": 1, "name": 1, "picture": 1}
    ).to_list(10)
    
    return users

# ============== PACKAGE REQUESTS ==============

@api_router.post("/packages/request")
async def request_package(data: PackageRequestModel, request: Request):
    """Client requests a package - creates pending request for admin approval"""
    user = await get_current_user(request)
    # Check if user already has a pending request
    existing = await db.package_requests.find_one(
        {"user_id": user.user_id, "status": "pending"}, {"_id": 0}
    )
    if existing:
        raise HTTPException(status_code=400, detail="Već imate zahtjev za paket na čekanju.")
    # Get package info from database
    pkg = await db.packages.find_one({"id": data.package_id}, {"_id": 0})
    if not pkg:
        raise HTTPException(status_code=404, detail="Paket nije pronađen")
    req_id = str(uuid.uuid4())
    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    package_request = {
        "id": req_id,
        "user_id": user.user_id,
        "user_name": user_doc.get("name", ""),
        "user_phone": user_doc.get("phone", ""),
        "user_email": user_doc.get("email", ""),
        "package_id": data.package_id,
        "package_name": pkg["naziv"],
        "package_price": pkg["cijena"],
        "package_sessions": pkg["termini"],
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.package_requests.insert_one(package_request)
    # Create admin notification
    admins = await db.users.find({"is_admin": True}, {"_id": 0}).to_list(10)
    for admin in admins:
        await db.notifications.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": admin["user_id"],
            "type": "package_request",
            "title": "Novi zahtjev za paket",
            "message": f"{user_doc.get('name', 'Korisnik')} je zatražio paket {pkg['naziv']} ({pkg['cijena']} KM).",
            "data": {"request_id": req_id, "package_name": pkg["naziv"], "user_name": user_doc.get("name", "")},
            "read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    return {"success": True, "message": "Vaš zahtjev za paket je poslat. Čeka aktivaciju nakon uplate.", "request_id": req_id}

@api_router.get("/packages/my-requests")
async def get_my_package_requests(request: Request):
    """Get current user's package requests"""
    user = await get_current_user(request)
    requests = await db.package_requests.find(
        {"user_id": user.user_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(20)
    return requests

# ============== ADMIN PACKAGE APPROVAL ==============

@api_router.get("/admin/package-requests")
async def admin_get_package_requests(request: Request):
    """Get all package requests"""
    await get_admin_user(request)
    requests = await db.package_requests.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return requests

@api_router.post("/admin/package-requests/{request_id}/approve")
async def admin_approve_package(request_id: str, request: Request):
    """Approve a package request - creates active membership"""
    admin_user = await get_admin_user(request)
    pkg_req = await db.package_requests.find_one({"id": request_id}, {"_id": 0})
    if not pkg_req:
        raise HTTPException(status_code=404, detail="Zahtjev nije pronađen")
    if pkg_req["status"] != "pending":
        raise HTTPException(status_code=400, detail="Zahtjev je već obrađen")
    now = datetime.now(timezone.utc)
    membership = {
        "id": str(uuid.uuid4()),
        "user_id": pkg_req["user_id"],
        "naziv": pkg_req["package_name"],
        "package_id": pkg_req["package_id"],
        "tip": "aktivna",
        "preostali_termini": pkg_req["package_sessions"],
        "ukupni_termini": pkg_req["package_sessions"],
        "cijena": pkg_req["package_price"],
        "datum_pocetka": now.isoformat(),
        "datum_isteka": (now + timedelta(days=30)).isoformat(),
        "created_at": now.isoformat()
    }
    # Deactivate any existing active membership
    await db.memberships.update_many(
        {"user_id": pkg_req["user_id"], "tip": "aktivna"},
        {"$set": {"tip": "prethodna"}}
    )
    await db.memberships.insert_one(membership)
    admin_name = admin_user.get("name", admin_user.get("email", "Admin"))
    await db.package_requests.update_one(
        {"id": request_id},
        {"$set": {"status": "approved", "approved_at": now.isoformat(), "approved_by": admin_name}}
    )
    # Notify client
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": pkg_req["user_id"],
        "type": "package_approved",
        "title": "Paket aktiviran",
        "message": f"Vaš paket {pkg_req['package_name']} je aktiviran! Imate {pkg_req['package_sessions']} termina na raspolaganju.",
        "data": {"package_name": pkg_req["package_name"]},
        "read": False,
        "created_at": now.isoformat()
    })
    return {"success": True, "message": f"Paket {pkg_req['package_name']} je aktiviran za korisnika {pkg_req['user_name']}."}

@api_router.post("/admin/package-requests/{request_id}/reject")
async def admin_reject_package(request_id: str, request: Request):
    """Reject a package request"""
    await get_admin_user(request)
    pkg_req = await db.package_requests.find_one({"id": request_id}, {"_id": 0})
    if not pkg_req:
        raise HTTPException(status_code=404, detail="Zahtjev nije pronađen")
    await db.package_requests.update_one(
        {"id": request_id},
        {"$set": {"status": "rejected", "rejected_at": datetime.now(timezone.utc).isoformat()}}
    )
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": pkg_req["user_id"],
        "type": "package_rejected",
        "title": "Zahtjev za paket odbijen",
        "message": f"Vaš zahtjev za paket {pkg_req['package_name']} nije odobren. Kontaktirajte nas za više informacija.",
        "data": {},
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    return {"success": True, "message": "Zahtjev je odbijen."}

# ============== ADMIN SESSION DEDUCTION ==============

@api_router.post("/admin/users/{user_id}/deduct-session")
async def admin_deduct_session(user_id: str, request: Request):
    """Deduct one session from user's membership"""
    await get_admin_user(request)
    membership = await db.memberships.find_one(
        {"user_id": user_id, "tip": "aktivna", "preostali_termini": {"$gt": 0}}, {"_id": 0}
    )
    if not membership:
        raise HTTPException(status_code=400, detail="Korisnik nema aktivnu članarinu sa preostalim terminima")
    await db.memberships.update_one(
        {"id": membership["id"]},
        {"$inc": {"preostali_termini": -1}}
    )
    remaining = membership["preostali_termini"] - 1
    return {"success": True, "message": f"Termin je oduzet. Preostalo: {remaining}", "preostali": remaining}

# ============== ADMIN PACKAGE FREEZE ==============

@api_router.post("/admin/users/{user_id}/freeze")
async def admin_freeze_package(user_id: str, data: AdminFreezeRequest, request: Request):
    """Freeze user's package"""
    await get_admin_user(request)
    membership = await db.memberships.find_one(
        {"user_id": user_id, "tip": "aktivna"}, {"_id": 0}
    )
    if not membership:
        raise HTTPException(status_code=400, detail="Korisnik nema aktivnu članarinu")
    await db.memberships.update_one(
        {"id": membership["id"]},
        {"$set": {
            "tip": "zamrznuta",
            "freeze_start": data.start_date,
            "freeze_end": data.end_date
        }}
    )
    await db.users.update_one({"user_id": user_id}, {"$set": {"status": "frozen"}})
    return {"success": True, "message": f"Članarina je zamrznuta od {data.start_date} do {data.end_date}"}

@api_router.post("/admin/users/{user_id}/unfreeze")
async def admin_unfreeze_package(user_id: str, request: Request):
    """Unfreeze user's package"""
    await get_admin_user(request)
    membership = await db.memberships.find_one(
        {"user_id": user_id, "tip": "zamrznuta"}, {"_id": 0}
    )
    if not membership:
        raise HTTPException(status_code=400, detail="Korisnik nema zamrznutu članarinu")
    # Extend expiry by freeze duration
    freeze_start = membership.get("freeze_start")
    freeze_end = membership.get("freeze_end")
    extra_days = 0
    if freeze_start and freeze_end:
        try:
            fs = datetime.strptime(freeze_start, "%Y-%m-%d")
            fe = datetime.strptime(freeze_end, "%Y-%m-%d")
            extra_days = (fe - fs).days
        except Exception:
            pass
    original_expiry = membership.get("datum_isteka", "")
    if isinstance(original_expiry, str):
        original_expiry = datetime.fromisoformat(original_expiry.replace("Z", "+00:00"))
    if original_expiry.tzinfo is None:
        original_expiry = original_expiry.replace(tzinfo=timezone.utc)
    new_expiry = (original_expiry + timedelta(days=extra_days)).isoformat()
    await db.memberships.update_one(
        {"id": membership["id"]},
        {"$set": {"tip": "aktivna", "datum_isteka": new_expiry}, "$unset": {"freeze_start": "", "freeze_end": ""}}
    )
    await db.users.update_one({"user_id": user_id}, {"$set": {"status": "active"}})
    return {"success": True, "message": f"Članarina je odmrznuta. Produžena za {extra_days} dana."}

# ============== ADMIN CLIENT NOTES ==============

@api_router.put("/admin/users/{user_id}/notes")
async def admin_update_notes(user_id: str, data: AdminNoteRequest, request: Request):
    """Update client notes"""
    await get_admin_user(request)
    await db.users.update_one({"user_id": user_id}, {"$set": {"notes": data.notes}})
    return {"success": True, "message": "Bilješka je ažurirana"}

@api_router.put("/admin/users/{user_id}/status")
async def admin_update_user_status(user_id: str, data: AdminStatusRequest, request: Request):
    """Update user account status"""
    await get_admin_user(request)
    await db.users.update_one({"user_id": user_id}, {"$set": {"status": data.status}})
    return {"success": True, "message": f"Status korisnika je ažuriran na: {data.status}"}

# ============== ADMIN FINANCIAL OVERVIEW ==============

@api_router.get("/admin/financial")
async def admin_financial_overview(request: Request):
    """Get financial overview including manual income"""
    await get_admin_user(request)
    now = datetime.now(timezone.utc)
    current_month = now.strftime("%Y-%m")
    # This month's approved packages
    this_month_requests = await db.package_requests.find(
        {"status": "approved", "approved_at": {"$regex": f"^{current_month}"}},
        {"_id": 0}
    ).to_list(1000)
    this_month_pkg_revenue = sum(r.get("package_price", 0) for r in this_month_requests)
    # This month's manual income
    this_month_manual = await db.manual_income.find(
        {"datum": {"$regex": f"^{current_month}"}},
        {"_id": 0}
    ).to_list(1000)
    this_month_manual_revenue = sum(m.get("iznos", 0) for m in this_month_manual)
    this_month_revenue = this_month_pkg_revenue + this_month_manual_revenue
    # Monthly revenue for past 12 months
    monthly_revenue = []
    for i in range(12):
        month_dt = now - timedelta(days=30 * i)
        month_str = month_dt.strftime("%Y-%m")
        # Check archive first
        archived = await db.revenue_archive.find_one({"month": month_str}, {"_id": 0})
        if archived and i > 0:
            monthly_revenue.append(archived)
        else:
            month_requests = await db.package_requests.find(
                {"status": "approved", "approved_at": {"$regex": f"^{month_str}"}},
                {"_id": 0}
            ).to_list(1000)
            pkg_rev = sum(r.get("package_price", 0) for r in month_requests)
            month_manual = await db.manual_income.find(
                {"datum": {"$regex": f"^{month_str}"}},
                {"_id": 0}
            ).to_list(1000)
            manual_rev = sum(m.get("iznos", 0) for m in month_manual)
            monthly_revenue.append({
                "month": month_str,
                "revenue": pkg_rev + manual_rev,
                "pkg_revenue": pkg_rev,
                "manual_revenue": manual_rev,
                "count": len(month_requests)
            })
    # Revenue by package type
    all_approved = await db.package_requests.find({"status": "approved"}, {"_id": 0}).to_list(5000)
    by_package = {}
    for r in all_approved:
        name = r.get("package_name", "Unknown")
        if name not in by_package:
            by_package[name] = {"count": 0, "revenue": 0}
        by_package[name]["count"] += 1
        by_package[name]["revenue"] += r.get("package_price", 0)
    # Client stats
    total_users = await db.users.count_documents({"is_admin": {"$ne": True}})
    active_memberships = await db.memberships.count_documents({"tip": "aktivna"})
    expired_memberships = await db.memberships.count_documents({"tip": {"$in": ["prethodna", "istekla"]}})
    # New clients this month
    new_clients = await db.users.count_documents({
        "is_admin": {"$ne": True},
        "created_at": {"$regex": f"^{current_month}"}
    })
    return {
        "ovaj_mjesec_prihod": this_month_revenue,
        "ovaj_mjesec_paketi": this_month_pkg_revenue,
        "ovaj_mjesec_rucni": this_month_manual_revenue,
        "mjesecni_prihod": list(reversed(monthly_revenue)),
        "prihod_po_paketu": [{"naziv": k, **v} for k, v in by_package.items()],
        "ukupno_klijenata": total_users,
        "aktivne_clanarine": active_memberships,
        "istekle_clanarine": expired_memberships,
        "novi_klijenti_mjesec": new_clients,
        "najprodavaniji": max(by_package.items(), key=lambda x: x[1]["count"])[0] if by_package else "-"
    }

# ============== ADMIN MANUAL INCOME ==============

@api_router.get("/admin/manual-income")
async def admin_get_manual_income(request: Request):
    """Get all manual income entries"""
    await get_admin_user(request)
    entries = await db.manual_income.find({}, {"_id": 0}).sort("datum", -1).to_list(500)
    return entries

@api_router.post("/admin/manual-income")
async def admin_add_manual_income(data: ManualIncomeRequest, request: Request):
    """Add a manual income entry"""
    admin_user = await get_admin_user(request)
    entry = {
        "id": str(uuid.uuid4()),
        "iznos": data.iznos,
        "opis": data.opis,
        "kategorija": data.kategorija,
        "datum": data.datum or datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "added_by": admin_user.get("name", "Admin"),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.manual_income.insert_one(entry)
    return {"success": True, "message": f"Prihod od {data.iznos} KM je dodan.", "entry": {k: v for k, v in entry.items() if k != "_id"}}

@api_router.delete("/admin/manual-income/{entry_id}")
async def admin_delete_manual_income(entry_id: str, request: Request):
    """Delete a manual income entry"""
    await get_admin_user(request)
    result = await db.manual_income.delete_one({"id": entry_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Unos nije pronađen")
    return {"success": True, "message": "Unos je obrisan"}

# ============== ADMIN REMINDERS ==============

@api_router.get("/admin/reminders")
async def admin_get_reminders(request: Request):
    """Get admin reminders"""
    await get_admin_user(request)
    reminders = await db.admin_reminders.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return reminders

@api_router.post("/admin/reminders")
async def admin_add_reminder(data: AdminReminderRequest, request: Request):
    """Add an admin reminder"""
    admin_user = await get_admin_user(request)
    reminder = {
        "id": str(uuid.uuid4()),
        "tekst": data.tekst,
        "datum": data.datum or datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "zavrseno": False,
        "added_by": admin_user.get("name", "Admin"),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.admin_reminders.insert_one(reminder)
    return {"success": True, "message": "Podsjetnik je dodan.", "reminder": {k: v for k, v in reminder.items() if k != "_id"}}

@api_router.post("/admin/reminders/{reminder_id}/toggle")
async def admin_toggle_reminder(reminder_id: str, request: Request):
    """Toggle reminder completed status"""
    await get_admin_user(request)
    reminder = await db.admin_reminders.find_one({"id": reminder_id}, {"_id": 0})
    if not reminder:
        raise HTTPException(status_code=404, detail="Podsjetnik nije pronađen")
    new_status = not reminder.get("zavrseno", False)
    await db.admin_reminders.update_one({"id": reminder_id}, {"$set": {"zavrseno": new_status}})
    return {"success": True, "zavrseno": new_status}

@api_router.delete("/admin/reminders/{reminder_id}")
async def admin_delete_reminder(reminder_id: str, request: Request):
    """Delete a reminder"""
    await get_admin_user(request)
    result = await db.admin_reminders.delete_one({"id": reminder_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Podsjetnik nije pronađen")
    return {"success": True, "message": "Podsjetnik je obrisan"}

# ============== ADMIN CUSTOM MEMBERSHIP ==============

@api_router.post("/admin/users/{user_id}/custom-membership")
async def admin_create_custom_membership(user_id: str, data: AdminCustomMembershipRequest, request: Request):
    """Admin creates a custom membership directly for a user (bypassing package requests)"""
    admin_user = await get_admin_user(request)
    # Verify user exists
    user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=404, detail="Korisnik nije pronađen")
    now = datetime.now(timezone.utc)
    # Deactivate any existing active membership
    await db.memberships.update_many(
        {"user_id": user_id, "tip": "aktivna"},
        {"$set": {"tip": "prethodna"}}
    )
    membership = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "naziv": data.naziv,
        "package_id": data.package_id,
        "tip": "aktivna",
        "preostali_termini": data.termini,
        "ukupni_termini": data.termini,
        "cijena": data.cijena,
        "datum_pocetka": now.isoformat(),
        "datum_isteka": (now + timedelta(days=data.trajanje_dana)).isoformat(),
        "created_by": admin_user.get("name", "Admin"),
        "created_at": now.isoformat()
    }
    await db.memberships.insert_one(membership)
    # Notify user
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "type": "package_approved",
        "title": "Paket aktiviran",
        "message": f"Vaš paket {data.naziv} je aktiviran! Imate {data.termini} termina na raspolaganju.",
        "data": {"package_name": data.naziv},
        "read": False,
        "created_at": now.isoformat()
    })
    return {"success": True, "message": f"Članarina '{data.naziv}' ({data.termini} termina) je kreirana za {user_doc.get('name', 'korisnika')}."}

# ============== ADMIN PACKAGE HISTORY ==============

@api_router.get("/admin/users/{user_id}/membership-history")
async def admin_get_membership_history(user_id: str, request: Request):
    """Get full membership history for a user"""
    await get_admin_user(request)
    memberships = await db.memberships.find(
        {"user_id": user_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    # Also get package requests
    requests = await db.package_requests.find(
        {"user_id": user_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return {"memberships": memberships, "requests": requests}

# ============== ADMIN PACKAGES CRUD ==============

@api_router.get("/admin/packages")
async def admin_get_packages(request: Request):
    """Get all packages (including inactive)"""
    await get_admin_user(request)
    packages = await db.packages.find({}, {"_id": 0}).sort("cijena", 1).to_list(50)
    return packages

@api_router.post("/admin/packages")
async def admin_create_package(data: PackageCreateRequest, request: Request):
    """Create a new package"""
    await get_admin_user(request)
    pkg_id = f"pkg_{data.naziv.lower().replace(' ', '_')}"
    existing = await db.packages.find_one({"id": pkg_id})
    if existing:
        raise HTTPException(status_code=400, detail="Paket sa ovim nazivom već postoji")
    package = {
        "id": pkg_id,
        "naziv": data.naziv,
        "opis": data.opis,
        "cijena": data.cijena,
        "valuta": "KM",
        "termini": data.termini,
        "trajanje_dana": data.trajanje_dana,
        "popular": data.popular,
        "active": data.active,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.packages.insert_one(package)
    return {"success": True, "message": f"Paket '{data.naziv}' je kreiran.", "package": {k: v for k, v in package.items() if k != "_id"}}

@api_router.put("/admin/packages/{package_id}")
async def admin_update_package(package_id: str, data: PackageCreateRequest, request: Request):
    """Update a package"""
    await get_admin_user(request)
    result = await db.packages.update_one(
        {"id": package_id},
        {"$set": {
            "naziv": data.naziv, "opis": data.opis, "cijena": data.cijena,
            "termini": data.termini, "trajanje_dana": data.trajanje_dana,
            "popular": data.popular, "active": data.active
        }}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Paket nije pronađen")
    return {"success": True, "message": f"Paket '{data.naziv}' je ažuriran."}

@api_router.delete("/admin/packages/{package_id}")
async def admin_delete_package(package_id: str, request: Request):
    """Soft-delete a package (mark inactive)"""
    await get_admin_user(request)
    result = await db.packages.update_one({"id": package_id}, {"$set": {"active": False}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Paket nije pronađen")
    return {"success": True, "message": "Paket je deaktiviran."}

# ============== ADMIN REVENUE ARCHIVE ==============

@api_router.post("/admin/revenue/archive")
async def admin_archive_month(request: Request):
    """Archive a month's revenue data"""
    await get_admin_user(request)
    body = await request.json()
    month_str = body.get("month")
    if not month_str:
        raise HTTPException(status_code=400, detail="Mjesec je obavezan (format: YYYY-MM)")
    # Calculate revenue for that month
    month_requests = await db.package_requests.find(
        {"status": "approved", "approved_at": {"$regex": f"^{month_str}"}},
        {"_id": 0}
    ).to_list(1000)
    pkg_rev = sum(r.get("package_price", 0) for r in month_requests)
    month_manual = await db.manual_income.find(
        {"datum": {"$regex": f"^{month_str}"}},
        {"_id": 0}
    ).to_list(1000)
    manual_rev = sum(m.get("iznos", 0) for m in month_manual)
    archive_entry = {
        "month": month_str,
        "revenue": pkg_rev + manual_rev,
        "pkg_revenue": pkg_rev,
        "manual_revenue": manual_rev,
        "count": len(month_requests),
        "archived_at": datetime.now(timezone.utc).isoformat()
    }
    await db.revenue_archive.update_one(
        {"month": month_str}, {"$set": archive_entry}, upsert=True
    )
    return {"success": True, "message": f"Prihod za {month_str} je arhiviran.", "data": archive_entry}

# ============== ADMIN EXPIRY ALERTS ==============

@api_router.get("/admin/alerts")
async def admin_expiry_alerts(request: Request):
    """Get expiry alerts - packages expiring in 7 days or 2 or fewer sessions remaining"""
    await get_admin_user(request)
    now = datetime.now(timezone.utc)
    seven_days = (now + timedelta(days=7)).isoformat()
    # Expiring within 7 days
    expiring = await db.memberships.find(
        {"tip": "aktivna", "datum_isteka": {"$lte": seven_days}},
        {"_id": 0}
    ).to_list(500)
    # 2 or fewer sessions remaining
    low_sessions = await db.memberships.find(
        {"tip": "aktivna", "preostali_termini": {"$lte": 2}},
        {"_id": 0}
    ).to_list(500)
    # Enrich with user info
    async def enrich(memberships):
        result = []
        seen_users = set()
        for m in memberships:
            if m["user_id"] in seen_users:
                continue
            seen_users.add(m["user_id"])
            user = await db.users.find_one({"user_id": m["user_id"]}, {"_id": 0, "name": 1, "phone": 1, "email": 1})
            result.append({**m, "korisnik": user})
        return result
    return {
        "isticu_uskoro": await enrich(expiring),
        "malo_termina": await enrich(low_sessions)
    }

# ============== ROOT ==============

@api_router.get("/")
async def root():
    return {"message": "Linea Reformer Pilates API"}

# ============== ADMIN AUTH ==============

@api_router.post("/admin/login")
async def admin_login(data: AdminLoginRequest, response: Response):
    """Admin login"""
    admin = await db.admins.find_one({"email": data.email}, {"_id": 0})
    if not admin:
        raise HTTPException(status_code=401, detail="Pogrešan email ili lozinka")
    if not bcrypt.verify(data.password, admin["password_hash"]):
        raise HTTPException(status_code=401, detail="Pogrešan email ili lozinka")
    session_token = str(uuid.uuid4())
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    await db.admin_sessions.delete_many({"admin_id": admin["admin_id"]})
    await db.admin_sessions.insert_one({
        "session_id": str(uuid.uuid4()),
        "admin_id": admin["admin_id"],
        "session_token": session_token,
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    response.set_cookie(
        key="admin_session_token", value=session_token,
        httponly=True, secure=True, samesite="none",
        max_age=7 * 24 * 60 * 60, path="/"
    )
    return {
        "admin_id": admin["admin_id"],
        "name": admin["name"],
        "email": admin["email"],
        "session_token": session_token
    }

@api_router.get("/admin/me")
async def admin_me(request: Request):
    """Get current admin"""
    admin = await get_admin_user(request)
    return {"admin_id": admin["admin_id"], "name": admin["name"], "email": admin["email"]}

@api_router.post("/admin/logout")
async def admin_logout(request: Request, response: Response):
    """Admin logout"""
    session_token = request.cookies.get("admin_session_token")
    if session_token:
        await db.admin_sessions.delete_many({"session_token": session_token})
    response.delete_cookie(key="admin_session_token", path="/")
    return {"message": "Uspješno ste se odjavili"}

# ============== ADMIN DASHBOARD ==============

@api_router.get("/admin/dashboard")
async def admin_dashboard(request: Request):
    """Admin dashboard stats"""
    await get_admin_user(request)
    now = datetime.now(timezone.utc)
    today_str = now.strftime("%Y-%m-%d")
    total_users = await db.users.count_documents({"is_admin": {"$ne": True}})
    active_memberships = await db.memberships.count_documents({"tip": "aktivna"})
    today_trainings = await db.trainings.count_documents({
        "datum": {"$regex": f"^{today_str}"}, "tip": "predstojeći"
    })
    total_bookings = await db.trainings.count_documents({})
    pending_requests = await db.package_requests.count_documents({"status": "pending"})
    recent_users = await db.users.find(
        {"is_admin": {"$ne": True}}, {"_id": 0, "user_id": 1, "name": 1, "email": 1, "phone": 1, "created_at": 1}
    ).sort("created_at", -1).to_list(5)
    recent_requests = await db.package_requests.find(
        {"status": "pending"}, {"_id": 0}
    ).sort("created_at", -1).to_list(10)
    return {
        "ukupno_korisnika": total_users,
        "aktivne_clanarine": active_memberships,
        "danasnji_treninzi": today_trainings,
        "ukupno_rezervacija": total_bookings,
        "zahtjevi_na_cekanju": pending_requests,
        "posljednji_korisnici": recent_users,
        "posljednji_zahtjevi": recent_requests
    }

# ============== ADMIN USERS ==============

@api_router.get("/admin/users")
async def admin_get_users(request: Request):
    """Get all users with full details"""
    await get_admin_user(request)
    users = await db.users.find({"is_admin": {"$ne": True}}, {"_id": 0}).sort("created_at", -1).to_list(500)
    result = []
    for u in users:
        membership = await db.memberships.find_one(
            {"user_id": u["user_id"], "tip": {"$in": ["aktivna", "zamrznuta"]}}, {"_id": 0}
        )
        upcoming = await db.trainings.count_documents(
            {"user_id": u["user_id"], "tip": "predstojeći"}
        )
        pending_req = await db.package_requests.find_one(
            {"user_id": u["user_id"], "status": "pending"}, {"_id": 0}
        )
        user_status = u.get("status", "active")
        if membership and membership.get("tip") == "zamrznuta":
            user_status = "frozen"
        elif membership and membership.get("tip") == "aktivna":
            user_status = "active"
        elif pending_req:
            user_status = "pending"
        elif not membership:
            user_status = "pending" if pending_req else u.get("status", "active")
        result.append({
            **u,
            "aktivna_clanarina": membership is not None and membership.get("tip") == "aktivna",
            "naziv_paketa": membership.get("naziv", "-") if membership else (pending_req.get("package_name", "Na čekanju") if pending_req else "-"),
            "preostali_termini": membership.get("preostali_termini", 0) if membership else 0,
            "ukupni_termini": membership.get("ukupni_termini", 0) if membership else 0,
            "datum_aktivacije": membership.get("datum_pocetka", "") if membership else "",
            "datum_isteka": membership.get("datum_isteka", "") if membership else "",
            "predstojeći_treninzi": upcoming,
            "membership_status": membership.get("tip", "-") if membership else "-",
            "freeze_start": membership.get("freeze_start") if membership else None,
            "freeze_end": membership.get("freeze_end") if membership else None,
            "korisnik_status": user_status,
            "pending_request": pending_req
        })
    return result

# ============== ADMIN SCHEDULE MANAGEMENT ==============

@api_router.get("/admin/schedule")
async def admin_get_schedule(request: Request):
    """Get all schedule slots from DB"""
    await get_admin_user(request)
    slots = await db.schedule_slots.find(
        {}, {"_id": 0}
    ).sort([("datum", 1), ("vrijeme", 1)]).to_list(5000)
    # Enrich with booking count
    for slot in slots:
        booked = await db.trainings.count_documents({
            "slot_id": slot["id"], "tip": {"$in": ["predstojeći", "završen"]}
        })
        slot["zauzeto"] = booked
        slot["slobodna_mjesta"] = max(0, slot["ukupno_mjesta"] - booked)
    return slots

@api_router.post("/admin/schedule/slots")
async def admin_create_slot(data: AdminSlotRequest, request: Request):
    """Create a new schedule slot"""
    await get_admin_user(request)
    slot_id = f"slot_{data.datum.replace('-', '')}_{data.vrijeme.replace(':', '')}"
    existing = await db.schedule_slots.find_one({"id": slot_id})
    if existing:
        raise HTTPException(status_code=400, detail="Ovaj termin već postoji")
    slot = {
        "id": slot_id,
        "datum": data.datum,
        "vrijeme": data.vrijeme,
        "instruktor": data.instruktor,
        "ukupno_mjesta": data.ukupno_mjesta,
        "trajanje": data.trajanje,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.schedule_slots.insert_one(slot)
    return {"success": True, "slot": {k: v for k, v in slot.items() if k != "_id"}}

@api_router.put("/admin/schedule/slots/{slot_id}")
async def admin_update_slot(slot_id: str, data: AdminSlotRequest, request: Request):
    """Update a schedule slot"""
    await get_admin_user(request)
    result = await db.schedule_slots.update_one(
        {"id": slot_id},
        {"$set": {
            "datum": data.datum, "vrijeme": data.vrijeme,
            "instruktor": data.instruktor, "ukupno_mjesta": data.ukupno_mjesta,
            "trajanje": data.trajanje
        }}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Termin nije pronađen")
    return {"success": True, "message": "Termin je ažuriran"}

@api_router.delete("/admin/schedule/slots/{slot_id}")
async def admin_delete_slot(slot_id: str, request: Request):
    """Delete a schedule slot"""
    await get_admin_user(request)
    booked = await db.trainings.count_documents({
        "slot_id": slot_id, "tip": "predstojeći"
    })
    if booked > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Ne možete obrisati termin sa {booked} aktivnih rezervacija. Prvo otkažite rezervacije."
        )
    result = await db.schedule_slots.delete_one({"id": slot_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Termin nije pronađen")
    return {"success": True, "message": "Termin je obrisan"}

# ============== ADMIN BOOKINGS ==============

@api_router.get("/admin/bookings")
async def admin_get_bookings(request: Request):
    """Get all bookings"""
    await get_admin_user(request)
    trainings = await db.trainings.find(
        {}, {"_id": 0}
    ).sort("datum", -1).to_list(1000)
    result = []
    for t in trainings:
        user = await db.users.find_one({"user_id": t["user_id"]}, {"_id": 0, "name": 1, "phone": 1, "email": 1})
        result.append({**t, "korisnik": user})
    return result

@api_router.post("/admin/bookings/{training_id}/cancel")
async def admin_cancel_booking(training_id: str, data: AdminCancelRequest, request: Request):
    """Cancel a booking (admin only). Only possible 12+ hours before the training."""
    await get_admin_user(request)
    training = await db.trainings.find_one({"id": training_id}, {"_id": 0})
    if not training:
        raise HTTPException(status_code=404, detail="Rezervacija nije pronađena")
    if training["tip"] not in ["predstojeći"]:
        raise HTTPException(status_code=400, detail="Samo predstojeće rezervacije se mogu otkazati")
    # Parse training datetime
    training_datum = training.get("datum", "")
    training_vrijeme = training.get("vrijeme", "00:00")
    try:
        if "T" in training_datum:
            training_dt = datetime.fromisoformat(training_datum.replace("Z", "+00:00"))
        else:
            hour, minute = training_vrijeme.split(":")
            training_dt = datetime.strptime(training_datum, "%Y-%m-%d").replace(
                hour=int(hour), minute=int(minute), tzinfo=timezone.utc
            )
    except Exception:
        raise HTTPException(status_code=400, detail="Neispravan format datuma treninga")
    now = datetime.now(timezone.utc)
    hours_until = (training_dt - now).total_seconds() / 3600
    if hours_until < 12:
        raise HTTPException(
            status_code=400,
            detail="Otkazivanje nije moguće manje od 12 sati prije termina. Termin se računa kao iskorišten."
        )
    # Cancel the training
    await db.trainings.update_one(
        {"id": training_id},
        {"$set": {"tip": "otkazan", "razlog_otkazivanja": data.razlog or "Otkazano od strane admina"}}
    )
    # Restore membership slot
    membership = await db.memberships.find_one(
        {"user_id": training["user_id"], "tip": "aktivna"}, {"_id": 0}
    )
    if membership:
        await db.memberships.update_one(
            {"id": membership["id"]},
            {"$inc": {"preostali_termini": 1}}
        )
    # Notify the user
    notification = {
        "id": str(uuid.uuid4()),
        "user_id": training["user_id"],
        "type": "booking_cancelled",
        "title": "Termin otkazan",
        "message": f"Vaš termin za {training_datum} u {training_vrijeme} je otkazan.\n{data.razlog or ''}".strip(),
        "data": {"training_id": training_id},
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.notifications.insert_one(notification)
    return {"success": True, "message": "Rezervacija je uspješno otkazana. Termin je vraćen korisniku."}

# ============== ADMIN BULK SCHEDULE ==============

@api_router.post("/admin/schedule/generate-week")
async def admin_generate_week(request: Request):
    """Generate schedule slots for the next 7 days"""
    await get_admin_user(request)
    body = await request.json()
    start_date_str = body.get("start_date")
    days_count = body.get("days", 7)
    instructors = body.get("instructors", ["Marija Trisic"])
    times = body.get("times", ["08:00", "09:00", "10:00", "11:00", "17:00", "18:00", "19:00", "20:00"])
    spots = body.get("spots_per_slot", 3)
    if start_date_str:
        start_date = datetime.strptime(start_date_str, "%Y-%m-%d")
    else:
        start_date = datetime.now(timezone.utc)
    created = 0
    for day_offset in range(days_count):
        date = start_date + timedelta(days=day_offset)
        if date.weekday() == 6:  # Skip Sunday (neradni dan)
            continue
        date_str = date.strftime("%Y-%m-%d")
        for idx, time in enumerate(times):
            slot_id = f"slot_{date_str.replace('-', '')}_{time.replace(':', '')}"
            existing = await db.schedule_slots.find_one({"id": slot_id})
            if not existing:
                slot = {
                    "id": slot_id,
                    "datum": date_str,
                    "vrijeme": time,
                    "instruktor": instructors[idx % len(instructors)],
                    "ukupno_mjesta": spots,
                    "trajanje": 50,
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                await db.schedule_slots.insert_one(slot)
                created += 1
    return {"success": True, "message": f"Kreirano {created} novih termina", "created": created}

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

# ============== NOTIFICATION SCHEDULER ==============

scheduler = AsyncIOScheduler()

async def check_day_before_reminders():
    """Send reminders for trainings happening tomorrow"""
    try:
        now = datetime.now(timezone.utc)
        tomorrow = (now + timedelta(days=1)).strftime("%Y-%m-%d")
        trainings = await db.trainings.find(
            {"tip": "predstojeći", "datum": {"$regex": f"^{tomorrow}"}},
            {"_id": 0}
        ).to_list(1000)
        for training in trainings:
            existing = await db.notifications.find_one({
                "user_id": training["user_id"],
                "type": "day_before_reminder",
                "data.training_id": training["id"]
            })
            if not existing:
                await db.notifications.insert_one({
                    "id": str(uuid.uuid4()),
                    "user_id": training["user_id"],
                    "type": "day_before_reminder",
                    "title": "Sutrašnji trening",
                    "message": f"Sutra te očekuje tvoj Pilates Reformer trening\nVidimo se u {training['vrijeme']}. Radujemo se zajedničkom treningu.",
                    "data": {"training_id": training["id"]},
                    "read": False,
                    "created_at": datetime.now(timezone.utc).isoformat()
                })
        logger.info(f"Day-before check: {len(trainings)} trainings for {tomorrow}")
    except Exception as e:
        logger.error(f"Day-before reminder error: {e}")

async def check_inactivity_reminders():
    """Send reminders for users inactive 7+ days"""
    try:
        now = datetime.now(timezone.utc)
        seven_days_ago = (now - timedelta(days=7)).isoformat()
        users = await db.users.find(
            {"last_activity": {"$lt": seven_days_ago}},
            {"_id": 0}
        ).to_list(1000)
        for user_doc in users:
            uid = user_doc["user_id"]
            upcoming = await db.trainings.count_documents({"user_id": uid, "tip": "predstojeći"})
            if upcoming > 0:
                continue
            existing = await db.notifications.find_one({
                "user_id": uid,
                "type": "inactivity_reminder",
                "created_at": {"$gte": seven_days_ago}
            })
            if not existing:
                await db.notifications.insert_one({
                    "id": str(uuid.uuid4()),
                    "user_id": uid,
                    "type": "inactivity_reminder",
                    "title": "Nedostaješ nam",
                    "message": "Nedostaješ nam u studiju\nVrijeme je da rezervišeš novi Pilates Reformer trening.",
                    "data": {},
                    "read": False,
                    "created_at": datetime.now(timezone.utc).isoformat()
                })
        logger.info(f"Inactivity check: {len(users)} inactive users checked")
    except Exception as e:
        logger.error(f"Inactivity reminder error: {e}")

# ============== SEED DATA ==============

async def seed_packages():
    """Seed default packages if empty"""
    count = await db.packages.count_documents({})
    if count > 0:
        return
    default_packages = [
        {"id": "pkg_single", "naziv": "Pojedinacni", "opis": "Mala grupa do 3 osobe", "cijena": 25, "valuta": "KM", "termini": 1, "trajanje_dana": 30, "popular": False, "best_value": False, "active": True},
        {"id": "pkg_basic", "naziv": "Basic", "opis": "Mala grupa do 3 osobe", "cijena": 90, "valuta": "KM", "termini": 6, "trajanje_dana": 30, "popular": False, "best_value": False, "active": True},
        {"id": "pkg_active", "naziv": "Linea Active", "opis": "Mala grupa do 3 osobe", "cijena": 125, "valuta": "KM", "termini": 8, "trajanje_dana": 30, "popular": False, "best_value": False, "active": True},
        {"id": "pkg_balance", "naziv": "Linea Balance", "opis": "Mala grupa do 3 osobe", "cijena": 145, "valuta": "KM", "termini": 10, "trajanje_dana": 30, "popular": False, "best_value": False, "active": True},
        {"id": "pkg_gold", "naziv": "Linea Gold", "opis": "Mala grupa do 3 osobe", "cijena": 175, "valuta": "KM", "termini": 12, "trajanje_dana": 30, "popular": True, "best_value": False, "active": True},
        {"id": "pkg_premium", "naziv": "Linea Premium", "opis": "Mala grupa do 3 osobe", "cijena": 200, "valuta": "KM", "termini": 16, "trajanje_dana": 30, "popular": False, "best_value": True, "active": True},
    ]
    for pkg in default_packages:
        pkg["created_at"] = datetime.now(timezone.utc).isoformat()
    await db.packages.insert_many(default_packages)
    logger.info(f"Seeded {len(default_packages)} packages")

async def seed_admin():
    """Create admin users in the regular users collection"""
    admin_phones = ["+38766024148"]
    for phone in admin_phones:
        existing = await db.users.find_one({"phone": phone})
        if existing:
            if not existing.get("is_admin"):
                await db.users.update_one({"phone": phone}, {"$set": {"is_admin": True}})
                logger.info(f"Marked {phone} as admin")
        else:
            admin_user = {
                "user_id": f"admin_{uuid.uuid4().hex[:8]}",
                "phone": phone,
                "name": "Admin",
                "email": "",
                "country_code": detect_phone_country(phone),
                "is_admin": True,
                "status": "active",
                "notes": "",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "last_activity": datetime.now(timezone.utc).isoformat()
            }
            await db.users.insert_one(admin_user)
            logger.info(f"Admin user created: {phone}")
    # Keep legacy admin for backward compatibility
    existing_legacy = await db.admins.find_one({"email": "admin@linea.ba"})
    if not existing_legacy:
        admin = {
            "admin_id": f"admin_{uuid.uuid4().hex[:8]}",
            "email": "admin@linea.ba",
            "name": "Admin",
            "password_hash": bcrypt.hash("admin123"),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.admins.insert_one(admin)
        logger.info("Legacy admin created: admin@linea.ba")

async def seed_schedule():
    """Seed schedule slots for 30 days if empty"""
    count = await db.schedule_slots.count_documents({})
    if count > 0:
        return
    now = datetime.now(timezone.utc)
    times = ["08:00", "09:00", "10:00", "11:00", "17:00", "18:00", "19:00", "20:00"]
    slots = []
    for day_offset in range(30):
        date = now + timedelta(days=day_offset)
        if date.weekday() == 6:  # Skip Sunday (neradni dan)
            continue
        date_str = date.strftime("%Y-%m-%d")
        for idx, time_str in enumerate(times):
            slot_id = f"slot_{date_str.replace('-', '')}_{time_str.replace(':', '')}"
            slots.append({
                "id": slot_id,
                "datum": date_str,
                "vrijeme": time_str,
                "instruktor": "Marija Trisic",
                "ukupno_mjesta": 3,
                "trajanje": 50,
                "created_at": now.isoformat()
            })
    if slots:
        await db.schedule_slots.insert_many(slots)
        logger.info(f"Seeded {len(slots)} schedule slots")

async def seed_studio_users():
    """Seed/update studio admin users and fix instructor names"""
    # Update existing admin +38766024148 → Linea Trebinje, PIN 2803
    existing_main = await db.users.find_one({"phone": "+38766024148"})
    if existing_main:
        await db.users.update_one(
            {"phone": "+38766024148"},
            {"$set": {"name": "Linea Trebinje", "pin_hash": bcrypt.hash("2803"), "is_admin": True}}
        )
        logger.info("Updated admin +38766024148 -> Linea Trebinje, PIN 2803")
    else:
        await db.users.insert_one({
            "user_id": f"user_{uuid.uuid4().hex[:12]}",
            "phone": "+38766024148",
            "name": "Linea Trebinje",
            "email": "",
            "is_admin": True,
            "status": "active",
            "notes": "",
            "pin_hash": bcrypt.hash("2803"),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "last_activity": datetime.now(timezone.utc).isoformat()
        })
        logger.info("Created admin +38766024148 -> Linea Trebinje")

    # Admin Stefan +381640080404
    existing_stefan = await db.users.find_one({"phone": "+381640080404"})
    if not existing_stefan:
        await db.users.insert_one({
            "user_id": f"user_{uuid.uuid4().hex[:12]}",
            "phone": "+381640080404",
            "name": "Stefan",
            "email": "",
            "is_admin": True,
            "status": "active",
            "notes": "",
            "pin_hash": bcrypt.hash("1234"),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "last_activity": datetime.now(timezone.utc).isoformat()
        })
        logger.info("Created admin Stefan +381640080404")
    else:
        await db.users.update_one({"phone": "+381640080404"}, {"$set": {"is_admin": True, "name": "Stefan"}})

    # Admin Nevena +381652344415
    existing_nevena = await db.users.find_one({"phone": "+381652344415"})
    if not existing_nevena:
        await db.users.insert_one({
            "user_id": f"user_{uuid.uuid4().hex[:12]}",
            "phone": "+381652344415",
            "name": "Nevena",
            "email": "",
            "is_admin": True,
            "status": "active",
            "notes": "",
            "pin_hash": bcrypt.hash("1234"),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "last_activity": datetime.now(timezone.utc).isoformat()
        })
        logger.info("Created admin Nevena +381652344415")
    else:
        await db.users.update_one({"phone": "+381652344415"}, {"$set": {"is_admin": True, "name": "Nevena"}})

    # Fix all existing schedule slots and trainings to use Marija Trisic
    await db.schedule_slots.update_many({}, {"$set": {"instruktor": "Marija Trisic"}})
    await db.trainings.update_many({}, {"$set": {"instruktor": "Marija Trisic"}})
    # Remove Sunday slots from schedule
    all_slots = await db.schedule_slots.find({}, {"_id": 0, "id": 1, "datum": 1}).to_list(10000)
    sunday_ids = []
    for s in all_slots:
        try:
            d = datetime.strptime(s["datum"], "%Y-%m-%d")
            if d.weekday() == 6:
                sunday_ids.append(s["id"])
        except Exception:
            pass
    if sunday_ids:
        await db.schedule_slots.delete_many({"id": {"$in": sunday_ids}})
        logger.info(f"Removed {len(sunday_ids)} Sunday schedule slots")
    logger.info("Studio users and instructor data updated")

# ============== STARTUP / SHUTDOWN ==============

@app.on_event("startup")
async def startup():
    await seed_packages()
    await seed_admin()
    await seed_schedule()
    await seed_studio_users()
    # Start notification scheduler - runs every hour
    scheduler.add_job(check_day_before_reminders, 'interval', hours=1, id='day_before')
    scheduler.add_job(check_inactivity_reminders, 'interval', hours=6, id='inactivity')
    scheduler.start()
    logger.info("Notification scheduler started")

@app.on_event("shutdown")
async def shutdown_db_client():
    scheduler.shutdown(wait=False)
    client.close()

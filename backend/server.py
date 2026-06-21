from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Query
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, AliasChoices
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo
import httpx
from passlib.hash import bcrypt
from apscheduler.schedulers.asyncio import AsyncIOScheduler
import asyncio
import re
import random
import smtplib
import requests
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

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

# ============== EXPO PUSH NOTIFICATIONS ==============

async def send_push_notification(user_id: str, title: str, message: str, data: dict = None):
    """Send push notification via Expo Push API"""
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "push_token": 1})
    if not user or not user.get("push_token"):
        logger.info(f"No push token for user {user_id}, skipping push")
        return False
    token = user["push_token"]
    if not token.startswith("ExponentPushToken["):
        logger.warning(f"Invalid push token format for user {user_id}")
        return False
    payload = {
        "to": token,
        "sound": "default",
        "title": title,
        "body": message,
    }
    if data:
        payload["data"] = data
    try:
        async with httpx.AsyncClient() as client_http:
            res = await client_http.post(
                "https://exp.host/--/api/v2/push/send",
                json=payload,
                headers={"Accept": "application/json", "Content-Type": "application/json"}
            )
            if res.status_code == 200:
                logger.info(f"Push sent to user {user_id}: {title}")
                return True
            else:
                logger.error(f"Push failed for user {user_id}: {res.status_code} {res.text}")
                return False
    except Exception as e:
        logger.error(f"Push notification error for user {user_id}: {e}")
        return False

async def send_push_to_all_users(title: str, message: str, data: dict = None):
    """Send push notification to all users with push tokens"""
    users = await db.users.find({"push_token": {"$exists": True, "$ne": ""}}, {"_id": 0, "user_id": 1, "push_token": 1}).to_list(10000)
    sent = 0
    for u in users:
        result = await send_push_notification(u["user_id"], title, message, data)
        if result:
            sent += 1
    return sent


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
    admin_override: bool = False  # When True and requester is admin, skip remaining-sessions check

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


class UserProfileUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None


class PinChangeRequest(BaseModel):
    old_pin: str
    new_pin: str


class ForgotPinRequest(BaseModel):
    email: str


class ResetPinRequest(BaseModel):
    email: str
    code: str
    new_pin: str

class AdminNoteRequest(BaseModel):
    notes: str

class AdminFreezeRequest(BaseModel):
    start_date: str
    end_date: str
    freeze_reason: str = ""

class AdminStatusRequest(BaseModel):
    status: str  # "active", "pending", "expired", "frozen"

class AdminMembershipStartDateRequest(BaseModel):
    start_date: str  # YYYY-MM-DD
    cijena: Optional[float] = None  # Optionally update the membership price (KM)

class AdminCustomMembershipRequest(BaseModel):
    # user_id also comes from the path; naziv/termini/cijena fall back to the
    # package defaults when omitted, so all of these are optional in the body.
    user_id: Optional[str] = None
    package_id: Optional[str] = None
    naziv: Optional[str] = None
    cijena: Optional[float] = None
    termini: Optional[int] = None
    trajanje_dana: int = 35
    start_date: Optional[str] = None

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
    trajanje_dana: int = 35
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

async def expire_overdue_memberships(user_id: str):
    """Mark any active membership past its expiry date as expired.

    Sets tip to "istekla". Surplus sessions are forfeited (+3 -> 0) but any debt is
    kept (-2 -> -2) via preostali_termini = min(preostali_termini, 0), so the live
    minus stays correct through expiry. datum_isteka is stored as a timezone-aware
    ISO string, so a lexicographic string comparison against the current ISO
    timestamp is correct (same convention used elsewhere in this file).
    """
    now_iso = datetime.now(timezone.utc).isoformat()
    # Pipeline update (MongoDB 4.2+): višak termina propada (+3 -> 0), dug se
    # zadržava (-2 -> -2).
    await db.memberships.update_many(
        {
            "user_id": user_id,
            "tip": "aktivna",
            "datum_isteka": {"$ne": None, "$lt": now_iso},
        },
        [
            {"$set": {
                "tip": "istekla",
                "preostali_termini": {"$min": ["$preostali_termini", 0]},
            }}
        ],
    )


async def compute_minus(user_id: str) -> int:
    """Računa broj "minus" treninga UŽIVO, bez minus:true flaga.

        minus = max(0, -Σ preostali_termini)   # dug nošen u balansima paketa (< 0)
              + broj "consuming" treninga       # samo kad članica NEMA nijedan paket

    "Consuming" = tip ∈ {predstojeći, završen, iskoristen} (probni i otkazan se NE
    broje → probni nikad nije minus; otkazivanje samo-zaliječi minus).
    """
    # Označi istekle pakete prije računa (idempotentno; čuva dug po pravilu iznad).
    await expire_overdue_memberships(user_id)

    memberships = await db.memberships.find(
        {"user_id": user_id},
        {"_id": 0, "preostali_termini": 1},
    ).to_list(1000)

    # Sabirak 1: dug nošen u balansima paketa (negativan preostali_termini).
    balance_debt = sum(
        -m.get("preostali_termini", 0)
        for m in memberships
        if (m.get("preostali_termini", 0) or 0) < 0
    )

    # Sabirak 2: rubni slučaj — članica bez ijednog paketa da ponese dug
    # (npr. admin ručni unos / booking bez ikakve članarine).
    uncovered = 0
    if not memberships:
        uncovered = await db.trainings.count_documents({
            "user_id": user_id,
            "tip": {"$in": ["predstojeći", "završen", "iskoristen"]},
        })

    return balance_debt + uncovered


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

    # Auto-expire any overdue active membership on every authenticated request
    await expire_overdue_memberships(user_doc["user_id"])

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

GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "1085993530181-g4cnkler2rr97b1sob4b57biqfj15id3.apps.googleusercontent.com")

class GoogleExchangeRequest(BaseModel):
    code: str
    code_verifier: str
    redirect_uri: str

@api_router.post("/auth/google/exchange-code")
async def google_exchange_code(data: GoogleExchangeRequest, response: Response):
    """Exchange Google auth code for tokens, then login or register user"""
    async with httpx.AsyncClient() as client:
        # Exchange code for tokens
        try:
            token_res = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "code": data.code,
                    "client_id": GOOGLE_CLIENT_ID,
                    "code_verifier": data.code_verifier,
                    "redirect_uri": data.redirect_uri,
                    "grant_type": "authorization_code"
                }
            )
            if token_res.status_code != 200:
                logger.error(f"Google token exchange failed: {token_res.status_code} {token_res.text}")
                raise HTTPException(status_code=401, detail="Google autentifikacija neuspjesna")
            tokens = token_res.json()
            access_token = tokens.get("access_token")
            if not access_token:
                raise HTTPException(status_code=401, detail="Nema access tokena od Google-a")
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Google token exchange error: {e}")
            raise HTTPException(status_code=500, detail="Greska pri Google autentifikaciji")

        # Get user info from Google
        try:
            userinfo_res = await client.get(
                "https://www.googleapis.com/oauth2/v2/userinfo",
                headers={"Authorization": f"Bearer {access_token}"}
            )
            if userinfo_res.status_code != 200:
                raise HTTPException(status_code=401, detail="Neuspjesno dohvatanje korisnickih podataka")
            google_user = userinfo_res.json()
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Google userinfo error: {e}")
            raise HTTPException(status_code=500, detail="Greska pri dohvatanju podataka")

    email = google_user.get("email")
    name = google_user.get("name", "")
    picture = google_user.get("picture")
    if not email:
        raise HTTPException(status_code=400, detail="Email nije dostupan od Google-a")

    # Check if user exists
    existing_user = await db.users.find_one({"email": email}, {"_id": 0})
    if existing_user:
        user_id = existing_user["user_id"]
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"name": name, "picture": picture, "last_activity": datetime.now(timezone.utc).isoformat()}}
        )
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
            "is_admin": False,
            "status": "active",
            "notes": "",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "last_activity": datetime.now(timezone.utc).isoformat()
        })

    # Create session
    session_token = str(uuid.uuid4())
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    await db.user_sessions.delete_many({"user_id": user_id})
    await db.user_sessions.insert_one({
        "session_id": str(uuid.uuid4()),
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    })

    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=7 * 24 * 60 * 60,
        path="/"
    )

    user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0, "pin_hash": 0})
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
    # Minus se računa UŽIVO (negativan balans paketa + nepokriveni treninzi),
    # a ne iz zamrznutog minus:true flaga. Vidi compute_minus().
    user_doc["minus_treninzi"] = await compute_minus(user.user_id)
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
    """Get user's active memberships with correct status"""
    user = await get_current_user(request)
    now = datetime.now(timezone.utc)
    memberships = await db.memberships.find(
        {"user_id": user.user_id, "tip": "aktivna"},
        {"_id": 0}
    ).to_list(100)
    result = []
    for m in memberships:
        isteka = m.get("datum_isteka", "")
        preostali = m.get("preostali_termini", 0)
        try:
            if isinstance(isteka, str):
                exp = datetime.fromisoformat(isteka.replace("Z", "+00:00"))
            else:
                exp = isteka
            if exp.tzinfo is None:
                exp = exp.replace(tzinfo=timezone.utc)
            is_valid = exp > now and preostali > 0
        except Exception:
            is_valid = preostali > 0
        m["status"] = "aktivna" if is_valid else "istekla"
        result.append(m)
    return result


# ============== PUSH TOKEN ==============

class PushTokenRequest(BaseModel):
    push_token: str

@api_router.post("/user/push-token")
async def save_push_token(data: PushTokenRequest, request: Request):
    """Save user's Expo push token"""
    user = await get_current_user(request)
    await db.users.update_one(
        {"user_id": user.user_id},
        {"$set": {"push_token": data.push_token}}
    )
    return {"success": True}

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
    """Get user's upcoming trainings where datetime is in the future"""
    user = await get_current_user(request)
    now = datetime.now(timezone.utc)
    trainings = await db.trainings.find(
        {"user_id": user.user_id, "tip": {"$in": ["predstojeći", "probni"]}},
        {"_id": 0}
    ).to_list(100)
    result = []
    for t in trainings:
        try:
            d = t.get("datum", "")
            if "T" in d:
                d = d.split("T")[0]
            v = t.get("vrijeme", "00:00")
            training_dt = datetime.strptime(f"{d} {v}", "%Y-%m-%d %H:%M").replace(tzinfo=timezone.utc)
            if training_dt > now:
                result.append(t)
        except Exception:
            result.append(t)
    return result

@api_router.get("/trainings/past")
async def get_past_trainings(request: Request):
    """Get user's past trainings (time passed or status finished)"""
    user = await get_current_user(request)
    now = datetime.now(timezone.utc)
    trainings = await db.trainings.find(
        {"user_id": user.user_id, "tip": {"$in": ["prethodni", "završen", "iskoristen", "predstojeći"]}},
        {"_id": 0}
    ).to_list(500)
    result = []
    for t in trainings:
        if t.get("tip") in ["prethodni", "završen", "iskoristen"]:
            result.append(t)
            continue
        try:
            d = t.get("datum", "")
            if "T" in d:
                d = d.split("T")[0]
            v = t.get("vrijeme", "00:00")
            training_dt = datetime.strptime(f"{d} {v}", "%Y-%m-%d %H:%M").replace(tzinfo=timezone.utc)
            if training_dt <= now:
                result.append(t)
        except Exception:
            pass
    return result

@api_router.post("/trainings/{training_id}/cancel")
async def cancel_training(training_id: str, request: Request):
    """Cancel a training and restore membership session"""
    user = await get_current_user(request)
    training = await db.trainings.find_one(
        {"id": training_id, "user_id": user.user_id}, {"_id": 0}
    )
    if not training:
        raise HTTPException(status_code=404, detail="Trening nije pronadjen")
    if training.get("tip") == "otkazan":
        raise HTTPException(status_code=400, detail="Trening je vec otkazan")
    await db.trainings.update_one(
        {"id": training_id},
        {"$set": {"tip": "otkazan"}}
    )
    logger.info(f"Training {training_id} cancelled for user {user.user_id}")
    # Restore session to active membership
    restore_result = await db.memberships.update_one(
        {"user_id": user.user_id, "tip": "aktivna"},
        {"$inc": {"preostali_termini": 1}}
    )
    logger.info(f"Membership restore for user {user.user_id}: matched={restore_result.matched_count}, modified={restore_result.modified_count}")
    return {"success": True, "message": "Trening je otkazan"}


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

# ============== BOOKING TIME WINDOW ==============

# Slot datum/vrijeme are stored in the studio's LOCAL time. The server runs in
# UTC, so we convert to UTC before comparing. ZoneInfo handles CET/CEST (DST)
# automatically, so no fixed offset is hardcoded.
STUDIO_TZ = ZoneInfo("Europe/Sarajevo")
BOOKING_CUTOFF_MINUTES = 120  # 2 sata prije početka

def slot_start_utc(datum: str, vrijeme: str):
    """'2026-06-21' + '17:00' (lokalno vrijeme studija) -> UTC datetime, ili None."""
    try:
        local = datetime.strptime(f"{datum} {vrijeme}", "%Y-%m-%d %H:%M")
    except (ValueError, TypeError):
        return None
    return local.replace(tzinfo=STUDIO_TZ).astimezone(timezone.utc)

def is_bookable(datum: str, vrijeme: str, now: datetime = None) -> bool:
    """True ako je do početka termina ostalo >= 2 sata. Neispravan format ne blokira."""
    start = slot_start_utc(datum, vrijeme)
    if start is None:
        return True
    now = now or datetime.now(timezone.utc)
    return start - now >= timedelta(minutes=BOOKING_CUTOFF_MINUTES)

# ============== BOOKING ==============

@api_router.post("/bookings")
async def create_booking(data: BookingRequest, request: Request):
    """Book a training slot"""
    user = await get_current_user(request)

    # Find the user's active membership (regardless of remaining sessions)
    membership = await db.memberships.find_one(
        {"user_id": user.user_id, "tip": "aktivna"}, {"_id": 0}
    )

    # Check one booking per day limit
    existing_today = await db.trainings.find_one({
        "user_id": user.user_id,
        "datum": {"$regex": f"^{data.datum}"},
        "tip": "predstojeći"
    })
    if existing_today:
        raise HTTPException(status_code=400, detail="Vec imate zakazan termin za ovaj dan. Mozete imati samo jedan termin dnevno.")

    # Check actual slot availability (capacity)
    slot = await db.schedule_slots.find_one({"id": data.slot_id}, {"_id": 0})
    if slot:
        # Termin se zatvara 2 sata prije početka (koristi vrijeme iz slota, ne klijenta).
        if not is_bookable(slot["datum"], slot["vrijeme"]):
            raise HTTPException(status_code=400, detail="Prekasno za zakazivanje — termin se zatvara 2 sata prije početka.")
        booked_count = await db.trainings.count_documents({
            "slot_id": data.slot_id, "tip": {"$in": ["predstojeći", "završen", "probni"]}
        })
        if booked_count >= slot.get("ukupno_mjesta", 3):
            raise HTTPException(status_code=400, detail="Ovaj termin je popunjen")

    # One booking per slot: a user cannot book the same slot twice
    existing_in_slot = await db.trainings.find_one({
        "user_id": user.user_id,
        "slot_id": data.slot_id,
        "tip": {"$in": ["predstojeći", "završen"]}
    })
    if existing_in_slot:
        raise HTTPException(status_code=400, detail="Već imate rezervaciju za ovaj termin.")

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

    # If this is user's first training on this membership, start the 35-day period from this date
    first_training = await db.trainings.count_documents({
        "user_id": user.user_id,
        "tip": {"$in": ["predstojeći", "završen", "iskoristen"]}
    })
    if first_training == 1 and membership:
        booking_date = datetime.strptime(data.datum, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        await db.memberships.update_one(
            {"id": membership["id"]},
            {"$set": {
                "datum_pocetka": booking_date.isoformat(),
                "datum_isteka": (booking_date + timedelta(days=35)).isoformat()
            }}
        )

    # Dekrementiraj nosioca duga. Ako postoji aktivan paket -> njega (balans smije
    # u minus). Ako ne, ali članica je ranije imala paket -> najnoviji paket (dug
    # ostaje brojiv i izmiruje se na sljedećoj aktivaciji). Ako paketa nema -> ništa
    # (compute_minus() takve treninge broji kroz Sabirak 2).
    debt_target = membership
    if debt_target is None:
        debt_target = await db.memberships.find_one(
            {"user_id": user.user_id},
            {"_id": 0, "id": 1},
            sort=[("created_at", -1)],
        )
    if debt_target:
        await db.memberships.update_one(
            {"id": debt_target["id"]},
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
        "message": "Termin je uspjesno rezervisan!"
    }


class TrialBookingRequest(BaseModel):
    # The app only sends slot_id; datum/vrijeme/instruktor are derived from the
    # slot, but are accepted (optional) for backward compatibility.
    slot_id: str
    datum: Optional[str] = None
    vrijeme: Optional[str] = None
    instruktor: Optional[str] = None


@api_router.post("/bookings/trial")
async def create_trial_booking(data: TrialBookingRequest, request: Request):
    """Book a free trial training ("probni trening") for a brand-new member.

    Only available to users who have never trained before (no training history).
    No membership is required. Slot capacity and one-booking-per-slot still apply.
    """
    user = await get_current_user(request)

    # Must have zero training history (any non-cancelled training disqualifies)
    existing_history = await db.trainings.count_documents({
        "user_id": user.user_id,
        "tip": {"$ne": "otkazan"}
    })
    if existing_history > 0:
        raise HTTPException(status_code=400, detail="Probni trening je dostupan samo za nove članice.")

    # The slot must exist — datum/vrijeme/instruktor are taken from it.
    slot = await db.schedule_slots.find_one({"id": data.slot_id}, {"_id": 0})
    if not slot:
        raise HTTPException(status_code=404, detail="Termin nije pronađen")

    # Termin se zatvara 2 sata prije početka.
    if not is_bookable(slot["datum"], slot["vrijeme"]):
        raise HTTPException(status_code=400, detail="Prekasno za zakazivanje — termin se zatvara 2 sata prije početka.")

    # Check slot availability (capacity)
    booked_count = await db.trainings.count_documents({
        "slot_id": data.slot_id, "tip": {"$in": ["predstojeći", "završen", "probni"]}
    })
    if booked_count >= slot.get("ukupno_mjesta", 3):
        raise HTTPException(status_code=400, detail="Ovaj termin je popunjen")

    # One booking per slot
    existing_in_slot = await db.trainings.find_one({
        "user_id": user.user_id,
        "slot_id": data.slot_id,
        "tip": {"$in": ["predstojeći", "završen", "probni"]}
    })
    if existing_in_slot:
        raise HTTPException(status_code=400, detail="Već imate rezervaciju za ovaj termin.")

    training_id = str(uuid.uuid4())
    training = {
        "id": training_id,
        "user_id": user.user_id,
        "slot_id": data.slot_id,
        "datum": data.datum or slot.get("datum"),
        "vrijeme": data.vrijeme or slot.get("vrijeme"),
        "instruktor": data.instruktor or slot.get("instruktor"),
        "tip": "probni",
        "trajanje": 50,
        "feedback_submitted": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.trainings.insert_one(training)

    await db.users.update_one(
        {"user_id": user.user_id},
        {"$set": {"last_activity": datetime.now(timezone.utc).isoformat()}}
    )

    return {
        "success": True,
        "training_id": training_id,
        "message": "Probni trening je uspješno rezervisan!"
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
        # Novi termin se zatvara 2 sata prije početka (vrijeme iz slota).
        if not is_bookable(new_slot["datum"], new_slot["vrijeme"]):
            raise HTTPException(status_code=400, detail="Prekasno za zakazivanje — termin se zatvara 2 sata prije početka.")
        booked_count = await db.trainings.count_documents({
            "slot_id": data.new_slot_id,
            "tip": {"$in": ["predstojeći", "završen", "probni"]},
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
    """Get user's weight history with trend"""
    user = await get_current_user(request)
    
    entries = await db.weight_entries.find(
        {"user_id": user.user_id},
        {"_id": 0}
    ).sort("date", -1).to_list(100)
    
    # Calculate trend for each entry
    for i, entry in enumerate(entries):
        if i < len(entries) - 1:
            prev = entries[i + 1].get("weight", 0)
            curr = entry.get("weight", 0)
            if curr > prev:
                entry["trend"] = "povećanje"
            elif curr < prev:
                entry["trend"] = "smanjenje"
            else:
                entry["trend"] = "bez promjene"
        else:
            entry["trend"] = "bez promjene"
    
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


# ============== PROFILE PHOTO ==============

class ProfilePhotoRequest(BaseModel):
    photo: str

@api_router.post("/user/profile-photo")
async def upload_profile_photo(data: ProfilePhotoRequest, request: Request):
    """Save base64 profile photo to user document"""
    user = await get_current_user(request)
    await db.users.update_one(
        {"user_id": user.user_id},
        {"$set": {"profile_photo": data.photo}}
    )
    return {"success": True}

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
    
    # Enrich with actual availability. Trial bookings ("probni") occupy a real
    # seat just like regular bookings, so they must be counted here too.
    result = []
    for slot in slots:
        # Skrij termine koji se zatvaraju (počinju za < 2h) ili su već prošli.
        if not is_bookable(slot["datum"], slot["vrijeme"], now):
            continue
        booked = await db.trainings.count_documents({
            "slot_id": slot["id"], "tip": {"$in": ["predstojeći", "završen", "probni"]}
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
    
    # Count upcoming trainings (future-dated, still pending only). datum may be
    # "YYYY-MM-DD" or a full ISO string; a string $gte against today handles both.
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    upcoming_count = await db.trainings.count_documents(
        {"user_id": user.user_id, "tip": "predstojeći", "datum": {"$gte": today_str}}
    )
    upcoming_count = max(0, upcoming_count)
    
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

# ============== USER PROFILE & PIN MANAGEMENT ==============

EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$")
PHONE_REGEX = re.compile(r"^\+?[0-9]{8,15}$")


def _validate_pin(value: str, field_name: str = "PIN") -> None:
    if not value or len(value) != 4 or not value.isdigit():
        raise HTTPException(status_code=400, detail=f"{field_name} mora biti tačno 4 cifre.")


def _send_reset_email(to_email: str, code: str) -> None:
    """Send PIN reset code via Resend HTTP API. Raises 500 on config/send failure."""
    api_key = os.environ.get("RESEND_API_KEY")
    if not api_key:
        logger.error("RESEND_API_KEY missing")
        raise HTTPException(status_code=500, detail="Servis za slanje emaila nije konfigurisan.")

    text_body = (
        f"Pozdrav,\n\n"
        f"Vaš kod za reset PIN-a je: {code}\n"
        f"Kod važi 15 minuta.\n\n"
        f"Ako niste zatražili reset PIN-a, ignorišite ovu poruku.\n\n"
        f"— Linea Pilates"
    )
    html_body = f"""
    <html><body style="font-family:Arial,sans-serif;color:#222;">
      <h2 style="color:#C4A574;">Linea Pilates</h2>
      <p>Pozdrav,</p>
      <p>Vaš kod za reset PIN-a je:</p>
      <p style="font-size:28px;font-weight:bold;letter-spacing:6px;color:#1a1a2e;">{code}</p>
      <p>Kod važi <strong>15 minuta</strong>.</p>
      <p style="color:#888;font-size:12px;">Ako niste zatražili reset PIN-a, ignorišite ovu poruku.</p>
    </body></html>
    """
    payload = {
        "from": "Linea Pilates <podrska@lineapilatesreformer.com>",
        "to": [to_email],
        "subject": "Linea Pilates — Reset PIN kod",
        "html": html_body,
        "text": text_body,
    }

    try:
        resp = requests.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=15,
        )
    except Exception as e:
        logger.error(f"Resend request failed to {to_email}: {e}")
        raise HTTPException(status_code=500, detail="Slanje emaila nije uspjelo. Pokušajte ponovo kasnije.")

    if resp.status_code not in (200, 201, 202):
        logger.error(f"Resend send failed to {to_email}: status={resp.status_code} body={resp.text}")
        raise HTTPException(status_code=500, detail="Slanje emaila nije uspjelo. Pokušajte ponovo kasnije.")

    logger.info(f"Reset email sent to {to_email} via Resend")


@api_router.put("/user/profile")
async def update_user_profile(data: UserProfileUpdateRequest, request: Request):
    """Authenticated user updates own profile (first_name, last_name, email, phone)."""
    user = await get_current_user(request)

    updates: dict = {}

    # Name: combine first_name + last_name into existing `name` field (schema compat)
    if data.first_name is not None or data.last_name is not None:
        first = (data.first_name or "").strip()
        last = (data.last_name or "").strip()
        if data.first_name is not None and not first:
            raise HTTPException(status_code=400, detail="Ime ne smije biti prazno.")
        if data.last_name is not None and not last:
            raise HTTPException(status_code=400, detail="Prezime ne smije biti prazno.")
        # Preserve existing halves if only one is provided
        current = await db.users.find_one({"user_id": user.user_id}, {"_id": 0, "name": 1})
        current_name = (current or {}).get("name", "") if current else ""
        parts = current_name.split(" ", 1)
        cur_first = parts[0] if parts else ""
        cur_last = parts[1] if len(parts) > 1 else ""
        final_first = first if data.first_name is not None else cur_first
        final_last = last if data.last_name is not None else cur_last
        updates["name"] = (final_first + " " + final_last).strip()
        updates["first_name"] = final_first
        updates["last_name"] = final_last

    if data.email is not None:
        email_clean = data.email.strip().lower()
        if not EMAIL_REGEX.match(email_clean):
            raise HTTPException(status_code=400, detail="Nevažeći format email adrese.")
        # Enforce uniqueness among other users
        taken_by = await db.users.find_one(
            {"email": email_clean, "user_id": {"$ne": user.user_id}},
            {"_id": 0, "user_id": 1},
        )
        if taken_by:
            raise HTTPException(status_code=400, detail="Email je već u upotrebi.")
        updates["email"] = email_clean

    if data.phone is not None:
        phone_clean = data.phone.strip().replace(" ", "")
        if not PHONE_REGEX.match(phone_clean):
            raise HTTPException(status_code=400, detail="Nevažeći format broja telefona.")
        taken_by = await db.users.find_one(
            {"phone": phone_clean, "user_id": {"$ne": user.user_id}},
            {"_id": 0, "user_id": 1},
        )
        if taken_by:
            raise HTTPException(status_code=400, detail="Broj telefona je već u upotrebi.")
        updates["phone"] = phone_clean

    if not updates:
        raise HTTPException(status_code=400, detail="Nije prosleđeno nijedno polje za ažuriranje.")

    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.users.update_one({"user_id": user.user_id}, {"$set": updates})

    fresh = await db.users.find_one(
        {"user_id": user.user_id},
        {"_id": 0, "pin_hash": 0, "reset_code": 0, "reset_code_expires": 0},
    )
    return {"success": True, "message": "Profil je uspješno ažuriran.", "user": fresh}


@api_router.put("/user/change-pin")
async def change_user_pin(data: PinChangeRequest, request: Request):
    """Authenticated user changes their own PIN."""
    user = await get_current_user(request)

    _validate_pin(data.new_pin, "Novi PIN")

    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0, "pin_hash": 1})
    if not user_doc or not user_doc.get("pin_hash"):
        raise HTTPException(status_code=400, detail="PIN nije postavljen za ovaj nalog.")

    if not bcrypt.verify(data.old_pin, user_doc["pin_hash"]):
        raise HTTPException(status_code=400, detail="Pogrešan stari PIN.")

    if data.old_pin == data.new_pin:
        raise HTTPException(status_code=400, detail="Novi PIN mora biti različit od starog.")

    await db.users.update_one(
        {"user_id": user.user_id},
        {"$set": {
            "pin_hash": bcrypt.hash(data.new_pin),
            "pin_updated_at": datetime.now(timezone.utc).isoformat(),
        }},
    )
    return {"success": True, "message": "PIN je uspješno promijenjen."}


@api_router.post("/auth/forgot-pin")
async def forgot_pin(data: ForgotPinRequest):
    """Request a 6-digit reset code sent to the user's email.

    Always returns a generic success message to prevent email enumeration.
    """
    generic_response = {
        "success": True,
        "message": "Ako email postoji u sistemu, poslali smo vam kod za reset PIN-a.",
    }

    email_clean = (data.email or "").strip().lower()
    if not email_clean or not EMAIL_REGEX.match(email_clean):
        return generic_response

    user_doc = await db.users.find_one({"email": email_clean}, {"_id": 0, "user_id": 1})
    if not user_doc:
        return generic_response

    code = f"{random.randint(0, 999999):06d}"
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=15)

    await db.users.update_one(
        {"user_id": user_doc["user_id"]},
        {"$set": {
            "reset_code": code,
            "reset_code_expires": expires_at.isoformat(),
        }},
    )

    try:
        _send_reset_email(email_clean, code)
    except HTTPException:
        # Clear the code if email could not be sent; re-raise so client knows
        await db.users.update_one(
            {"user_id": user_doc["user_id"]},
            {"$unset": {"reset_code": "", "reset_code_expires": ""}},
        )
        raise

    return generic_response


@api_router.post("/auth/reset-pin")
async def reset_pin(data: ResetPinRequest):
    """Verify reset code and set a new PIN."""
    email_clean = (data.email or "").strip().lower()
    if not email_clean or not EMAIL_REGEX.match(email_clean):
        raise HTTPException(status_code=400, detail="Nevažeći format email adrese.")

    _validate_pin(data.new_pin, "Novi PIN")

    if not data.code or not data.code.isdigit() or len(data.code) != 6:
        raise HTTPException(status_code=400, detail="Kod mora biti 6 cifara.")

    user_doc = await db.users.find_one(
        {"email": email_clean},
        {"_id": 0, "user_id": 1, "reset_code": 1, "reset_code_expires": 1},
    )
    if not user_doc or not user_doc.get("reset_code"):
        raise HTTPException(status_code=400, detail="Nevažeći ili istekao kod.")

    if user_doc["reset_code"] != data.code:
        raise HTTPException(status_code=400, detail="Nevažeći ili istekao kod.")

    expires_raw = user_doc.get("reset_code_expires")
    try:
        expires_dt = datetime.fromisoformat(expires_raw)
        if expires_dt.tzinfo is None:
            expires_dt = expires_dt.replace(tzinfo=timezone.utc)
    except Exception:
        raise HTTPException(status_code=400, detail="Nevažeći ili istekao kod.")

    if expires_dt < datetime.now(timezone.utc):
        # Also clear expired code
        await db.users.update_one(
            {"user_id": user_doc["user_id"]},
            {"$unset": {"reset_code": "", "reset_code_expires": ""}},
        )
        raise HTTPException(status_code=400, detail="Nevažeći ili istekao kod.")

    await db.users.update_one(
        {"user_id": user_doc["user_id"]},
        {
            "$set": {
                "pin_hash": bcrypt.hash(data.new_pin),
                "pin_updated_at": datetime.now(timezone.utc).isoformat(),
            },
            "$unset": {"reset_code": "", "reset_code_expires": ""},
        },
    )
    return {"success": True, "message": "PIN je uspješno resetovan. Prijavite se sa novim PIN-om."}


async def settle_minus_sessions(user_id: str, new_membership_id: str, total_sessions: int):
    """Izmiruje "minus" pri aktivaciji novog paketa — model balansa.

    Dug = -Σ preostali_termini preko korisnikovih paketa koji su u minusu (< 0),
    izuzev novog paketa. Oduzima se od termina novog paketa (clamp na 0), a stari
    negativni balansi se postavljaju na 0 (dug izmiren). Više se NE oslanja na
    minus:true flag (čime nestaje i bug brojanja otkazanih minus treninga).

    Vraća (dug, novo_stanje) — broj oduzetih i konačno stanje novog paketa.
    """
    debt_filter = {
        "user_id": user_id,
        "id": {"$ne": new_membership_id},
        "preostali_termini": {"$lt": 0},
    }
    debt_docs = await db.memberships.find(
        debt_filter, {"_id": 0, "preostali_termini": 1}
    ).to_list(1000)
    dug = sum(-d["preostali_termini"] for d in debt_docs)
    if dug == 0:
        return 0, total_sessions
    novo_stanje = max(0, total_sessions - dug)
    await db.memberships.update_one(
        {"id": new_membership_id},
        {"$set": {"preostali_termini": novo_stanje}},
    )
    # Izmiri stare dugove: negativan balans -> 0.
    await db.memberships.update_many(debt_filter, {"$set": {"preostali_termini": 0}})
    return dug, novo_stanje


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
    # Block duplicate: user cannot request a new package while having an active one
    # Active = tip 'aktivna' AND (datum_isteka in future OR preostali_termini > 0)
    now_iso = datetime.now(timezone.utc).isoformat()
    active_membership = await db.memberships.find_one(
        {
            "user_id": user.user_id,
            "tip": "aktivna",
            "$or": [
                {"datum_isteka": {"$gt": now_iso}},
                {"preostali_termini": {"$gt": 0}},
            ],
        },
        {"_id": 0},
    )
    if active_membership:
        raise HTTPException(
            status_code=400,
            detail="Već imate aktivan paket. Novi paket možete izabrati kada istekne trenutni ili kada potrošite sve treninge.",
        )
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
    # Conversion tracking: mark recent renewal reminders as converted (within 7 days)
    await mark_renewal_conversions(user.user_id, "package_request")
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
        "datum_isteka": (now + timedelta(days=35)).isoformat(),
        "created_at": now.isoformat()
    }
    # Deactivate any existing active membership
    await db.memberships.update_many(
        {"user_id": pkg_req["user_id"], "tip": "aktivna"},
        {"$set": {"tip": "prethodna"}}
    )
    await db.memberships.insert_one(membership)
    # Izmiri eventualni minus (oduzmi minus treninge od novog paketa, clamp na 0,
    # obriši minus flag da banner nestane).
    minus_count, preostali = await settle_minus_sessions(
        pkg_req["user_id"], membership["id"], pkg_req["package_sessions"]
    )
    if minus_count > 0:
        termini_tekst = f"{preostali} termina ({minus_count} oduzeta za minus)"
    else:
        termini_tekst = f"{pkg_req['package_sessions']} termina"
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
        "message": f"Vaš paket {pkg_req['package_name']} je aktiviran! Imate {termini_tekst} na raspolaganju.",
        "data": {"package_name": pkg_req["package_name"]},
        "read": False,
        "created_at": now.isoformat()
    })
    # Send push notification
    await send_push_notification(
        pkg_req["user_id"],
        "Paket odobren",
        f"Vaš paket {pkg_req['package_name']} je aktiviran! Imate {termini_tekst}."
    )
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


class AdminBookTrainingRequest(BaseModel):
    slot_id: str


@api_router.post("/admin/users/{user_id}/book-training")
async def admin_book_training(user_id: str, data: AdminBookTrainingRequest, request: Request):
    """Admin books a training slot for a user, bypassing the remaining-sessions check."""
    await get_admin_user(request)

    target = await db.users.find_one({"user_id": user_id}, {"_id": 0, "user_id": 1})
    if not target:
        raise HTTPException(status_code=404, detail="Korisnik nije pronađen")

    slot = await db.schedule_slots.find_one({"id": data.slot_id}, {"_id": 0})
    if not slot:
        raise HTTPException(status_code=404, detail="Termin nije pronađen")

    # One booking per day limit still applies
    existing_today = await db.trainings.find_one({
        "user_id": user_id,
        "datum": {"$regex": f"^{slot['datum']}"},
        "tip": "predstojeći"
    })
    if existing_today:
        raise HTTPException(status_code=400, detail="Korisnik već ima zakazan termin za ovaj dan.")

    # Slot capacity still applies
    booked_count = await db.trainings.count_documents({
        "slot_id": data.slot_id, "tip": {"$in": ["predstojeći", "završen"]}
    })
    if booked_count >= slot.get("ukupno_mjesta", 3):
        raise HTTPException(status_code=400, detail="Ovaj termin je popunjen")

    training_id = str(uuid.uuid4())
    training = {
        "id": training_id,
        "user_id": user_id,
        "slot_id": data.slot_id,
        "datum": slot["datum"],
        "vrijeme": slot["vrijeme"],
        "instruktor": slot.get("instruktor"),
        "tip": "predstojeći",
        "trajanje": slot.get("trajanje", 50),
        "feedback_submitted": False,
        "booked_by_admin": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.trainings.insert_one(training)

    # Decrement membership slots only if the user has sessions left (never go negative)
    membership = await db.memberships.find_one(
        {"user_id": user_id, "tip": "aktivna", "preostali_termini": {"$gt": 0}}, {"_id": 0}
    )
    if membership:
        # Start the 35-day period from this date if it's the user's first training
        first_training = await db.trainings.count_documents({
            "user_id": user_id,
            "tip": {"$in": ["predstojeći", "završen", "iskoristen"]}
        })
        if first_training == 1:
            booking_date = datetime.strptime(slot["datum"], "%Y-%m-%d").replace(tzinfo=timezone.utc)
            await db.memberships.update_one(
                {"id": membership["id"]},
                {"$set": {
                    "datum_pocetka": booking_date.isoformat(),
                    "datum_isteka": (booking_date + timedelta(days=35)).isoformat()
                }}
            )
        await db.memberships.update_one(
            {"id": membership["id"]},
            {"$inc": {"preostali_termini": -1}}
        )

    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {"last_activity": datetime.now(timezone.utc).isoformat()}}
    )

    return {
        "success": True,
        "training_id": training_id,
        "message": "Termin je uspjesno rezervisan za korisnika!"
    }

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
            "freeze_end": data.end_date,
            "freeze_reason": data.freeze_reason
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
        {"$set": {"tip": "aktivna", "datum_isteka": new_expiry}, "$unset": {"freeze_start": "", "freeze_end": "", "freeze_reason": ""}}
    )
    await db.users.update_one({"user_id": user_id}, {"$set": {"status": "active"}})
    return {"success": True, "message": f"Članarina je odmrznuta. Produžena za {extra_days} dana."}

@api_router.patch("/admin/memberships/{membership_id}/update-start-date")
async def admin_update_membership_start_date(membership_id: str, data: AdminMembershipStartDateRequest, request: Request):
    """Update a membership's start date and recalculate expiry (start + 35 days)."""
    await get_admin_user(request)
    membership = await db.memberships.find_one({"id": membership_id}, {"_id": 0})
    if not membership:
        raise HTTPException(status_code=404, detail="Članarina nije pronađena")
    start = _parse_flexible_date(data.start_date)
    if start is None:
        raise HTTPException(status_code=400, detail="Nevažeći format datuma. Koristite YYYY-MM-DD.")
    new_pocetka = start.isoformat()
    new_isteka = (start + timedelta(days=35)).isoformat()
    update_fields = {"datum_pocetka": new_pocetka, "datum_isteka": new_isteka}
    if data.cijena is not None:
        update_fields["cijena"] = data.cijena
    await db.memberships.update_one(
        {"id": membership_id},
        {"$set": update_fields}
    )
    updated = await db.memberships.find_one({"id": membership_id}, {"_id": 0})
    return updated

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
@api_router.get("/admin/finance")
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

# ============== ADMIN FINANCIAL BY MEMBERSHIP START DATE ==============

def _parse_flexible_date(value: str):
    """Parse a date that may arrive as 'YYYY-MM-DD' or a full ISO datetime string.

    Returns a timezone-aware datetime (UTC) or None if it can't be parsed.
    """
    if not value or not isinstance(value, str):
        return None
    # Plain date first (the documented format).
    try:
        return datetime.strptime(value[:10], "%Y-%m-%d").replace(tzinfo=timezone.utc)
    except ValueError:
        pass
    # Fall back to a full ISO timestamp (e.g. "2026-04-01T00:00:00+00:00").
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def _next_month_str(month_str: str) -> str:
    """Given 'YYYY-MM' return the following month as 'YYYY-MM'."""
    year, month = int(month_str[:4]), int(month_str[5:7])
    if month == 12:
        return f"{year + 1}-01"
    return f"{year}-{month + 1:02d}"


@api_router.get("/admin/financial-by-start-date")
async def admin_financial_by_start_date(request: Request, from_: str = Query("2026-04", alias="from")):
    """Financial overview where revenue is attributed to the MONTH of each
    membership's datum_pocetka (when the package became active), not when the
    record was created in the system.

    Returns a monthly breakdown from `from` (default 2026-04) up to the current
    month. Each month lists the activated memberships with the user name,
    package name, cijena and datum_pocetka. When a membership has no `cijena`,
    the package's default price is used.
    """
    await get_admin_user(request)

    # Validate the start month
    try:
        datetime.strptime(from_, "%Y-%m")
    except ValueError:
        raise HTTPException(status_code=400, detail="Nevažeći format za 'from'. Koristite YYYY-MM.")

    now = datetime.now(timezone.utc)
    current_month = now.strftime("%Y-%m")
    if from_ > current_month:
        from_ = current_month

    # Build the ordered list of months from `from_` to the current month.
    months = []
    cursor = from_
    while cursor <= current_month:
        months.append(cursor)
        cursor = _next_month_str(cursor)

    # Lookup maps for default package prices and user names.
    packages = await db.packages.find({}, {"_id": 0, "id": 1, "naziv": 1, "cijena": 1}).to_list(200)
    pkg_price_by_id = {p["id"]: p.get("cijena", 0) for p in packages}
    pkg_price_by_naziv = {p["naziv"]: p.get("cijena", 0) for p in packages}

    users = await db.users.find({}, {"_id": 0, "user_id": 1, "name": 1}).to_list(5000)
    user_name_by_id = {u["user_id"]: u.get("name", "Nepoznat korisnik") for u in users}

    # Fetch ALL memberships and bucket them in Python. We deliberately do NOT use a
    # MongoDB range query like {"datum_pocetka": {"$gte": from_}}: datum_pocetka may
    # have been stored as a string ("2026-04-01T..."), as a plain date ("2026-04-01"),
    # or as a BSON Date object. In BSON's type-ordering a Date is always "less than"
    # any string, so a string range query silently returns nothing for Date-typed
    # values — which is exactly why this endpoint came back empty.
    all_memberships = await db.memberships.find({}, {"_id": 0}).to_list(20000)

    def _month_key_of(value):
        """Normalize a datum_pocetka (str, datetime, or None) to 'YYYY-MM'.

        Handles the several shapes datum_pocetka can take in the database:
        BSON Date/datetime, ISO strings ("2026-04-01T..." / "2026-04-01"), and
        the localized "DD.MM.YYYY" form.
        """
        if value is None:
            return None
        if isinstance(value, datetime):
            return value.strftime("%Y-%m")
        if isinstance(value, str):
            value = value.strip()
            # DD.MM.YYYY (or D.M.YYYY) — convert to YYYY-MM.
            if "." in value:
                parts = value.split(".")
                if len(parts) >= 3 and parts[2].strip()[:4].isdigit():
                    year = parts[2].strip()[:4]
                    month = parts[1].strip().zfill(2)
                    return f"{year}-{month}"
                return None
            # ISO string "YYYY-MM-DD..." — first 7 chars are "YYYY-MM".
            if len(value) >= 7 and value[:4].isdigit():
                return value[:7]
        return None

    # Group memberships by the month of their datum_pocetka.
    by_month = {m: {"month": m, "revenue": 0, "count": 0, "memberships": []} for m in months}
    for mem in all_memberships:
        pocetak = mem.get("datum_pocetka")
        month_key = _month_key_of(pocetak)
        if month_key is None:
            continue
        if month_key not in by_month:
            continue
        # Normalize the datum_pocetka we echo back to a string for the response.
        pocetak_out = pocetak.isoformat() if isinstance(pocetak, datetime) else pocetak
        # Resolve price: explicit cijena, else package default.
        cijena = mem.get("cijena")
        if cijena is None:
            cijena = pkg_price_by_id.get(mem.get("package_id"))
        if cijena is None:
            cijena = pkg_price_by_naziv.get(mem.get("naziv"), 0)
        cijena = cijena or 0
        bucket = by_month[month_key]
        bucket["revenue"] += cijena
        bucket["count"] += 1
        bucket["memberships"].append({
            "membership_id": mem.get("id"),
            "user_id": mem.get("user_id"),
            "user_name": user_name_by_id.get(mem.get("user_id"), "Nepoznat korisnik"),
            "package_name": mem.get("naziv"),
            "cijena": cijena,
            "datum_pocetka": pocetak_out,
            "tip": mem.get("tip"),
        })

    monthly = [by_month[m] for m in months]
    return {
        "from": from_,
        "to": current_month,
        "ukupni_prihod": sum(b["revenue"] for b in monthly),
        "ukupno_clanarina": sum(b["count"] for b in monthly),
        "mjeseci": monthly,
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

@api_router.post("/admin/users/{user_id}/add-membership")
@api_router.post("/admin/users/{user_id}/custom-membership")
async def admin_create_custom_membership(user_id: str, data: AdminCustomMembershipRequest, request: Request):
    """Admin creates a custom membership directly for a user (bypassing package requests)"""
    admin_user = await get_admin_user(request)
    # Verify user exists
    user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=404, detail="Korisnik nije pronađen")
    now = datetime.now(timezone.utc)

    # Resolve package defaults for any fields the client did not provide.
    pkg = None
    if data.package_id:
        pkg = await db.packages.find_one({"id": data.package_id}, {"_id": 0})

    naziv = data.naziv or (pkg.get("naziv") if pkg else None)
    termini = data.termini if data.termini is not None else (pkg.get("termini") if pkg else None)
    cijena = data.cijena if data.cijena is not None else (pkg.get("cijena") if pkg else None)
    trajanje_dana = data.trajanje_dana or (pkg.get("trajanje_dana") if pkg else None) or 35

    if not naziv:
        raise HTTPException(status_code=400, detail="Naziv paketa je obavezan.")
    if termini is None:
        raise HTTPException(status_code=400, detail="Broj termina je obavezan.")

    if data.start_date:
        try:
            start = datetime.strptime(data.start_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        except ValueError:
            raise HTTPException(status_code=400, detail="Nevažeći format datuma. Koristite YYYY-MM-DD.")
    else:
        start = now
    # Deactivate any existing active membership
    await db.memberships.update_many(
        {"user_id": user_id, "tip": "aktivna"},
        {"$set": {"tip": "prethodna"}}
    )
    membership = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "naziv": naziv,
        "package_id": data.package_id,
        "tip": "aktivna",
        "preostali_termini": termini,
        "ukupni_termini": termini,
        "cijena": cijena,
        "datum_pocetka": start.isoformat(),
        "datum_isteka": (start + timedelta(days=trajanje_dana)).isoformat(),
        "created_by": admin_user.get("name", "Admin"),
        "created_at": now.isoformat()
    }
    await db.memberships.insert_one(membership)
    # Izmiri eventualni minus (oduzmi minus treninge od novog paketa, clamp na 0,
    # obriši minus flag da banner nestane).
    minus_count, preostali = await settle_minus_sessions(user_id, membership["id"], termini)
    if minus_count > 0:
        termini_tekst = f"{preostali} termina ({minus_count} oduzeta za minus)"
    else:
        termini_tekst = f"{termini} termina"
    # Conversion tracking: mark recent renewal reminders as converted (within 7 days)
    await mark_renewal_conversions(user_id, "custom_membership")
    # Notify user
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "type": "package_approved",
        "title": "Paket aktiviran",
        "message": f"Vaš paket {naziv} je aktiviran! Imate {termini_tekst} na raspolaganju.",
        "data": {"package_name": naziv},
        "read": False,
        "created_at": now.isoformat()
    })
    return {"success": True, "message": f"Članarina '{naziv}' ({termini} termina) je kreirana za {user_doc.get('name', 'korisnika')}."}

class AdminHistoricalMembershipRequest(BaseModel):
    # Accept BOTH the English field names and the Croatian names the mobile app
    # sends ({ naziv_paketa, cijena, datum_pocetka, ukupno_termina, iskoristeno_termina }).
    model_config = ConfigDict(populate_by_name=True)
    package_name: str = Field(validation_alias=AliasChoices("package_name", "naziv_paketa"))
    cijena: Optional[float] = 0
    start_date: str = Field(validation_alias=AliasChoices("start_date", "datum_pocetka"))  # YYYY-MM-DD
    total_sessions: int = Field(validation_alias=AliasChoices("total_sessions", "ukupno_termina"))
    used_sessions: int = Field(default=0, validation_alias=AliasChoices("used_sessions", "iskoristeno_termina"))


@api_router.post("/admin/users/{user_id}/add-historical-membership")
async def admin_add_historical_membership(user_id: str, data: AdminHistoricalMembershipRequest, request: Request):
    """Retroactively record a past (expired) membership that a user had before
    the app existed.

    Always creates an expired/historical membership (tip='istekla') with the
    given start date (expiry = start + 35 days) and price. No active-membership
    checks are performed and no existing memberships are deactivated.
    """
    admin_user = await get_admin_user(request)

    user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0, "name": 1})
    if not user_doc:
        raise HTTPException(status_code=404, detail="Korisnik nije pronađen")

    start = _parse_flexible_date(data.start_date)
    if start is None:
        raise HTTPException(status_code=400, detail="Nevažeći format datuma. Koristite YYYY-MM-DD.")

    remaining = max(data.total_sessions - data.used_sessions, 0)
    now = datetime.now(timezone.utc)
    membership = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "naziv": data.package_name,
        "package_id": None,
        "tip": "istekla",
        "preostali_termini": remaining,
        "ukupni_termini": data.total_sessions,
        "cijena": data.cijena if data.cijena is not None else 0,
        "datum_pocetka": start.isoformat(),
        "datum_isteka": (start + timedelta(days=35)).isoformat(),
        "historical": True,
        "created_by": admin_user.get("name", "Admin"),
        "created_at": now.isoformat(),
    }
    await db.memberships.insert_one(membership)
    return {
        "success": True,
        "message": f"Istorijska članarina '{data.package_name}' je dodana za {user_doc.get('name', 'korisnika')}.",
        "membership": {k: v for k, v in membership.items() if k != "_id"},
    }

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


@api_router.get("/admin/users/{user_id}/full-history")
async def admin_get_full_history(user_id: str, request: Request):
    """Complete history for a single user: every membership (active & expired)
    and every training (booked, used, trial, cancelled, historical).

    Memberships are sorted by datum_pocetka (newest first) and trainings by
    datum (newest first). Both fields can be stored as ISO strings, localized
    "DD.MM.YYYY" strings, or datetime objects, so sorting is done on a
    normalized key in Python rather than relying on a MongoDB sort.
    """
    await get_admin_user(request)

    user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0, "name": 1})
    if not user_doc:
        raise HTTPException(status_code=404, detail="Korisnik nije pronađen")

    def _sort_key(value):
        """Normalize a date value to a chronologically sortable string."""
        if value is None:
            return ""
        if isinstance(value, datetime):
            return value.isoformat()
        if isinstance(value, str):
            value = value.strip()
            # "DD.MM.YYYY[ HH:MM]" -> "YYYY-MM-DD" so it sorts chronologically.
            if "." in value and "-" not in value:
                date_part = value.split(" ")[0]
                parts = date_part.split(".")
                if len(parts) >= 3 and parts[2].strip()[:4].isdigit():
                    return f"{parts[2].strip()[:4]}-{parts[1].strip().zfill(2)}-{parts[0].strip().zfill(2)}"
            return value
        return ""

    def _iso(value):
        return value.isoformat() if isinstance(value, datetime) else value

    # --- Memberships (active and expired) ---
    raw_memberships = await db.memberships.find({"user_id": user_id}, {"_id": 0}).to_list(2000)
    memberships = []
    for m in raw_memberships:
        ukupni = m.get("ukupni_termini", 0) or 0
        preostali = m.get("preostali_termini")
        if preostali is None:
            preostali = 0
        # Prefer an explicit iskoristeni_termini; otherwise derive it.
        iskoristeni = m.get("iskoristeni_termini")
        if iskoristeni is None:
            iskoristeni = max(0, ukupni - preostali)
        memberships.append({
            "id": m.get("id"),
            "package_name": m.get("naziv"),
            "cijena": m.get("cijena", 0) or 0,
            "datum_pocetka": _iso(m.get("datum_pocetka")),
            "datum_isteka": _iso(m.get("datum_isteka")),
            "ukupni_termini": ukupni,
            "preostali_termini": preostali,
            "iskoristeni_termini": iskoristeni,
            "tip": m.get("tip"),
            "status": m.get("status", m.get("tip")),
            "historical": bool(m.get("historical", False)),
        })
    memberships.sort(key=lambda x: _sort_key(x["datum_pocetka"]), reverse=True)

    # --- Trainings (all statuses) ---
    raw_trainings = await db.trainings.find({"user_id": user_id}, {"_id": 0}).to_list(10000)
    trainings = []
    for t in raw_trainings:
        trainings.append({
            "id": t.get("id"),
            "datum": _iso(t.get("datum")),
            "vrijeme": t.get("vrijeme"),
            "instruktor": t.get("instruktor"),
            "tip": t.get("tip"),
            "status": t.get("status", t.get("tip")),
            "historical": bool(t.get("historical", False)),
        })
    trainings.sort(key=lambda x: _sort_key(x["datum"]), reverse=True)

    return {
        "user_id": user_id,
        "user_name": user_doc.get("name", "Nepoznat korisnik"),
        "memberships": memberships,
        "trainings": trainings,
    }


class AdminAddPastTrainingRequest(BaseModel):
    datum: str  # YYYY-MM-DD
    vrijeme: str  # HH:MM
    historical: bool = False  # If True, record the training without deducting a session


VALID_PAST_TRAINING_TIMES = {"08:00", "09:00", "10:00", "11:00", "17:00", "18:00", "19:00", "20:00"}


@api_router.post("/admin/users/{user_id}/add-past-training")
async def admin_add_past_training(user_id: str, data: AdminAddPastTrainingRequest, request: Request):
    """Admin manually logs a past training that the user attended.

    - Creates a training entry with tip='iskoristen' (shows up in user history).
    - If user has an active membership with remaining sessions, decrements
      `preostali_termini` by 1. If none, still records the training (no error).
    """
    admin_user = await get_admin_user(request)

    user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0, "name": 1})
    if not user_doc:
        raise HTTPException(status_code=404, detail="Korisnik nije pronađen")

    # Validate date format
    try:
        date_obj = datetime.strptime(data.datum, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    except ValueError:
        raise HTTPException(status_code=400, detail="Nevažeći format datuma. Koristite YYYY-MM-DD.")

    if data.vrijeme not in VALID_PAST_TRAINING_TIMES:
        raise HTTPException(
            status_code=400,
            detail="Nevažeće vrijeme. Dozvoljeno: " + ", ".join(sorted(VALID_PAST_TRAINING_TIMES)),
        )

    now = datetime.now(timezone.utc)
    training = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "datum": date_obj.isoformat(),
        "vrijeme": data.vrijeme,
        "instruktor": "Marija Trisic",
        "tip": "iskoristen",
        "trajanje": 50,
        "feedback_submitted": False,
        "manually_added": True,
        "added_by": admin_user.get("name", "Admin"),
        "created_at": now.isoformat(),
    }
    if data.historical:
        training["historical"] = True
    await db.trainings.insert_one(training)

    # Knjiži trening na nosioca duga (osim historical, koji nikad ne dira termine).
    # Aktivan paket -> njega (balans smije u minus = dug). Ako nema aktivnog ->
    # najnoviji paket. Ako paketa uopšte nema -> ništa (hvata compute_minus Sabirak 2).
    deducted = False
    remaining_after = None
    debt_target = None
    if not data.historical:
        debt_target = await db.memberships.find_one(
            {"user_id": user_id, "tip": "aktivna"},
            {"_id": 0, "id": 1, "preostali_termini": 1, "naziv": 1},
        ) or await db.memberships.find_one(
            {"user_id": user_id},
            {"_id": 0, "id": 1, "preostali_termini": 1, "naziv": 1},
            sort=[("created_at", -1)],
        )
    if debt_target:
        await db.memberships.update_one(
            {"id": debt_target["id"]},
            {"$inc": {"preostali_termini": -1}},
        )
        remaining_after = (debt_target.get("preostali_termini", 0) or 0) - 1
        deducted = remaining_after >= 0  # "deducted" = pokriveno; < 0 znači minus
        # Link training to membership for audit trail
        await db.trainings.update_one(
            {"id": training["id"]},
            {"$set": {"membership_id": debt_target["id"]}},
        )

    user_name = user_doc.get("name", "korisnika")
    if data.historical:
        message = (
            f"Historijski trening dodan za {user_name} ({data.datum} u {data.vrijeme}). "
            f"Nije oduzet termin — zabilježen samo u historiji."
        )
    elif deducted:
        message = (
            f"Prošli trening dodan za {user_name} ({data.datum} u {data.vrijeme}). "
            f"Oduzet 1 termin iz aktivne članarine (preostalo: {remaining_after})."
        )
    elif debt_target:
        message = (
            f"Prošli trening dodan za {user_name} ({data.datum} u {data.vrijeme}). "
            f"Članica nema pokriće — trening se broji kao MINUS (dug: {-remaining_after})."
        )
    else:
        message = (
            f"Prošli trening dodan za {user_name} ({data.datum} u {data.vrijeme}). "
            f"Nema nijedne članarine — trening se broji kao MINUS."
        )

    return {
        "success": True,
        "message": message,
        "deducted": deducted,
        "remaining_after": remaining_after,
        "training": {k: v for k, v in training.items() if k != "_id"},
    }

# ============== ADMIN HISTORICAL DATA MANAGEMENT ==============
# Lets the admin review and remove historical (retroactively entered) memberships
# and trainings, so mistakes made while entering past data can be corrected.


@api_router.get("/admin/users/{user_id}/historical-memberships")
async def admin_get_historical_memberships(user_id: str, request: Request):
    """List all historical (retroactively entered) memberships for a user."""
    await get_admin_user(request)
    user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0, "name": 1})
    if not user_doc:
        raise HTTPException(status_code=404, detail="Korisnik nije pronađen")
    memberships = await db.memberships.find(
        {"user_id": user_id, "historical": True}, {"_id": 0}
    ).sort("datum_pocetka", -1).to_list(200)
    return {"memberships": memberships}


@api_router.delete("/admin/users/{user_id}/historical-memberships/{membership_id}")
async def admin_delete_historical_membership(user_id: str, membership_id: str, request: Request):
    """Delete a historical membership (admin correction of past data)."""
    await get_admin_user(request)
    membership = await db.memberships.find_one(
        {"id": membership_id, "user_id": user_id}, {"_id": 0}
    )
    if not membership:
        raise HTTPException(status_code=404, detail="Članarina nije pronađena")
    await db.memberships.delete_one({"id": membership_id, "user_id": user_id})
    logger.info(f"Historical membership {membership_id} deleted for user {user_id}")
    return {"success": True, "message": "Istorijska članarina je obrisana."}


@api_router.delete("/admin/users/{user_id}/historical-trainings/{training_id}")
async def admin_delete_historical_training(user_id: str, training_id: str, request: Request):
    """Delete a historical training (admin correction of past data)."""
    await get_admin_user(request)
    training = await db.trainings.find_one(
        {"id": training_id, "user_id": user_id}, {"_id": 0}
    )
    if not training:
        raise HTTPException(status_code=404, detail="Trening nije pronađen")
    await db.trainings.delete_one({"id": training_id, "user_id": user_id})
    logger.info(f"Historical training {training_id} deleted for user {user_id}")
    return {"success": True, "message": "Istorijski trening je obrisan."}

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
    """Admin dashboard stats with real-time counts"""
    await get_admin_user(request)
    now = datetime.now(timezone.utc)
    today_str = now.strftime("%Y-%m-%d")
    month_start = now.replace(day=1).strftime("%Y-%m-%d")
    total_users = await db.users.count_documents({"is_admin": {"$ne": True}})
    active_memberships = await db.memberships.count_documents({"tip": "aktivna"})
    today_trainings = await db.trainings.count_documents({
        "datum": {"$regex": f"^{today_str}"},
        "tip": {"$nin": ["otkazan", "cancelled", "otkazano"]},
        "status": {"$nin": ["otkazan", "cancelled", "otkazano"]},
    })
    total_bookings = await db.trainings.count_documents({})
    pending_requests = await db.package_requests.count_documents({"status": "pending"})
    # Current month revenue from approved packages
    month_approved = await db.package_requests.find(
        {"status": "approved", "approved_at": {"$gte": now.replace(day=1).isoformat()}}, {"_id": 0, "package_price": 1}
    ).to_list(1000)
    pkg_revenue = sum(r.get("package_price", 0) for r in month_approved)
    # Current month manual income
    manual_entries = await db.manual_income.find(
        {"datum": {"$gte": month_start}}, {"_id": 0, "iznos": 1}
    ).to_list(1000)
    manual_revenue = sum(e.get("iznos", 0) for e in manual_entries)
    month_revenue = pkg_revenue + manual_revenue
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
        "mjesecni_prihod": month_revenue,
        "prihod_paketi": pkg_revenue,
        "prihod_rucni": manual_revenue,
        "posljednji_korisnici": recent_users,
        "posljednji_zahtjevi": recent_requests
    }

# ============== ADMIN USERS ==============

@api_router.get("/admin/users")
async def admin_get_users(request: Request):
    """Get all users including archived, with full details"""
    await get_admin_user(request)
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    users = await db.users.find({"is_admin": {"$ne": True}}, {"_id": 0}).sort("created_at", -1).to_list(500)
    archived_users = await db.archived_users.find({}, {"_id": 0}).sort("archived_at", -1).to_list(500)
    for au in archived_users:
        au["is_archived"] = True
        au["disable_actions"] = True
    all_users = users + archived_users
    result = []
    for u in all_users:
        is_archived = u.get("is_archived", False)
        membership = None
        upcoming = 0
        pending_req = None
        if not is_archived:
            membership = await db.memberships.find_one(
                {"user_id": u["user_id"], "tip": {"$in": ["aktivna", "zamrznuta"]}}, {"_id": 0}
            )
            # "Zakazani" = only upcoming (future-dated) trainings that are still
            # pending — never cancelled or completed. datum is stored as either
            # "YYYY-MM-DD" or a full ISO string, so a string $gte against today
            # works for both. count_documents is inherently >= 0.
            upcoming = await db.trainings.count_documents(
                {
                    "user_id": u["user_id"],
                    "tip": "predstojeći",
                    "datum": {"$gte": today_str},
                }
            )
            upcoming = max(0, upcoming)
            pending_req = await db.package_requests.find_one(
                {"user_id": u["user_id"], "status": "pending"}, {"_id": 0}
            )
        user_status = u.get("status", "active")
        if is_archived:
            user_status = "archived"
        elif membership and membership.get("tip") == "zamrznuta":
            user_status = "frozen"
        elif membership and membership.get("tip") == "aktivna":
            user_status = "active"
        elif pending_req:
            user_status = "pending"
        result.append({
            **u,
            "aktivna_clanarina": membership is not None and membership.get("tip") == "aktivna" if not is_archived else False,
            "naziv_paketa": membership.get("naziv", "-") if membership else (pending_req.get("package_name", "Na čekanju") if pending_req else "-"),
            "preostali_termini": membership.get("preostali_termini", 0) if membership else 0,
            "ukupni_termini": membership.get("ukupni_termini", 0) if membership else 0,
            "datum_aktivacije": membership.get("datum_pocetka", "") if membership else "",
            "datum_isteka": membership.get("datum_isteka", "") if membership else "",
            "predstojeći_treninzi": upcoming,
            "membership_status": membership.get("tip", "-") if membership else "-",
            "freeze_start": membership.get("freeze_start") if membership else None,
            "freeze_end": membership.get("freeze_end") if membership else None,
            "freeze_reason": membership.get("freeze_reason", "") if membership else "",
            "korisnik_status": user_status,
            "pending_request": pending_req,
            "disable_actions": is_archived
        })
    return result

# ============== ADMIN SCHEDULE MANAGEMENT ==============

@api_router.get("/admin/schedule")
async def admin_get_schedule(request: Request):
    """Get schedule slots for today + next 10 days"""
    await get_admin_user(request)
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    end_date = (datetime.now(timezone.utc) + timedelta(days=10)).strftime("%Y-%m-%d")
    slots = await db.schedule_slots.find(
        {"datum": {"$gte": today_str, "$lte": end_date}}, {"_id": 0}
    ).sort([("datum", 1), ("vrijeme", 1)]).to_list(5000)
    # Enrich with booking count. Trial bookings ("probni") also take up a seat.
    for slot in slots:
        booked = await db.trainings.count_documents({
            "slot_id": slot["id"], "tip": {"$in": ["predstojeći", "završen", "probni"]}
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
    """Delete a schedule slot without any checks"""
    await get_admin_user(request)
    await db.schedule_slots.delete_one({"id": slot_id})
    return {"success": True, "message": "Termin je obrisan"}

# ============== ADMIN BOOKINGS ==============

@api_router.get("/admin/bookings")
async def admin_get_bookings(request: Request):
    """Get ALL trainings with user names"""
    await get_admin_user(request)
    trainings = await db.trainings.find(
        {}, {"_id": 0}
    ).sort("datum", -1).to_list(5000)
    result = []
    for t in trainings:
        user = await db.users.find_one({"user_id": t.get("user_id")}, {"_id": 0, "name": 1, "phone": 1, "email": 1})
        t["korisnik"] = user
        t["korisnik_ime"] = user.get("name", "Nepoznat") if user else "Nepoznat"
        result.append(t)
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
    # Send push notification
    await send_push_notification(
        training["user_id"],
        "Trening otkazan",
        f"Vaš termin za {training_datum} u {training_vrijeme} je otkazan."
    )
    return {"success": True, "message": "Rezervacija je uspješno otkazana. Termin je vraćen korisniku."}


@api_router.post("/admin/trainings/{training_id}/cancel")
async def admin_cancel_training(training_id: str, request: Request):
    """Cancel a training as admin, bypassing the 12-hour cancellation window.

    Restores the session to the user's active membership and frees up the slot.
    Slot availability (slobodna_mjesta / zauzeto) is derived by counting trainings
    with tip in ["predstojeći", "završen"], so setting tip to "otkazan" frees it.
    """
    await get_admin_user(request)
    training = await db.trainings.find_one({"id": training_id}, {"_id": 0})
    if not training:
        raise HTTPException(status_code=404, detail="Trening nije pronađen")
    if training.get("tip") == "otkazan":
        raise HTTPException(status_code=400, detail="Trening je već otkazan")

    # Cancel the training (no 12-hour window check for admins)
    await db.trainings.update_one(
        {"id": training_id},
        {"$set": {"tip": "otkazan", "razlog_otkazivanja": "Otkazano od strane admina"}}
    )
    logger.info(f"Training {training_id} cancelled by admin for user {training.get('user_id')}")

    # Return the session to the user's active membership
    membership = await db.memberships.find_one(
        {"user_id": training["user_id"], "tip": "aktivna"}, {"_id": 0}
    )
    if membership:
        await db.memberships.update_one(
            {"id": membership["id"]},
            {"$inc": {"preostali_termini": 1}}
        )

    # Notify the user
    training_datum = training.get("datum", "")
    training_vrijeme = training.get("vrijeme", "")
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": training["user_id"],
        "type": "booking_cancelled",
        "title": "Termin otkazan",
        "message": f"Vaš termin za {training_datum} u {training_vrijeme} je otkazan.".strip(),
        "data": {"training_id": training_id},
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    await send_push_notification(
        training["user_id"],
        "Trening otkazan",
        f"Vaš termin za {training_datum} u {training_vrijeme} je otkazan."
    )

    return {"success": True, "message": "Trening uspješno otkazan."}

# ============== CANCELLATION REQUESTS ==============
# When a user tries to cancel a training less than 12h before it starts, the app
# cannot cancel it directly — instead it sends a cancellation REQUEST that an
# admin reviews. Requests live in the `cancellation_requests` collection.


@api_router.post("/trainings/{training_id}/request-cancel")
async def request_cancel_training(training_id: str, request: Request):
    """User requests cancellation of an upcoming training (admin must approve)."""
    user = await get_current_user(request)

    training = await db.trainings.find_one(
        {"id": training_id, "user_id": user.user_id}, {"_id": 0}
    )
    if not training:
        raise HTTPException(status_code=404, detail="Trening nije pronađen")
    if training.get("tip") != "predstojeći":
        raise HTTPException(status_code=400, detail="Samo predstojeći treninzi se mogu otkazati.")

    # Don't allow duplicate pending requests for the same training.
    existing = await db.cancellation_requests.find_one(
        {"training_id": training_id, "status": "pending"}, {"_id": 0}
    )
    if existing:
        raise HTTPException(status_code=400, detail="Zahtjev za otkazivanje je već poslan.")

    req = {
        "id": str(uuid.uuid4()),
        "training_id": training_id,
        "user_id": user.user_id,
        "status": "pending",
        # Snapshot the training details so the admin list is self-contained.
        "datum": training.get("datum"),
        "vrijeme": training.get("vrijeme"),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.cancellation_requests.insert_one(req)
    logger.info(f"Cancellation request {req['id']} created for training {training_id} by {user.user_id}")

    return {
        "success": True,
        "message": "Zahtjev za otkazivanje je poslan. Sačekajte odobrenje administratora.",
        "request_id": req["id"],
    }


@api_router.get("/admin/cancellation-requests")
async def admin_list_cancellation_requests(request: Request):
    """List all pending cancellation requests with user and training details."""
    await get_admin_user(request)
    requests = await db.cancellation_requests.find(
        {"status": "pending"}, {"_id": 0}
    ).sort("created_at", -1).to_list(1000)
    for r in requests:
        user = await db.users.find_one(
            {"user_id": r.get("user_id")}, {"_id": 0, "name": 1, "phone": 1}
        )
        r["user_name"] = user.get("name", "Nepoznat") if user else "Nepoznat"
        r["user_phone"] = user.get("phone", "") if user else ""
        # Refresh training details in case they aren't snapshotted on the request.
        training = await db.trainings.find_one(
            {"id": r.get("training_id")}, {"_id": 0, "datum": 1, "vrijeme": 1, "tip": 1, "instruktor": 1}
        )
        if training:
            r["datum"] = r.get("datum") or training.get("datum")
            r["vrijeme"] = r.get("vrijeme") or training.get("vrijeme")
            r["instruktor"] = training.get("instruktor")
            r["training_tip"] = training.get("tip")
    return requests


@api_router.post("/admin/cancellation-requests/{request_id}/approve")
async def admin_approve_cancellation_request(request_id: str, request: Request):
    """Approve a cancellation request: cancel the training, return the session to
    the user's active membership and free the slot."""
    await get_admin_user(request)

    req = await db.cancellation_requests.find_one(
        {"id": request_id, "status": "pending"}, {"_id": 0}
    )
    if not req:
        raise HTTPException(status_code=404, detail="Zahtjev nije pronađen")

    training = await db.trainings.find_one({"id": req["training_id"]}, {"_id": 0})
    if training and training.get("tip") != "otkazan":
        # Cancel the training — slot availability is derived by counting trainings,
        # so setting tip to "otkazan" frees the slot automatically.
        await db.trainings.update_one(
            {"id": req["training_id"]},
            {"$set": {"tip": "otkazan", "razlog_otkazivanja": "Odobren zahtjev za otkazivanje"}},
        )
        # Return the session to the user's active membership.
        membership = await db.memberships.find_one(
            {"user_id": req["user_id"], "tip": "aktivna"}, {"_id": 0}
        )
        if membership:
            await db.memberships.update_one(
                {"id": membership["id"]},
                {"$inc": {"preostali_termini": 1}},
            )

    await db.cancellation_requests.update_one(
        {"id": request_id},
        {"$set": {"status": "approved", "resolved_at": datetime.now(timezone.utc).isoformat()}},
    )

    datum = req.get("datum", "")
    vrijeme = req.get("vrijeme", "")
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": req["user_id"],
        "type": "cancellation_approved",
        "title": "Otkazivanje odobreno",
        "message": f"Vaš zahtjev za otkazivanje termina ({datum} u {vrijeme}) je odobren. Termin je vraćen.".strip(),
        "data": {"training_id": req["training_id"]},
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    await send_push_notification(
        req["user_id"],
        "Otkazivanje odobreno",
        f"Vaš zahtjev za otkazivanje termina ({datum} u {vrijeme}) je odobren.",
    )

    return {"success": True, "message": "Zahtjev je odobren. Termin je otkazan i vraćen korisniku."}


@api_router.post("/admin/cancellation-requests/{request_id}/reject")
async def admin_reject_cancellation_request(request_id: str, request: Request):
    """Reject a cancellation request: the training stands and counts as used."""
    await get_admin_user(request)

    req = await db.cancellation_requests.find_one(
        {"id": request_id, "status": "pending"}, {"_id": 0}
    )
    if not req:
        raise HTTPException(status_code=404, detail="Zahtjev nije pronađen")

    await db.cancellation_requests.update_one(
        {"id": request_id},
        {"$set": {"status": "rejected", "resolved_at": datetime.now(timezone.utc).isoformat()}},
    )

    # The training is left as-is (predstojeći → it stands and counts as used);
    # no session is returned to the membership.
    datum = req.get("datum", "")
    vrijeme = req.get("vrijeme", "")
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": req["user_id"],
        "type": "cancellation_rejected",
        "title": "Otkazivanje odbijeno",
        "message": f"Vaš zahtjev za otkazivanje termina ({datum} u {vrijeme}) je odbijen. Termin se računa kao iskorišten.".strip(),
        "data": {"training_id": req["training_id"]},
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    await send_push_notification(
        req["user_id"],
        "Otkazivanje odbijeno",
        f"Vaš zahtjev za otkazivanje termina ({datum} u {vrijeme}) je odbijen.",
    )

    return {"success": True, "message": "Zahtjev je odbijen. Termin se računa kao iskorišten."}

# ============== ADMIN BULK SCHEDULE ==============

@api_router.post("/admin/schedule/generate-week")
async def admin_generate_week(request: Request):
    """Generate schedule slots for the next N days (default 7, up to 60).

    Reads the `days` value sent by the client (the frontend sends e.g. 30) and
    generates that many days of slots. Only adds new slots — existing slots are
    never deleted or overwritten.
    """
    await get_admin_user(request)
    body = await request.json()
    start_date_str = body.get("start_date")
    days_count = body.get("days", 7)
    # Honor the requested number of days, clamped to a safe range (1–60) that
    # matches the frontend's allowed input. Previously this was capped at a lower
    # value, which prevented generating the full requested range.
    try:
        days_count = int(days_count)
    except (TypeError, ValueError):
        days_count = 7
    days_count = max(1, min(days_count, 60))
    instructors = body.get("instructors", ["Marija Trisic"])
    times = body.get("times", ["08:00", "09:00", "10:00", "11:00", "17:00", "18:00", "19:00", "20:00"])
    spots = body.get("spots_per_slot", 3)
    if start_date_str:
        start_date = datetime.strptime(start_date_str, "%Y-%m-%d")
    else:
        start_date = datetime.now(timezone.utc)
    created = 0
    saturday_times = ["08:00", "09:00", "10:00", "11:00"]
    for day_offset in range(days_count):
        date = start_date + timedelta(days=day_offset)
        if date.weekday() == 6:  # Skip Sunday (neradni dan)
            continue
        date_str = date.strftime("%Y-%m-%d")
        day_times = saturday_times if date.weekday() == 5 else times
        for idx, time in enumerate(day_times):
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


# ============== ADDITIONAL ADMIN ENDPOINTS ==============

@api_router.get("/admin/all-users")
async def admin_get_all_users(request: Request):
    """Return all users including archived ones"""
    await get_admin_user(request)
    active_users = await db.users.find({}, {"_id": 0}).to_list(10000)
    archived_users = await db.archived_users.find({}, {"_id": 0}).to_list(10000)
    for u in archived_users:
        u["is_archived"] = True
        u["status"] = "grey"
        u["actions_disabled"] = True
    for u in active_users:
        u["is_archived"] = False
    return active_users + archived_users

@api_router.get("/admin/today-trainings")
async def admin_get_today_trainings(request: Request):
    """Return all non-cancelled trainings for today sorted by time"""
    await get_admin_user(request)
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    # Exclude cancelled trainings regardless of whether the cancellation was
    # recorded on `tip` or on a separate `status` field, and regardless of the
    # exact wording ("otkazan" / "cancelled"). $nin also matches docs missing
    # the field, so non-cancelled trainings are still returned.
    trainings = await db.trainings.find(
        {
            "datum": {"$regex": f"^{today_str}"},
            "tip": {"$nin": ["otkazan", "cancelled", "otkazano"]},
            "status": {"$nin": ["otkazan", "cancelled", "otkazano"]},
        },
        {"_id": 0}
    ).sort("vrijeme", 1).to_list(1000)
    # Enrich with user names
    for t in trainings:
        user = await db.users.find_one({"user_id": t.get("user_id")}, {"_id": 0, "name": 1, "phone": 1})
        t["user_name"] = user.get("name", "Nepoznat") if user else "Nepoznat"
        t["user_phone"] = user.get("phone", "") if user else ""
    return trainings

@api_router.delete("/admin/schedule/slots/{slot_id}/force")
async def admin_force_delete_slot(slot_id: str, request: Request):
    """Force delete a slot and cancel all its bookings"""
    await get_admin_user(request)
    slot = await db.schedule_slots.find_one({"id": slot_id}, {"_id": 0})
    if not slot:
        raise HTTPException(status_code=404, detail="Termin nije pronadjen")
    cancelled = await db.trainings.update_many(
        {"slot_id": slot_id, "tip": "predstojeći"},
        {"$set": {"tip": "otkazan"}}
    )
    await db.schedule_slots.delete_one({"id": slot_id})
    return {"success": True, "message": f"Termin obrisan, otkazano {cancelled.modified_count} rezervacija", "cancelled_bookings": cancelled.modified_count}

class DeleteDayRequest(BaseModel):
    datum: str

@api_router.post("/admin/schedule/delete-day")
@api_router.delete("/admin/schedule/delete-day")
async def admin_delete_day_slots(data: DeleteDayRequest, request: Request):
    """Delete ALL slots for a given date"""
    await get_admin_user(request)
    logger.info(f"Deleting all slots for datum={data.datum}")
    count_before = await db.schedule_slots.count_documents({"datum": data.datum})
    logger.info(f"Found {count_before} slots to delete for datum={data.datum}")
    result = await db.schedule_slots.delete_many({"datum": data.datum})
    logger.info(f"Deleted {result.deleted_count} slots for datum={data.datum}")
    return {"success": True, "deleted": result.deleted_count}

@api_router.post("/admin/users/{user_id}/archive")
async def admin_archive_user(user_id: str, request: Request):
    """Move user to archived_users collection"""
    await get_admin_user(request)
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Korisnik nije pronadjen")
    if user.get("is_admin"):
        raise HTTPException(status_code=400, detail="Ne mozete arhivirati admin korisnika")
    user["archived_at"] = datetime.now(timezone.utc).isoformat()
    await db.archived_users.insert_one(user)
    await db.users.delete_one({"user_id": user_id})
    await db.user_sessions.delete_many({"user_id": user_id})
    return {"success": True, "message": "Korisnik je arhiviran"}

@api_router.get("/admin/warnings")
async def admin_get_warnings(request: Request):
    """Return users with 0 sessions, expiring memberships, and inactive users"""
    await get_admin_user(request)
    now = datetime.now(timezone.utc)
    seven_days = (now + timedelta(days=7)).isoformat()
    thirty_days_ago = (now - timedelta(days=30)).isoformat()
    today_str = now.strftime("%Y-%m-%d")

    # Users with 0 remaining sessions
    zero_sessions = await db.memberships.find(
        {"tip": "aktivna", "preostali_termini": 0}, {"_id": 0}
    ).to_list(1000)
    zero_session_user_ids = list(set(m["user_id"] for m in zero_sessions))
    zero_session_users = []
    for uid in zero_session_user_ids:
        u = await db.users.find_one({"user_id": uid}, {"_id": 0, "user_id": 1, "name": 1, "phone": 1})
        if u:
            u["warning_type"] = "zero_sessions"
            zero_session_users.append(u)

    # Memberships expiring within 7 days
    expiring = await db.memberships.find(
        {"tip": "aktivna", "datum_isteka": {"$lte": seven_days, "$gte": today_str}}, {"_id": 0}
    ).to_list(1000)
    expiring_user_ids = list(set(m["user_id"] for m in expiring))
    expiring_users = []
    for uid in expiring_user_ids:
        u = await db.users.find_one({"user_id": uid}, {"_id": 0, "user_id": 1, "name": 1, "phone": 1})
        if u:
            membership = next((m for m in expiring if m["user_id"] == uid), None)
            u["warning_type"] = "expiring_membership"
            u["datum_isteka"] = membership["datum_isteka"] if membership else ""
            expiring_users.append(u)

    # Users inactive for 30+ days
    inactive_users_cursor = db.users.find(
        {"is_admin": {"$ne": True}, "last_activity": {"$lt": thirty_days_ago}},
        {"_id": 0, "user_id": 1, "name": 1, "phone": 1, "last_activity": 1}
    )
    inactive_users = await inactive_users_cursor.to_list(1000)
    for u in inactive_users:
        u["warning_type"] = "inactive_30_days"

    return {
        "zero_sessions": zero_session_users,
        "expiring_memberships": expiring_users,
        "inactive_users": inactive_users
    }


# Include the router in the main app

# ============== ADMIN ANALYTICS ==============

@api_router.get("/admin/analytics/clients")
async def admin_analytics_clients(request: Request):
    """Active vs inactive clients with details"""
    await get_admin_user(request)
    all_users = await db.users.find({"is_admin": {"$ne": True}}, {"_id": 0}).to_list(10000)
    active_clients = []
    inactive_clients = []
    for u in all_users:
        uid = u.get("user_id")
        active_mem = await db.memberships.find_one(
            {"user_id": uid, "tip": "aktivna"}, {"_id": 0}
        )
        if active_mem:
            active_clients.append({
                "user_id": uid,
                "name": u.get("name", ""),
                "phone": u.get("phone", ""),
                "last_activity": u.get("last_activity", ""),
                "paket": active_mem.get("naziv", ""),
                "preostali_termini": active_mem.get("preostali_termini", 0),
                "datum_isteka": active_mem.get("datum_isteka", "")
            })
        else:
            prev_mem = await db.memberships.find_one(
                {"user_id": uid, "tip": {"$in": ["prethodna", "istekla"]}},
                {"_id": 0},
                sort=[("datum_isteka", -1)]
            )
            if prev_mem:
                inactive_clients.append({
                    "user_id": uid,
                    "name": u.get("name", ""),
                    "phone": u.get("phone", ""),
                    "last_activity": u.get("last_activity", ""),
                    "prethodni_paket": prev_mem.get("naziv", ""),
                    "datum_isteka": prev_mem.get("datum_isteka", ""),
                    "preostali_termini": prev_mem.get("preostali_termini", 0)
                })
    return {
        "active_count": len(active_clients),
        "inactive_count": len(inactive_clients),
        "active_clients": active_clients,
        "inactive_clients": inactive_clients
    }

@api_router.get("/admin/analytics/slots")
async def admin_analytics_slots(request: Request):
    """Slot popularity and occupancy from all bookings"""
    await get_admin_user(request)
    all_trainings = await db.trainings.find(
        {"tip": {"$ne": "otkazan"}}, {"_id": 0, "datum": 1, "vrijeme": 1, "slot_id": 1}
    ).to_list(100000)
    total_bookings = len(all_trainings)
    # Day popularity
    day_names = ["Ponedjeljak", "Utorak", "Srijeda", "Cetvrtak", "Petak", "Subota", "Nedjelja"]
    day_counts = {}
    time_counts = {}
    for t in all_trainings:
        d = t.get("datum", "")
        if isinstance(d, datetime):
            d = d.strftime("%Y-%m-%d")
        elif "T" in str(d):
            d = str(d).split("T")[0]
        else:
            d = str(d)
        try:
            dt = datetime.strptime(d, "%Y-%m-%d")
            day_name = day_names[dt.weekday()]
            day_counts[day_name] = day_counts.get(day_name, 0) + 1
        except Exception:
            pass
        v = t.get("vrijeme", "")
        if v:
            time_counts[v] = time_counts.get(v, 0) + 1
    popular_days = sorted(day_counts.items(), key=lambda x: x[1], reverse=True)
    popular_times = sorted(time_counts.items(), key=lambda x: x[1], reverse=True)
    # Average occupancy
    total_slots = await db.schedule_slots.count_documents({})
    avg_occupancy = round((total_bookings / total_slots * 100), 1) if total_slots > 0 else 0
    return {
        "total_bookings": total_bookings,
        "total_slots": total_slots,
        "average_occupancy_percent": avg_occupancy,
        "popular_days": [{"dan": d, "rezervacija": c} for d, c in popular_days],
        "popular_times": [{"vrijeme": t, "rezervacija": c} for t, c in popular_times]
    }


# ============== ADMIN PUSH NOTIFICATIONS ==============

class AdminSendNotificationRequest(BaseModel):
    # recipients: "all" | "active" | "individual". If omitted, inferred from user_id
    # (individual when user_id is present, otherwise all) for backward compatibility.
    recipients: Optional[str] = None
    user_id: Optional[str] = None
    title: str
    message: Optional[str] = None
    body: Optional[str] = None  # alias accepted by clients; falls back to message


async def _save_notification(user_id: str, title: str, message: str, now: datetime):
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "type": "admin_message",
        "title": title,
        "message": message,
        "read": False,
        "created_at": now.isoformat()
    })


@api_router.post("/admin/send-notification")
async def admin_send_notification(data: AdminSendNotificationRequest, request: Request):
    """Admin sends a push notification to all users, active members, or one individual."""
    await get_admin_user(request)
    now = datetime.now(timezone.utc)

    message = data.body or data.message
    if not message:
        raise HTTPException(status_code=400, detail="Poruka je obavezna")

    # Resolve recipient mode (fall back to legacy behavior based on user_id)
    mode = data.recipients
    if mode not in ("all", "active", "individual"):
        mode = "individual" if data.user_id else "all"

    if mode == "individual":
        if not data.user_id:
            raise HTTPException(status_code=400, detail="user_id je obavezan za individualnu notifikaciju")
        await send_push_notification(data.user_id, data.title, message)
        await _save_notification(data.user_id, data.title, message, now)
        return {"success": True, "message": "Notifikacija poslana korisniku"}

    if mode == "active":
        # Users with an active membership AND a push token
        active_user_ids = await db.memberships.distinct("user_id", {"tip": "aktivna"})
        recipients = await db.users.find(
            {
                "user_id": {"$in": active_user_ids},
                "is_admin": {"$ne": True},
                "push_token": {"$exists": True, "$ne": ""}
            },
            {"_id": 0, "user_id": 1, "push_token": 1}
        ).to_list(10000)
        sent = 0
        for u in recipients:
            if await send_push_notification(u["user_id"], data.title, message):
                sent += 1
            await _save_notification(u["user_id"], data.title, message, now)
        return {"success": True, "message": f"Notifikacija poslana aktivnim članovima ({sent} push-eva)"}

    # mode == "all": all non-admin users with a push token
    sent = await send_push_to_all_users(data.title, message)
    all_users = await db.users.find(
        {"is_admin": {"$ne": True}, "push_token": {"$exists": True, "$ne": ""}},
        {"_id": 0, "user_id": 1}
    ).to_list(10000)
    for u in all_users:
        await _save_notification(u["user_id"], data.title, message, now)
    return {"success": True, "message": f"Notifikacija poslana svim korisnicima ({sent} push-eva)"}


@api_router.get("/admin/renewal-reminders/log")
async def admin_get_renewal_log(request: Request):
    """Get history of automatic renewal reminders sent."""
    await get_admin_user(request)
    entries = await db.renewal_reminders_log.find({}, {"_id": 0}).sort("sent_at", -1).to_list(500)
    return {"count": len(entries), "entries": entries}


@api_router.post("/admin/renewal-reminders/run")
async def admin_run_renewal_check(request: Request):
    """Manually trigger the auto-renewal reminder check (3 days before expiry)."""
    await get_admin_user(request)
    await check_renewal_reminders()
    recent = await db.renewal_reminders_log.find({}, {"_id": 0}).sort("sent_at", -1).to_list(50)
    return {"success": True, "message": "Provjera pokrenuta", "recent_log": recent[:10]}


@api_router.get("/admin/inactivity-reminders/log")
async def admin_get_inactivity_log(request: Request):
    """Get history of 5-day inactivity push reminders sent."""
    await get_admin_user(request)
    entries = await db.inactivity_reminders_log.find({}, {"_id": 0}).sort("sent_at", -1).to_list(500)
    return {"count": len(entries), "entries": entries}


@api_router.post("/admin/inactivity-reminders/run")
async def admin_run_inactivity_check(request: Request):
    """Manually trigger the 5-day inactivity reminder check."""
    await get_admin_user(request)
    await check_5day_inactivity_reminders()
    recent = await db.inactivity_reminders_log.find({}, {"_id": 0}).sort("sent_at", -1).to_list(50)
    return {"success": True, "message": "Provjera pokrenuta", "recent_log": recent[:10]}

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
                await send_push_notification(
                    training["user_id"],
                    "Sutrašnji trening",
                    f"Sutra u {training['vrijeme']} te očekuje Pilates Reformer trening. Vidimo se!"
                )
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


async def check_5day_inactivity_reminders():
    """Send push notifications to users with active memberships who haven't trained in 5+ days.

    Idempotent: at most one reminder per user per 5-day window
    (tracked in inactivity_reminders_log collection).
    """
    try:
        now = datetime.now(timezone.utc)
        now_iso = now.isoformat()
        five_days_ago = (now - timedelta(days=5)).isoformat()

        # 1) Find all active memberships (not expired, has remaining sessions)
        active_memberships = await db.memberships.find(
            {
                "tip": "aktivna",
                "datum_isteka": {"$gt": now_iso},
                "preostali_termini": {"$gt": 0},
            },
            {"_id": 0, "user_id": 1},
        ).to_list(5000)

        sent_count = 0
        skipped_count = 0
        failed_count = 0
        seen_users = set()

        for m in active_memberships:
            uid = m.get("user_id")
            if not uid or uid in seen_users:
                continue
            seen_users.add(uid)

            # 2) Find user's most recent completed training
            last_training = await db.trainings.find_one(
                {
                    "user_id": uid,
                    "tip": {"$in": ["završen", "prethodni", "iskoristen"]},
                },
                {"_id": 0, "datum": 1, "tip": 1},
                sort=[("datum", -1)],
            )

            last_training_date = None
            send_reminder = False
            if last_training:
                raw_date = last_training.get("datum", "")
                try:
                    if isinstance(raw_date, str):
                        if "T" in raw_date:
                            last_dt = datetime.fromisoformat(raw_date.replace("Z", "+00:00"))
                        else:
                            last_dt = datetime.strptime(raw_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
                    else:
                        last_dt = raw_date
                    if last_dt.tzinfo is None:
                        last_dt = last_dt.replace(tzinfo=timezone.utc)
                    days_since = (now - last_dt).days
                    last_training_date = last_dt.isoformat()
                    if days_since >= 5:
                        send_reminder = True
                except Exception as e:
                    logger.warning(f"Inactivity: bad last training date for {uid}: {e}")
                    send_reminder = True
            else:
                # Never trained
                send_reminder = True

            if not send_reminder:
                continue

            # 3) Idempotency: skip if a reminder was already sent within 5 days
            recent_log = await db.inactivity_reminders_log.find_one({
                "user_id": uid,
                "sent_at": {"$gte": five_days_ago},
            })
            if recent_log:
                skipped_count += 1
                continue

            title = "Vrijeme je za trening! 💪"
            message = "Niste trenirali već 5 dana. Zakažite svoj sljedeći trening!"

            push_status = "skipped"
            try:
                push_ok = await send_push_notification(uid, title, message)
                push_status = "ok" if push_ok else "no_token"
            except Exception as push_err:
                logger.error(f"Inactivity push error for {uid}: {push_err}")
                push_status = "error"

            try:
                await db.notifications.insert_one({
                    "id": str(uuid.uuid4()),
                    "user_id": uid,
                    "type": "inactivity_5day_reminder",
                    "title": title,
                    "message": message,
                    "data": {"last_training_date": last_training_date},
                    "read": False,
                    "created_at": now_iso,
                })
            except Exception as notif_err:
                logger.error(f"Inactivity in-app notif error for {uid}: {notif_err}")
                failed_count += 1
                continue

            await db.inactivity_reminders_log.insert_one({
                "id": str(uuid.uuid4()),
                "user_id": uid,
                "sent_at": now_iso,
                "last_training_date": last_training_date,
                "push_status": push_status,
                "channel": "auto_scheduler",
            })
            sent_count += 1

        logger.info(
            f"5-day inactivity check: active_users={len(seen_users)}, "
            f"sent={sent_count}, skipped(recent)={skipped_count}, failed={failed_count}"
        )
    except Exception as e:
        logger.error(f"5-day inactivity reminder error: {e}")


async def mark_renewal_conversions(user_id: str, source: str):
    """Mark recent renewal_reminders_log entries as converted when user renews.

    Called whenever a user creates a package_request OR admin creates a custom membership.
    Looks back 7 days for unmarked log entries belonging to this user and tags them with
    renewed_after_reminder=true, renewed_at, and renewal_method.
    """
    try:
        now = datetime.now(timezone.utc)
        seven_days_ago = (now - timedelta(days=7)).isoformat()
        result = await db.renewal_reminders_log.update_many(
            {
                "user_id": user_id,
                "renewed_after_reminder": {"$ne": True},
                "sent_at": {"$gte": seven_days_ago},
            },
            {
                "$set": {
                    "renewed_after_reminder": True,
                    "renewed_at": now.isoformat(),
                    "renewal_method": source,
                }
            },
        )
        if result.modified_count > 0:
            logger.info(
                f"Conversion: marked {result.modified_count} renewal reminder(s) "
                f"as converted for user {user_id} via {source}"
            )
    except Exception as e:
        logger.error(f"Conversion tracking error for {user_id}: {e}")


async def check_renewal_reminders():
    """Send auto-renewal reminders 3 days before membership expiry.

    - Finds active memberships expiring in exactly 3 days (calendar days).
    - Idempotent: each membership/expiry pair is reminded at most once,
      tracked in the renewal_reminders_log collection.
    - Sends Expo push notification + persistent in-app notification.
    """
    try:
        now = datetime.now(timezone.utc)
        target_date = (now + timedelta(days=3)).strftime("%Y-%m-%d")
        memberships = await db.memberships.find(
            {"tip": "aktivna", "datum_isteka": {"$regex": f"^{target_date}"}},
            {"_id": 0}
        ).to_list(1000)

        sent_count = 0
        skipped_count = 0
        failed_count = 0

        for m in memberships:
            membership_id = m.get("id")
            user_id = m.get("user_id")
            if not membership_id or not user_id:
                continue

            # Idempotency: skip if we've already logged a reminder for this expiry
            already = await db.renewal_reminders_log.find_one({
                "membership_id": membership_id,
                "datum_isteka": m.get("datum_isteka"),
            })
            if already:
                skipped_count += 1
                continue

            user = await db.users.find_one(
                {"user_id": user_id},
                {"_id": 0, "name": 1, "phone": 1}
            )
            user_name = (user or {}).get("name") or "klijent"
            paket = m.get("naziv", "članarina")

            title = "Vaša članarina uskoro ističe"
            message = (
                f"Pozdrav {user_name}! Vaša Linea Pilates članarina "
                f"({paket}) ističe za 3 dana ({target_date}). "
                f"Obnovite paket i nastavite tamo gdje ste stali."
            )

            push_status = "skipped"
            try:
                push_result = await send_push_notification(user_id, title, message)
                push_status = "ok" if push_result else "no_token"
            except Exception as push_err:
                logger.error(f"Renewal push error for {user_id}: {push_err}")
                push_status = "error"

            # Always create the in-app notification (works even without push token)
            try:
                await db.notifications.insert_one({
                    "id": str(uuid.uuid4()),
                    "user_id": user_id,
                    "type": "renewal_reminder",
                    "title": title,
                    "message": message,
                    "data": {"membership_id": membership_id, "datum_isteka": m.get("datum_isteka")},
                    "read": False,
                    "created_at": datetime.now(timezone.utc).isoformat()
                })
            except Exception as notif_err:
                logger.error(f"Renewal in-app notif error for {user_id}: {notif_err}")
                failed_count += 1
                continue

            await db.renewal_reminders_log.insert_one({
                "id": str(uuid.uuid4()),
                "membership_id": membership_id,
                "user_id": user_id,
                "user_name": user_name,
                "datum_isteka": m.get("datum_isteka"),
                "naziv_paketa": paket,
                "title": title,
                "message": message,
                "push_status": push_status,
                "channel": "auto_scheduler",
                "sent_at": datetime.now(timezone.utc).isoformat(),
            })
            sent_count += 1

        logger.info(
            f"Renewal reminder check ({target_date}): "
            f"matched={len(memberships)}, sent={sent_count}, "
            f"skipped(already_sent)={skipped_count}, failed={failed_count}"
        )
    except Exception as e:
        logger.error(f"Renewal reminder error: {e}")

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
    saturday_times = ["08:00", "09:00", "10:00", "11:00"]
    slots = []
    for day_offset in range(30):
        date = now + timedelta(days=day_offset)
        if date.weekday() == 6:  # Skip Sunday (neradni dan)
            continue
        date_str = date.strftime("%Y-%m-%d")
        day_times = saturday_times if date.weekday() == 5 else times
        for idx, time_str in enumerate(day_times):
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
        await db.users.update_one({"phone": "+381640080404"}, {"$set": {"is_admin": True, "name": "Stefan", "pin_hash": bcrypt.hash("1234")}})

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
        await db.users.update_one({"phone": "+381652344415"}, {"$set": {"is_admin": True, "name": "Nevena", "pin_hash": bcrypt.hash("1234")}})

    # Fix all existing schedule slots and trainings to use Marija Trisic
    await db.schedule_slots.update_many({}, {"$set": {"instruktor": "Marija Trisic"}})
    await db.trainings.update_many({}, {"$set": {"instruktor": "Marija Trisic"}})
    # Remove Sunday slots from schedule
    all_slots = await db.schedule_slots.find({}, {"_id": 0, "id": 1, "datum": 1, "vrijeme": 1}).to_list(10000)
    sunday_ids = []
    saturday_afternoon_ids = []
    saturday_afternoon_times = ["17:00", "18:00", "19:00", "20:00"]
    for s in all_slots:
        try:
            d = datetime.strptime(s["datum"], "%Y-%m-%d")
            if d.weekday() == 6:
                sunday_ids.append(s["id"])
            elif d.weekday() == 5 and s.get("vrijeme") in saturday_afternoon_times:
                saturday_afternoon_ids.append(s["id"])
        except Exception:
            pass
    if sunday_ids:
        await db.schedule_slots.delete_many({"id": {"$in": sunday_ids}})
        logger.info(f"Removed {len(sunday_ids)} Sunday schedule slots")
    if saturday_afternoon_ids:
        await db.schedule_slots.delete_many({"id": {"$in": saturday_afternoon_ids}})
        logger.info(f"Removed {len(saturday_afternoon_ids)} Saturday afternoon slots")
    logger.info("Studio users and instructor data updated")

# ============== STARTUP / SHUTDOWN ==============

@app.on_event("startup")
async def startup():
    masked = mongo_url[:20] + "***" + mongo_url[-20:] if len(mongo_url) > 40 else mongo_url
    logger.info(f"MongoDB URL: {masked}")
    logger.info(f"MongoDB DB_NAME: {os.environ['DB_NAME']}")
    await seed_packages()
    await seed_admin()
    await seed_schedule()
    await seed_studio_users()
    # Start notification scheduler
    scheduler.add_job(check_day_before_reminders, 'interval', hours=1, id='day_before')
    scheduler.add_job(check_inactivity_reminders, 'interval', hours=6, id='inactivity')
    # Auto-renewal reminders: run once a day at 09:00 UTC + immediate first run on startup
    scheduler.add_job(check_renewal_reminders, 'cron', hour=9, minute=0, id='renewal_reminder')
    scheduler.add_job(check_renewal_reminders, 'date', run_date=datetime.now(timezone.utc) + timedelta(seconds=15), id='renewal_reminder_initial')
    # 5-day inactivity push reminders: run once a day at 10:00 UTC (after renewal job)
    scheduler.add_job(check_5day_inactivity_reminders, 'cron', hour=10, minute=0, id='inactivity_5day')
    scheduler.start()
    logger.info("Notification scheduler started")

@app.on_event("shutdown")
async def shutdown_db_client():
    scheduler.shutdown(wait=False)
    client.close()

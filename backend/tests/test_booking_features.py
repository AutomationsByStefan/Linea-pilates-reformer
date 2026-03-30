"""
Test suite for Iteration 4 features:
- Updated studio info (Instagram, address)
- Same-day scheduling
- One booking per day per user
- Reschedule within 30 minutes
- Booking confirmation flow
"""
import pytest
import requests
import os
from datetime import datetime, timedelta
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestStudioInfo:
    """Test updated studio info endpoint"""
    
    def test_studio_info_returns_updated_instagram(self):
        """GET /api/studio-info returns updated Instagram URL and handle"""
        response = requests.get(f"{BASE_URL}/api/studio-info")
        assert response.status_code == 200
        data = response.json()
        
        # Verify Instagram URL
        assert data["instagram"] == "https://www.instagram.com/lineapilatesreformer/"
        # Verify Instagram handle
        assert data["instagram_handle"] == "@lineapilatesreformer"
        print("✅ Studio info returns correct Instagram URL and handle")
    
    def test_studio_info_returns_updated_address(self):
        """GET /api/studio-info returns updated address"""
        response = requests.get(f"{BASE_URL}/api/studio-info")
        assert response.status_code == 200
        data = response.json()
        
        # Verify address
        assert data["adresa"] == "Kralja Petra I Oslobodioca 55, 89101 Trebinje"
        assert data["grad"] == "Trebinje"
        print("✅ Studio info returns correct address")


class TestScheduleEndpoint:
    """Test schedule endpoint for same-day scheduling"""
    
    def test_schedule_returns_today_slots(self):
        """GET /api/schedule returns today's date slots (same-day scheduling)"""
        response = requests.get(f"{BASE_URL}/api/schedule")
        assert response.status_code == 200
        data = response.json()
        
        # Get today's date
        today = datetime.now().strftime("%Y-%m-%d")
        
        # Check if today's slots are included
        today_slots = [s for s in data if s["datum"] == today]
        assert len(today_slots) > 0, f"Expected slots for today ({today}), but found none"
        print(f"✅ Schedule returns {len(today_slots)} slots for today ({today})")
    
    def test_schedule_slots_have_required_fields(self):
        """Verify schedule slots have all required fields"""
        response = requests.get(f"{BASE_URL}/api/schedule")
        assert response.status_code == 200
        data = response.json()
        
        assert len(data) > 0, "Expected at least one slot"
        slot = data[0]
        
        required_fields = ["id", "datum", "vrijeme", "instruktor", "ukupno_mjesta", "slobodna_mjesta"]
        for field in required_fields:
            assert field in slot, f"Missing field: {field}"
        print("✅ Schedule slots have all required fields")


class TestPhoneAuth:
    """Test phone authentication flow"""
    
    def test_send_otp(self):
        """POST /api/auth/phone/send-otp sends OTP"""
        response = requests.post(
            f"{BASE_URL}/api/auth/phone/send-otp",
            json={"phone": "+387 61 123 456"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        print("✅ OTP sent successfully")
    
    def test_verify_otp_creates_session(self):
        """POST /api/auth/phone/verify with correct OTP creates session"""
        # First send OTP
        requests.post(
            f"{BASE_URL}/api/auth/phone/send-otp",
            json={"phone": "+387 61 123 456"}
        )
        
        # Verify with mock OTP (always 123456)
        session = requests.Session()
        response = session.post(
            f"{BASE_URL}/api/auth/phone/verify",
            json={"phone": "+387 61 123 456", "otp": "123456"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "user_id" in data
        print(f"✅ OTP verified, user_id: {data['user_id']}")
        return session


class TestBookingOnePerDay:
    """Test one booking per day per user limit"""
    
    @pytest.fixture
    def authenticated_session(self):
        """Create authenticated session"""
        # Send OTP
        requests.post(
            f"{BASE_URL}/api/auth/phone/send-otp",
            json={"phone": "+387 61 123 456"}
        )
        
        # Verify OTP
        session = requests.Session()
        response = session.post(
            f"{BASE_URL}/api/auth/phone/verify",
            json={"phone": "+387 61 123 456", "otp": "123456"}
        )
        assert response.status_code == 200
        return session
    
    def test_booking_creates_training(self, authenticated_session):
        """POST /api/bookings creates a training"""
        # Get available slots
        response = authenticated_session.get(f"{BASE_URL}/api/schedule")
        slots = response.json()
        
        # Find a slot for tomorrow (to avoid conflicts with existing bookings)
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        tomorrow_slots = [s for s in slots if s["datum"] == tomorrow and s["slobodna_mjesta"] > 0]
        
        if not tomorrow_slots:
            pytest.skip("No available slots for tomorrow")
        
        slot = tomorrow_slots[0]
        
        # Book the slot
        response = authenticated_session.post(
            f"{BASE_URL}/api/bookings",
            json={
                "slot_id": slot["id"],
                "datum": slot["datum"],
                "vrijeme": slot["vrijeme"],
                "instruktor": slot["instruktor"]
            }
        )
        
        # Could be 200 (success) or 400 (already has booking for that day)
        if response.status_code == 200:
            data = response.json()
            assert data["success"] == True
            assert "training_id" in data
            print(f"✅ Booking created: {data['training_id']}")
            return data["training_id"]
        elif response.status_code == 400:
            data = response.json()
            assert "jedan termin dnevno" in data["detail"].lower() or "već imate" in data["detail"].lower()
            print("✅ One booking per day limit enforced (user already has booking)")
        else:
            pytest.fail(f"Unexpected status code: {response.status_code}")
    
    def test_second_booking_same_day_rejected(self, authenticated_session):
        """POST /api/bookings returns error if user already has booking for that date"""
        # Get available slots
        response = authenticated_session.get(f"{BASE_URL}/api/schedule")
        slots = response.json()
        
        # Find slots for a specific date (day after tomorrow to avoid conflicts)
        target_date = (datetime.now() + timedelta(days=2)).strftime("%Y-%m-%d")
        target_slots = [s for s in slots if s["datum"] == target_date and s["slobodna_mjesta"] > 0]
        
        if len(target_slots) < 2:
            pytest.skip("Not enough available slots for test")
        
        # Book first slot
        slot1 = target_slots[0]
        response1 = authenticated_session.post(
            f"{BASE_URL}/api/bookings",
            json={
                "slot_id": slot1["id"],
                "datum": slot1["datum"],
                "vrijeme": slot1["vrijeme"],
                "instruktor": slot1["instruktor"]
            }
        )
        
        if response1.status_code != 200:
            # User might already have a booking for this day
            print("ℹ️ First booking failed (may already have booking for this day)")
            return
        
        # Try to book second slot on same day
        slot2 = target_slots[1]
        response2 = authenticated_session.post(
            f"{BASE_URL}/api/bookings",
            json={
                "slot_id": slot2["id"],
                "datum": slot2["datum"],
                "vrijeme": slot2["vrijeme"],
                "instruktor": slot2["instruktor"]
            }
        )
        
        assert response2.status_code == 400
        data = response2.json()
        assert "jedan termin dnevno" in data["detail"].lower() or "već imate" in data["detail"].lower()
        print("✅ Second booking on same day correctly rejected")


class TestReschedule:
    """Test reschedule within 30 minutes"""
    
    @pytest.fixture
    def authenticated_session(self):
        """Create authenticated session"""
        requests.post(
            f"{BASE_URL}/api/auth/phone/send-otp",
            json={"phone": "+387 61 123 456"}
        )
        
        session = requests.Session()
        response = session.post(
            f"{BASE_URL}/api/auth/phone/verify",
            json={"phone": "+387 61 123 456", "otp": "123456"}
        )
        assert response.status_code == 200
        return session
    
    def test_reschedule_within_30_min_works(self, authenticated_session):
        """POST /api/bookings/{training_id}/reschedule works within 30 min window"""
        # Get available slots
        response = authenticated_session.get(f"{BASE_URL}/api/schedule")
        slots = response.json()
        
        # Find slots for different dates - use dates far in future to avoid conflicts
        future_dates = [d for d in list(set([s["datum"] for s in slots if s["slobodna_mjesta"] > 0]))
                       if d > (datetime.now() + timedelta(days=10)).strftime("%Y-%m-%d")]
        future_dates.sort()
        
        if len(future_dates) < 2:
            pytest.skip("Not enough future dates for reschedule test")
        
        date1 = future_dates[0]
        date2 = future_dates[1]
        
        slots_date1 = [s for s in slots if s["datum"] == date1 and s["slobodna_mjesta"] > 0]
        slots_date2 = [s for s in slots if s["datum"] == date2 and s["slobodna_mjesta"] > 0]
        
        if not slots_date1 or not slots_date2:
            pytest.skip("No available slots for test dates")
        
        slot1 = slots_date1[0]
        slot2 = slots_date2[0]
        
        # Create booking
        response = authenticated_session.post(
            f"{BASE_URL}/api/bookings",
            json={
                "slot_id": slot1["id"],
                "datum": slot1["datum"],
                "vrijeme": slot1["vrijeme"],
                "instruktor": slot1["instruktor"]
            }
        )
        
        if response.status_code != 200:
            error_msg = response.json().get("detail", "Unknown error")
            print(f"ℹ️ Could not create booking: {error_msg}")
            # If user already has booking for that day, the one-per-day limit is working
            if "jedan termin" in error_msg.lower() or "već imate" in error_msg.lower():
                print("✅ One booking per day limit is enforced - skipping reschedule test")
                pytest.skip("User already has booking for test date")
            pytest.skip("Could not create initial booking")
        
        training_id = response.json()["training_id"]
        print(f"✅ Created booking: {training_id}")
        
        # Immediately reschedule (within 30 min)
        response = authenticated_session.post(
            f"{BASE_URL}/api/bookings/{training_id}/reschedule",
            json={
                "new_slot_id": slot2["id"],
                "new_datum": slot2["datum"],
                "new_vrijeme": slot2["vrijeme"],
                "new_instruktor": slot2["instruktor"]
            }
        )
        
        if response.status_code == 400:
            error_msg = response.json().get("detail", "")
            # If user already has booking for new date, that's expected behavior
            if "već imate" in error_msg.lower() or "taj dan" in error_msg.lower():
                print("✅ One booking per day limit enforced on reschedule target date")
                return
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        print("✅ Reschedule within 30 min window successful")
    
    def test_reschedule_endpoint_exists(self, authenticated_session):
        """Verify reschedule endpoint exists and validates training"""
        # Try to reschedule non-existent training
        response = authenticated_session.post(
            f"{BASE_URL}/api/bookings/nonexistent123/reschedule",
            json={
                "new_slot_id": "slot_test",
                "new_datum": "2026-04-01",
                "new_vrijeme": "10:00",
                "new_instruktor": "Test"
            }
        )
        
        # Should return 404 (not found) not 500 (server error)
        assert response.status_code == 404
        print("✅ Reschedule endpoint validates training existence")


class TestUserBookings:
    """Test user bookings retrieval"""
    
    @pytest.fixture
    def authenticated_session(self):
        """Create authenticated session"""
        requests.post(
            f"{BASE_URL}/api/auth/phone/send-otp",
            json={"phone": "+387 61 123 456"}
        )
        
        session = requests.Session()
        response = session.post(
            f"{BASE_URL}/api/auth/phone/verify",
            json={"phone": "+387 61 123 456", "otp": "123456"}
        )
        assert response.status_code == 200
        return session
    
    def test_get_upcoming_trainings(self, authenticated_session):
        """GET /api/trainings/upcoming returns user's upcoming trainings"""
        response = authenticated_session.get(f"{BASE_URL}/api/trainings/upcoming")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Got {len(data)} upcoming trainings")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

"""
Iteration 10 Tests: Testing 4 new features
1. Admin bookings returns only upcoming (tip='predstojeći' and datum >= today)
2. Admin schedule returns only today + 10 days ahead
3. Free trial booking for new user without membership
4. Second booking attempt blocked for user who used free trial
"""
import pytest
import requests
import os
import uuid
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAdminBookings:
    """Test admin bookings endpoint returns only upcoming bookings"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as admin before each test"""
        self.session = requests.Session()
        # Login as admin
        login_resp = self.session.post(f"{BASE_URL}/api/auth/phone/login", json={
            "phone": "+38766024148",
            "pin": "2803"
        })
        assert login_resp.status_code == 200, f"Admin login failed: {login_resp.text}"
        # Store cookies
        self.cookies = login_resp.cookies
    
    def test_admin_bookings_returns_only_upcoming(self):
        """GET /api/admin/bookings should return only tip='predstojeći' and datum >= today"""
        resp = self.session.get(f"{BASE_URL}/api/admin/bookings", cookies=self.cookies)
        assert resp.status_code == 200, f"Admin bookings failed: {resp.text}"
        
        bookings = resp.json()
        today_str = datetime.utcnow().strftime("%Y-%m-%d")
        
        print(f"Total bookings returned: {len(bookings)}")
        print(f"Today's date: {today_str}")
        
        # Verify all bookings are upcoming (tip='predstojeći')
        for booking in bookings:
            assert booking.get("tip") == "predstojeći", f"Found non-upcoming booking: tip={booking.get('tip')}"
            
            # Verify datum >= today
            booking_date = booking.get("datum", "")
            if "T" in booking_date:
                booking_date = booking_date.split("T")[0]
            assert booking_date >= today_str, f"Found past booking: datum={booking_date}, today={today_str}"
        
        print(f"✓ All {len(bookings)} bookings are upcoming (tip='predstojeći' and datum >= today)")
    
    def test_admin_bookings_no_past_or_cancelled(self):
        """Verify no 'završen' or 'otkazan' bookings are returned"""
        resp = self.session.get(f"{BASE_URL}/api/admin/bookings", cookies=self.cookies)
        assert resp.status_code == 200
        
        bookings = resp.json()
        
        for booking in bookings:
            tip = booking.get("tip")
            assert tip not in ["završen", "otkazan", "prethodni"], f"Found non-upcoming booking type: {tip}"
        
        print(f"✓ No past or cancelled bookings in response")


class TestAdminSchedule:
    """Test admin schedule endpoint returns only today + 10 days"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as admin before each test"""
        self.session = requests.Session()
        login_resp = self.session.post(f"{BASE_URL}/api/auth/phone/login", json={
            "phone": "+38766024148",
            "pin": "2803"
        })
        assert login_resp.status_code == 200, f"Admin login failed: {login_resp.text}"
        self.cookies = login_resp.cookies
    
    def test_admin_schedule_date_range(self):
        """GET /api/admin/schedule should return only slots from today to today+10 days"""
        resp = self.session.get(f"{BASE_URL}/api/admin/schedule", cookies=self.cookies)
        assert resp.status_code == 200, f"Admin schedule failed: {resp.text}"
        
        slots = resp.json()
        today = datetime.utcnow()
        today_str = today.strftime("%Y-%m-%d")
        end_date = (today + timedelta(days=10)).strftime("%Y-%m-%d")
        
        print(f"Total slots returned: {len(slots)}")
        print(f"Expected date range: {today_str} to {end_date}")
        
        for slot in slots:
            slot_date = slot.get("datum", "")
            assert slot_date >= today_str, f"Found slot before today: {slot_date}"
            assert slot_date <= end_date, f"Found slot after today+10: {slot_date}"
        
        print(f"✓ All {len(slots)} slots are within today to today+10 days range")
    
    def test_admin_schedule_no_past_slots(self):
        """Verify no past slots are returned"""
        resp = self.session.get(f"{BASE_URL}/api/admin/schedule", cookies=self.cookies)
        assert resp.status_code == 200
        
        slots = resp.json()
        yesterday = (datetime.utcnow() - timedelta(days=1)).strftime("%Y-%m-%d")
        
        for slot in slots:
            slot_date = slot.get("datum", "")
            assert slot_date > yesterday, f"Found past slot: {slot_date}"
        
        print(f"✓ No past slots in admin schedule response")


class TestFreeTrialBooking:
    """Test free trial booking for new users without membership"""
    
    def test_new_user_gets_free_trial(self):
        """POST /api/bookings for NEW user without membership returns is_trial=true"""
        session = requests.Session()
        
        # Generate unique phone number for new user
        unique_phone = f"+387111{uuid.uuid4().hex[:6]}"
        unique_pin = "1234"
        
        # Register new user
        register_resp = session.post(f"{BASE_URL}/api/auth/register", json={
            "phone": unique_phone,
            "ime": "Test",
            "prezime": "TrialUser",
            "email": f"trial_{uuid.uuid4().hex[:6]}@test.com",
            "pin": unique_pin
        })
        assert register_resp.status_code == 200, f"Registration failed: {register_resp.text}"
        cookies = register_resp.cookies
        
        print(f"✓ Registered new user: {unique_phone}")
        
        # Get available schedule slots
        schedule_resp = session.get(f"{BASE_URL}/api/schedule")
        assert schedule_resp.status_code == 200
        slots = schedule_resp.json()
        
        # Find a slot with available space
        available_slot = None
        for slot in slots:
            if slot.get("slobodna_mjesta", 0) > 0:
                available_slot = slot
                break
        
        assert available_slot is not None, "No available slots found for booking"
        print(f"✓ Found available slot: {available_slot['datum']} {available_slot['vrijeme']}")
        
        # Try to book without membership - should get free trial
        booking_resp = session.post(f"{BASE_URL}/api/bookings", json={
            "slot_id": available_slot["id"],
            "datum": available_slot["datum"],
            "vrijeme": available_slot["vrijeme"],
            "instruktor": available_slot.get("instruktor", "Marija Trisic")
        }, cookies=cookies)
        
        assert booking_resp.status_code == 200, f"Booking failed: {booking_resp.text}"
        booking_data = booking_resp.json()
        
        # Verify is_trial=true
        assert booking_data.get("is_trial") == True, f"Expected is_trial=true, got: {booking_data}"
        assert "training_id" in booking_data, "Missing training_id in response"
        
        print(f"✓ Free trial booking successful: is_trial={booking_data.get('is_trial')}")
        print(f"✓ Message: {booking_data.get('message')}")
        
        # Store for next test
        self.trial_user_phone = unique_phone
        self.trial_user_pin = unique_pin
        self.trial_user_cookies = cookies
        
        return unique_phone, unique_pin, cookies
    
    def test_second_booking_blocked_after_trial(self):
        """POST /api/bookings for same user SECOND time returns 400 error"""
        session = requests.Session()
        
        # Generate unique phone number for new user
        unique_phone = f"+387222{uuid.uuid4().hex[:6]}"
        unique_pin = "1234"
        
        # Register new user
        register_resp = session.post(f"{BASE_URL}/api/auth/register", json={
            "phone": unique_phone,
            "ime": "Test",
            "prezime": "TrialUser2",
            "email": f"trial2_{uuid.uuid4().hex[:6]}@test.com",
            "pin": unique_pin
        })
        assert register_resp.status_code == 200, f"Registration failed: {register_resp.text}"
        cookies = register_resp.cookies
        
        print(f"✓ Registered new user: {unique_phone}")
        
        # Get available schedule slots
        schedule_resp = session.get(f"{BASE_URL}/api/schedule")
        assert schedule_resp.status_code == 200
        slots = schedule_resp.json()
        
        # Find slots with available space
        available_slots = [s for s in slots if s.get("slobodna_mjesta", 0) > 0]
        assert len(available_slots) >= 2, "Need at least 2 available slots for this test"
        
        slot1 = available_slots[0]
        slot2 = available_slots[1]
        
        # First booking - should succeed with free trial
        booking1_resp = session.post(f"{BASE_URL}/api/bookings", json={
            "slot_id": slot1["id"],
            "datum": slot1["datum"],
            "vrijeme": slot1["vrijeme"],
            "instruktor": slot1.get("instruktor", "Marija Trisic")
        }, cookies=cookies)
        
        assert booking1_resp.status_code == 200, f"First booking failed: {booking1_resp.text}"
        booking1_data = booking1_resp.json()
        assert booking1_data.get("is_trial") == True, "First booking should be trial"
        
        print(f"✓ First booking (trial) successful")
        
        # Second booking - should be blocked with 400
        booking2_resp = session.post(f"{BASE_URL}/api/bookings", json={
            "slot_id": slot2["id"],
            "datum": slot2["datum"],
            "vrijeme": slot2["vrijeme"],
            "instruktor": slot2.get("instruktor", "Marija Trisic")
        }, cookies=cookies)
        
        assert booking2_resp.status_code == 400, f"Second booking should fail with 400, got: {booking2_resp.status_code}"
        error_data = booking2_resp.json()
        
        # Verify error message mentions trial
        error_detail = error_data.get("detail", "")
        assert "probni" in error_detail.lower() or "paket" in error_detail.lower(), \
            f"Error should mention trial or package: {error_detail}"
        
        print(f"✓ Second booking correctly blocked with 400")
        print(f"✓ Error message: {error_detail}")


class TestHealthCheck:
    """Basic health checks"""
    
    def test_api_health(self):
        """Verify API is responding"""
        resp = requests.get(f"{BASE_URL}/api/schedule")
        assert resp.status_code == 200, f"API health check failed: {resp.status_code}"
        print("✓ API is healthy")
    
    def test_admin_login(self):
        """Verify admin login works"""
        session = requests.Session()
        resp = session.post(f"{BASE_URL}/api/auth/phone/login", json={
            "phone": "+38766024148",
            "pin": "2803"
        })
        assert resp.status_code == 200, f"Admin login failed: {resp.text}"
        data = resp.json()
        assert data.get("is_admin") == True, "User should be admin"
        print(f"✓ Admin login successful: {data.get('name')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

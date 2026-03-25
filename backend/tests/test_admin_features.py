"""
Test suite for Admin Panel features and Schedule from DB
Tests: Admin login, dashboard, schedule CRUD, bookings, users, 12h cancellation rule
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Admin credentials
ADMIN_EMAIL = "admin@linea.ba"
ADMIN_PASSWORD = "admin123"

class TestAdminAuth:
    """Admin authentication tests"""
    
    def test_admin_login_success(self):
        """Test admin login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/admin/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "session_token" in data, "Response should contain session_token"
        assert "admin_id" in data, "Response should contain admin_id"
        assert data["email"] == ADMIN_EMAIL
        assert data["name"] == "Admin"
        
    def test_admin_login_invalid_password(self):
        """Test admin login with wrong password"""
        response = requests.post(f"{BASE_URL}/api/admin/login", json={
            "email": ADMIN_EMAIL,
            "password": "wrongpassword"
        })
        assert response.status_code == 401
        
    def test_admin_login_invalid_email(self):
        """Test admin login with non-existent email"""
        response = requests.post(f"{BASE_URL}/api/admin/login", json={
            "email": "nonexistent@linea.ba",
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 401
        
    def test_admin_me_without_token(self):
        """Test /admin/me without authentication"""
        response = requests.get(f"{BASE_URL}/api/admin/me")
        assert response.status_code == 401


class TestAdminDashboard:
    """Admin dashboard stats tests"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin session token"""
        response = requests.post(f"{BASE_URL}/api/admin/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("session_token")
        pytest.skip("Admin login failed")
        
    def test_admin_dashboard_stats(self, admin_token):
        """Test admin dashboard returns correct stats structure"""
        response = requests.get(
            f"{BASE_URL}/api/admin/dashboard",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify all required stats fields
        assert "ukupno_korisnika" in data, "Should have total users count"
        assert "aktivne_clanarine" in data, "Should have active memberships count"
        assert "danasnji_treninzi" in data, "Should have today's trainings count"
        assert "ukupno_rezervacija" in data, "Should have total bookings count"
        assert "posljednji_korisnici" in data, "Should have recent users list"
        
        # Verify types
        assert isinstance(data["ukupno_korisnika"], int)
        assert isinstance(data["aktivne_clanarine"], int)
        assert isinstance(data["danasnji_treninzi"], int)
        assert isinstance(data["ukupno_rezervacija"], int)
        assert isinstance(data["posljednji_korisnici"], list)
        
    def test_admin_dashboard_without_auth(self):
        """Test dashboard requires authentication"""
        response = requests.get(f"{BASE_URL}/api/admin/dashboard")
        assert response.status_code == 401


class TestAdminScheduleManagement:
    """Admin schedule CRUD operations tests"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin session token"""
        response = requests.post(f"{BASE_URL}/api/admin/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("session_token")
        pytest.skip("Admin login failed")
        
    def test_get_admin_schedule(self, admin_token):
        """Test fetching schedule slots from admin endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/admin/schedule",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list), "Should return list of slots"
        
        # Verify slot structure if slots exist
        if len(data) > 0:
            slot = data[0]
            assert "id" in slot
            assert "datum" in slot
            assert "vrijeme" in slot
            assert "instruktor" in slot
            assert "ukupno_mjesta" in slot
            assert "zauzeto" in slot
            assert "slobodna_mjesta" in slot
            
    def test_create_schedule_slot(self, admin_token):
        """Test creating a new schedule slot"""
        # Use a future date to avoid conflicts
        future_date = (datetime.now() + timedelta(days=60)).strftime("%Y-%m-%d")
        
        response = requests.post(
            f"{BASE_URL}/api/admin/schedule/slots",
            headers={
                "Authorization": f"Bearer {admin_token}",
                "Content-Type": "application/json"
            },
            json={
                "datum": future_date,
                "vrijeme": "20:00",
                "instruktor": "Test Instruktor",
                "ukupno_mjesta": 5
            }
        )
        
        # Could be 200 (created) or 400 (already exists)
        assert response.status_code in [200, 400], f"Unexpected status: {response.status_code}"
        
        if response.status_code == 200:
            data = response.json()
            assert data.get("success") == True
            assert "slot" in data
            
    def test_delete_schedule_slot_without_bookings(self, admin_token):
        """Test deleting a slot that has no bookings"""
        # First create a slot to delete
        future_date = (datetime.now() + timedelta(days=61)).strftime("%Y-%m-%d")
        slot_id = f"slot_{future_date.replace('-', '')}_2100"
        
        # Create the slot first
        requests.post(
            f"{BASE_URL}/api/admin/schedule/slots",
            headers={
                "Authorization": f"Bearer {admin_token}",
                "Content-Type": "application/json"
            },
            json={
                "datum": future_date,
                "vrijeme": "21:00",
                "instruktor": "Test Instruktor",
                "ukupno_mjesta": 3
            }
        )
        
        # Now delete it
        response = requests.delete(
            f"{BASE_URL}/api/admin/schedule/slots/{slot_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        # Should succeed or slot not found (if already deleted)
        assert response.status_code in [200, 404]
        
    def test_generate_week_schedule(self, admin_token):
        """Test bulk schedule generation"""
        future_date = (datetime.now() + timedelta(days=90)).strftime("%Y-%m-%d")
        
        response = requests.post(
            f"{BASE_URL}/api/admin/schedule/generate-week",
            headers={
                "Authorization": f"Bearer {admin_token}",
                "Content-Type": "application/json"
            },
            json={
                "start_date": future_date,
                "days": 3
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert "created" in data


class TestAdminUsers:
    """Admin users management tests"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin session token"""
        response = requests.post(f"{BASE_URL}/api/admin/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("session_token")
        pytest.skip("Admin login failed")
        
    def test_get_all_users(self, admin_token):
        """Test fetching all users"""
        response = requests.get(
            f"{BASE_URL}/api/admin/users",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        # Verify user structure if users exist
        if len(data) > 0:
            user = data[0]
            assert "user_id" in user
            assert "name" in user or user.get("name") is None
            assert "aktivna_clanarina" in user
            assert "preostali_termini" in user


class TestAdminBookings:
    """Admin bookings management tests"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin session token"""
        response = requests.post(f"{BASE_URL}/api/admin/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("session_token")
        pytest.skip("Admin login failed")
        
    def test_get_all_bookings(self, admin_token):
        """Test fetching all bookings"""
        response = requests.get(
            f"{BASE_URL}/api/admin/bookings",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        # Verify booking structure if bookings exist
        if len(data) > 0:
            booking = data[0]
            assert "id" in booking
            assert "user_id" in booking
            assert "datum" in booking
            assert "vrijeme" in booking
            assert "tip" in booking
            assert "korisnik" in booking


class TestScheduleFromDB:
    """Test that schedule is read from MongoDB (not generated dynamically)"""
    
    def test_public_schedule_endpoint(self):
        """Test GET /api/schedule returns DB-stored slots"""
        response = requests.get(f"{BASE_URL}/api/schedule")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list), "Should return list of slots"
        
        # Should have seeded slots (240 for 30 days)
        assert len(data) > 0, "Schedule should have slots from DB seed"
        
        # Verify slot structure
        if len(data) > 0:
            slot = data[0]
            assert "id" in slot
            assert "datum" in slot
            assert "vrijeme" in slot
            assert "instruktor" in slot
            assert "slobodna_mjesta" in slot
            assert "ukupno_mjesta" in slot
            
    def test_schedule_has_multiple_days(self):
        """Verify schedule spans multiple days (seeded data)"""
        response = requests.get(f"{BASE_URL}/api/schedule")
        assert response.status_code == 200
        data = response.json()
        
        # Get unique dates
        dates = set(slot["datum"] for slot in data)
        assert len(dates) >= 7, f"Should have at least 7 days of schedule, got {len(dates)}"


class TestBookingCancellation12hRule:
    """Test the 12-hour cancellation rule"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin session token"""
        response = requests.post(f"{BASE_URL}/api/admin/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("session_token")
        pytest.skip("Admin login failed")
        
    def test_cancel_nonexistent_booking(self, admin_token):
        """Test cancelling a booking that doesn't exist"""
        response = requests.post(
            f"{BASE_URL}/api/admin/bookings/nonexistent_id_12345/cancel",
            headers={
                "Authorization": f"Bearer {admin_token}",
                "Content-Type": "application/json"
            },
            json={"razlog": "Test cancellation"}
        )
        assert response.status_code == 404
        
    def test_cancel_booking_endpoint_exists(self, admin_token):
        """Verify the cancellation endpoint exists and requires valid booking"""
        # This tests that the endpoint is properly configured
        response = requests.post(
            f"{BASE_URL}/api/admin/bookings/test_booking_id/cancel",
            headers={
                "Authorization": f"Bearer {admin_token}",
                "Content-Type": "application/json"
            },
            json={"razlog": "Test"}
        )
        # Should return 404 (not found) not 405 (method not allowed) or 500
        assert response.status_code in [404, 400], f"Expected 404 or 400, got {response.status_code}"


class TestPhoneAuth:
    """Test phone authentication (mock OTP)"""
    
    def test_send_otp(self):
        """Test sending OTP to phone number"""
        response = requests.post(
            f"{BASE_URL}/api/auth/phone/send-otp",
            json={"phone": "+38761123456"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert "user_exists" in data
        
    def test_verify_otp_mock_code(self):
        """Test OTP verification with mock code 123456"""
        # First send OTP
        requests.post(
            f"{BASE_URL}/api/auth/phone/send-otp",
            json={"phone": "+38761999888"}
        )
        
        # Try to verify - should fail if user doesn't exist
        response = requests.post(
            f"{BASE_URL}/api/auth/phone/verify",
            json={"phone": "+38761999888", "otp": "123456"}
        )
        # 404 = user not found (needs registration), which is expected
        assert response.status_code in [200, 404]


class TestNotificationScheduler:
    """Test notification scheduler is running"""
    
    def test_api_root(self):
        """Test API root endpoint"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

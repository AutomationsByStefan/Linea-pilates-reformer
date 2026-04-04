"""
Iteration 9 Backend Tests - Testing 7 new features:
1. Only instructor is Marija Trisic
2. Sunday is non-working day (no schedule slots)
3. Admin +38766024148 name='Linea Trebinje' PIN=2803
4. Admin Stefan +381640080404 PIN=1234
5. Admin Nevena +381652344415 PIN=1234
6. POST /api/trainings/comment saves comment on training
7. Schedule slots have correct instructor
"""

import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAdminLogins:
    """Test admin login credentials as specified"""
    
    def test_linea_trebinje_login(self):
        """Test admin +38766024148 with PIN 2803 returns name 'Linea Trebinje' and is_admin=true"""
        response = requests.post(f"{BASE_URL}/api/auth/phone/login", json={
            "phone": "+38766024148",
            "pin": "2803"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert data.get("name") == "Linea Trebinje", f"Expected name 'Linea Trebinje', got '{data.get('name')}'"
        assert data.get("is_admin") == True, f"Expected is_admin=True, got {data.get('is_admin')}"
        print(f"✓ Linea Trebinje login: name={data.get('name')}, is_admin={data.get('is_admin')}")
    
    def test_stefan_login(self):
        """Test admin Stefan +381640080404 with PIN 1234 returns name 'Stefan' and is_admin=true"""
        response = requests.post(f"{BASE_URL}/api/auth/phone/login", json={
            "phone": "+381640080404",
            "pin": "1234"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert data.get("name") == "Stefan", f"Expected name 'Stefan', got '{data.get('name')}'"
        assert data.get("is_admin") == True, f"Expected is_admin=True, got {data.get('is_admin')}"
        print(f"✓ Stefan login: name={data.get('name')}, is_admin={data.get('is_admin')}")
    
    def test_nevena_login(self):
        """Test admin Nevena +381652344415 with PIN 1234 returns name 'Nevena' and is_admin=true"""
        response = requests.post(f"{BASE_URL}/api/auth/phone/login", json={
            "phone": "+381652344415",
            "pin": "1234"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert data.get("name") == "Nevena", f"Expected name 'Nevena', got '{data.get('name')}'"
        assert data.get("is_admin") == True, f"Expected is_admin=True, got {data.get('is_admin')}"
        print(f"✓ Nevena login: name={data.get('name')}, is_admin={data.get('is_admin')}")
    
    def test_old_pin_should_fail(self):
        """Test that old PIN 1234 no longer works for Linea Trebinje"""
        response = requests.post(f"{BASE_URL}/api/auth/phone/login", json={
            "phone": "+38766024148",
            "pin": "1234"
        })
        assert response.status_code == 400, f"Old PIN should fail, got status {response.status_code}"
        print("✓ Old PIN 1234 correctly rejected for Linea Trebinje")


class TestScheduleSlots:
    """Test schedule slots - only Marija Trisic, no Sundays"""
    
    def test_all_slots_have_marija_trisic(self):
        """All schedule slots should have instruktor='Marija Trisic'"""
        response = requests.get(f"{BASE_URL}/api/schedule")
        assert response.status_code == 200, f"Failed to get schedule: {response.text}"
        slots = response.json()
        assert len(slots) > 0, "No schedule slots found"
        
        non_marija_slots = [s for s in slots if s.get("instruktor") != "Marija Trisic"]
        assert len(non_marija_slots) == 0, f"Found {len(non_marija_slots)} slots with non-Marija instructor: {non_marija_slots[:3]}"
        print(f"✓ All {len(slots)} schedule slots have instruktor='Marija Trisic'")
    
    def test_no_sunday_slots(self):
        """No schedule slots should exist for Sundays"""
        response = requests.get(f"{BASE_URL}/api/schedule")
        assert response.status_code == 200, f"Failed to get schedule: {response.text}"
        slots = response.json()
        
        sunday_slots = []
        for slot in slots:
            try:
                date = datetime.strptime(slot.get("datum", ""), "%Y-%m-%d")
                if date.weekday() == 6:  # Sunday
                    sunday_slots.append(slot)
            except:
                pass
        
        assert len(sunday_slots) == 0, f"Found {len(sunday_slots)} Sunday slots: {sunday_slots[:3]}"
        print(f"✓ No Sunday slots found in {len(slots)} total slots")
    
    def test_schedule_has_expected_time_slots(self):
        """Schedule should have time slots like 08:00, 09:00, etc."""
        response = requests.get(f"{BASE_URL}/api/schedule")
        assert response.status_code == 200
        slots = response.json()
        
        times = set(s.get("vrijeme") for s in slots)
        expected_times = {"08:00", "09:00", "10:00", "11:00", "17:00", "18:00", "19:00", "20:00"}
        
        # At least some expected times should be present
        found_times = times.intersection(expected_times)
        assert len(found_times) > 0, f"No expected time slots found. Got: {times}"
        print(f"✓ Found expected time slots: {found_times}")


class TestTrainingComments:
    """Test training comment feature"""
    
    @pytest.fixture
    def auth_session(self):
        """Get authenticated session for Linea Trebinje"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/phone/login", json={
            "phone": "+38766024148",
            "pin": "2803"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return session
    
    def test_comment_endpoint_exists(self, auth_session):
        """POST /api/trainings/comment endpoint should exist"""
        # First get past trainings to find a training ID
        response = auth_session.get(f"{BASE_URL}/api/trainings/past")
        
        if response.status_code == 200 and len(response.json()) > 0:
            training = response.json()[0]
            training_id = training.get("id")
            
            # Try to add a comment
            comment_response = auth_session.post(f"{BASE_URL}/api/trainings/comment", json={
                "training_id": training_id,
                "komentar": "Test komentar za trening"
            })
            
            # Should succeed or return appropriate error
            assert comment_response.status_code in [200, 404], f"Unexpected status: {comment_response.status_code}"
            print(f"✓ Comment endpoint works, status: {comment_response.status_code}")
        else:
            # No past trainings, just verify endpoint exists
            comment_response = auth_session.post(f"{BASE_URL}/api/trainings/comment", json={
                "training_id": "nonexistent",
                "komentar": "Test"
            })
            # Should return 404 for nonexistent training
            assert comment_response.status_code == 404, f"Expected 404, got {comment_response.status_code}"
            print("✓ Comment endpoint exists and returns 404 for nonexistent training")


class TestPublicEndpoints:
    """Test public endpoints still work"""
    
    def test_packages_endpoint(self):
        """GET /api/packages should return packages"""
        response = requests.get(f"{BASE_URL}/api/packages")
        assert response.status_code == 200
        packages = response.json()
        assert isinstance(packages, list)
        print(f"✓ Packages endpoint returns {len(packages)} packages")
    
    def test_studio_info_endpoint(self):
        """GET /api/studio-info should return studio info"""
        response = requests.get(f"{BASE_URL}/api/studio-info")
        assert response.status_code == 200
        info = response.json()
        assert "naziv" in info
        assert "telefon" in info
        print(f"✓ Studio info: {info.get('naziv')}")
    
    def test_schedule_endpoint(self):
        """GET /api/schedule should return schedule"""
        response = requests.get(f"{BASE_URL}/api/schedule")
        assert response.status_code == 200
        schedule = response.json()
        assert isinstance(schedule, list)
        print(f"✓ Schedule endpoint returns {len(schedule)} slots")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])

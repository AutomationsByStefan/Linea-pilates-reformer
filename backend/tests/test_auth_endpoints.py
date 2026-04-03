"""
Test auth endpoints for Linea Pilates app
Tests phone check, phone login, and session endpoints
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestPhoneAuth:
    """Phone authentication endpoint tests"""
    
    def test_phone_check_existing_user(self):
        """Test phone check for existing admin user"""
        response = requests.post(
            f"{BASE_URL}/api/auth/phone/check",
            json={"phone": "+38766024148"},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "exists" in data
        assert data["exists"] == True
        assert "name" in data
        print(f"Phone check response: {data}")
    
    def test_phone_check_non_existing_user(self):
        """Test phone check for non-existing user"""
        response = requests.post(
            f"{BASE_URL}/api/auth/phone/check",
            json={"phone": "+38799999999"},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "exists" in data
        assert data["exists"] == False
        print(f"Non-existing phone check response: {data}")
    
    def test_phone_login_success(self):
        """Test phone login with correct PIN"""
        response = requests.post(
            f"{BASE_URL}/api/auth/phone/login",
            json={"phone": "+38766024148", "pin": "1234"},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "user_id" in data
        assert "name" in data
        print(f"Login success response: {data}")
    
    def test_phone_login_wrong_pin(self):
        """Test phone login with wrong PIN"""
        response = requests.post(
            f"{BASE_URL}/api/auth/phone/login",
            json={"phone": "+38766024148", "pin": "9999"},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
        print(f"Wrong PIN response: {data}")
    
    def test_phone_login_non_existing_user(self):
        """Test phone login for non-existing user"""
        response = requests.post(
            f"{BASE_URL}/api/auth/phone/login",
            json={"phone": "+38799999999", "pin": "1234"},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 404
        data = response.json()
        assert "detail" in data
        print(f"Non-existing user login response: {data}")


class TestPublicEndpoints:
    """Test public endpoints that don't require auth"""
    
    def test_packages_endpoint(self):
        """Test packages endpoint returns data"""
        response = requests.get(f"{BASE_URL}/api/packages")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Packages count: {len(data)}")
    
    def test_schedule_endpoint(self):
        """Test schedule endpoint returns data"""
        response = requests.get(f"{BASE_URL}/api/schedule")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Schedule slots count: {len(data)}")
    
    def test_studio_info_endpoint(self):
        """Test studio info endpoint returns data"""
        response = requests.get(f"{BASE_URL}/api/studio-info")
        assert response.status_code == 200
        data = response.json()
        assert "naziv" in data
        assert "telefon" in data
        print(f"Studio info: {data.get('naziv')}")


class TestAuthMe:
    """Test auth/me endpoint"""
    
    def test_auth_me_without_session(self):
        """Test auth/me without session returns 401"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 401
        print("Auth/me without session correctly returns 401")
    
    def test_auth_me_with_invalid_session(self):
        """Test auth/me with invalid session returns 401"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": "Bearer invalid_token_12345"}
        )
        assert response.status_code == 401
        print("Auth/me with invalid session correctly returns 401")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

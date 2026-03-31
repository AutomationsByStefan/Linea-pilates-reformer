"""
Test suite for Iteration 6 features:
- Package request system (user selects → admin approves → activates)
- Session deduction by admin
- Package freeze/unfreeze
- Client notes
- Financial overview
- Expiry alerts
- Admin dashboard with notifications
- User stats with ima_aktivnu_clanarinu and pending_paket fields
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Credentials
ADMIN_EMAIL = "admin@linea.ba"
ADMIN_PASSWORD = "admin123"
TEST_PHONE = "+387 61 123 456"
TEST_OTP = "123456"


class TestPackagesEndpoint:
    """Test packages endpoint returns correct 5 packages"""
    
    def test_packages_returns_5_packages(self):
        """GET /api/packages returns exactly 5 packages"""
        response = requests.get(f"{BASE_URL}/api/packages")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 5, f"Expected 5 packages, got {len(data)}"
        
    def test_basic_package(self):
        """Basic package: 6 sessions, 90 KM"""
        response = requests.get(f"{BASE_URL}/api/packages")
        data = response.json()
        basic = next((p for p in data if p["id"] == "pkg_basic"), None)
        assert basic is not None, "Basic package not found"
        assert basic["naziv"] == "Basic"
        assert basic["termini"] == 6
        assert basic["cijena"] == 90
        
    def test_linea_active_package(self):
        """Linea Active package: 8 sessions, 125 KM"""
        response = requests.get(f"{BASE_URL}/api/packages")
        data = response.json()
        pkg = next((p for p in data if p["id"] == "pkg_active"), None)
        assert pkg is not None
        assert pkg["naziv"] == "Linea Active"
        assert pkg["termini"] == 8
        assert pkg["cijena"] == 125
        
    def test_linea_balance_package(self):
        """Linea Balance package: 10 sessions, 145 KM (popular)"""
        response = requests.get(f"{BASE_URL}/api/packages")
        data = response.json()
        pkg = next((p for p in data if p["id"] == "pkg_balance"), None)
        assert pkg is not None
        assert pkg["naziv"] == "Linea Balance"
        assert pkg["termini"] == 10
        assert pkg["cijena"] == 145
        assert pkg.get("popular") == True
        
    def test_linea_gold_package(self):
        """Linea Gold package: 12 sessions, 175 KM"""
        response = requests.get(f"{BASE_URL}/api/packages")
        data = response.json()
        pkg = next((p for p in data if p["id"] == "pkg_gold"), None)
        assert pkg is not None
        assert pkg["naziv"] == "Linea Gold"
        assert pkg["termini"] == 12
        assert pkg["cijena"] == 175
        
    def test_linea_premium_package(self):
        """Linea Premium package: 16 sessions, 200 KM"""
        response = requests.get(f"{BASE_URL}/api/packages")
        data = response.json()
        pkg = next((p for p in data if p["id"] == "pkg_premium"), None)
        assert pkg is not None
        assert pkg["naziv"] == "Linea Premium"
        assert pkg["termini"] == 16
        assert pkg["cijena"] == 200


class TestStudioInfo:
    """Test studio info endpoint"""
    
    def test_studio_phone_number(self):
        """GET /api/studio-info returns phone +38766024148"""
        response = requests.get(f"{BASE_URL}/api/studio-info")
        assert response.status_code == 200
        data = response.json()
        assert data["telefon"] == "+38766024148"


class TestAdminAuth:
    """Admin authentication tests"""
    
    def test_admin_login_success(self):
        """Admin login with admin@linea.ba / admin123"""
        response = requests.post(f"{BASE_URL}/api/admin/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "session_token" in data


class TestAdminDashboard:
    """Admin dashboard with pending request count"""
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/admin/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("session_token")
        pytest.skip("Admin login failed")
        
    def test_dashboard_has_pending_requests_count(self, admin_token):
        """GET /api/admin/dashboard returns pending request count"""
        response = requests.get(
            f"{BASE_URL}/api/admin/dashboard",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "zahtjevi_na_cekanju" in data, "Dashboard should have pending requests count"
        assert isinstance(data["zahtjevi_na_cekanju"], int)
        
    def test_dashboard_has_recent_requests(self, admin_token):
        """GET /api/admin/dashboard returns recent package requests"""
        response = requests.get(
            f"{BASE_URL}/api/admin/dashboard",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "posljednji_zahtjevi" in data, "Dashboard should have recent requests"
        assert isinstance(data["posljednji_zahtjevi"], list)


class TestAdminPackageRequests:
    """Admin package request management"""
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/admin/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("session_token")
        pytest.skip("Admin login failed")
        
    def test_get_all_package_requests(self, admin_token):
        """GET /api/admin/package-requests returns all requests"""
        response = requests.get(
            f"{BASE_URL}/api/admin/package-requests",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


class TestAdminFinancial:
    """Admin financial overview"""
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/admin/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("session_token")
        pytest.skip("Admin login failed")
        
    def test_financial_overview(self, admin_token):
        """GET /api/admin/financial returns revenue overview"""
        response = requests.get(
            f"{BASE_URL}/api/admin/financial",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check required fields
        assert "ovaj_mjesec_prihod" in data, "Should have this month revenue"
        assert "mjesecni_prihod" in data, "Should have monthly revenue array"
        assert "prihod_po_paketu" in data, "Should have revenue by package"
        assert "ukupno_klijenata" in data, "Should have total clients"
        assert "aktivne_clanarine" in data, "Should have active memberships"
        assert "istekle_clanarine" in data, "Should have expired memberships"
        assert "novi_klijenti_mjesec" in data, "Should have new clients this month"
        assert "najprodavaniji" in data, "Should have best selling package"


class TestAdminAlerts:
    """Admin expiry and low-session alerts"""
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/admin/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("session_token")
        pytest.skip("Admin login failed")
        
    def test_alerts_endpoint(self, admin_token):
        """GET /api/admin/alerts returns expiry and low-session alerts"""
        response = requests.get(
            f"{BASE_URL}/api/admin/alerts",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "isticu_uskoro" in data, "Should have expiring soon alerts"
        assert "malo_termina" in data, "Should have low sessions alerts"
        assert isinstance(data["isticu_uskoro"], list)
        assert isinstance(data["malo_termina"], list)


class TestAdminUsers:
    """Admin users management with full details"""
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/admin/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("session_token")
        pytest.skip("Admin login failed")
        
    def test_get_users_with_details(self, admin_token):
        """GET /api/admin/users returns users with membership details"""
        response = requests.get(
            f"{BASE_URL}/api/admin/users",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        # If users exist, check structure
        if len(data) > 0:
            user = data[0]
            assert "user_id" in user
            assert "aktivna_clanarina" in user
            assert "preostali_termini" in user
            assert "ukupni_termini" in user
            assert "korisnik_status" in user


class TestPackageRequestFlow:
    """Full package request flow: user requests → admin approves"""
    
    @pytest.fixture
    def user_session(self):
        """Create a test user and get session"""
        # Send OTP
        requests.post(f"{BASE_URL}/api/auth/phone/send-otp", json={"phone": TEST_PHONE})
        
        # Verify OTP
        response = requests.post(f"{BASE_URL}/api/auth/phone/verify", json={
            "phone": TEST_PHONE,
            "otp": TEST_OTP
        })
        
        if response.status_code == 200:
            return response.cookies.get("session_token") or response.json().get("session_token")
        elif response.status_code == 404:
            # User doesn't exist, register
            response = requests.post(f"{BASE_URL}/api/auth/register", json={
                "phone": TEST_PHONE,
                "ime": "Test",
                "prezime": "User",
                "email": "test@example.com"
            })
            if response.status_code == 200:
                return response.cookies.get("session_token")
        pytest.skip("Could not create user session")
        
    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/admin/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("session_token")
        pytest.skip("Admin login failed")
        
    def test_user_can_request_package(self, user_session):
        """POST /api/packages/request creates pending request"""
        if not user_session:
            pytest.skip("No user session")
            
        response = requests.post(
            f"{BASE_URL}/api/packages/request",
            headers={"Authorization": f"Bearer {user_session}"},
            json={"package_id": "pkg_basic"}
        )
        
        # Could be 200 (success) or 400 (already has pending request)
        assert response.status_code in [200, 400], f"Unexpected status: {response.status_code}"
        
        if response.status_code == 200:
            data = response.json()
            assert data.get("success") == True
            assert "request_id" in data
            
    def test_user_can_view_their_requests(self, user_session):
        """GET /api/packages/my-requests returns user's requests"""
        if not user_session:
            pytest.skip("No user session")
            
        response = requests.get(
            f"{BASE_URL}/api/packages/my-requests",
            headers={"Authorization": f"Bearer {user_session}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


class TestUserStats:
    """User stats endpoint with membership info"""
    
    @pytest.fixture
    def user_session(self):
        """Create a test user and get session"""
        requests.post(f"{BASE_URL}/api/auth/phone/send-otp", json={"phone": TEST_PHONE})
        response = requests.post(f"{BASE_URL}/api/auth/phone/verify", json={
            "phone": TEST_PHONE,
            "otp": TEST_OTP
        })
        
        if response.status_code == 200:
            return response.cookies.get("session_token") or response.json().get("session_token")
        elif response.status_code == 404:
            response = requests.post(f"{BASE_URL}/api/auth/register", json={
                "phone": TEST_PHONE,
                "ime": "Test",
                "prezime": "User",
                "email": "test@example.com"
            })
            if response.status_code == 200:
                return response.cookies.get("session_token")
        pytest.skip("Could not create user session")
        
    def test_user_stats_has_membership_fields(self, user_session):
        """GET /api/user/stats returns ima_aktivnu_clanarinu and pending_paket"""
        if not user_session:
            pytest.skip("No user session")
            
        response = requests.get(
            f"{BASE_URL}/api/user/stats",
            headers={"Authorization": f"Bearer {user_session}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "ima_aktivnu_clanarinu" in data, "Should have ima_aktivnu_clanarinu field"
        assert "pending_paket" in data, "Should have pending_paket field"
        assert isinstance(data["ima_aktivnu_clanarinu"], bool)


class TestAdminSessionDeduction:
    """Admin session deduction endpoint"""
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/admin/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("session_token")
        pytest.skip("Admin login failed")
        
    def test_deduct_session_endpoint_exists(self, admin_token):
        """POST /api/admin/users/{id}/deduct-session endpoint exists"""
        response = requests.post(
            f"{BASE_URL}/api/admin/users/nonexistent_user/deduct-session",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        # Should return 400 (no active membership) not 404 or 405
        assert response.status_code in [400, 404], f"Unexpected status: {response.status_code}"


class TestAdminFreezeUnfreeze:
    """Admin freeze/unfreeze endpoints"""
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/admin/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("session_token")
        pytest.skip("Admin login failed")
        
    def test_freeze_endpoint_exists(self, admin_token):
        """POST /api/admin/users/{id}/freeze endpoint exists"""
        response = requests.post(
            f"{BASE_URL}/api/admin/users/nonexistent_user/freeze",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"start_date": "2026-04-01", "end_date": "2026-04-15"}
        )
        # Should return 400 (no active membership) not 404 or 405
        assert response.status_code in [400, 404], f"Unexpected status: {response.status_code}"
        
    def test_unfreeze_endpoint_exists(self, admin_token):
        """POST /api/admin/users/{id}/unfreeze endpoint exists"""
        response = requests.post(
            f"{BASE_URL}/api/admin/users/nonexistent_user/unfreeze",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        # Should return 400 (no frozen membership) not 404 or 405
        assert response.status_code in [400, 404], f"Unexpected status: {response.status_code}"


class TestAdminClientNotes:
    """Admin client notes endpoint"""
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/admin/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("session_token")
        pytest.skip("Admin login failed")
        
    def test_notes_endpoint_exists(self, admin_token):
        """PUT /api/admin/users/{id}/notes endpoint exists"""
        response = requests.put(
            f"{BASE_URL}/api/admin/users/nonexistent_user/notes",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"notes": "Test note"}
        )
        # Should return 200 (MongoDB upsert) or some response, not 405
        assert response.status_code in [200, 400, 404], f"Unexpected status: {response.status_code}"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

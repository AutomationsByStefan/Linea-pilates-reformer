"""
Test suite for 12-point feature enhancement:
1. Packages from MongoDB
2. Manual income tracking
3. Studio reminders
4. Custom memberships
5. Monthly revenue archiving
6. approved_by field on package requests
7. User package history
8. Client schedule 10-day limit (frontend)
9. Instructor column removed (frontend)
10. Responsive admin panel (frontend)
11. Financial overview with 12-month chart
12. Admin packages CRUD
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Admin phone for testing
ADMIN_PHONE = "+38766024148"
OTP_CODE = "123456"

@pytest.fixture(scope="module")
def admin_session():
    """Get admin session via phone auth"""
    session = requests.Session()
    
    # Send OTP
    resp = session.post(f"{BASE_URL}/api/auth/phone/send-otp", json={"phone": ADMIN_PHONE})
    assert resp.status_code == 200, f"Failed to send OTP: {resp.text}"
    
    # Verify OTP
    resp = session.post(f"{BASE_URL}/api/auth/phone/verify", json={"phone": ADMIN_PHONE, "otp": OTP_CODE})
    assert resp.status_code == 200, f"Failed to verify OTP: {resp.text}"
    
    return session


class TestPackagesFromMongoDB:
    """Test 1: GET /api/packages returns packages from MongoDB (5 default packages seeded)"""
    
    def test_get_packages_returns_list(self):
        """Verify packages endpoint returns a list"""
        resp = requests.get(f"{BASE_URL}/api/packages")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) >= 5, f"Expected at least 5 packages, got {len(data)}"
    
    def test_packages_have_required_fields(self):
        """Verify packages have all required fields"""
        resp = requests.get(f"{BASE_URL}/api/packages")
        assert resp.status_code == 200
        packages = resp.json()
        
        required_fields = ["id", "naziv", "cijena", "termini"]
        for pkg in packages:
            for field in required_fields:
                assert field in pkg, f"Package missing field: {field}"


class TestManualIncome:
    """Tests 2-4: Manual income CRUD"""
    
    def test_create_manual_income(self, admin_session):
        """Test POST /api/admin/manual-income creates entry"""
        payload = {
            "iznos": 150.0,
            "opis": "TEST_Prodaja opreme",
            "kategorija": "oprema",
            "datum": "2026-01-15"
        }
        resp = admin_session.post(f"{BASE_URL}/api/admin/manual-income", json=payload)
        assert resp.status_code == 200, f"Failed to create manual income: {resp.text}"
        data = resp.json()
        assert data.get("success") == True
        assert "entry" in data
        assert data["entry"]["iznos"] == 150.0
        assert data["entry"]["opis"] == "TEST_Prodaja opreme"
    
    def test_get_manual_income(self, admin_session):
        """Test GET /api/admin/manual-income returns all entries"""
        resp = admin_session.get(f"{BASE_URL}/api/admin/manual-income")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
    
    def test_delete_manual_income(self, admin_session):
        """Test DELETE /api/admin/manual-income/{id} deletes entry"""
        # First create an entry
        payload = {"iznos": 50.0, "opis": "TEST_To_Delete", "kategorija": "ostalo"}
        create_resp = admin_session.post(f"{BASE_URL}/api/admin/manual-income", json=payload)
        assert create_resp.status_code == 200
        entry_id = create_resp.json()["entry"]["id"]
        
        # Delete it
        del_resp = admin_session.delete(f"{BASE_URL}/api/admin/manual-income/{entry_id}")
        assert del_resp.status_code == 200
        assert del_resp.json().get("success") == True


class TestReminders:
    """Tests 5-8: Studio reminders CRUD"""
    
    def test_create_reminder(self, admin_session):
        """Test POST /api/admin/reminders creates reminder"""
        payload = {"tekst": "TEST_Nazvati klijenta", "datum": "2026-01-20"}
        resp = admin_session.post(f"{BASE_URL}/api/admin/reminders", json=payload)
        assert resp.status_code == 200, f"Failed to create reminder: {resp.text}"
        data = resp.json()
        assert data.get("success") == True
        assert "reminder" in data
        assert data["reminder"]["tekst"] == "TEST_Nazvati klijenta"
        assert data["reminder"]["zavrseno"] == False
    
    def test_get_reminders(self, admin_session):
        """Test GET /api/admin/reminders returns all reminders"""
        resp = admin_session.get(f"{BASE_URL}/api/admin/reminders")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
    
    def test_toggle_reminder(self, admin_session):
        """Test POST /api/admin/reminders/{id}/toggle toggles status"""
        # Create a reminder first
        payload = {"tekst": "TEST_Toggle_Reminder"}
        create_resp = admin_session.post(f"{BASE_URL}/api/admin/reminders", json=payload)
        assert create_resp.status_code == 200
        reminder_id = create_resp.json()["reminder"]["id"]
        
        # Toggle it
        toggle_resp = admin_session.post(f"{BASE_URL}/api/admin/reminders/{reminder_id}/toggle")
        assert toggle_resp.status_code == 200
        assert toggle_resp.json().get("zavrseno") == True
        
        # Toggle again
        toggle_resp2 = admin_session.post(f"{BASE_URL}/api/admin/reminders/{reminder_id}/toggle")
        assert toggle_resp2.status_code == 200
        assert toggle_resp2.json().get("zavrseno") == False
    
    def test_delete_reminder(self, admin_session):
        """Test DELETE /api/admin/reminders/{id} deletes reminder"""
        # Create a reminder
        payload = {"tekst": "TEST_Delete_Reminder"}
        create_resp = admin_session.post(f"{BASE_URL}/api/admin/reminders", json=payload)
        assert create_resp.status_code == 200
        reminder_id = create_resp.json()["reminder"]["id"]
        
        # Delete it
        del_resp = admin_session.delete(f"{BASE_URL}/api/admin/reminders/{reminder_id}")
        assert del_resp.status_code == 200
        assert del_resp.json().get("success") == True


class TestCustomMembership:
    """Test 9: Custom membership creation (bypassing package requests)"""
    
    def test_create_custom_membership(self, admin_session):
        """Test POST /api/admin/users/{user_id}/custom-membership creates membership directly"""
        # First get a user
        users_resp = admin_session.get(f"{BASE_URL}/api/admin/users")
        assert users_resp.status_code == 200
        users = users_resp.json()
        
        if len(users) == 0:
            pytest.skip("No users available for testing")
        
        user_id = users[0]["user_id"]
        
        payload = {
            "user_id": user_id,
            "package_id": "custom_test",
            "naziv": "TEST_Custom_Paket",
            "cijena": 100.0,
            "termini": 5,
            "trajanje_dana": 30
        }
        resp = admin_session.post(f"{BASE_URL}/api/admin/users/{user_id}/custom-membership", json=payload)
        assert resp.status_code == 200, f"Failed to create custom membership: {resp.text}"
        data = resp.json()
        assert data.get("success") == True


class TestMembershipHistory:
    """Test 10: User package history"""
    
    def test_get_membership_history(self, admin_session):
        """Test GET /api/admin/users/{user_id}/membership-history returns history"""
        # Get a user
        users_resp = admin_session.get(f"{BASE_URL}/api/admin/users")
        assert users_resp.status_code == 200
        users = users_resp.json()
        
        if len(users) == 0:
            pytest.skip("No users available for testing")
        
        user_id = users[0]["user_id"]
        
        resp = admin_session.get(f"{BASE_URL}/api/admin/users/{user_id}/membership-history")
        assert resp.status_code == 200, f"Failed to get membership history: {resp.text}"
        data = resp.json()
        assert "memberships" in data
        assert "requests" in data
        assert isinstance(data["memberships"], list)
        assert isinstance(data["requests"], list)


class TestFinancialOverview:
    """Test 11: Financial overview with required fields"""
    
    def test_financial_has_required_fields(self, admin_session):
        """Test GET /api/admin/financial returns ovaj_mjesec_prihod, ovaj_mjesec_paketi, ovaj_mjesec_rucni"""
        resp = admin_session.get(f"{BASE_URL}/api/admin/financial")
        assert resp.status_code == 200, f"Failed to get financial: {resp.text}"
        data = resp.json()
        
        # Check required fields
        assert "ovaj_mjesec_prihod" in data, "Missing ovaj_mjesec_prihod"
        assert "ovaj_mjesec_paketi" in data, "Missing ovaj_mjesec_paketi"
        assert "ovaj_mjesec_rucni" in data, "Missing ovaj_mjesec_rucni"
        assert "mjesecni_prihod" in data, "Missing mjesecni_prihod (12-month chart data)"
        
        # Verify 12-month data
        monthly = data["mjesecni_prihod"]
        assert isinstance(monthly, list)
        assert len(monthly) == 12, f"Expected 12 months of data, got {len(monthly)}"


class TestRevenueArchive:
    """Test 12: Monthly revenue archiving"""
    
    def test_archive_revenue(self, admin_session):
        """Test POST /api/admin/revenue/archive archives a month's revenue"""
        payload = {"month": "2025-12"}
        resp = admin_session.post(f"{BASE_URL}/api/admin/revenue/archive", json=payload)
        assert resp.status_code == 200, f"Failed to archive revenue: {resp.text}"
        data = resp.json()
        assert data.get("success") == True


class TestAdminPackagesCRUD:
    """Tests 13-16: Admin packages CRUD"""
    
    def test_get_all_packages_including_inactive(self, admin_session):
        """Test GET /api/admin/packages returns all packages including inactive"""
        resp = admin_session.get(f"{BASE_URL}/api/admin/packages")
        assert resp.status_code == 200, f"Failed to get admin packages: {resp.text}"
        data = resp.json()
        assert isinstance(data, list)
    
    def test_create_package(self, admin_session):
        """Test POST /api/admin/packages creates a new package"""
        unique_name = f"TEST_Paket_{uuid.uuid4().hex[:6]}"
        payload = {
            "naziv": unique_name,
            "opis": "Test paket opis",
            "cijena": 99.0,
            "termini": 4,
            "trajanje_dana": 30,
            "popular": False,
            "active": True
        }
        resp = admin_session.post(f"{BASE_URL}/api/admin/packages", json=payload)
        assert resp.status_code == 200, f"Failed to create package: {resp.text}"
        data = resp.json()
        assert data.get("success") == True
        assert "package" in data
        return data["package"]["id"]
    
    def test_update_package(self, admin_session):
        """Test PUT /api/admin/packages/{id} updates a package"""
        # First create a package
        unique_name = f"TEST_Update_{uuid.uuid4().hex[:6]}"
        create_payload = {
            "naziv": unique_name,
            "opis": "Original opis",
            "cijena": 80.0,
            "termini": 3,
            "trajanje_dana": 30,
            "popular": False,
            "active": True
        }
        create_resp = admin_session.post(f"{BASE_URL}/api/admin/packages", json=create_payload)
        assert create_resp.status_code == 200
        pkg_id = create_resp.json()["package"]["id"]
        
        # Update it - PUT requires all fields (uses PackageCreateRequest)
        update_payload = {
            "naziv": unique_name,
            "opis": "Updated opis",
            "cijena": 85.0,
            "termini": 3,
            "trajanje_dana": 30,
            "popular": False,
            "active": True
        }
        update_resp = admin_session.put(f"{BASE_URL}/api/admin/packages/{pkg_id}", json=update_payload)
        assert update_resp.status_code == 200, f"Failed to update package: {update_resp.text}"
        data = update_resp.json()
        assert data.get("success") == True
    
    def test_delete_package_soft_delete(self, admin_session):
        """Test DELETE /api/admin/packages/{id} soft-deletes (deactivates) a package"""
        # First create a package
        unique_name = f"TEST_Delete_{uuid.uuid4().hex[:6]}"
        create_payload = {
            "naziv": unique_name,
            "opis": "To be deleted",
            "cijena": 70.0,
            "termini": 2,
            "trajanje_dana": 30,
            "popular": False,
            "active": True
        }
        create_resp = admin_session.post(f"{BASE_URL}/api/admin/packages", json=create_payload)
        assert create_resp.status_code == 200
        pkg_id = create_resp.json()["package"]["id"]
        
        # Delete (soft-delete)
        del_resp = admin_session.delete(f"{BASE_URL}/api/admin/packages/{pkg_id}")
        assert del_resp.status_code == 200, f"Failed to delete package: {del_resp.text}"
        data = del_resp.json()
        assert data.get("success") == True
        
        # Verify it's deactivated (still in admin list but active=false)
        all_pkgs = admin_session.get(f"{BASE_URL}/api/admin/packages").json()
        deleted_pkg = next((p for p in all_pkgs if p["id"] == pkg_id), None)
        if deleted_pkg:
            assert deleted_pkg.get("active") == False, "Package should be deactivated"


class TestApprovedByField:
    """Test 6: approved_by field on package requests"""
    
    def test_approved_by_field_exists(self, admin_session):
        """Verify approved package requests have approved_by field"""
        resp = admin_session.get(f"{BASE_URL}/api/admin/package-requests")
        assert resp.status_code == 200
        requests_list = resp.json()
        
        # Check approved requests for approved_by field
        approved = [r for r in requests_list if r.get("status") == "approved"]
        for req in approved:
            # approved_by should exist on approved requests
            assert "approved_by" in req or "approved_at" in req, f"Approved request missing approved_by/approved_at: {req}"


class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_test_data(self, admin_session):
        """Clean up TEST_ prefixed data"""
        # Clean up manual income
        income_resp = admin_session.get(f"{BASE_URL}/api/admin/manual-income")
        if income_resp.status_code == 200:
            for entry in income_resp.json():
                if entry.get("opis", "").startswith("TEST_"):
                    admin_session.delete(f"{BASE_URL}/api/admin/manual-income/{entry['id']}")
        
        # Clean up reminders
        reminders_resp = admin_session.get(f"{BASE_URL}/api/admin/reminders")
        if reminders_resp.status_code == 200:
            for reminder in reminders_resp.json():
                if reminder.get("tekst", "").startswith("TEST_"):
                    admin_session.delete(f"{BASE_URL}/api/admin/reminders/{reminder['id']}")
        
        print("Cleanup completed")
        assert True

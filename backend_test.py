#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime

class PilatesAPITester:
    def __init__(self, base_url="https://pilates-hub-12.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.session_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}")
        else:
            print(f"❌ {name} - {details}")
        
        self.test_results.append({
            "test": name,
            "success": success,
            "details": details
        })

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if self.session_token:
            test_headers['Authorization'] = f'Bearer {self.session_token}'
        
        if headers:
            test_headers.update(headers)

        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers, timeout=10)

            success = response.status_code == expected_status
            details = f"Status: {response.status_code}"
            
            if not success:
                details += f", Expected: {expected_status}"
                try:
                    error_data = response.json()
                    details += f", Response: {error_data}"
                except:
                    details += f", Response: {response.text[:200]}"

            self.log_test(name, success, details)
            
            if success:
                try:
                    return response.json()
                except:
                    return {}
            return None

        except Exception as e:
            self.log_test(name, False, f"Error: {str(e)}")
            return None

    def test_public_endpoints(self):
        """Test public endpoints that don't require authentication"""
        print("\n🔍 Testing Public Endpoints...")
        
        # Test packages endpoint
        packages = self.run_test("Get Packages", "GET", "packages", 200)
        if packages and isinstance(packages, list) and len(packages) > 0:
            print(f"   Found {len(packages)} packages")
            # Check if package text shows '3 osobe' instead of '6'
            for pkg in packages:
                if 'Mala grupa do 3 osobe' in str(pkg):
                    print("   ✅ Package text correctly shows '3 osobe'")
                    break
            else:
                print("   ⚠️  Package text may not show '3 osobe'")
        
        # Test schedule endpoint
        schedule = self.run_test("Get Schedule", "GET", "schedule", 200)
        if schedule and isinstance(schedule, list) and len(schedule) > 0:
            print(f"   Found {len(schedule)} schedule slots")
            # Check if schedule shows ukupno_mjesta: 3
            first_slot = schedule[0] if schedule else {}
            if first_slot.get('ukupno_mjesta') == 3:
                print("   ✅ Schedule correctly shows ukupno_mjesta: 3")
            else:
                print(f"   ⚠️  Schedule shows ukupno_mjesta: {first_slot.get('ukupno_mjesta', 'unknown')}")
        
        # Test studio info endpoint
        studio_info = self.run_test("Get Studio Info", "GET", "studio-info", 200)
        if studio_info and isinstance(studio_info, dict):
            print(f"   Studio: {studio_info.get('naziv', 'Unknown')}")

        # Test invite endpoint (public)
        # This should return 404 for non-existent invite, which is expected
        self.run_test("Get Invite Details (404 expected)", "GET", "invites/non-existent-id", 404)

    def test_phone_auth_flow(self):
        """Test phone authentication flow"""
        print("\n🔍 Testing Phone Auth Flow...")
        
        test_phone = "+387 61 123 456"
        
        # Test send OTP
        otp_response = self.run_test(
            "Send OTP", 
            "POST", 
            "auth/phone/send-otp", 
            200,
            {"phone": test_phone}
        )
        
        if otp_response:
            print(f"   OTP sent, user_exists: {otp_response.get('user_exists', False)}")
            
            # Test verify OTP with mock code
            verify_response = self.run_test(
                "Verify OTP (Mock)", 
                "POST", 
                "auth/phone/verify", 
                200,
                {"phone": test_phone, "otp": "123456"}
            )
            
            if verify_response and verify_response.get('user_id'):
                print(f"   Phone auth successful for user: {verify_response.get('name', 'Unknown')}")
                return True
        
        return False

    def test_registration_flow(self):
        """Test user registration"""
        print("\n🔍 Testing Registration Flow...")
        
        test_phone = f"+387 61 {datetime.now().strftime('%H%M%S')}"
        test_email = f"test.user.{datetime.now().strftime('%H%M%S')}@example.com"
        
        # Test registration
        register_response = self.run_test(
            "Register User", 
            "POST", 
            "auth/register", 
            200,
            {
                "phone": test_phone,
                "ime": "Test",
                "prezime": "User",
                "email": test_email
            }
        )
        
        if register_response and register_response.get('user_id'):
            print(f"   Registration successful for: {register_response.get('name', 'Unknown')}")
            return True
        
        return False

    def test_authenticated_endpoints(self):
        """Test endpoints that require authentication"""
        print("\n🔍 Testing Authenticated Endpoints...")
        
        # First try to get session token from auth testing setup
        if not self.session_token:
            print("   No session token available, skipping authenticated tests")
            return False
        
        # Test /auth/me
        me_response = self.run_test("Get Current User", "GET", "auth/me", 200)
        if me_response:
            print(f"   Authenticated as: {me_response.get('name', 'Unknown')}")
        
        # Test memberships
        memberships = self.run_test("Get Memberships", "GET", "memberships", 200)
        if memberships and isinstance(memberships, list):
            print(f"   Found {len(memberships)} memberships")
        
        # Test active memberships
        active_memberships = self.run_test("Get Active Memberships", "GET", "memberships/active", 200)
        if active_memberships and isinstance(active_memberships, list):
            print(f"   Found {len(active_memberships)} active memberships")
        
        # Test trainings
        trainings = self.run_test("Get Trainings", "GET", "trainings", 200)
        if trainings and isinstance(trainings, list):
            print(f"   Found {len(trainings)} trainings")
        
        # Test upcoming trainings
        upcoming = self.run_test("Get Upcoming Trainings", "GET", "trainings/upcoming", 200)
        if upcoming and isinstance(upcoming, list):
            print(f"   Found {len(upcoming)} upcoming trainings")
        
        # NEW ENDPOINTS TESTING
        
        # Test user stats endpoint
        stats = self.run_test("Get User Stats", "GET", "user/stats", 200)
        if stats and isinstance(stats, dict):
            print(f"   Stats: {stats.get('preostali_termini', 0)}/{stats.get('ukupni_termini', 0)} remaining")
        
        # Test activity status endpoint
        activity = self.run_test("Get Activity Status", "GET", "user/activity-status", 200)
        if activity and isinstance(activity, dict):
            print(f"   Activity: {activity.get('days_inactive', 0)} days inactive")
        
        # Test weight endpoints
        weight_entries = self.run_test("Get Weight Entries", "GET", "weight", 200)
        if weight_entries and isinstance(weight_entries, list):
            print(f"   Found {len(weight_entries)} weight entries")
        
        # Test add weight entry
        weight_add = self.run_test(
            "Add Weight Entry", 
            "POST", 
            "weight", 
            200,
            {"weight": 70.5, "date": "2024-01-15"}
        )
        if weight_add:
            print("   Weight entry added successfully")
        
        # Test notifications endpoints
        notifications = self.run_test("Get Notifications", "GET", "notifications", 200)
        if notifications and isinstance(notifications, list):
            print(f"   Found {len(notifications)} notifications")
        
        unread_notifications = self.run_test("Get Unread Notifications", "GET", "notifications/unread", 200)
        if unread_notifications and isinstance(unread_notifications, list):
            print(f"   Found {len(unread_notifications)} unread notifications")
        
        # Test feedback endpoints
        pending_feedback = self.run_test("Get Pending Feedback", "GET", "feedback/pending", 200)
        if pending_feedback and isinstance(pending_feedback, list):
            print(f"   Found {len(pending_feedback)} trainings needing feedback")
        
        feedback_history = self.run_test("Get Feedback History", "GET", "feedback/history", 200)
        if feedback_history and isinstance(feedback_history, list):
            print(f"   Found {len(feedback_history)} feedback entries")
        
        # Test user search (for sharing)
        user_search = self.run_test("Search Users", "GET", "users/search?q=test", 200)
        if user_search and isinstance(user_search, list):
            print(f"   Found {len(user_search)} users in search")
        
        # Test logout
        self.run_test("Logout", "POST", "auth/logout", 200)
        
        return True

    def create_test_session(self):
        """Create test session using the specific session token from review request"""
        print("\n🔍 Setting up Test Session...")
        
        # Use the specific session token mentioned in the review request
        self.session_token = "test_session_pilates_123"
        print(f"   Using session token: {self.session_token}")
        
        # Try to test if this session works by calling /auth/me
        try:
            url = f"{self.api_url}/auth/me"
            headers = {'Authorization': f'Bearer {self.session_token}'}
            response = requests.get(url, headers=headers, timeout=10)
            
            if response.status_code == 200:
                user_data = response.json()
                print(f"   Session valid for user: {user_data.get('name', 'Unknown')}")
                return True
            else:
                print(f"   Session token not valid (status: {response.status_code})")
                # Fall back to creating a new session via mongosh
                return self.create_test_session_fallback()
        except Exception as e:
            print(f"   Error testing session: {e}")
            return self.create_test_session_fallback()

    def create_test_session_fallback(self):
        """Create test session using mongosh as described in auth_testing.md"""
        print("\n🔍 Creating Test Session via MongoDB...")
        
        import subprocess
        import time
        
        timestamp = int(time.time())
        
        mongosh_script = f'''
use('test_database');
var userId = 'test-user-{timestamp}';
var sessionToken = 'test_session_pilates_123';
db.users.insertOne({{
  user_id: userId,
  email: 'test.user.{timestamp}@example.com',
  name: 'Test User',
  phone: '+387 61 123 456',
  created_at: new Date()
}});
db.user_sessions.insertOne({{
  user_id: userId,
  session_token: sessionToken,
  expires_at: new Date(Date.now() + 7*24*60*60*1000),
  created_at: new Date()
}});
db.memberships.insertOne({{
  id: 'mem_{timestamp}',
  user_id: userId,
  naziv: 'Mjesečna članarina',
  tip: 'aktivna',
  preostali_termini: 8,
  ukupni_termini: 12,
  datum_pocetka: new Date(),
  datum_isteka: new Date(Date.now() + 25*24*60*60*1000),
  created_at: new Date()
}});
db.trainings.insertOne({{
  id: 'train_{timestamp}',
  user_id: userId,
  datum: new Date(Date.now() + 2*24*60*60*1000),
  vrijeme: '10:00',
  instruktor: 'Ana Marić',
  tip: 'predstojeći',
  trajanje: 50,
  feedback_submitted: false,
  created_at: new Date()
}});
print('SESSION_TOKEN:' + sessionToken);
print('USER_ID:' + userId);
'''
        
        try:
            result = subprocess.run(
                ['mongosh', '--eval', mongosh_script],
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if result.returncode == 0:
                # Extract session token from output
                for line in result.stdout.split('\n'):
                    if 'SESSION_TOKEN:' in line:
                        self.session_token = line.split('SESSION_TOKEN:')[1].strip()
                        print(f"   Created session token: {self.session_token}")
                        return True
            else:
                print(f"   MongoDB setup failed: {result.stderr}")
        except Exception as e:
            print(f"   Error creating test session: {e}")
        
        return False

    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting Pilates API Tests...")
        print(f"   Base URL: {self.base_url}")
        
        # Test public endpoints first
        self.test_public_endpoints()
        
        # Test phone auth flow
        self.test_phone_auth_flow()
        
        # Test registration
        self.test_registration_flow()
        
        # Create test session for authenticated tests
        if self.create_test_session():
            self.test_authenticated_endpoints()
        
        # Print summary
        print(f"\n📊 Test Results: {self.tests_passed}/{self.tests_run} passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed!")
            return 0
        else:
            print("⚠️  Some tests failed")
            return 1

def main():
    tester = PilatesAPITester()
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())
"""
Iteration 5 Bug Fix Tests
Tests for:
1. Today's date (March 31) selection for booking - timezone fix
2. Packages updated to 5 new packages with correct names/prices
3. Instagram and Google Maps links configuration
"""
import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestPackagesEndpoint:
    """Test /api/packages returns correct 5 packages with updated values"""
    
    def test_packages_returns_5_packages(self):
        """Verify exactly 5 packages are returned"""
        response = requests.get(f"{BASE_URL}/api/packages")
        assert response.status_code == 200
        packages = response.json()
        assert len(packages) == 5, f"Expected 5 packages, got {len(packages)}"
    
    def test_basic_package(self):
        """Basic: 6 termina, 90 KM"""
        response = requests.get(f"{BASE_URL}/api/packages")
        packages = response.json()
        basic = next((p for p in packages if p['naziv'] == 'Basic'), None)
        assert basic is not None, "Basic package not found"
        assert basic['termini'] == 6, f"Basic should have 6 termini, got {basic['termini']}"
        assert basic['cijena'] == 90, f"Basic should cost 90 KM, got {basic['cijena']}"
    
    def test_linea_active_package(self):
        """Linea Active: 8 termina, 125 KM"""
        response = requests.get(f"{BASE_URL}/api/packages")
        packages = response.json()
        pkg = next((p for p in packages if p['naziv'] == 'Linea Active'), None)
        assert pkg is not None, "Linea Active package not found"
        assert pkg['termini'] == 8, f"Linea Active should have 8 termini, got {pkg['termini']}"
        assert pkg['cijena'] == 125, f"Linea Active should cost 125 KM, got {pkg['cijena']}"
    
    def test_linea_balance_package(self):
        """Linea Balance: 10 termina, 145 KM"""
        response = requests.get(f"{BASE_URL}/api/packages")
        packages = response.json()
        pkg = next((p for p in packages if p['naziv'] == 'Linea Balance'), None)
        assert pkg is not None, "Linea Balance package not found"
        assert pkg['termini'] == 10, f"Linea Balance should have 10 termini, got {pkg['termini']}"
        assert pkg['cijena'] == 145, f"Linea Balance should cost 145 KM, got {pkg['cijena']}"
        assert pkg.get('popular') == True, "Linea Balance should be marked as popular"
    
    def test_linea_gold_package(self):
        """Linea Gold: 12 termina, 175 KM"""
        response = requests.get(f"{BASE_URL}/api/packages")
        packages = response.json()
        pkg = next((p for p in packages if p['naziv'] == 'Linea Gold'), None)
        assert pkg is not None, "Linea Gold package not found"
        assert pkg['termini'] == 12, f"Linea Gold should have 12 termini, got {pkg['termini']}"
        assert pkg['cijena'] == 175, f"Linea Gold should cost 175 KM, got {pkg['cijena']}"
    
    def test_linea_premium_package(self):
        """Linea Premium: 16 termina, 200 KM"""
        response = requests.get(f"{BASE_URL}/api/packages")
        packages = response.json()
        pkg = next((p for p in packages if p['naziv'] == 'Linea Premium'), None)
        assert pkg is not None, "Linea Premium package not found"
        assert pkg['termini'] == 16, f"Linea Premium should have 16 termini, got {pkg['termini']}"
        assert pkg['cijena'] == 200, f"Linea Premium should cost 200 KM, got {pkg['cijena']}"


class TestStudioInfoLinks:
    """Test /api/studio-info returns correct Instagram and address for Google Maps"""
    
    def test_instagram_url(self):
        """Instagram link should be https://www.instagram.com/lineapilatesreformer/"""
        response = requests.get(f"{BASE_URL}/api/studio-info")
        assert response.status_code == 200
        data = response.json()
        assert data['instagram'] == 'https://www.instagram.com/lineapilatesreformer/', \
            f"Instagram URL incorrect: {data['instagram']}"
    
    def test_instagram_handle(self):
        """Instagram handle should be @lineapilatesreformer"""
        response = requests.get(f"{BASE_URL}/api/studio-info")
        data = response.json()
        assert data['instagram_handle'] == '@lineapilatesreformer', \
            f"Instagram handle incorrect: {data['instagram_handle']}"
    
    def test_address_for_google_maps(self):
        """Address should be present for Google Maps link"""
        response = requests.get(f"{BASE_URL}/api/studio-info")
        data = response.json()
        assert 'adresa' in data, "Address field missing"
        assert len(data['adresa']) > 0, "Address is empty"
        # Verify it's the correct address
        assert 'Trebinje' in data['adresa'], f"Address should contain Trebinje: {data['adresa']}"


class TestTodayScheduleSlots:
    """Test /api/schedule returns today's date (2026-03-31) slots - timezone fix verification"""
    
    def test_schedule_returns_today_slots(self):
        """Schedule should include today's date (2026-03-31) slots"""
        response = requests.get(f"{BASE_URL}/api/schedule")
        assert response.status_code == 200
        slots = response.json()
        
        # Today is 2026-03-31
        today_str = "2026-03-31"
        today_slots = [s for s in slots if s['datum'] == today_str]
        
        assert len(today_slots) > 0, f"No slots found for today ({today_str}). This indicates the timezone bug may still exist."
        print(f"Found {len(today_slots)} slots for today ({today_str})")
    
    def test_today_slots_have_required_fields(self):
        """Today's slots should have all required fields"""
        response = requests.get(f"{BASE_URL}/api/schedule")
        slots = response.json()
        
        today_str = "2026-03-31"
        today_slots = [s for s in slots if s['datum'] == today_str]
        
        if len(today_slots) > 0:
            slot = today_slots[0]
            required_fields = ['id', 'datum', 'vrijeme', 'instruktor', 'ukupno_mjesta', 'slobodna_mjesta']
            for field in required_fields:
                assert field in slot, f"Missing field '{field}' in slot"
    
    def test_today_slots_have_time_values(self):
        """Today's slots should have valid time values"""
        response = requests.get(f"{BASE_URL}/api/schedule")
        slots = response.json()
        
        today_str = "2026-03-31"
        today_slots = [s for s in slots if s['datum'] == today_str]
        
        for slot in today_slots:
            assert ':' in slot['vrijeme'], f"Invalid time format: {slot['vrijeme']}"
            hour = int(slot['vrijeme'].split(':')[0])
            assert 0 <= hour <= 23, f"Invalid hour in time: {slot['vrijeme']}"


class TestScheduleDateFormat:
    """Verify schedule dates are in correct format (YYYY-MM-DD) for frontend matching"""
    
    def test_schedule_date_format(self):
        """All schedule dates should be in YYYY-MM-DD format"""
        response = requests.get(f"{BASE_URL}/api/schedule")
        slots = response.json()
        
        for slot in slots[:20]:  # Check first 20 slots
            datum = slot['datum']
            # Should match YYYY-MM-DD format
            assert len(datum) == 10, f"Date should be 10 chars (YYYY-MM-DD): {datum}"
            assert datum[4] == '-' and datum[7] == '-', f"Date format incorrect: {datum}"
            
            # Verify it's a valid date
            try:
                datetime.strptime(datum, '%Y-%m-%d')
            except ValueError:
                pytest.fail(f"Invalid date format: {datum}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

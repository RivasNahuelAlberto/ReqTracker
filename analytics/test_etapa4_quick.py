"""
ETAPA 4 Testing Script
Prueba rápida de los endpoints de Prediction Engine

Run: python analytics/test_etapa4_quick.py
"""

import requests
import json

BASE_URL = "http://localhost:8000"

def test_prediction_endpoints():
    """Test ETAPA 4 endpoints"""
    
    print("\n" + "="*70)
    print("ETAPA 4 - PREDICTION ENGINE QUICK TESTS")
    print("="*70 + "\n")
    
    # Test 1: Health check
    print("1. Testing /prediction/health-check...")
    try:
        response = requests.get(f"{BASE_URL}/prediction/health-check", timeout=5)
        if response.status_code == 200:
            print(f"   ✓ Status: {response.status_code}")
            print(f"   ✓ Module: {response.json().get('module')}")
        else:
            print(f"   ✗ Status: {response.status_code}")
    except Exception as e:
        print(f"   ✗ Error: {e}")
    
    # Test 2: Risk prediction
    print("\n2. Testing /prediction/risk...")
    try:
        payload = {
            "requirement_id": "REQ-001",
            "requirement_text": "The system shall authenticate users with username and password",
            "project_context": {"type": "web"}
        }
        response = requests.post(
            f"{BASE_URL}/prediction/risk",
            json=payload,
            timeout=10
        )
        if response.status_code == 200:
            data = response.json()
            print(f"   ✓ Status: {response.status_code}")
            print(f"   ✓ Risk Level: {data.get('risk_level')}")
            print(f"   ✓ Risk Score: {data.get('risk_score'):.2f}")
            print(f"   ✓ Confidence: {data.get('confidence'):.2f}")
        else:
            print(f"   ✗ Status: {response.status_code}")
    except Exception as e:
        print(f"   ✗ Error: {e}")
    
    # Test 3: Missing requirements detection
    print("\n3. Testing /prediction/missing...")
    try:
        payload = {
            "requirements": [
                {"id": "REQ-001", "description": "User authentication system"},
                {"id": "REQ-002", "description": "User registration"}
            ],
            "project_context": {"type": "saas"}
        }
        response = requests.post(
            f"{BASE_URL}/prediction/missing",
            json=payload,
            timeout=10
        )
        if response.status_code == 200:
            data = response.json()
            print(f"   ✓ Status: {response.status_code}")
            print(f"   ✓ Missing types found: {data.get('total_found')}")
            if data.get('missing_requirements'):
                for m in data['missing_requirements'][:2]:
                    print(f"     - {m.get('type')}: {m.get('priority')}")
        else:
            print(f"   ✗ Status: {response.status_code}")
    except Exception as e:
        print(f"   ✗ Error: {e}")
    
    # Test 4: Inconsistency detection
    print("\n4. Testing /prediction/inconsistencies...")
    try:
        payload = {
            "requirements": [
                {"id": "REQ-001", "description": "User login with authentication", "priority": "high"},
                {"id": "REQ-002", "description": "User login and authentication", "priority": "high"}
            ],
            "relationships": []
        }
        response = requests.post(
            f"{BASE_URL}/prediction/inconsistencies",
            json=payload,
            timeout=10
        )
        if response.status_code == 200:
            data = response.json()
            print(f"   ✓ Status: {response.status_code}")
            print(f"   ✓ Inconsistencies found: {data.get('total_found')}")
            print(f"   ✓ Severity distribution: {data.get('severity_distribution')}")
        else:
            print(f"   ✗ Status: {response.status_code}")
    except Exception as e:
        print(f"   ✗ Error: {e}")
    
    # Test 5: Comprehensive prediction
    print("\n5. Testing /prediction/comprehensive...")
    try:
        payload = {
            "requirements": [
                {"id": "REQ-001", "description": "The system shall authenticate users"},
                {"id": "REQ-002", "description": "Maybe the system should validate input"},
                {"id": "REQ-003", "description": "System processes 100 requests per second"},
                {"id": "REQ-004", "description": "User login and authentication"},
                {"id": "REQ-005", "description": "System has 99.9% uptime"}
            ],
            "relationships": [
                {"source_id": "REQ-001", "target_id": "REQ-002", "type": "depends_on"},
                {"source_id": "REQ-002", "target_id": "REQ-003", "type": "depends_on"}
            ],
            "project_context": {"type": "saas"},
            "project_id": "PROJ-TEST-001"
        }
        response = requests.post(
            f"{BASE_URL}/prediction/comprehensive",
            json=payload,
            timeout=15
        )
        if response.status_code == 200:
            data = response.json()
            print(f"   ✓ Status: {response.status_code}")
            print(f"   ✓ Project: {data.get('project_id')}")
            print(f"   ✓ Total Requirements: {data.get('total_requirements')}")
            print(f"   ✓ Overall Assessment: {data.get('overall_assessment')}")
            summary = data.get('summary', {})
            print(f"   ✓ Average Risk Score: {summary.get('average_risk_score'):.2f}")
            print(f"   ✓ Missing Types Found: {summary.get('total_missing_types')}")
            print(f"   ✓ Inconsistencies: {summary.get('total_inconsistencies')}")
        else:
            print(f"   ✗ Status: {response.status_code}")
    except Exception as e:
        print(f"   ✗ Error: {e}")
    
    print("\n" + "="*70)
    print("ETAPA 4 QUICK TESTS COMPLETE")
    print("="*70 + "\n")

if __name__ == "__main__":
    test_prediction_endpoints()

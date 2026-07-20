"""
ETAPA 5 Testing Script - Quick Tests
Prueba rápida de los endpoints de Advanced Features (Clustering, Forecasting, Explainability)

Run: python analytics/test_etapa5_quick.py
"""

import requests
import json
from datetime import datetime, timedelta

BASE_URL = "http://localhost:8000"

def test_advanced_endpoints():
    """Test ETAPA 5 endpoints"""
    
    print("\n" + "="*70)
    print("ETAPA 5 - ADVANCED FEATURES QUICK TESTS")
    print("="*70 + "\n")
    
    # Test 1: Clustering Health Check
    print("1. Testing /advanced/clustering/health-check...")
    try:
        response = requests.get(f"{BASE_URL}/advanced/clustering/health-check", timeout=5)
        if response.status_code == 200:
            print(f"   ✓ Status: {response.status_code}")
            data = response.json()
            print(f"   ✓ Module: {data.get('module')}")
            print(f"   ✓ Status: {data.get('status')}")
        else:
            print(f"   ✗ Status: {response.status_code}")
    except Exception as e:
        print(f"   ✗ Error: {e}")
    
    # Test 2: Clustering Analysis
    print("\n2. Testing /advanced/clustering/analyze...")
    try:
        payload = {
            "requirements": [
                {"id": "REQ-001", "description": "User authentication system with login and password"},
                {"id": "REQ-002", "description": "User login and authentication feature"},
                {"id": "REQ-003", "description": "Payment processing module"},
                {"id": "REQ-004", "description": "Order management and tracking"},
                {"id": "REQ-005", "description": "Database connectivity layer"}
            ],
            "min_cluster_size": 2,
            "project_id": "PROJ-TEST"
        }
        response = requests.post(
            f"{BASE_URL}/advanced/clustering/analyze",
            json=payload,
            timeout=10
        )
        if response.status_code == 200:
            data = response.json()
            print(f"   ✓ Status: {response.status_code}")
            print(f"   ✓ Total Clusters: {data.get('total_clusters')}")
            print(f"   ✓ Quality: {data.get('quality')}")
            if data.get('clusters'):
                for cluster in data['clusters'][:2]:
                    print(f"     - Cluster {cluster['cluster_id']}: {cluster['type']} ({cluster['size']} reqs)")
        else:
            print(f"   ✗ Status: {response.status_code}")
    except Exception as e:
        print(f"   ✗ Error: {e}")
    
    # Test 3: Forecasting Health Check
    print("\n3. Testing /advanced/forecasting/health-check...")
    try:
        response = requests.get(f"{BASE_URL}/advanced/forecasting/health-check", timeout=5)
        if response.status_code == 200:
            print(f"   ✓ Status: {response.status_code}")
            data = response.json()
            print(f"   ✓ Module: {data.get('module')}")
            print(f"   ✓ Version: {data.get('version')}")
        else:
            print(f"   ✗ Status: {response.status_code}")
    except Exception as e:
        print(f"   ✗ Error: {e}")
    
    # Test 4: Forecasting Project
    print("\n4. Testing /advanced/forecasting/project...")
    try:
        payload = {
            "project_id": "PROJ-TEST",
            "requirements": [
                {"id": "REQ-001", "priority": "high", "description": "Auth system"},
                {"id": "REQ-002", "priority": "medium", "description": "Payment"},
                {"id": "REQ-003", "priority": "low", "description": "Logging"}
            ],
            "forecast_periods": 12
        }
        response = requests.post(
            f"{BASE_URL}/advanced/forecasting/project",
            json=payload,
            timeout=10
        )
        if response.status_code == 200:
            data = response.json()
            print(f"   ✓ Status: {response.status_code}")
            print(f"   ✓ Project: {data.get('project_id')}")
            print(f"   ✓ Forecasts: {len(data.get('forecasts', []))}")
            if data.get('forecasts'):
                for forecast in data['forecasts'][:1]:
                    print(f"     - {forecast['metric_name']}: {forecast['trend']}")
        else:
            print(f"   ✗ Status: {response.status_code}")
    except Exception as e:
        print(f"   ✗ Error: {e}")
    
    # Test 5: Explainability Health Check
    print("\n5. Testing /advanced/explainability/health-check...")
    try:
        response = requests.get(f"{BASE_URL}/advanced/explainability/health-check", timeout=5)
        if response.status_code == 200:
            print(f"   ✓ Status: {response.status_code}")
            data = response.json()
            print(f"   ✓ Module: {data.get('module')}")
            print(f"   ✓ Capabilities: {len(data.get('capabilities', []))}")
        else:
            print(f"   ✗ Status: {response.status_code}")
    except Exception as e:
        print(f"   ✗ Error: {e}")
    
    # Test 6: Risk Explanation
    print("\n6. Testing /advanced/explainability/risk...")
    try:
        payload = {
            "requirement_id": "REQ-001",
            "requirement_text": "The system shall authenticate users with username and password",
            "risk_score": 0.25,
            "risk_factors": {
                "ambiguity": 0.05,
                "complexity": 0.10,
                "dependency": 0.06,
                "conformance": 0.02,
                "coverage": 0.02
            }
        }
        response = requests.post(
            f"{BASE_URL}/advanced/explainability/risk",
            json=payload,
            timeout=10
        )
        if response.status_code == 200:
            data = response.json()
            print(f"   ✓ Status: {response.status_code}")
            print(f"   ✓ Prediction ID: {data.get('prediction_id')}")
            print(f"   ✓ Confidence: {data.get('confidence'):.2f}")
            print(f"   ✓ Contributions: {len(data.get('feature_contributions', []))}")
        else:
            print(f"   ✗ Status: {response.status_code}")
    except Exception as e:
        print(f"   ✗ Error: {e}")
    
    print("\n" + "="*70)
    print("ETAPA 5 QUICK TESTS COMPLETE")
    print("="*70 + "\n")

if __name__ == "__main__":
    test_advanced_endpoints()

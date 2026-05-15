"""
CHECKPOINT E: ETAPA 5 Advanced Features - Validation Test Suite
Comprehensive validation of Clustering, Forecasting, and Explainability endpoints

Run: python analytics/checkpoint-e.test.py
Expected: All tests PASS (10/10 minimum)
"""

import unittest
import requests
import json
from typing import Dict, List, Any
import sys
import time

# Configuration
BASE_URL = "http://localhost:8000"
TIMEOUT = 15

class TestETAPA5Clustering(unittest.TestCase):
    """ETAPA 5 - Clustering Engine Tests"""
    
    @classmethod
    def setUpClass(cls):
        """Initialize test suite"""
        print("\n" + "="*80)
        print("CHECKPOINT E: ETAPA 5 VALIDATION TEST SUITE")
        print("Advanced Features - Clustering, Forecasting, Explainability")
        print("="*80 + "\n")
        
        # Health check before tests
        cls.service_ready = False
        max_retries = 5
        for attempt in range(max_retries):
            try:
                response = requests.get(f"{BASE_URL}/health", timeout=5)
                if response.status_code == 200:
                    print(f"✓ Analytics service is ready (attempt {attempt + 1}/{max_retries})")
                    cls.service_ready = True
                    break
            except requests.exceptions.ConnectionError:
                print(f"⏳ Waiting for service... (attempt {attempt + 1}/{max_retries})")
                time.sleep(1)
        
        if not cls.service_ready:
            print("✗ Analytics service not available!")
            sys.exit(1)
    
    def test_1_clustering_health_check(self):
        """Test: /advanced/clustering/health-check endpoint"""
        print("\n[TEST 1] Testing /advanced/clustering/health-check")
        print("-" * 60)
        
        try:
            response = requests.get(
                f"{BASE_URL}/advanced/clustering/health-check",
                timeout=TIMEOUT
            )
            self.assertEqual(response.status_code, 200, f"Expected 200, got {response.status_code}")
            
            data = response.json()
            print(f"Status: {response.status_code} ✓")
            print(f"Module: {data.get('module')} ✓")
            print(f"Status: {data.get('status')} ✓")
            print(f"Version: {data.get('version')} ✓")
            
            self.assertIn("module", data)
            self.assertIn("status", data)
            self.assertEqual(data["module"], "clustering")
            
            print("✓ PASSED: Clustering health check successful")
        
        except Exception as e:
            print(f"✗ FAILED: {e}")
            self.fail(f"Clustering health check failed: {e}")
    
    def test_2_clustering_analysis(self):
        """Test: /advanced/clustering/analyze endpoint"""
        print("\n[TEST 2] Testing /advanced/clustering/analyze")
        print("-" * 60)
        
        try:
            payload = {
                "requirements": [
                    {"id": "REQ-001", "description": "User authentication with login credentials"},
                    {"id": "REQ-002", "description": "Login and password authentication system"},
                    {"id": "REQ-003", "description": "Payment processing functionality"},
                    {"id": "REQ-004", "description": "Order management and tracking system"},
                    {"id": "REQ-005", "description": "Database connectivity layer"}
                ],
                "min_cluster_size": 2,
                "project_id": "PROJ-CHECKPOINT-E"
            }
            
            response = requests.post(
                f"{BASE_URL}/advanced/clustering/analyze",
                json=payload,
                timeout=TIMEOUT
            )
            
            self.assertEqual(response.status_code, 200)
            
            data = response.json()
            print(f"Status: {response.status_code} ✓")
            print(f"Total Clusters: {data.get('total_clusters')} ✓")
            print(f"Quality: {data.get('quality')} ✓")
            
            self.assertIn("total_clusters", data)
            self.assertIn("clusters", data)
            self.assertIn("quality", data)
            self.assertGreater(data["total_clusters"], 0, "Should identify at least 1 cluster")
            
            # Check cluster structure
            for cluster in data["clusters"][:1]:
                print(f"  Cluster {cluster['cluster_id']}: {cluster['type']} ({cluster['size']} reqs, cohesion={cluster['cohesion']:.2f})")
                self.assertIn("cluster_id", cluster)
                self.assertIn("type", cluster)
                self.assertIn("size", cluster)
            
            print("✓ PASSED: Clustering analysis successful")
        
        except Exception as e:
            print(f"✗ FAILED: {e}")
            self.fail(f"Clustering analysis failed: {e}")
    
    def test_3_clustering_suggestions(self):
        """Test: /advanced/clustering/suggestions endpoint"""
        print("\n[TEST 3] Testing /advanced/clustering/suggestions")
        print("-" * 60)
        
        try:
            payload = {
                "requirements": [
                    {"id": "REQ-001", "description": "Auth system"},
                    {"id": "REQ-002", "description": "Auth system"},
                    {"id": "REQ-003", "description": "Payment"}
                ],
                "min_cluster_size": 1
            }
            
            response = requests.post(
                f"{BASE_URL}/advanced/clustering/suggestions",
                json=payload,
                timeout=TIMEOUT
            )
            
            self.assertEqual(response.status_code, 200)
            
            data = response.json()
            print(f"Status: {response.status_code} ✓")
            print(f"Total Suggestions: {data.get('total_suggestions')} ✓")
            
            self.assertIn("total_suggestions", data)
            self.assertIn("suggestions", data)
            
            print("✓ PASSED: Clustering suggestions generated")
        
        except Exception as e:
            print(f"✗ FAILED: {e}")
            self.fail(f"Clustering suggestions failed: {e}")


class TestETAPA5Forecasting(unittest.TestCase):
    """ETAPA 5 - Forecasting Engine Tests"""
    
    def test_4_forecasting_health_check(self):
        """Test: /advanced/forecasting/health-check endpoint"""
        print("\n[TEST 4] Testing /advanced/forecasting/health-check")
        print("-" * 60)
        
        try:
            response = requests.get(
                f"{BASE_URL}/advanced/forecasting/health-check",
                timeout=TIMEOUT
            )
            self.assertEqual(response.status_code, 200)
            
            data = response.json()
            print(f"Status: {response.status_code} ✓")
            print(f"Module: {data.get('module')} ✓")
            print(f"Version: {data.get('version')} ✓")
            
            self.assertEqual(data["module"], "forecasting")
            self.assertIn("capabilities", data)
            
            print("✓ PASSED: Forecasting health check successful")
        
        except Exception as e:
            print(f"✗ FAILED: {e}")
            self.fail(f"Forecasting health check failed: {e}")
    
    def test_5_forecasting_project(self):
        """Test: /advanced/forecasting/project endpoint"""
        print("\n[TEST 5] Testing /advanced/forecasting/project")
        print("-" * 60)
        
        try:
            payload = {
                "project_id": "PROJ-CHECKPOINT-E",
                "requirements": [
                    {"id": "REQ-001", "priority": "critical", "description": "Critical auth"},
                    {"id": "REQ-002", "priority": "high", "description": "High priority feature"},
                    {"id": "REQ-003", "priority": "medium", "description": "Medium priority"},
                    {"id": "REQ-004", "priority": "low", "description": "Low priority logging"},
                    {"id": "REQ-005", "priority": "low", "description": "Low priority docs"}
                ],
                "forecast_periods": 12
            }
            
            response = requests.post(
                f"{BASE_URL}/advanced/forecasting/project",
                json=payload,
                timeout=TIMEOUT
            )
            
            self.assertEqual(response.status_code, 200)
            
            data = response.json()
            print(f"Status: {response.status_code} ✓")
            print(f"Project: {data.get('project_id')} ✓")
            print(f"Analysis Date: {data.get('analysis_date')} ✓")
            print(f"Forecasts: {len(data.get('forecasts', []))} ✓")
            
            self.assertIn("project_id", data)
            self.assertIn("forecasts", data)
            self.assertGreater(len(data["forecasts"]), 0, "Should have at least 1 forecast")
            
            # Check forecast structure
            for forecast in data["forecasts"][:1]:
                print(f"  {forecast['metric_name']}: trend={forecast['trend']}, confidence={forecast['confidence']:.2f}")
                self.assertIn("metric_name", forecast)
                self.assertIn("trend", forecast)
                self.assertIn("confidence", forecast)
            
            print("✓ PASSED: Project forecasting successful")
        
        except Exception as e:
            print(f"✗ FAILED: {e}")
            self.fail(f"Project forecasting failed: {e}")
    
    def test_6_forecasting_anomalies(self):
        """Test: /advanced/forecasting/anomalies endpoint"""
        print("\n[TEST 6] Testing /advanced/forecasting/anomalies")
        print("-" * 60)
        
        try:
            payload = {
                "time_series": [
                    {"timestamp": "2024-01-01T00:00:00", "value": 5.0},
                    {"timestamp": "2024-02-01T00:00:00", "value": 5.2},
                    {"timestamp": "2024-03-01T00:00:00", "value": 5.1},
                    {"timestamp": "2024-04-01T00:00:00", "value": 20.0},  # Anomaly
                    {"timestamp": "2024-05-01T00:00:00", "value": 5.3}
                ],
                "sensitivity": 2.0
            }
            
            response = requests.post(
                f"{BASE_URL}/advanced/forecasting/anomalies",
                json=payload,
                timeout=TIMEOUT
            )
            
            self.assertEqual(response.status_code, 200)
            
            data = response.json()
            print(f"Status: {response.status_code} ✓")
            print(f"Total Anomalies: {data.get('total_anomalies')} ✓")
            
            self.assertIn("total_anomalies", data)
            self.assertIn("anomalies", data)
            # Should detect at least 1 anomaly (the spike to 20.0)
            self.assertGreater(data["total_anomalies"], 0, "Should detect anomalies")
            
            print("✓ PASSED: Anomaly detection successful")
        
        except Exception as e:
            print(f"✗ FAILED: {e}")
            self.fail(f"Anomaly detection failed: {e}")


class TestETAPA5Explainability(unittest.TestCase):
    """ETAPA 5 - Explainability Engine Tests"""
    
    def test_7_explainability_health_check(self):
        """Test: /advanced/explainability/health-check endpoint"""
        print("\n[TEST 7] Testing /advanced/explainability/health-check")
        print("-" * 60)
        
        try:
            response = requests.get(
                f"{BASE_URL}/advanced/explainability/health-check",
                timeout=TIMEOUT
            )
            self.assertEqual(response.status_code, 200)
            
            data = response.json()
            print(f"Status: {response.status_code} ✓")
            print(f"Module: {data.get('module')} ✓")
            print(f"Version: {data.get('version')} ✓")
            
            self.assertEqual(data["module"], "explainability")
            self.assertIn("capabilities", data)
            
            print("✓ PASSED: Explainability health check successful")
        
        except Exception as e:
            print(f"✗ FAILED: {e}")
            self.fail(f"Explainability health check failed: {e}")
    
    def test_8_risk_explanation(self):
        """Test: /advanced/explainability/risk endpoint"""
        print("\n[TEST 8] Testing /advanced/explainability/risk")
        print("-" * 60)
        
        try:
            payload = {
                "requirement_id": "REQ-001",
                "requirement_text": "The system shall authenticate users within 100ms",
                "risk_score": 0.25,
                "risk_factors": {
                    "ambiguity": 0.05,
                    "complexity": 0.08,
                    "dependency": 0.06,
                    "conformance": 0.03,
                    "coverage": 0.03
                }
            }
            
            response = requests.post(
                f"{BASE_URL}/advanced/explainability/risk",
                json=payload,
                timeout=TIMEOUT
            )
            
            self.assertEqual(response.status_code, 200)
            
            data = response.json()
            print(f"Status: {response.status_code} ✓")
            print(f"Prediction ID: {data.get('prediction_id')} ✓")
            print(f"Confidence: {data.get('confidence'):.2f} ✓")
            print(f"Contributions: {len(data.get('feature_contributions', []))} ✓")
            
            self.assertIn("prediction_id", data)
            self.assertIn("feature_contributions", data)
            self.assertGreater(len(data["feature_contributions"]), 0, "Should have feature contributions")
            
            # Check contribution structure
            for contrib in data["feature_contributions"][:1]:
                print(f"  {contrib['feature']}: {contrib['contribution_pct']:.1f}% ({contrib['importance']})")
                self.assertIn("feature", contrib)
                self.assertIn("contribution_pct", contrib)
                self.assertIn("importance", contrib)
            
            print("✓ PASSED: Risk explanation successful")
        
        except Exception as e:
            print(f"✗ FAILED: {e}")
            self.fail(f"Risk explanation failed: {e}")
    
    def test_9_missing_explanation(self):
        """Test: /advanced/explainability/missing endpoint"""
        print("\n[TEST 9] Testing /advanced/explainability/missing")
        print("-" * 60)
        
        try:
            payload = {
                "missing_type": "security",
                "requirements": [
                    {"id": "REQ-001", "description": "User login system"},
                    {"id": "REQ-002", "description": "Data storage"}
                ],
                "keywords": ["encrypt", "auth", "password", "token"],
                "confidence": 0.8
            }
            
            response = requests.post(
                f"{BASE_URL}/advanced/explainability/missing",
                json=payload,
                timeout=TIMEOUT
            )
            
            self.assertEqual(response.status_code, 200)
            
            data = response.json()
            print(f"Status: {response.status_code} ✓")
            print(f"Explanation Type: {data.get('explanation_type')} ✓")
            print(f"Confidence: {data.get('confidence'):.2f} ✓")
            
            self.assertIn("prediction_id", data)
            self.assertIn("feature_contributions", data)
            
            print("✓ PASSED: Missing explanation successful")
        
        except Exception as e:
            print(f"✗ FAILED: {e}")
            self.fail(f"Missing explanation failed: {e}")
    
    def test_10_comprehensive_explanation(self):
        """Test: /advanced/explainability/comprehensive endpoint"""
        print("\n[TEST 10] Testing /advanced/explainability/comprehensive")
        print("-" * 60)
        
        try:
            payload = {
                "predictions": [
                    {
                        "prediction_type": "risk",
                        "requirement_id": "REQ-001",
                        "text": "The system shall...",
                        "risk_score": 0.4,
                        "risk_factors": {"ambiguity": 0.1, "complexity": 0.15}
                    },
                    {
                        "prediction_type": "missing",
                        "missing_type": "security",
                        "requirements": [{"id": "REQ-001"}],
                        "keywords": ["encrypt"],
                        "confidence": 0.7
                    }
                ],
                "analysis_type": "comprehensive"
            }
            
            response = requests.post(
                f"{BASE_URL}/advanced/explainability/comprehensive",
                json=payload,
                timeout=TIMEOUT
            )
            
            self.assertEqual(response.status_code, 200)
            
            data = response.json()
            print(f"Status: {response.status_code} ✓")
            print(f"Analysis Type: {data.get('analysis_type')} ✓")
            print(f"Total Explained: {data.get('total_predictions')} ✓")
            
            self.assertIn("analysis_type", data)
            self.assertIn("explanations", data)
            self.assertIn("summary", data)
            
            print(f"  Insights: {len(data.get('insights', []))} generated")
            
            print("✓ PASSED: Comprehensive explanation successful")
        
        except Exception as e:
            print(f"✗ FAILED: {e}")
            self.fail(f"Comprehensive explanation failed: {e}")


def run_tests():
    """Run all tests with verbose output"""
    loader = unittest.TestLoader()
    suite = unittest.TestSuite()
    
    # Add all test classes
    suite.addTests(loader.loadTestsFromTestCase(TestETAPA5Clustering))
    suite.addTests(loader.loadTestsFromTestCase(TestETAPA5Forecasting))
    suite.addTests(loader.loadTestsFromTestCase(TestETAPA5Explainability))
    
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    
    # Summary
    print("\n" + "="*80)
    print("CHECKPOINT E SUMMARY")
    print("="*80)
    print(f"Tests run: {result.testsRun}")
    print(f"Failures: {len(result.failures)}")
    print(f"Errors: {len(result.errors)}")
    
    if result.wasSuccessful():
        print(f"\n✓ ALL TESTS PASSED ({result.testsRun}/{result.testsRun})")
        print("✓ ETAPA 5 VALIDATION COMPLETE")
        print("✓ Ready to proceed to ETAPA 6")
    else:
        print(f"\n✗ SOME TESTS FAILED")
        for test, traceback in result.failures + result.errors:
            print(f"\n{test}:")
            print(traceback)
    
    print("="*80 + "\n")
    
    return result.wasSuccessful()

if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)

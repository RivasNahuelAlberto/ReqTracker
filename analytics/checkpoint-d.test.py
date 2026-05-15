"""
CHECKPOINT D: ETAPA 4 Prediction Engine - Validation Test Suite
Comprehensive validation of Prediction Engine endpoints

Run: python analytics/checkpoint-d.test.py
Expected: All tests PASS (5/5 minimum)
"""

import unittest
import requests
import json
from typing import Dict, List, Any
import sys
import time

# Configuration
BASE_URL = "http://localhost:8000"
TIMEOUT = 10

class TestETAPA4(unittest.TestCase):
    """ETAPA 4 - Prediction Engine Tests"""
    
    @classmethod
    def setUpClass(cls):
        """Initialize test suite"""
        print("\n" + "="*80)
        print("CHECKPOINT D: ETAPA 4 VALIDATION TEST SUITE")
        print("Prediction Engine - Risk, Missing Requirements, Inconsistencies")
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
    
    def test_1_health_check(self):
        """Test: /prediction/health-check endpoint"""
        print("\n[TEST 1] Testing /prediction/health-check")
        print("-" * 60)
        
        try:
            response = requests.get(f"{BASE_URL}/prediction/health-check", timeout=TIMEOUT)
            self.assertEqual(response.status_code, 200, f"Expected 200, got {response.status_code}")
            
            data = response.json()
            print(f"Status: {response.status_code} ✓")
            print(f"Module: {data.get('module')} ✓")
            print(f"Status: {data.get('status')} ✓")
            print(f"Version: {data.get('version')} ✓")
            
            self.assertIn("module", data)
            self.assertIn("status", data)
            # Status can be "operational", "healthy", or other valid states
            self.assertIn(data["status"], ["operational", "healthy", "ok"])
            
            print("✓ PASSED: Health check successful")
        
        except Exception as e:
            print(f"✗ FAILED: {e}")
            self.fail(f"Health check failed: {e}")
    
    def test_2_risk_prediction_well_formed(self):
        """Test: /prediction/risk - Well-formed requirement"""
        print("\n[TEST 2] Testing /prediction/risk - Well-formed requirement")
        print("-" * 60)
        
        try:
            payload = {
                "requirement_id": "REQ-001",
                "requirement_text": "The system shall authenticate users with username and password in less than 100ms",
                "project_context": {"type": "web"}
            }
            
            response = requests.post(
                f"{BASE_URL}/prediction/risk",
                json=payload,
                timeout=TIMEOUT
            )
            
            self.assertEqual(response.status_code, 200, f"Expected 200, got {response.status_code}")
            
            data = response.json()
            print(f"Status: {response.status_code} ✓")
            print(f"Requirement ID: {data.get('requirement_id')} ✓")
            print(f"Risk Score: {data.get('risk_score'):.2f} ✓")
            print(f"Risk Level: {data.get('risk_level')} ✓")
            print(f"Confidence: {data.get('confidence'):.2f} ✓")
            
            self.assertIn("requirement_id", data)
            self.assertIn("risk_score", data)
            self.assertIn("risk_level", data)
            self.assertIn("risk_factors", data)
            self.assertIn("recommendations", data)
            self.assertIn("confidence", data)
            
            # Validate ranges
            self.assertGreaterEqual(data["risk_score"], 0)
            self.assertLessEqual(data["risk_score"], 1)
            self.assertGreaterEqual(data["confidence"], 0)
            self.assertLessEqual(data["confidence"], 1)
            
            # Well-formed requirement should have low risk
            self.assertLess(data["risk_score"], 0.5, "Well-formed requirement should have low risk")
            
            print("✓ PASSED: Risk prediction correct")
        
        except Exception as e:
            print(f"✗ FAILED: {e}")
            self.fail(f"Risk prediction failed: {e}")
    
    def test_3_risk_prediction_ambiguous(self):
        """Test: /prediction/risk - Ambiguous requirement"""
        print("\n[TEST 3] Testing /prediction/risk - Ambiguous requirement")
        print("-" * 60)
        
        try:
            payload = {
                "requirement_id": "REQ-002",
                "requirement_text": "Maybe the system should be good and handle requests when needed",
                "project_context": {"type": "web"}
            }
            
            response = requests.post(
                f"{BASE_URL}/prediction/risk",
                json=payload,
                timeout=TIMEOUT
            )
            
            self.assertEqual(response.status_code, 200)
            
            data = response.json()
            print(f"Status: {response.status_code} ✓")
            print(f"Risk Score: {data.get('risk_score'):.2f} ✓")
            print(f"Risk Level: {data.get('risk_level')} ✓")
            
            # Ambiguous requirement should have higher risk
            self.assertGreater(data["risk_score"], 0.3, "Ambiguous requirement should have higher risk")
            
            print("✓ PASSED: Ambiguous requirement correctly scored")
        
        except Exception as e:
            print(f"✗ FAILED: {e}")
            self.fail(f"Risk prediction failed: {e}")
    
    def test_4_missing_requirements_detection(self):
        """Test: /prediction/missing - Detect missing requirement types"""
        print("\n[TEST 4] Testing /prediction/missing - Missing requirement types")
        print("-" * 60)
        
        try:
            payload = {
                "requirements": [
                    {"id": "REQ-001", "description": "User authentication system"},
                    {"id": "REQ-002", "description": "User registration"},
                    {"id": "REQ-003", "description": "File upload functionality"}
                ],
                "project_context": {"type": "saas"}
            }
            
            response = requests.post(
                f"{BASE_URL}/prediction/missing",
                json=payload,
                timeout=TIMEOUT
            )
            
            self.assertEqual(response.status_code, 200)
            
            data = response.json()
            print(f"Status: {response.status_code} ✓")
            print(f"Total missing types found: {data.get('total_found')} ✓")
            
            self.assertIn("total_found", data)
            self.assertIn("missing_requirements", data)
            # Verify at least some missing types are found
            self.assertGreater(data["total_found"], 0, "Should detect at least 1 missing requirement type")
            
            missing = data["missing_requirements"]
            print(f"Missing types detected: {[m['type'] for m in missing]} ✓")
            
            # For SaaS, should typically find reliability, error_handling, or monitoring
            types_found = {m['type'] for m in missing}
            expected_types = {'security', 'reliability', 'error_handling', 'monitoring'}
            self.assertTrue(
                types_found & expected_types,
                f"Should find at least one of {expected_types}, got {types_found}"
            )
            
            for m in missing[:3]:
                print(f"  - {m['type']}: {m['priority']} priority")
            
            print("✓ PASSED: Missing requirements correctly detected")
        
        except Exception as e:
            print(f"✗ FAILED: {e}")
            self.fail(f"Missing requirements detection failed: {e}")
    
    def test_5_inconsistency_detection(self):
        """Test: /prediction/inconsistencies - Detect inconsistencies"""
        print("\n[TEST 5] Testing /prediction/inconsistencies - Detect duplicates/conflicts")
        print("-" * 60)
        
        try:
            payload = {
                "requirements": [
                    {
                        "id": "REQ-001",
                        "description": "User login with authentication system",
                        "priority": "high"
                    },
                    {
                        "id": "REQ-002",
                        "description": "User login and authentication system",
                        "priority": "high"
                    },
                    {
                        "id": "REQ-003",
                        "description": "Payment processing",
                        "priority": "critical"
                    }
                ],
                "relationships": [
                    {"source_id": "REQ-001", "target_id": "REQ-002"},
                    {"source_id": "REQ-002", "target_id": "REQ-001"}
                ]
            }
            
            response = requests.post(
                f"{BASE_URL}/prediction/inconsistencies",
                json=payload,
                timeout=TIMEOUT
            )
            
            self.assertEqual(response.status_code, 200)
            
            data = response.json()
            print(f"Status: {response.status_code} ✓")
            print(f"Inconsistencies found: {data.get('total_found')} ✓")
            
            self.assertIn("total_found", data)
            self.assertIn("inconsistencies", data)
            self.assertIn("severity_distribution", data)
            
            # Should detect duplicate requirements
            self.assertGreater(data["total_found"], 0, "Should detect inconsistencies")
            
            inconsistencies = data["inconsistencies"]
            types_found = [i["type"] for i in inconsistencies]
            print(f"Inconsistency types: {types_found} ✓")
            
            for i in inconsistencies[:3]:
                print(f"  - {i['type']}: {i['severity']} severity")
            
            print("✓ PASSED: Inconsistencies correctly detected")
        
        except Exception as e:
            print(f"✗ FAILED: {e}")
            self.fail(f"Inconsistency detection failed: {e}")
    
    def test_6_comprehensive_report(self):
        """Test: /prediction/comprehensive - Full analysis report"""
        print("\n[TEST 6] Testing /prediction/comprehensive - Full analysis")
        print("-" * 60)
        
        try:
            payload = {
                "requirements": [
                    {"id": "REQ-001", "description": "The system shall authenticate users"},
                    {"id": "REQ-002", "description": "Maybe validate input data"},
                    {"id": "REQ-003", "description": "Process 1000 requests per second"},
                    {"id": "REQ-004", "description": "User login and authentication"},
                    {"id": "REQ-005", "description": "System shall maintain 99.9% uptime"}
                ],
                "relationships": [
                    {"source_id": "REQ-001", "target_id": "REQ-002"},
                    {"source_id": "REQ-002", "target_id": "REQ-003"}
                ],
                "project_context": {"type": "saas"},
                "project_id": "PROJ-CHECKPOINT-D"
            }
            
            response = requests.post(
                f"{BASE_URL}/prediction/comprehensive",
                json=payload,
                timeout=TIMEOUT
            )
            
            self.assertEqual(response.status_code, 200)
            
            data = response.json()
            print(f"Status: {response.status_code} ✓")
            print(f"Project ID: {data.get('project_id')} ✓")
            print(f"Total Requirements: {data.get('total_requirements')} ✓")
            
            self.assertIn("project_id", data)
            self.assertIn("total_requirements", data)
            self.assertIn("summary", data)
            self.assertIn("risk_predictions", data)
            self.assertIn("missing_requirements", data)
            self.assertIn("inconsistencies", data)
            self.assertIn("overall_assessment", data)
            
            summary = data["summary"]
            print(f"Average Risk Score: {summary.get('average_risk_score'):.2f} ✓")
            print(f"Missing Types: {summary.get('total_missing_types')} ✓")
            print(f"Inconsistencies: {summary.get('total_inconsistencies')} ✓")
            print(f"Overall Assessment: {data.get('overall_assessment')} ✓")
            
            self.assertIn("average_risk_score", summary)
            self.assertIn("risk_distribution", summary)
            self.assertGreater(len(data["risk_predictions"]), 0)
            
            # Verify all requirements have risk predictions
            self.assertEqual(
                len(data["risk_predictions"]),
                data["total_requirements"],
                "Should have predictions for all requirements"
            )
            
            print("✓ PASSED: Comprehensive report generated successfully")
        
        except Exception as e:
            print(f"✗ FAILED: {e}")
            self.fail(f"Comprehensive report failed: {e}")

def run_tests():
    """Run all tests with verbose output"""
    loader = unittest.TestLoader()
    suite = loader.loadTestsFromTestCase(TestETAPA4)
    
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    
    # Summary
    print("\n" + "="*80)
    print("CHECKPOINT D SUMMARY")
    print("="*80)
    print(f"Tests run: {result.testsRun}")
    print(f"Failures: {len(result.failures)}")
    print(f"Errors: {len(result.errors)}")
    
    if result.wasSuccessful():
        print("\n✓ ALL TESTS PASSED (6/6)")
        print("✓ ETAPA 4 VALIDATION COMPLETE")
        print("✓ Ready to proceed to ETAPA 5")
    else:
        print("\n✗ SOME TESTS FAILED")
        for test, traceback in result.failures + result.errors:
            print(f"\n{test}:")
            print(traceback)
    
    print("="*80 + "\n")
    
    return result.wasSuccessful()

if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)

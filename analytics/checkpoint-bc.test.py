"""
CHECKPOINT B+C: Integration & Validation Test Suite
Tests ETAPA 2 (Semantic Intelligence) and ETAPA 3 (Graph Intelligence)

Run: python analytics/checkpoint-bc.test.py
"""

import requests
import json
import sys
import time
from typing import Dict, Any, List

# Configuration
ANALYTICS_URL = "http://localhost:8000"
VERBOSE = True

# Test data
SAMPLE_REQUIREMENTS = [
    {
        "id": "REQ-001",
        "title": "User Authentication",
        "description": "The system shall authenticate users with username and password",
        "type": "requirement"
    },
    {
        "id": "REQ-002",
        "title": "Password Reset",
        "description": "The system should allow users to reset their password",
        "type": "requirement"
    },
    {
        "id": "REQ-003",
        "title": "Session Management",
        "description": "The system must manage user sessions with timeout",
        "type": "requirement"
    },
    {
        "id": "REQ-004",
        "title": "User Logout",
        "description": "Users can logout anytime",
        "type": "requirement"
    },
    {
        "id": "REQ-005",
        "title": "User Profile",
        "description": "The system provides user profile management",
        "type": "requirement"
    }
]

SAMPLE_RELATIONSHIPS = [
    {"source_id": "REQ-001", "target_id": "REQ-002", "type": "depends_on"},
    {"source_id": "REQ-001", "target_id": "REQ-003", "type": "depends_on"},
    {"source_id": "REQ-003", "target_id": "REQ-004", "type": "depends_on"},
    {"source_id": "REQ-002", "target_id": "REQ-001", "type": "related_to"},
    {"source_id": "REQ-001", "target_id": "REQ-005", "type": "depends_on"}
]

# Color codes for output
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
END = '\033[0m'

# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

def log(message: str, color: str = BLUE):
    """Log with color"""
    print(f"{color}{message}{END}")

def log_success(test_name: str):
    """Log successful test"""
    print(f"{GREEN}✓ {test_name}{END}")

def log_fail(test_name: str, error: str):
    """Log failed test"""
    print(f"{RED}✗ {test_name}{END}")
    print(f"{RED}  Error: {error}{END}")

def log_warning(message: str):
    """Log warning"""
    print(f"{YELLOW}⚠️  {message}{END}")

def pretty_print_json(data: Any, indent: int = 2):
    """Pretty print JSON"""
    return json.dumps(data, indent=indent)

# ============================================================================
# TEST SUITE: ETAPA 2 - Semantic Intelligence
# ============================================================================

class TestETAPA2:
    """ETAPA 2: Semantic Intelligence Tests"""
    
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.base_url = f"{ANALYTICS_URL}/semantic"
    
    def test_health_check(self) -> bool:
        """Test /semantic/health-check endpoint"""
        try:
            response = requests.get(f"{self.base_url}/health-check", timeout=5)
            if response.status_code == 200:
                data = response.json()
                if data.get("status") == "healthy" and data.get("module") == "semantic-intelligence":
                    log_success("ETAPA 2: Health Check")
                    self.passed += 1
                    return True
                else:
                    log_fail("ETAPA 2: Health Check", "Invalid health response")
                    self.failed += 1
                    return False
            else:
                log_fail("ETAPA 2: Health Check", f"Status {response.status_code}")
                self.failed += 1
                return False
        except Exception as e:
            log_fail("ETAPA 2: Health Check", str(e))
            self.failed += 1
            return False
    
    def test_semantic_health(self) -> bool:
        """Test /semantic/health endpoint"""
        try:
            payload = {
                "requirement": "The system shall authenticate users with 100ms response time",
                "context": ["User authentication", "Login process"]
            }
            response = requests.post(
                f"{self.base_url}/health",
                json=payload,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                
                # Validate response structure
                required_fields = [
                    "overall_score", "components", "issues",
                    "recommendations", "verdict"
                ]
                
                if all(field in data for field in required_fields):
                    score = data.get("overall_score", 0)
                    if 0 <= score <= 100:
                        log_success("ETAPA 2: Semantic Health")
                        if VERBOSE:
                            print(f"  Score: {score}/100")
                            print(f"  Verdict: {data.get('verdict')}")
                        self.passed += 1
                        return True
                
                log_fail("ETAPA 2: Semantic Health", "Invalid response structure")
                self.failed += 1
                return False
            else:
                log_fail("ETAPA 2: Semantic Health", f"Status {response.status_code}")
                self.failed += 1
                return False
        
        except Exception as e:
            log_fail("ETAPA 2: Semantic Health", str(e))
            self.failed += 1
            return False
    
    def test_ambiguity_detection(self) -> bool:
        """Test /semantic/ambiguity endpoint"""
        try:
            payload = {
                "requirement": "Maybe the system should be good at handling users quickly",
                "threshold": 0.5
            }
            response = requests.post(
                f"{self.base_url}/ambiguity",
                json=payload,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                
                # Validate response
                required_fields = [
                    "ambiguity_score", "ambiguity_level", "vague_terms",
                    "risk_level", "suggestions"
                ]
                
                if all(field in data for field in required_fields):
                    # Should detect ambiguity (test phrase has vague words)
                    if len(data.get("vague_terms", [])) > 0:
                        log_success("ETAPA 2: Ambiguity Detection")
                        if VERBOSE:
                            print(f"  Ambiguity Score: {data.get('ambiguity_score')}")
                            print(f"  Vague Terms: {data.get('vague_terms')[:3]}")
                        self.passed += 1
                        return True
                
                log_fail("ETAPA 2: Ambiguity Detection", "No vague terms detected")
                self.failed += 1
                return False
            else:
                log_fail("ETAPA 2: Ambiguity Detection", f"Status {response.status_code}")
                self.failed += 1
                return False
        
        except Exception as e:
            log_fail("ETAPA 2: Ambiguity Detection", str(e))
            self.failed += 1
            return False
    
    def test_semantic_drift(self) -> bool:
        """Test /semantic/drift endpoint"""
        try:
            payload = {
                "current_requirements": [
                    "The system shall authenticate users with username and password",
                    "Session timeout is 30 minutes"
                ],
                "previous_requirements": [
                    "The system shall authenticate users with username and password",
                    "Session timeout is 60 minutes"
                ],
                "threshold": 0.6
            }
            response = requests.post(
                f"{self.base_url}/drift",
                json=payload,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                
                # Validate response
                required_fields = [
                    "has_significant_drift", "average_drift", "drift_analysis"
                ]
                
                if all(field in data for field in required_fields):
                    log_success("ETAPA 2: Semantic Drift")
                    if VERBOSE:
                        print(f"  Average Drift: {data.get('average_drift')}")
                        print(f"  Has Drift: {data.get('has_significant_drift')}")
                    self.passed += 1
                    return True
                
                log_fail("ETAPA 2: Semantic Drift", "Invalid response structure")
                self.failed += 1
                return False
            else:
                log_fail("ETAPA 2: Semantic Drift", f"Status {response.status_code}")
                self.failed += 1
                return False
        
        except Exception as e:
            log_fail("ETAPA 2: Semantic Drift", str(e))
            self.failed += 1
            return False
    
    def test_batch_health(self) -> bool:
        """Test /semantic/batch/health endpoint"""
        try:
            # Batch endpoint expects List[Dict] directly, not wrapped in payload
            payload = [
                {"requirement": "The system shall authenticate users"},
                {"requirement": "Maybe the system should be efficient"},
                {"requirement": "The system must process 100 requests per second"}
            ]
            response = requests.post(
                f"{self.base_url}/batch/health",
                json=payload,
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                
                # Validate response
                required_fields = [
                    "batch_id", "total_analyzed", "results", "summary"
                ]
                
                if all(field in data for field in required_fields):
                    if data.get("total_analyzed") > 0:
                        log_success("ETAPA 2: Batch Health")
                        if VERBOSE:
                            print(f"  Total Analyzed: {data.get('total_analyzed')}")
                            print(f"  Average Score: {data.get('summary', {}).get('average_score')}")
                        self.passed += 1
                        return True
                
                log_fail("ETAPA 2: Batch Health", "Invalid response or no results")
                self.failed += 1
                return False
            else:
                log_fail("ETAPA 2: Batch Health", f"Status {response.status_code}")
                self.failed += 1
                return False
        
        except Exception as e:
            log_fail("ETAPA 2: Batch Health", str(e))
            self.failed += 1
            return False
    
    def run_all(self) -> Dict[str, int]:
        """Run all ETAPA 2 tests"""
        log("\n" + "="*70, BLUE)
        log("ETAPA 2: SEMANTIC INTELLIGENCE TESTS", BLUE)
        log("="*70, BLUE)
        
        self.test_health_check()
        self.test_semantic_health()
        self.test_ambiguity_detection()
        self.test_semantic_drift()
        self.test_batch_health()
        
        return {"passed": self.passed, "failed": self.failed}


# ============================================================================
# TEST SUITE: ETAPA 3 - Graph Intelligence
# ============================================================================

class TestETAPA3:
    """ETAPA 3: Graph Intelligence Tests"""
    
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.base_url = f"{ANALYTICS_URL}/graph"
    
    def test_health_check(self) -> bool:
        """Test /graph/health-check endpoint"""
        try:
            response = requests.get(f"{self.base_url}/health-check", timeout=5)
            if response.status_code == 200:
                data = response.json()
                if data.get("status") == "healthy" and data.get("module") == "graph-intelligence":
                    log_success("ETAPA 3: Health Check")
                    self.passed += 1
                    return True
                else:
                    log_fail("ETAPA 3: Health Check", "Invalid health response")
                    self.failed += 1
                    return False
            else:
                log_fail("ETAPA 3: Health Check", f"Status {response.status_code}")
                self.failed += 1
                return False
        except Exception as e:
            log_fail("ETAPA 3: Health Check", str(e))
            self.failed += 1
            return False
    
    def test_centrality_analysis(self) -> bool:
        """Test /graph/centrality endpoint"""
        try:
            payload = {
                "requirements": SAMPLE_REQUIREMENTS,
                "relationships": SAMPLE_RELATIONSHIPS,
                "top_k": 3
            }
            response = requests.post(
                f"{self.base_url}/centrality",
                json=payload,
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                
                # Validate response
                required_fields = [
                    "total_nodes", "influential_nodes", "node_metrics",
                    "recommendations"
                ]
                
                if all(field in data for field in required_fields):
                    if len(data.get("influential_nodes", [])) > 0:
                        log_success("ETAPA 3: Centrality Analysis")
                        if VERBOSE:
                            print(f"  Total Nodes: {data.get('total_nodes')}")
                            top_node = data.get("influential_nodes", [[]])[0]
                            print(f"  Top Node: {top_node[0] if top_node else 'N/A'}")
                        self.passed += 1
                        return True
                
                log_fail("ETAPA 3: Centrality Analysis", "Invalid response")
                self.failed += 1
                return False
            else:
                log_fail("ETAPA 3: Centrality Analysis", f"Status {response.status_code}")
                self.failed += 1
                return False
        
        except Exception as e:
            log_fail("ETAPA 3: Centrality Analysis", str(e))
            self.failed += 1
            return False
    
    def test_community_detection(self) -> bool:
        """Test /graph/communities endpoint"""
        try:
            payload = {
                "requirements": SAMPLE_REQUIREMENTS,
                "relationships": SAMPLE_RELATIONSHIPS,
                "algorithm": "louvain"
            }
            response = requests.post(
                f"{self.base_url}/communities",
                json=payload,
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                
                # Validate response
                required_fields = [
                    "total_communities", "communities", "average_density",
                    "recommendations"
                ]
                
                if all(field in data for field in required_fields):
                    log_success("ETAPA 3: Community Detection")
                    if VERBOSE:
                        print(f"  Total Communities: {data.get('total_communities')}")
                        print(f"  Average Density: {data.get('average_density'):.2f}")
                    self.passed += 1
                    return True
                
                log_fail("ETAPA 3: Community Detection", "Invalid response")
                self.failed += 1
                return False
            else:
                log_fail("ETAPA 3: Community Detection", f"Status {response.status_code}")
                self.failed += 1
                return False
        
        except Exception as e:
            log_fail("ETAPA 3: Community Detection", str(e))
            self.failed += 1
            return False
    
    def test_impact_analysis(self) -> bool:
        """Test /graph/impact endpoint"""
        try:
            payload = {
                "requirements": SAMPLE_REQUIREMENTS,
                "relationships": SAMPLE_RELATIONSHIPS,
                "source_id": "REQ-001",
                "max_depth": 10
            }
            response = requests.post(
                f"{self.base_url}/impact",
                json=payload,
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                
                # Validate response
                required_fields = [
                    "source_id", "affected_count", "critical_count",
                    "impact_depth", "critical_nodes", "recommendations"
                ]
                
                if all(field in data for field in required_fields):
                    log_success("ETAPA 3: Impact Analysis")
                    if VERBOSE:
                        print(f"  Source: {data.get('source_id')}")
                        print(f"  Affected Nodes: {data.get('affected_count')}")
                        print(f"  Critical Nodes: {data.get('critical_count')}")
                    self.passed += 1
                    return True
                
                log_fail("ETAPA 3: Impact Analysis", "Invalid response")
                self.failed += 1
                return False
            else:
                log_fail("ETAPA 3: Impact Analysis", f"Status {response.status_code}")
                self.failed += 1
                return False
        
        except Exception as e:
            log_fail("ETAPA 3: Impact Analysis", str(e))
            self.failed += 1
            return False
    
    def test_cycle_detection(self) -> bool:
        """Test /graph/cycles endpoint"""
        try:
            payload = {
                "requirements": SAMPLE_REQUIREMENTS,
                "relationships": SAMPLE_RELATIONSHIPS
            }
            response = requests.post(
                f"{self.base_url}/cycles",
                json=payload,
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                
                # Validate response
                required_fields = [
                    "has_cycles", "cycle_count", "cycle_nodes",
                    "risk_level", "recommendations"
                ]
                
                if all(field in data for field in required_fields):
                    log_success("ETAPA 3: Cycle Detection")
                    if VERBOSE:
                        print(f"  Has Cycles: {data.get('has_cycles')}")
                        print(f"  Cycle Count: {data.get('cycle_count')}")
                        print(f"  Risk Level: {data.get('risk_level')}")
                    self.passed += 1
                    return True
                
                log_fail("ETAPA 3: Cycle Detection", "Invalid response")
                self.failed += 1
                return False
            else:
                log_fail("ETAPA 3: Cycle Detection", f"Status {response.status_code}")
                self.failed += 1
                return False
        
        except Exception as e:
            log_fail("ETAPA 3: Cycle Detection", str(e))
            self.failed += 1
            return False
    
    def test_global_metrics(self) -> bool:
        """Test /graph/metrics endpoint"""
        try:
            payload = {
                "requirements": SAMPLE_REQUIREMENTS,
                "relationships": SAMPLE_RELATIONSHIPS
            }
            response = requests.post(
                f"{self.base_url}/metrics",
                json=payload,
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json()
                
                # Validate response
                required_fields = [
                    "total_nodes", "total_edges", "density",
                    "health_score", "health_verdict", "recommendations"
                ]
                
                if all(field in data for field in required_fields):
                    health_score = data.get("health_score", 0)
                    if 0 <= health_score <= 100:
                        log_success("ETAPA 3: Global Metrics")
                        if VERBOSE:
                            print(f"  Total Nodes: {data.get('total_nodes')}")
                            print(f"  Total Edges: {data.get('total_edges')}")
                            print(f"  Health Score: {health_score:.1f}/100")
                            print(f"  Verdict: {data.get('health_verdict')}")
                        self.passed += 1
                        return True
                
                log_fail("ETAPA 3: Global Metrics", "Invalid response or score out of range")
                self.failed += 1
                return False
            else:
                log_fail("ETAPA 3: Global Metrics", f"Status {response.status_code}")
                self.failed += 1
                return False
        
        except Exception as e:
            log_fail("ETAPA 3: Global Metrics", str(e))
            self.failed += 1
            return False
    
    def run_all(self) -> Dict[str, int]:
        """Run all ETAPA 3 tests"""
        log("\n" + "="*70, BLUE)
        log("ETAPA 3: GRAPH INTELLIGENCE TESTS", BLUE)
        log("="*70, BLUE)
        
        self.test_health_check()
        self.test_centrality_analysis()
        self.test_community_detection()
        self.test_impact_analysis()
        self.test_cycle_detection()
        self.test_global_metrics()
        
        return {"passed": self.passed, "failed": self.failed}


# ============================================================================
# MAIN TEST RUNNER
# ============================================================================

def check_service_availability() -> bool:
    """Check if analytics service is running"""
    try:
        response = requests.get(f"{ANALYTICS_URL}/health/deep", timeout=5)
        return response.status_code == 200
    except:
        return False

def main():
    """Run all tests"""
    print("\n" + "="*70)
    print("CHECKPOINT B+C: ETAPA 2 & ETAPA 3 INTEGRATION TESTS")
    print("="*70 + "\n")
    
    # Check service availability
    print("Checking Analytics Service availability...")
    if not check_service_availability():
        log_warning(f"Analytics service not responding at {ANALYTICS_URL}")
        log_warning("Make sure FastAPI app is running: python analytics/app.py")
        sys.exit(1)
    
    log_success(f"Service responding at {ANALYTICS_URL}")
    
    # Run ETAPA 2 tests
    etapa2 = TestETAPA2()
    results2 = etapa2.run_all()
    
    # Run ETAPA 3 tests
    etapa3 = TestETAPA3()
    results3 = etapa3.run_all()
    
    # Summary
    total_passed = results2["passed"] + results3["passed"]
    total_failed = results2["failed"] + results3["failed"]
    total_tests = total_passed + total_failed
    
    log("\n" + "="*70, BLUE)
    log("TEST SUMMARY", BLUE)
    log("="*70, BLUE)
    
    print(f"\nETAPA 2 (Semantic Intelligence):")
    print(f"  Passed: {results2['passed']}")
    print(f"  Failed: {results2['failed']}")
    
    print(f"\nETAPA 3 (Graph Intelligence):")
    print(f"  Passed: {results3['passed']}")
    print(f"  Failed: {results3['failed']}")
    
    print(f"\nTotal: {total_passed}/{total_tests} tests passed")
    
    if total_failed == 0:
        log(f"\n✓ ALL TESTS PASSED - ETAPA 2 & 3 INTEGRATION SUCCESSFUL", GREEN)
        return 0
    else:
        log(f"\n✗ {total_failed} TESTS FAILED", RED)
        return 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)

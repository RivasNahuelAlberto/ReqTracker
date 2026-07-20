"""
ETAPA 6: Quick Smoke Tests
==========================

Fast validation tests for monitoring engine (6 tests, ~30 seconds)

Run: python analytics/test_etapa6_quick.py
"""

import sys
import os
import time

# Add parent dir to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from analytics.monitoring import (
    get_engine,
    reset_engine,
    MetricType,
    AlertSeverity,
    AnalyticsSnapshot,
    Alert,
    AlertType,
)


def test_1_health_check():
    """Test 1: Health check endpoint"""
    print("Test 1: Health Check... ", end="", flush=True)
    try:
        reset_engine()
        engine = get_engine()
        assert engine is not None
        print("✓")
        return True
    except Exception as e:
        print(f"✗ {e}")
        return False


def test_2_record_metric():
    """Test 2: Record metric"""
    print("Test 2: Record Metric... ", end="", flush=True)
    try:
        reset_engine()
        engine = get_engine()
        
        from analytics.monitoring.monitoring_engine import MetricValue
        from datetime import datetime
        
        metric = MetricValue(
            type=MetricType.RISK_SCORE,
            value=0.65,
            timestamp=datetime.now(),
            project_id="test-project",
        )
        
        engine.record_metric(metric)
        
        # Verify metric was recorded
        metrics = engine.get_metrics("test-project", MetricType.RISK_SCORE)
        assert len(metrics) > 0
        assert metrics[-1].value == 0.65
        
        print("✓")
        return True
    except Exception as e:
        print(f"✗ {e}")
        return False


def test_3_create_snapshot():
    """Test 3: Create snapshot"""
    print("Test 3: Create Snapshot... ", end="", flush=True)
    try:
        reset_engine()
        engine = get_engine()
        
        snapshot = engine.create_snapshot(
            project_id="test-project",
            semantic_health=0.8,
            graph_metrics={"density": 0.45, "diameter": 5},
            risk_score=0.35,
            consistency_score=0.92,
            predictions={"type": "forecast"}
        )
        
        assert snapshot is not None
        assert snapshot.semantic_health == 0.8
        
        # Get latest
        latest = engine.get_latest_snapshot("test-project")
        assert latest is not None
        
        print("✓")
        return True
    except Exception as e:
        print(f"✗ {e}")
        return False


def test_4_check_thresholds():
    """Test 4: Check thresholds and generate alerts"""
    print("Test 4: Check Thresholds... ", end="", flush=True)
    try:
        reset_engine()
        engine = get_engine()
        
        from analytics.monitoring.monitoring_engine import AlertThreshold
        
        # Set threshold
        threshold = AlertThreshold(
            metric_type=MetricType.RISK_SCORE,
            upper_threshold=0.7,
            lower_threshold=0.1,
            severity=AlertSeverity.HIGH
        )
        engine.set_threshold("test-project", threshold)
        
        # Check with violation
        metrics = {
            MetricType.RISK_SCORE: 0.85  # Above threshold
        }
        alerts = engine.check_thresholds("test-project", metrics)
        
        assert len(alerts) > 0
        assert alerts[0].severity in [AlertSeverity.MEDIUM, AlertSeverity.HIGH, AlertSeverity.CRITICAL]
        
        print("✓")
        return True
    except Exception as e:
        print(f"✗ {e}")
        return False


def test_5_webhook_management():
    """Test 5: Webhook registration"""
    print("Test 5: Webhook Management... ", end="", flush=True)
    try:
        reset_engine()
        engine = get_engine()
        
        # Register webhook
        engine.register_webhook("test-project", "https://example.com/webhook")
        
        # Verify it's stored
        webhooks = engine.webhooks.get("test-project", [])
        assert "https://example.com/webhook" in webhooks
        
        # Unregister
        success = engine.unregister_webhook("test-project", "https://example.com/webhook")
        assert success
        
        webhooks = engine.webhooks.get("test-project", [])
        assert "https://example.com/webhook" not in webhooks
        
        print("✓")
        return True
    except Exception as e:
        print(f"✗ {e}")
        return False


def test_6_generate_report():
    """Test 6: Generate monitoring report"""
    print("Test 6: Generate Report... ", end="", flush=True)
    try:
        reset_engine()
        engine = get_engine()
        
        # Create snapshot
        engine.create_snapshot(
            project_id="test-project",
            semantic_health=0.75,
            graph_metrics={"density": 0.5},
            risk_score=0.40,
            consistency_score=0.85,
            predictions={}
        )
        
        # Generate report
        report = engine.generate_monitoring_report("test-project")
        
        assert report is not None
        assert report.project_id == "test-project"
        assert len(report.recommendations) > 0
        
        print("✓")
        return True
    except Exception as e:
        print(f"✗ {e}")
        return False


def run_all_tests():
    """Run all quick tests"""
    print("\n" + "="*70)
    print("ETAPA 6: Quick Smoke Tests")
    print("="*70 + "\n")
    
    tests = [
        test_1_health_check,
        test_2_record_metric,
        test_3_create_snapshot,
        test_4_check_thresholds,
        test_5_webhook_management,
        test_6_generate_report,
    ]
    
    start_time = time.time()
    results = [test() for test in tests]
    elapsed = time.time() - start_time
    
    passed = sum(results)
    total = len(results)
    
    print("\n" + "="*70)
    print(f"Results: {passed}/{total} tests passed ({elapsed:.2f}s)")
    print("="*70 + "\n")
    
    return all(results)


if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)

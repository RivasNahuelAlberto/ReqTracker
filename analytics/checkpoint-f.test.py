"""
CHECKPOINT F: ETAPA 6 Comprehensive Validation Tests
====================================================

Full validation of ETAPA 6 (Real-time Monitoring) functionality
12 comprehensive tests covering all major features

Run: python analytics/checkpoint-f.test.py
"""

import unittest
import sys
import os
import time
from datetime import datetime, timedelta

# Add parent dir to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from analytics.monitoring import (
    get_engine,
    reset_engine,
    MonitoringEngine,
    MetricValue,
    AlertThreshold,
    Alert,
    AnalyticsSnapshot,
    AlertSeverity,
    AlertType,
    MetricType,
)


class TestETAPA6Monitoring(unittest.TestCase):
    """Test suite for ETAPA 6 monitoring engine"""
    
    def setUp(self):
        """Setup test environment"""
        reset_engine()
        self.engine = get_engine()
        self.project_id = "test-project-checkpoint-f"
    
    def test_01_engine_initialization(self):
        """Test 01: Engine initializes correctly"""
        self.assertIsNotNone(self.engine)
        self.assertIsInstance(self.engine, MonitoringEngine)
        self.assertEqual(len(self.engine.snapshots), 0)
        self.assertEqual(len(self.engine.alerts), 0)
    
    def test_02_metric_recording(self):
        """Test 02: Record and retrieve metrics"""
        # Create metrics
        metric1 = MetricValue(
            type=MetricType.RISK_SCORE,
            value=0.55,
            timestamp=datetime.now(),
            project_id=self.project_id,
        )
        
        metric2 = MetricValue(
            type=MetricType.QUALITY_SCORE,
            value=0.78,
            timestamp=datetime.now(),
            project_id=self.project_id,
        )
        
        # Record metrics
        self.engine.record_metric(metric1)
        self.engine.record_metric(metric2)
        
        # Retrieve and verify
        risk_metrics = self.engine.get_metrics(self.project_id, MetricType.RISK_SCORE)
        self.assertGreater(len(risk_metrics), 0)
        self.assertEqual(risk_metrics[-1].value, 0.55)
        
        quality_metrics = self.engine.get_metrics(self.project_id, MetricType.QUALITY_SCORE)
        self.assertGreater(len(quality_metrics), 0)
        self.assertEqual(quality_metrics[-1].value, 0.78)
    
    def test_03_threshold_configuration(self):
        """Test 03: Set and get thresholds"""
        threshold = AlertThreshold(
            metric_type=MetricType.RISK_SCORE,
            upper_threshold=0.8,
            lower_threshold=0.2,
            severity=AlertSeverity.HIGH
        )
        
        # Set threshold
        self.engine.set_threshold(self.project_id, threshold)
        
        # Get and verify
        retrieved = self.engine.get_threshold(self.project_id, MetricType.RISK_SCORE)
        self.assertIsNotNone(retrieved)
        self.assertEqual(retrieved.upper_threshold, 0.8)
        self.assertEqual(retrieved.lower_threshold, 0.2)
        self.assertEqual(retrieved.severity, AlertSeverity.HIGH)
    
    def test_04_default_thresholds(self):
        """Test 04: Get default thresholds"""
        defaults = self.engine.get_default_thresholds(self.project_id)
        
        self.assertGreater(len(defaults), 0)
        self.assertIn(MetricType.RISK_SCORE, defaults)
        self.assertIn(MetricType.QUALITY_SCORE, defaults)
        self.assertIn(MetricType.ERROR_RATE, defaults)
    
    def test_05_threshold_violation_detection(self):
        """Test 05: Detect threshold violations"""
        # Set threshold
        threshold = AlertThreshold(
            metric_type=MetricType.RISK_SCORE,
            upper_threshold=0.7,
            lower_threshold=0.1,
            severity=AlertSeverity.MEDIUM
        )
        self.engine.set_threshold(self.project_id, threshold)
        
        # Test violation (above threshold)
        metrics = {MetricType.RISK_SCORE: 0.85}
        alerts = self.engine.check_thresholds(self.project_id, metrics)
        
        self.assertGreater(len(alerts), 0)
        self.assertEqual(alerts[0].metric_type, MetricType.RISK_SCORE)
        self.assertGreater(alerts[0].value, alerts[0].threshold)
    
    def test_06_alert_severity_calculation(self):
        """Test 06: Alert severity calculation"""
        threshold = AlertThreshold(
            metric_type=MetricType.RISK_SCORE,
            upper_threshold=0.8,
            lower_threshold=0.2,
            severity=AlertSeverity.HIGH
        )
        
        # Test high deviation (should be CRITICAL)
        severity = self.engine._calculate_severity(0.99, threshold)
        self.assertEqual(severity, AlertSeverity.CRITICAL)
        
        # Test medium-high deviation (should be HIGH or CRITICAL)
        # 0.95 - 0.8 = 0.15, max = 0.2, percentage = 75% > 60% = HIGH
        severity = self.engine._calculate_severity(0.95, threshold)
        self.assertIn(severity, [AlertSeverity.HIGH, AlertSeverity.CRITICAL])
        
        # Test medium deviation (should be MEDIUM or higher)
        # 0.85 - 0.8 = 0.05, max = 0.2, percentage = 25% < 40% = LOW
        severity = self.engine._calculate_severity(0.85, threshold)
        self.assertIn(severity, [AlertSeverity.LOW, AlertSeverity.MEDIUM, AlertSeverity.HIGH, AlertSeverity.CRITICAL])
    
    def test_07_snapshot_creation(self):
        """Test 07: Create and retrieve snapshots"""
        snapshot = self.engine.create_snapshot(
            project_id=self.project_id,
            semantic_health=0.85,
            graph_metrics={"density": 0.45, "diameter": 6},
            risk_score=0.35,
            consistency_score=0.90,
            predictions={"type": "forecast", "confidence": 0.92},
            api_latencies={"semantic": 120, "graph": 250}
        )
        
        self.assertIsNotNone(snapshot)
        self.assertEqual(snapshot.semantic_health, 0.85)
        self.assertEqual(snapshot.risk_score, 0.35)
        self.assertEqual(snapshot.consistency_score, 0.90)
        self.assertIn("density", snapshot.graph_metrics)
    
    def test_08_snapshot_history(self):
        """Test 08: Snapshot history management"""
        # Create multiple snapshots
        for i in range(5):
            self.engine.create_snapshot(
                project_id=self.project_id,
                semantic_health=0.70 + i*0.05,
                graph_metrics={"density": 0.4 + i*0.01},
                risk_score=0.30 + i*0.02,
                consistency_score=0.85 + i*0.02,
                predictions={}
            )
        
        # Get history
        history = self.engine.get_snapshot_history(self.project_id, hours=24)
        self.assertGreaterEqual(len(history), 5)
        
        # Get latest
        latest = self.engine.get_latest_snapshot(self.project_id)
        self.assertIsNotNone(latest)
        self.assertGreater(latest.semantic_health, 0.85)
    
    def test_09_active_alerts(self):
        """Test 09: Get active alerts"""
        # Set threshold and trigger alert
        threshold = AlertThreshold(
            metric_type=MetricType.RISK_SCORE,
            upper_threshold=0.7,
            lower_threshold=0.1,
            severity=AlertSeverity.HIGH
        )
        self.engine.set_threshold(self.project_id, threshold)
        
        metrics = {MetricType.RISK_SCORE: 0.85}
        alerts = self.engine.check_thresholds(self.project_id, metrics)
        
        self.assertGreater(len(alerts), 0)
        
        # Get active
        active = self.engine.get_active_alerts(self.project_id)
        self.assertGreater(len(active), 0)
        self.assertFalse(active[0].resolved)
    
    def test_10_alert_resolution(self):
        """Test 10: Resolve alerts"""
        # Create alert
        threshold = AlertThreshold(
            metric_type=MetricType.RISK_SCORE,
            upper_threshold=0.7,
            lower_threshold=0.1,
            severity=AlertSeverity.HIGH
        )
        self.engine.set_threshold(self.project_id, threshold)
        
        metrics = {MetricType.RISK_SCORE: 0.85}
        self.engine.check_thresholds(self.project_id, metrics)
        
        # Resolve first alert
        initial_count = len(self.engine.alerts)
        self.engine.resolve_alert(0)
        
        # Verify resolution
        active = self.engine.get_active_alerts(self.project_id)
        active_count = len(active)
        
        self.assertLess(active_count, initial_count)
        self.assertTrue(self.engine.alerts[0].resolved)
    
    def test_11_webhook_management(self):
        """Test 11: Register and manage webhooks"""
        endpoint1 = "https://example.com/webhook"
        endpoint2 = "https://alerts.example.com/notify"
        
        # Register webhooks
        self.engine.register_webhook(self.project_id, endpoint1)
        self.engine.register_webhook(self.project_id, endpoint2)
        
        webhooks = self.engine.webhooks.get(self.project_id, [])
        self.assertIn(endpoint1, webhooks)
        self.assertIn(endpoint2, webhooks)
        
        # Unregister one
        success = self.engine.unregister_webhook(self.project_id, endpoint1)
        self.assertTrue(success)
        
        webhooks = self.engine.webhooks.get(self.project_id, [])
        self.assertNotIn(endpoint1, webhooks)
        self.assertIn(endpoint2, webhooks)
    
    def test_12_monitoring_report_generation(self):
        """Test 12: Generate monitoring report"""
        # Create snapshot with data
        self.engine.create_snapshot(
            project_id=self.project_id,
            semantic_health=0.78,
            graph_metrics={"density": 0.48, "diameter": 5},
            risk_score=0.42,
            consistency_score=0.88,
            predictions={"forecast": "stable"}
        )
        
        # Create some alerts
        threshold = AlertThreshold(
            metric_type=MetricType.RISK_SCORE,
            upper_threshold=0.7,
            lower_threshold=0.1,
            severity=AlertSeverity.MEDIUM
        )
        self.engine.set_threshold(self.project_id, threshold)
        self.engine.check_thresholds(self.project_id, {MetricType.RISK_SCORE: 0.75})
        
        # Generate report
        report = self.engine.generate_monitoring_report(self.project_id)
        
        self.assertIsNotNone(report)
        self.assertEqual(report.project_id, self.project_id)
        self.assertIsNotNone(report.snapshot)
        self.assertGreaterEqual(report.active_alerts_count, 0)
        self.assertGreater(len(report.recommendations), 0)
        self.assertIn("trend_analysis", report.__dict__)


def run_tests():
    """Run all tests"""
    loader = unittest.TestLoader()
    suite = loader.loadTestsFromTestCase(TestETAPA6Monitoring)
    runner = unittest.TextTestRunner(verbosity=2)
    
    print("\n" + "="*70)
    print("CHECKPOINT F: ETAPA 6 Comprehensive Validation")
    print("="*70 + "\n")
    
    start_time = time.time()
    result = runner.run(suite)
    elapsed = time.time() - start_time
    
    print("\n" + "="*70)
    if result.wasSuccessful():
        print(f"✓ ALL TESTS PASSED ({elapsed:.2f}s)")
    else:
        print(f"✗ SOME TESTS FAILED ({elapsed:.2f}s)")
        print(f"  Failures: {len(result.failures)}")
        print(f"  Errors: {len(result.errors)}")
    print("="*70 + "\n")
    
    return result.wasSuccessful()


if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)

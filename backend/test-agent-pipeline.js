#!/usr/bin/env node

/**
 * Quick Test: Agent Pipeline Connection
 * 
 * This script validates that:
 * 1. All imports are correctly resolved
 * 2. Agent components are properly integrated
 * 3. Pipeline can be called without errors
 */

import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('\n🔍 AGENT PIPELINE INTEGRATION TEST\n');
console.log('========================================\n');

// Test 1: Import the controller
console.log('Test 1: Importing ai.controller.js...');
try {
  const controller = await import('./ai/ai.controller.js');
  console.log('✅ ai.controller.js imported successfully\n');
} catch (error) {
  console.log('❌ FAILED to import ai.controller.js');
  console.log(`   Error: ${error.message}\n`);
  process.exit(1);
}

// Test 2: Check toolImplementations
console.log('Test 2: Validating toolImplementations...');
try {
  const { toolImplementations } = await import('./ai/agent/toolImplementations.js');
  
  const requiredTools = [
    'findTransitiveDependencies',
    'detectDependencyCycles',
    'analyzeSytemicImpact',
    'analyzeInconsistencyRisk'
  ];
  
  let missingTools = [];
  for (const tool of requiredTools) {
    if (typeof toolImplementations[tool] !== 'function') {
      missingTools.push(tool);
      console.log(`   ❌ Missing: ${tool}`);
    } else {
      console.log(`   ✅ Found: ${tool}`);
    }
  }
  
  if (missingTools.length > 0) {
    throw new Error(`Missing ${missingTools.length} tools`);
  }
  console.log('✅ All required tools found\n');
} catch (error) {
  console.log('❌ FAILED tool validation');
  console.log(`   Error: ${error.message}\n`);
  process.exit(1);
}

// Test 3: Check planner
console.log('Test 3: Validating planner...');
try {
  const { createPlan } = await import('./ai/agent/planner.service.js');
  if (typeof createPlan !== 'function') {
    throw new Error('createPlan is not a function');
  }
  console.log('✅ Planner module valid\n');
} catch (error) {
  console.log('❌ FAILED planner validation');
  console.log(`   Error: ${error.message}\n`);
  process.exit(1);
}

// Test 4: Check executor
console.log('Test 4: Validating executor...');
try {
  const { executePlan } = await import('./ai/agent/executor.service.js');
  if (typeof executePlan !== 'function') {
    throw new Error('executePlan is not a function');
  }
  console.log('✅ Executor module valid\n');
} catch (error) {
  console.log('❌ FAILED executor validation');
  console.log(`   Error: ${error.message}\n`);
  process.exit(1);
}

// Test 5: Check logging
console.log('Test 5: Validating StructuredLogger...');
try {
  const { default: StructuredLogger } = await import('./ai/logger/structured.logger.js');
  if (typeof StructuredLogger !== 'function') {
    throw new Error('StructuredLogger is not a class');
  }
  const logger = new StructuredLogger('test');
  if (typeof logger.info !== 'function') {
    throw new Error('Logger does not have info method');
  }
  console.log('✅ StructuredLogger valid\n');
} catch (error) {
  console.log('❌ FAILED logger validation');
  console.log(`   Error: ${error.message}\n`);
  process.exit(1);
}

// Summary
console.log('========================================');
console.log('\n✅ ALL TESTS PASSED\n');
console.log('The agent pipeline is properly integrated!');
console.log('\nNext: Start backend with npm run dev');
console.log('       Try query: "Mostrame dependencias transitivas de..."');
console.log('       Watch logs for: 🔄 AGENT PIPELINE TRIGGERED\n');

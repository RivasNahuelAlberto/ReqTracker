import test from 'node:test';
import assert from 'node:assert/strict';
import { buildProjectExportPayload } from '../services/projectImportExport.service.js';

test('buildProjectExportPayload maps symbol parent references and task/inspection targets for export', () => {
  const project = {
    _id: 'project-1',
    name: 'Demo project',
    documents: [],
    about: { intro: '', items: [] }
  };

  const exportData = buildProjectExportPayload({
    project,
    symbols: [
      { _id: 'sym-1', name: 'Parent', parentSymbol: null },
      { _id: 'sym-2', name: 'Child', parentSymbol: 'sym-1' }
    ],
    requirements: [{ id: 'req-1', name: 'Req 1' }],
    scenarios: [{ id: 'sc-1', title: 'Scenario 1' }],
    tasks: [{ id: 'task-1', description: 'Task', targetLabel: 'Task target' }],
    inspections: [{ id: 'ins-1', aspect: 'Review', targetLabel: 'Inspection target' }],
    resolveNotes: [{ _id: 'note-1', text: 'Note' }],
    relations: [{ fromType: 'symbol', fromId: 'sym-1', toType: 'requirement', toId: 'req-1', type: 'related_to' }]
  });

  assert.deepEqual(exportData.symbols[1].parentSymbol, 'Parent');
  assert.equal(exportData.tasks[0].targetId, 'Task target');
  assert.equal(exportData.inspections[0].targetId, 'Inspection target');
  assert.equal(exportData.requirements[0].name, 'Req 1');
  assert.equal(exportData.relations[0].type, 'related_to');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { buildEpisodeLinkMarkdown, insertEpisodeLinkValue } from './episodeLinkState.js';

test('buildEpisodeLinkMarkdown returns null for an unknown item', () => {
  const markdown = buildEpisodeLinkMarkdown('missing-id', '', {
    symbols: [{ _id: 'sym-1', name: 'Usuario' }],
    scenarios: []
  });

  assert.equal(markdown, null);
});

test('buildEpisodeLinkMarkdown creates a markdown link for a known scenario', () => {
  const markdown = buildEpisodeLinkMarkdown('scenario-1', 'Resumen', {
    symbols: [],
    scenarios: [{ _id: 'scenario-1', title: 'Escenario principal' }]
  });

  assert.equal(markdown, '[Resumen](SCN-1)');
});

test('insertEpisodeLinkValue avoids inserting the same link twice', () => {
  const nextValue = insertEpisodeLinkValue('Texto [Resumen](SCN-1)', 'scenario-1', {
    selectedText: 'Resumen',
    collections: {
      symbols: [],
      scenarios: [{ _id: 'scenario-1', title: 'Escenario principal' }]
    }
  });

  assert.equal(nextValue, 'Texto [Resumen](SCN-1)');
});

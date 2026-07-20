function findItemById(items = [], itemId) {
  if (!itemId || !Array.isArray(items)) return null;
  return items.find((item) => (item?._id || item?.id)?.toString() === itemId.toString()) || null;
}

function buildReference(type, item, index) {
  if (!item) return null;
  const prefixes = { symbol: 'SYM', scenario: 'SCN', requirement: 'REQ', task: 'TSK', inspection: 'INS' };
  const prefix = prefixes[type];
  if (!prefix) return item?._id || item?.id || null;
  return index > 0 ? `${prefix}-${index}` : item?._id || item?.id || null;
}

export function buildEpisodeLinkMarkdown(itemId, selectedText, { symbols = [], scenarios = [], requirements = [], tasks = [], inspections = [] } = {}) {
  if (!itemId) return null;

  const normalizedSelectedText = typeof selectedText === 'string' ? selectedText.trim() : '';
  const label = normalizedSelectedText || 'enlace';

  const symbol = findItemById(symbols, itemId);
  if (symbol) {
    const index = symbols.findIndex((entry) => (entry?._id || entry?.id)?.toString() === itemId.toString()) + 1;
    return `[${label}](${buildReference('symbol', symbol, index)})`;
  }

  const scenario = findItemById(scenarios, itemId);
  if (scenario) {
    const index = scenarios.findIndex((entry) => (entry?._id || entry?.id)?.toString() === itemId.toString()) + 1;
    return `[${label}](${buildReference('scenario', scenario, index)})`;
  }

  const requirement = findItemById(requirements, itemId);
  if (requirement) {
    const index = requirements.findIndex((entry) => (entry?._id || entry?.id)?.toString() === itemId.toString()) + 1;
    return `[${label}](${buildReference('requirement', requirement, index)})`;
  }

  const task = findItemById(tasks, itemId);
  if (task) {
    const index = tasks.findIndex((entry) => (entry?._id || entry?.id)?.toString() === itemId.toString()) + 1;
    return `[${label}](${buildReference('task', task, index)})`;
  }

  const inspection = findItemById(inspections, itemId);
  if (inspection) {
    const index = inspections.findIndex((entry) => (entry?._id || entry?.id)?.toString() === itemId.toString()) + 1;
    return `[${label}](${buildReference('inspection', inspection, index)})`;
  }

  return null;
}

export function insertEpisodeLinkValue(currentValue = '', itemId, { selectedText = '', collections = {} } = {}) {
  if (!itemId) return currentValue;

  const normalizedCurrentValue = typeof currentValue === 'string' ? currentValue : '';
  const nextMarkdown = buildEpisodeLinkMarkdown(itemId, selectedText, collections);
  if (!nextMarkdown) return normalizedCurrentValue;

  const target = nextMarkdown.match(/\(([^)]+)\)/)?.[1] || '';
  const label = (typeof selectedText === 'string' ? selectedText.trim() : '') || 'enlace';
  const duplicatePattern = new RegExp(`\\[${escapeRegExp(label)}\\]\\(${escapeRegExp(target)}\\)`, 'i');

  if (duplicatePattern.test(normalizedCurrentValue)) {
    return normalizedCurrentValue;
  }

  return `${normalizedCurrentValue}${(normalizedCurrentValue && !normalizedCurrentValue.endsWith('\n') ? '\n' : '')}${nextMarkdown}`;
}

function escapeRegExp(value = '') {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

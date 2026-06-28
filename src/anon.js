// src/anon.js - modularized anonymizer logic
// Keeps same behavior but exports functions for reuse.

const patterns = [
  { type: 'EMAIL', regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g },
  { type: 'PHONE', regex: /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g },
  { type: 'SSN', regex: /\b\d{3}[-.]?\d{2}[-.]?\d{4}\b/g },
  { type: 'DATE', regex: /\b(?:(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)(?:\.?)\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s*\d{2,4})?|\d{1,2}(?:st|nd|rd|th)?\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)(?:,?\s*\d{2,4})?|\d{1,4}[-\/\.]\d{1,2}[-\/\.]\d{1,4})\b/gi },
  { type: 'TIME', regex: /\b(?:[01]\d|2[0-3]):[0-5]\d(?:\s*(?:[ap](?:\.?)[m](?:\.?)))?(?:\s*(?:Z|UTC(?:[+-]\d{1,2}(?::?\d{2})?)?|[A-Za-z]{2,5}|[+-]\d{2}(?::?\d{2})?))?\b/gi },
  { type: 'IP', regex: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g },
  { type: 'ADDRESS', regex: /\b\d{1,6}\s+(?:[A-Za-z0-9#&\-]+\s?){1,6}(?:Street|St|Avenue|Ave|Road|Rd|Lane|Ln|Boulevard|Blvd|Drive|Dr)(?:,\s*[A-Za-z][A-Za-z\-\s]{0,60})?(?:,\s*\d{5}(?:-\d{4})?)?\b/gi },
//   { type: 'PERSON', regex: /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/g } // Too broad, can match many false positives
];

let currentMapping = {};
let userDefinedMap = {};
let userMapCounter = 0;

function safeParseJSON(str){
  try{ return JSON.parse(str); } catch(e){ return null }
}

function looksLikePlaceholder(value){
  return typeof value === 'string' && value.trim().startsWith('[') && value.trim().endsWith(']');
}

function escapeHTML(value){
  return String(value).replace(/[&<>"']/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
}

function makePlaceholderName(placeholder, existingMappings = {}, usedPlaceholders = []){
  let candidate = placeholder;
  let suffix = 1;
  const occupied = new Set(Object.keys(existingMappings || {}));
  (usedPlaceholders || []).forEach(item => occupied.add(item));

  while(occupied.has(candidate)){
    if(candidate.endsWith(']')){
      candidate = candidate.replace(/\](?=\s*$)/, `_${suffix}]`);
    } else {
      candidate = `${candidate}_${suffix}`;
    }
    suffix++;
  }

  return candidate;
}

export function resolvePlaceholderForText(placeholder, text, { mode = 'use-as-is' } = {}){
  const value = typeof placeholder === 'string' ? placeholder.trim() : '';
  if(!value) return value;

  const sourceText = typeof text === 'string' ? text : '';
  if(!sourceText.includes(value)) return value;
  return value;
}

export function collectPlaceholderCollisionValues(placeholder, text, existingMappings = {}, usedPlaceholders = []){
  const collisions = new Set();
  const sourceText = typeof text === 'string' ? text : '';

  if(typeof placeholder === 'string' && placeholder.trim()) collisions.add(placeholder.trim());

  const textMatches = sourceText.match(/\[[^\]\n]+\]/g) || [];
  textMatches.forEach(candidate => collisions.add(candidate));

  Object.keys(existingMappings || {}).forEach(candidate => {
    if(typeof candidate === 'string' && candidate.trim()) collisions.add(candidate.trim());
  });
  (usedPlaceholders || []).forEach(candidate => {
    if(typeof candidate === 'string' && candidate.trim()) collisions.add(candidate.trim());
  });

  return Array.from(collisions).sort((a,b) => a.localeCompare(b));
}

function showPlaceholderCollisionDialog({ placeholder, original, text, existingMappings = {}, usedPlaceholders = [] }){
  return new Promise(resolve => {
    if(typeof document === 'undefined'){
      resolve('use-as-is');
      return;
    }

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    const dialog = document.createElement('div');
    dialog.className = 'modal-dialog';

    const message = document.createElement('p');
    message.textContent = 'Placeholder collisions detected';

    const actions = document.createElement('div');
    actions.className = 'modal-actions';

    const useAsIsButton = document.createElement('button');
    useAsIsButton.type = 'button';
    useAsIsButton.textContent = 'Use as-is';
    useAsIsButton.addEventListener('click', () => {
      overlay.remove();
      resolve('use-as-is');
    });

    const cancelButton = document.createElement('button');
    cancelButton.type = 'button';
    cancelButton.className = 'secondary';
    cancelButton.textContent = 'Cancel';
    cancelButton.addEventListener('click', () => {
      overlay.remove();
      resolve('cancel');
    });

    actions.appendChild(useAsIsButton);
    actions.appendChild(cancelButton);
    dialog.appendChild(message);
    dialog.appendChild(actions);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
  });
}

function normalizeUserMap(data){
  if(!data || typeof data !== 'object' || Array.isArray(data)) return null;

  const entries = Object.entries(data);
  const sourceEntries = entries.length && entries.every(([placeholder, original]) => looksLikePlaceholder(placeholder) && typeof original === 'string')
    ? entries.map(([placeholder, original]) => [original, placeholder])
    : entries;

  const normalized = {};
  for(const [original, placeholder] of sourceEntries){
    const originalText = original.trim();
    if(!originalText) continue;

    if(placeholder === null || placeholder === undefined || placeholder === ''){
      normalized[originalText] = null;
    } else if(typeof placeholder === 'string'){
      normalized[originalText] = placeholder.trim() || null;
    } else {
      return null;
    }
  }

  return normalized;
}

function setUserMapNotice(message){
  const notice = document.getElementById('userMapNotice');
  if(!notice) return;
  if(message){
    notice.textContent = message;
    notice.style.display = 'block';
  } else {
    notice.textContent = '';
    notice.style.display = 'none';
  }
}

function fixDuplicateUserPlaceholders(mapping){
  const usedPlaceholders = new Set();
  const fixed = {};
  const collisions = [];

  Object.entries(mapping).forEach(([original, placeholder]) => {
    if(placeholder === null || placeholder === undefined || !placeholder.trim()){
      fixed[original] = placeholder;
      return;
    }

    const trimmed = placeholder.trim();
    if(!usedPlaceholders.has(trimmed)){
      usedPlaceholders.add(trimmed);
      fixed[original] = trimmed;
      return;
    }

    const unique = makePlaceholderName(trimmed, {}, Array.from(usedPlaceholders));
    fixed[original] = unique;
    usedPlaceholders.add(unique);
    collisions.push({ original, from: trimmed, to: unique });
  });

  return { fixed, collisions };
}

function replaceUserMapRows(mapping){
  const rows = document.getElementById('userMapRows');
  rows.replaceChildren();

  Object.entries(mapping).forEach(([original, placeholder]) => {
    addUserMapRow(original, placeholder || '');
  });

  if(!Object.keys(mapping).length) addUserMapRow();
}

function addUserMapRow(original = '', placeholder = ''){
  const rows = document.getElementById('userMapRows');
  const tr = document.createElement('tr');
  const originalCell = document.createElement('td');
  const placeholderCell = document.createElement('td');
  const originalInput = document.createElement('input');
  const placeholderInput = document.createElement('input');

  originalInput.type = 'text';
  originalInput.className = 'user-map-original';
  originalInput.placeholder = 'John Doe';
  originalInput.setAttribute('aria-label', 'Original text');
  originalInput.value = original;

  placeholderInput.type = 'text';
  placeholderInput.className = 'user-map-placeholder';
  placeholderInput.placeholder = '[PERSON_1]';
  placeholderInput.setAttribute('aria-label', 'Placeholder text');
  placeholderInput.value = placeholder;

  originalCell.appendChild(originalInput);
  placeholderCell.appendChild(placeholderInput);
  tr.appendChild(originalCell);
  tr.appendChild(placeholderCell);
  rows.appendChild(tr);
}

function getUserMapFromRows(){
  const out = {};
  document.querySelectorAll('#userMapRows tr').forEach(row => {
    const original = row.querySelector('.user-map-original').value.trim();
    const placeholder = row.querySelector('.user-map-placeholder').value.trim();
    if(original) out[original] = placeholder || null;
  });
  return out;
}

function applyUserMap(){
  const parsed = normalizeUserMap(getUserMapFromRows());
  setUserMapNotice('');
  if(!parsed || Object.keys(parsed).length === 0){ userDefinedMap = {}; renderUserMapDisplay(); return }

  const { fixed, collisions } = fixDuplicateUserPlaceholders(parsed);
  if(collisions.length){
    const collisionText = collisions
      .map(item => `${item.original}: ${item.from} → ${item.to}`)
      .join('; ');
    setUserMapNotice(`Duplicate placeholders detected and auto-fixed: ${collisionText}`);
  }

  userDefinedMap = fixed;
  replaceUserMapRows(userDefinedMap);
  renderUserMapDisplay();
}

function clearUserMap(){
  userDefinedMap = {};
  document.getElementById('userMapRows').replaceChildren();
  addUserMapRow();
  setUserMapNotice('');
  renderUserMapDisplay();
}

function renderUserMapDisplay(){
  const el = document.getElementById('userMapDisplay');
  const has = Object.keys(userDefinedMap).length;
  el.textContent = has ? JSON.stringify(userDefinedMap, null, 2) : '';
  const btn = document.getElementById('exportUserMapBtn');
  if(btn) btn.style.display = has ? 'inline-block' : 'none';
}

function exportUserMap(){
  const data = JSON.stringify(userDefinedMap, null, 2);
  if(!data || data === '{}' || Object.keys(userDefinedMap).length === 0) return alert('No user-defined mapping to export');
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'user-mapping.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function importUserMapFile(event){
  const input = event.target;
  const file = input.files && input.files[0];
  if(!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    const parsed = safeParseJSON(String(reader.result || ''));
    const mapping = normalizeUserMap(parsed);

    if(!mapping || !Object.keys(mapping).length){
      alert('Mapping JSON must be an object like {"Original text":"[PLACEHOLDER]"}');
      input.value = '';
      return;
    }

    userDefinedMap = mapping;
    setUserMapNotice('');
    replaceUserMapRows(userDefinedMap);
    renderUserMapDisplay();
    input.value = '';
  };
  reader.onerror = () => {
    alert('Could not read the mapping file.');
    input.value = '';
  };
  reader.readAsText(file);
}

async function anonymizeText(){
  const text = document.getElementById('original').value;
  if(!text || !text.trim()) return alert('Please enter some text');
  let anonymized = text; currentMapping = {}; const counter = {}; const usedPlaceholders = new Set();

  if(userDefinedMap && Object.keys(userDefinedMap).length){
    for(const orig of Object.keys(userDefinedMap).sort((a,b)=>b.length-a.length)){
      let ph = userDefinedMap[orig];
      if(!ph){ userMapCounter++; ph = `[CUSTOM_${userMapCounter}]`; }

      const hasCollision = text.includes(ph);
      let resolvedPlaceholder = ph;
      if(hasCollision){
        const choice = await showPlaceholderCollisionDialog({
          placeholder: ph,
          original: orig,
          text,
          existingMappings: currentMapping,
          usedPlaceholders: Array.from(usedPlaceholders)
        });
        if(choice === 'cancel') return;
        resolvedPlaceholder = resolvePlaceholderForText(ph, text);
      }

      const uniquePh = makePlaceholderName(resolvedPlaceholder, currentMapping, usedPlaceholders);
      currentMapping[uniquePh] = orig;
      usedPlaceholders.add(uniquePh);
      anonymized = anonymized.split(orig).join(uniquePh);
    }
  }

  patterns.forEach(({type,regex})=>{
    counter[type] = 0;
    anonymized = anonymized.replace(regex, (match)=>{
      counter[type]++;
      const placeholder = `[${type}_${counter[type]}]`;
      const uniquePlaceholder = makePlaceholderName(placeholder, currentMapping, usedPlaceholders);
      if(!currentMapping[uniquePlaceholder]) currentMapping[uniquePlaceholder] = match;
      usedPlaceholders.add(uniquePlaceholder);
      return uniquePlaceholder;
    });
  });

  const sortedMapping = Object.fromEntries(Object.entries(currentMapping).sort(([a],[b])=>a.localeCompare(b)));
  document.getElementById('anonymized').value = anonymized;
  document.getElementById('mappingDisplay').textContent = JSON.stringify(sortedMapping, null, 2);
  document.getElementById('resultSection').style.display = 'block';
}

function copyAnonymized(){ const text = document.getElementById('anonymized').value; if(!text) return alert('Nothing to copy'); navigator.clipboard.writeText(text).then(()=>{}) }

function copyMapping(){ const data = JSON.stringify(currentMapping, null, 2); if(!data || data==='{}') return alert('No mapping to copy'); navigator.clipboard.writeText(data).then(()=>{}) }

function copyRestored(){ const text = document.getElementById('restored').textContent; if(!text) return alert('Nothing to copy'); navigator.clipboard.writeText(text).then(()=>{}) }

function downloadMapping(){ const data = JSON.stringify(currentMapping, null, 2); if(!data || data==='{}') return alert('No mapping to download'); const blob = new Blob([data], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'mapping.json'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); }

function deanonymizeText(){
  let text = document.getElementById('toRestore').value || '';
  let mapping = null;
  const mappingInputEl = document.getElementById('mappingInput');

  if(mappingInputEl){
    const mappingStr = mappingInputEl.value.trim();
    if(mappingStr){
      mapping = safeParseJSON(mappingStr);
      if(!mapping) return alert('Invalid JSON mapping.');
    }
  }

  if(!mapping || !Object.keys(mapping).length){
    if(currentMapping && Object.keys(currentMapping).length){
      mapping = currentMapping;
    } else {
      // try to read the mapping shown in the mapping display area
      const mappingDisplayEl = document.getElementById('mappingDisplay');
      if(mappingDisplayEl && mappingDisplayEl.textContent && mappingDisplayEl.textContent.trim()){
        const parsed = safeParseJSON(mappingDisplayEl.textContent.trim());
        if(parsed && Object.keys(parsed).length) mapping = parsed;
      }

      if(!mapping || !Object.keys(mapping).length){
        return alert('No mapping available. Anonymize text first or provide mapping JSON.');
      }
    }
  }

  Object.keys(mapping).sort((a,b)=>b.length-a.length).forEach(ph=>{ text = text.split(ph).join(mapping[ph]) });
  document.getElementById('restored').textContent = text;
  const copyBtn = document.getElementById('copyRestoredBtn');
  if(copyBtn){
    if(text && String(text).trim()) copyBtn.style.display = 'inline-block'; else copyBtn.style.display = 'none';
  }
}

function clearOriginal(){
  const el = document.getElementById('original');
  if(el) el.value = '';
}

function clearRestore(){
  const el = document.getElementById('toRestore');
  if(el) el.value = '';
  const restoredEl = document.getElementById('restored');
  if(restoredEl) restoredEl.textContent = '';
  const copyBtn = document.getElementById('copyRestoredBtn');
  if(copyBtn) copyBtn.style.display = 'none';
}

function init(){
  document.getElementById('applyUserMapBtn').addEventListener('click', applyUserMap);
  document.getElementById('exportUserMapBtn').addEventListener('click', exportUserMap);
  document.getElementById('addUserMapRowBtn').addEventListener('click', () => addUserMapRow());
  document.getElementById('importUserMapBtn').addEventListener('click', () => document.getElementById('importUserMapInput').click());
  document.getElementById('importUserMapInput').addEventListener('change', importUserMapFile);
  document.getElementById('clearUserMapBtn').addEventListener('click', clearUserMap);
  document.getElementById('anonymizeBtn').addEventListener('click', anonymizeText);
  document.getElementById('clearOriginalBtn').addEventListener('click', clearOriginal);
  document.getElementById('copyAnonymizedBtn').addEventListener('click', copyAnonymized);
  document.getElementById('downloadMappingBtn').addEventListener('click', downloadMapping);
  document.getElementById('restoreBtn').addEventListener('click', deanonymizeText);
  document.getElementById('clearRestoreBtn').addEventListener('click', clearRestore);
  const copyRestoredBtn = document.getElementById('copyRestoredBtn');
  if(copyRestoredBtn) copyRestoredBtn.addEventListener('click', copyRestored);
  addUserMapRow();
  renderUserMapDisplay();
}

const Anonymizer = { init, anonymizeText, deanonymizeText, applyUserMap, clearUserMap, importUserMapFile };

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
}

export default Anonymizer;

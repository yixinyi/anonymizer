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
  if(!parsed || Object.keys(parsed).length === 0){ userDefinedMap = {}; renderUserMapDisplay(); return }

  userDefinedMap = {};
  Object.keys(parsed).forEach(k => { userDefinedMap[k] = parsed[k]; });
  renderUserMapDisplay();
}

function clearUserMap(){
  userDefinedMap = {};
  document.getElementById('userMapRows').replaceChildren();
  addUserMapRow();
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

function anonymizeText(){
  const text = document.getElementById('original').value;
  if(!text || !text.trim()) return alert('Please enter some text');
  let anonymized = text; currentMapping = {}; const counter = {};

  if(userDefinedMap && Object.keys(userDefinedMap).length){
    Object.keys(userDefinedMap).sort((a,b)=>b.length-a.length).forEach(orig=>{
      let ph = userDefinedMap[orig]; if(!ph){ userMapCounter++; ph = `[CUSTOM_${userMapCounter}]` }
      let uniquePh = ph; let suffix = 1;
      while(currentMapping[uniquePh]){ uniquePh = ph.replace(/\]$/, `_${suffix}]`); suffix++; }
      currentMapping[uniquePh] = orig; anonymized = anonymized.split(orig).join(uniquePh);
    });
  }

  patterns.forEach(({type,regex})=>{
    counter[type] = 0;
    anonymized = anonymized.replace(regex, (match)=>{
      counter[type]++;
      const placeholder = `[${type}_${counter[type]}]`;
      if(!currentMapping[placeholder]) currentMapping[placeholder] = match;
      return placeholder;
    });
  });

  const sortedMapping = Object.fromEntries(Object.entries(currentMapping).sort(([a],[b])=>a.localeCompare(b)));
  document.getElementById('anonymized').value = anonymized;
  document.getElementById('mappingDisplay').textContent = JSON.stringify(sortedMapping, null, 2);
  document.getElementById('resultSection').style.display = 'block';
}

function copyAnonymized(){ const text = document.getElementById('anonymized').value; if(!text) return alert('Nothing to copy'); navigator.clipboard.writeText(text).then(()=>{}) }

function copyMapping(){ const data = JSON.stringify(currentMapping, null, 2); if(!data || data==='{}') return alert('No mapping to copy'); navigator.clipboard.writeText(data).then(()=>{}) }

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
}

function init(){
  document.getElementById('applyUserMapBtn').addEventListener('click', applyUserMap);
  document.getElementById('exportUserMapBtn').addEventListener('click', exportUserMap);
  document.getElementById('addUserMapRowBtn').addEventListener('click', () => addUserMapRow());
  document.getElementById('importUserMapBtn').addEventListener('click', () => document.getElementById('importUserMapInput').click());
  document.getElementById('importUserMapInput').addEventListener('change', importUserMapFile);
  document.getElementById('clearUserMapBtn').addEventListener('click', clearUserMap);
  document.getElementById('anonymizeBtn').addEventListener('click', anonymizeText);
  document.getElementById('copyAnonymizedBtn').addEventListener('click', copyAnonymized);
  document.getElementById('downloadMappingBtn').addEventListener('click', downloadMapping);
  document.getElementById('restoreBtn').addEventListener('click', deanonymizeText);
  addUserMapRow();
  renderUserMapDisplay();
}

const Anonymizer = { init, anonymizeText, deanonymizeText, applyUserMap, clearUserMap, importUserMapFile };

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

export default Anonymizer;

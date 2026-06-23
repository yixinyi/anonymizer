// src/anon.js - modularized anonymizer logic
// Keeps same behavior but exports functions for reuse.

const patterns = [
  { type: 'EMAIL', regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g },
  { type: 'PHONE', regex: /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g },
  { type: 'SSN', regex: /\b\d{3}[-.]?\d{2}[-.]?\d{4}\b/g },
  { type: 'IP', regex: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g },
  { type: 'PERSON', regex: /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/g },
  { type: 'ADDRESS', regex: /\b\d+\s+[A-Za-z0-9\s,]+(?:Street|St|Ave|Road|Rd|Lane|Ln|Boulevard|Blvd)\b/gi }
];

let currentMapping = {};
let userDefinedMap = {};
let userMapCounter = 0;

function safeParseJSON(str){
  try{ return JSON.parse(str); } catch(e){ return null }
}

function parseUserMapInput(str){
  str = (str || '').trim();
  if(!str) return {};
  const parsed = safeParseJSON(str);
  if(parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
  const out = {};
  str.split(/\r?\n/).forEach(line => {
    const s = line.trim(); if(!s) return;
    const parts = s.split(/=>|->|=/).map(p=>p.trim());
    const orig = parts[0]; const ph = parts[1] || null;
    if(orig) out[orig] = ph;
  });
  return out;
}

function applyUserMap(){
  const raw = document.getElementById('userMapInput').value;
  const parsed = parseUserMapInput(raw);
  if(!parsed || Object.keys(parsed).length === 0){ userDefinedMap = {}; renderUserMapDisplay(); return }

  const keys = Object.keys(parsed);
  let toUse = parsed;
  if(keys.length && keys.every(k=>typeof k==='string' && k.startsWith('['))){
    toUse = {}; keys.forEach(k=>{ const val = parsed[k]; if(typeof val === 'string') toUse[val] = k });
  }

  userDefinedMap = {};
  Object.keys(toUse).forEach(k => { userDefinedMap[k] = toUse[k] === undefined ? null : toUse[k]; });
  renderUserMapDisplay();
}

function clearUserMap(){ userDefinedMap = {}; document.getElementById('userMapInput').value = ''; renderUserMapDisplay(); }

function renderUserMapDisplay(){
  const el = document.getElementById('userMapDisplay');
  el.textContent = Object.keys(userDefinedMap).length ? JSON.stringify(userDefinedMap, null, 2) : '';
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
  let mappingStr = document.getElementById('mappingInput').value.trim();
  if(!mappingStr) return alert('Please paste the mapping JSON');
  const mapping = safeParseJSON(mappingStr); if(!mapping) return alert('Invalid JSON mapping.');
  Object.keys(mapping).sort((a,b)=>b.length-a.length).forEach(ph=>{ text = text.split(ph).join(mapping[ph]) });
  document.getElementById('restored').textContent = text;
}

function init(){
  document.getElementById('applyUserMapBtn').addEventListener('click', applyUserMap);
  document.getElementById('clearUserMapBtn').addEventListener('click', clearUserMap);
  document.getElementById('anonymizeBtn').addEventListener('click', anonymizeText);
  document.getElementById('copyAnonymizedBtn').addEventListener('click', copyAnonymized);
  document.getElementById('copyMappingBtn').addEventListener('click', copyMapping);
  document.getElementById('downloadMappingBtn').addEventListener('click', downloadMapping);
  document.getElementById('restoreBtn').addEventListener('click', deanonymizeText);
  renderUserMapDisplay();
}

const Anonymizer = { init, anonymizeText, deanonymizeText, applyUserMap, clearUserMap };

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

export default Anonymizer;

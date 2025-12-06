import { findStructuredPII } from './regex.js';
import { extractEntities, generateSynthetic, chat } from './pllum.js';

// Token mapping (square brackets per organizer spec)
const LABEL_TO_TOKEN = {
  'name': '[name]',
  'surname': '[surname]',
  'age': '[age]',
  'date-of-birth': '[date-of-birth]',
  'date': '[date]',
  'sex': '[sex]',
  'religion': '[religion]',
  'political-view': '[political-view]',
  'ethnicity': '[ethnicity]',
  'sexual-orientation': '[sexual-orientation]',
  'health': '[health]',
  'relative': '[relative]',
  'city': '[city]',
  'address': '[address]',
  'email': '[email]',
  'phone': '[phone]',
  'pesel': '[pesel]',
  'document-number': '[document-number]',
  'company': '[company]',
  'school-name': '[school-name]',
  'job-title': '[job-title]',
  'bank-account': '[bank-account]',
  'credit-card-number': '[credit-card-number]',
  'username': '[username]',
  'secret': '[secret]',
};

/**
 * Check if two entities overlap
 */
function overlaps(a, b) {
  return !(a.end <= b.start || b.end <= a.start);
}

/**
 * Merge regex and LLM entities, regex takes priority
 */
function mergeEntities(regexEntities, llmEntities) {
  const merged = [...regexEntities];
  
  for (const ent of llmEntities) {
    const hasOverlap = merged.some(existing => overlaps(ent, existing));
    if (!hasOverlap) {
      merged.push({ ...ent, source: 'llm' });
    }
  }
  
  // Sort by position
  merged.sort((a, b) => a.start - b.start);
  return merged;
}

/**
 * Apply token replacements (back-to-front to preserve positions)
 */
function applyTokens(text, entities) {
  let result = text;
  
  // Process in reverse order
  const sorted = [...entities].sort((a, b) => b.start - a.start);
  
  for (const ent of sorted) {
    const token = LABEL_TO_TOKEN[ent.label] || '[data]';
    result = result.slice(0, ent.start) + token + result.slice(ent.end);
  }
  
  return result;
}

/**
 * Main anonymization function
 */
export async function anonymize(text, options = {}) {
  const { useLLM = true } = options;
  
  // Step 1: Regex for structured data (fast, high precision)
  const regexEntities = findStructuredPII(text);
  
  // Step 2: LLM for NER (names, context-aware classification)
  let llmEntities = [];
  if (useLLM) {
    try {
      llmEntities = await extractEntities(text);
    } catch (e) {
      console.error('LLM extraction failed:', e.message);
    }
  }
  
  // Step 3: Merge results
  const allEntities = mergeEntities(regexEntities, llmEntities);
  
  // Step 4: Apply tokens
  const anonymized = applyTokens(text, allEntities);
  
  return {
    original: text,
    anonymized,
    entities: allEntities,
  };
}

/**
 * Generate synthetic text preserving entity uniqueness
 * Piotrek→Stefan, Janek→Tomek (different people stay different)
 */
export async function synthesize(text, entities) {
  // Group entities by label and original text
  const uniqueEntities = new Map();
  
  for (const ent of entities) {
    const key = `${ent.label}:${ent.text}`;
    if (!uniqueEntities.has(key)) {
      uniqueEntities.set(key, {
        label: ent.label,
        original: ent.text,
        positions: [],
      });
    }
    uniqueEntities.get(key).positions.push({ start: ent.start, end: ent.end });
  }

  const uniqueTexts = [...uniqueEntities.values()].map(e => e.original);
  
  const prompt = `Zamień dane osobowe na fikcyjne. Zachowaj odmianę gramatyczną.

Tekst: "${text}"

Dane do zamiany: ${uniqueTexts.join(', ')}

Zwróć TYLKO JSON z zamiennikami: {"replacements": {"oryginał": "zamiennik"}}`;

  const response = await chat(prompt, { temperature: 0.7 });
  
  try {
    let jsonStr = response.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    }
    // Try to extract JSON from response
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }
    
    const data = JSON.parse(jsonStr);
    const replacements = data.replacements || {};
    
    // Apply replacements to original text
    let result = text;
    
    // Sort positions back-to-front
    const allPositions = [];
    for (const [key, ent] of uniqueEntities) {
      const replacement = replacements[ent.original];
      if (replacement) {
        for (const pos of ent.positions) {
          allPositions.push({ ...pos, original: ent.original, replacement });
        }
      }
    }
    
    allPositions.sort((a, b) => b.start - a.start);
    
    for (const pos of allPositions) {
      result = result.slice(0, pos.start) + pos.replacement + result.slice(pos.end);
    }
    
    return {
      synthetic: result,
      replacements,
    };
    
  } catch (e) {
    console.error('Synthetic generation failed:', e.message);
    // Fallback: try direct text generation
    try {
      const fallbackPrompt = `Zamień "${uniqueTexts.join(', ')}" na fikcyjne dane w tekście. Zwróć TYLKO zmodyfikowany tekst:\n\n${text}`;
      const fallbackResponse = await chat(fallbackPrompt, { temperature: 0.7 });
      return {
        synthetic: fallbackResponse.trim(),
        replacements: {},
      };
    } catch (e2) {
      return { synthetic: null, error: e.message };
    }
  }
}

/**
 * Full pipeline: anonymize + optional synthetic
 */
export async function process(text, options = {}) {
  const { generateSynthetic: doSynthetic = false } = options;
  
  const result = await anonymize(text, options);
  
  if (doSynthetic && result.entities.length > 0) {
    const synth = await synthesize(result.original, result.entities);
    result.synthetic = synth.synthetic;
    result.replacements = synth.replacements;
  }
  
  return result;
}

export { LABEL_TO_TOKEN };

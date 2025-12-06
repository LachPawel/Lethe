import OpenAI from 'openai';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PLLUM_API_KEY = process.env.PLLUM_API_KEY;
const PLLUM_BASE_URL = process.env.PLLUM_BASE_URL || 'https://apim-pllum-tst-pcn.azure-api.net/vllm/v1';
const PLLUM_MODEL = process.env.PLLUM_MODEL || 'CYFRAGOVPL/pllum-12b-nc-chat-250715';

const client = new OpenAI({
  apiKey: 'EMPTY',
  baseURL: PLLUM_BASE_URL,
  defaultHeaders: {
    'Ocp-Apim-Subscription-Key': PLLUM_API_KEY,
  },
});

// Load example files
let originalLines = [];
let anonymizedLines = [];

try {
  const originalText = readFileSync(join(__dirname, 'original_text.txt'), 'utf-8');
  const anonymizedText = readFileSync(join(__dirname, 'anonymized_text.txt'), 'utf-8');
  originalLines = originalText.split('\n').filter(line => line.trim().length > 50);
  anonymizedLines = anonymizedText.split('\n').filter(line => line.trim().length > 50);
  console.log(`Loaded ${originalLines.length} example pairs for dynamic prompting`);
} catch (e) {
  console.warn('Could not load example files:', e.message);
}

/**
 * Get random examples from the loaded files
 */
function getRandomExamples(count = 2) {
  if (originalLines.length === 0 || anonymizedLines.length === 0) {
    return [];
  }
  
  const examples = [];
  const usedIndices = new Set();
  const maxAttempts = count * 3;
  let attempts = 0;
  
  while (examples.length < count && attempts < maxAttempts) {
    const idx = Math.floor(Math.random() * Math.min(originalLines.length, anonymizedLines.length));
    attempts++;
    
    if (usedIndices.has(idx)) continue;
    
    const original = originalLines[idx];
    const anonymized = anonymizedLines[idx];
    
    // Only use examples that have actual anonymization tokens and are not too long
    if (anonymized && anonymized.includes('[') && anonymized.includes(']') && original.length < 300) {
      usedIndices.add(idx);
      examples.push({ original, anonymized });
    }
  }
  
  return examples;
}

/**
 * Send chat completion request to PLLuM
 */
export async function chat(prompt, options = {}) {
  const response = await client.chat.completions.create({
    model: PLLUM_MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: options.temperature ?? 0.1,
    max_tokens: options.maxTokens ?? 2000,
  });

  return response.choices[0].message.content;
}

/**
 * Extract entities using PLLuM NER - Multi-step pipeline
 */
export async function extractEntities(text) {
  // Step 1: Find all potential PII candidates
  const candidates = await findPIICandidates(text);
  console.log('Step 1 - Found candidates:', candidates.length);
  
  if (candidates.length === 0) {
    return [];
  }
  
  // Step 2: Classify each candidate
  const classified = await classifyEntities(text, candidates);
  console.log('Step 2 - Classified:', classified.length);
  
  // Fix positions by finding actual text in input
  const correctedEntities = [];
  for (const ent of classified) {
    if (!ent.text || !ent.label) continue;
    
    let searchStart = 0;
    while (true) {
      const idx = text.indexOf(ent.text, searchStart);
      if (idx === -1) break;
      
      correctedEntities.push({
        text: ent.text,
        label: ent.label,
        start: idx,
        end: idx + ent.text.length,
      });
      searchStart = idx + 1;
    }
  }
  
  return correctedEntities;
}

/**
 * Step 1: Find potential PII candidates in text
 */
async function findPIICandidates(text) {
  const prompt = `Wypisz WSZYSTKIE potencjalne dane osobowe z tekstu (imiona, nazwiska, adresy, telefony, emaile, PESEL, miasta, firmy, numery dokumentów).

TEKST:
"""
${text.substring(0, 1500)}
"""

Zwróć listę w formacie JSON:
{"candidates": ["Jan", "Kowalski", "574 777 072", "ul. Długa 5", "Warszawa", ...]}`;

  const response = await chat(prompt, { temperature: 0.1, maxTokens: 1000 });
  
  try {
    let jsonStr = response.trim();
    if (!jsonStr.includes('{')) return [];
    
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    }
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) jsonStr = jsonMatch[0];
    
    const data = JSON.parse(jsonStr);
    return data.candidates || [];
  } catch (e) {
    console.error('Step 1 parse error:', e.message);
    return [];
  }
}

/**
 * Step 2: Classify each candidate into proper category
 */
async function classifyEntities(text, candidates) {
  if (candidates.length === 0) return [];
  
  const prompt = `Sklasyfikuj każdy element jako dane osobowe.

KATEGORIE:
- name (imię)
- surname (nazwisko)  
- phone (telefon)
- email (email)
- city (miasto samodzielnie)
- address (pełny adres: ulica+numer+kod+miasto)
- pesel (11 cyfr)
- document-number (nr dowodu)
- company (firma)
- age (wiek)
- sex (płeć)
- bank-account (nr konta)
- SKIP (nie jest daną osobową)

KANDYDACI: ${JSON.stringify(candidates)}

KONTEKST:
"""
${text.substring(0, 800)}
"""

Zwróć JSON:
{"entities": [{"text": "Jan", "label": "name"}, {"text": "Kowalski", "label": "surname"}, ...]}`;

  const response = await chat(prompt, { temperature: 0.1, maxTokens: 1500 });
  
  try {
    let jsonStr = response.trim();
    if (!jsonStr.includes('{')) return [];
    
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    }
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) jsonStr = jsonMatch[0];
    
    const data = JSON.parse(jsonStr);
    // Filter out SKIP labels
    return (data.entities || []).filter(e => e.label !== 'SKIP');
  } catch (e) {
    console.error('Step 2 parse error:', e.message);
    return [];
  }
}

/**
 * Generowanie danych syntetycznych z poprawną odmianą
 */
export async function generateSynthetic(originalText, entities) {
  const uniqueTexts = [...new Set(entities.map(e => e.text))];
  
  const prompt = `Zamień poniższe dane osobowe na fikcyjne, zachowując poprawną odmianę gramatyczną (przypadek).

TEKST ORYGINALNY:
"${originalText}"

DANE DO ZAMIANY: ${uniqueTexts.join(', ')}

ZASADY:
- Zachowaj odmianę przez przypadki (np. "Kowalskiego" zamień na "Nowaka", nie "Nowak")
- Imiona zamieniaj na inne polskie imiona
- Nazwiska zamieniaj na inne polskie nazwiska
- Adresy zamieniaj na inne fikcyjne adresy
- Miasta zamieniaj na inne polskie miasta

Zwróć WYŁĄCZNIE zmodyfikowany tekst, bez żadnych komentarzy:`;

  return chat(prompt, { temperature: 0.7, maxTokens: 4000 });
}

/**
 * Klasyfikacja lokalizacji jako miasto lub adres
 */
export async function classifyLocation(text, entityText, position) {
  const window = 100;
  const start = Math.max(0, position - window);
  const end = Math.min(text.length, position + window);
  const context = text.slice(start, end);

  const prompt = `Określ czy miejscowość to:
- "city" - miasto w kontekście opisu, podróży, pochodzenia
- "address" - miasto jako część adresu zamieszkania

KONTEKST: "${context}"
ENCJA: "${entityText}"

Odpowiedz JEDNYM słowem: city lub address`;

  const response = await chat(prompt, { temperature: 0.1, maxTokens: 10 });
  return response.trim().toLowerCase().includes('address') ? 'address' : 'city';
}

export { client };

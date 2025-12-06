import OpenAI from 'openai';

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
 * Extract entities using PLLuM NER
 */
export async function extractEntities(text) {
  const prompt = `Jesteś ekspertem od rozpoznawania danych osobowych w tekstach polskich.

Przeanalizuj tekst i znajdź WSZYSTKIE dane osobowe. Dla każdej encji podaj:
- text: dokładny tekst z dokumentu
- label: kategoria
- start: pozycja początkowa
- end: pozycja końcowa

KATEGORIE:
name, surname, age, date-of-birth, date, sex, religion, political-view, ethnicity, sexual-orientation, health, relative, city, address, email, phone, pesel, document-number, company, school-name, job-title, bank-account, credit-card-number, username, secret

WAŻNE:
- {city} = miasto w kontekście opisu/podróży
- {address} = pełny adres zamieszkania (ulica+numer+kod+miasto)
- {relative} = relacja rodzinna ujawniająca tożsamość ("mój brat Jan")

Odpowiedz TYLKO JSON:
{"entities": [{"text": "...", "label": "...", "start": 0, "end": 0}]}

TEKST:
${text}

JSON:`;

  const response = await chat(prompt, { temperature: 0.1, maxTokens: 2000 });
  
  try {
    let jsonStr = response.trim();
    // Handle markdown code blocks
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```/g, '');
    }
    
    const data = JSON.parse(jsonStr);
    return data.entities || [];
  } catch (e) {
    console.error('Failed to parse PLLuM response:', e.message);
    return [];
  }
}

/**
 * Generate synthetic data with correct morphology
 */
export async function generateSynthetic(anonymizedText, entities) {
  const entitiesDesc = entities
    .map(e => `- "${e.text}" → {${e.label}}`)
    .join('\n');

  const prompt = `Wygeneruj syntetyczną wersję tekstu. Zamień tokeny na FIKCYJNE dane.

KRYTYCZNE: Zachowaj poprawną odmianę morfologiczną!
- "Warszawy" (dopełniacz) → "Krakowa" (nie "Kraków")
- "Kowalskiemu" (celownik) → "Nowakowi" (nie "Nowak")
- "Jana" (dopełniacz) → "Piotra" (nie "Piotr")

TEKST:
${anonymizedText}

ORYGINALNE ENCJE:
${entitiesDesc}

Zwróć TYLKO tekst z podmienionymi wartościami:`;

  return chat(prompt, { temperature: 0.7, maxTokens: 2000 });
}

/**
 * Classify ambiguous location as city or address
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

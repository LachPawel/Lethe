/**
 * Regex patterns for structured Polish PII
 * High precision, used as first pass before LLM
 */

const PATTERNS = {
  pesel: {
    // Matches 11 digits, allows basic boundary checks
    pattern: /\b\d{11}\b/g,
    validate: validatePesel,
  },
  email: {
    // Standard email pattern
    pattern: /\b[\w.-]+@[\w.-]+\.\w{2,}\b/gi,
  },
  phone: {
    // Polish mobile/landline formats: 574 777 072, +48 123-456-789, (12) 345 67 89
    pattern: /(?:\+48[\s-]?)?(?:\(?\d{2,3}\)?[\s-]?)?\d{3}[\s-]?\d{3}[\s-]?\d{2,3}\b/g,
  },
  'bank-account': {
    // PL IBAN (26 digits) or standard format
    pattern: /\b(?:PL)?\d{2}[\s]?(?:\d{4}[\s]?){6}\b/g,
  },
  'credit-card-number': {
    // 16 digits, grouped
    pattern: /\b(?:\d{4}[\s-]?){3}\d{4}\b/g,
  },
  'document-number': {
    // Updated: Matches Polish ID (3 letters 6 digits) AND Passport (2 letters 7 digits)
    pattern: /\b([A-Z]{3}\s?\d{6}|[A-Z]{2}\s?\d{7})\b/g,
  },
};

/**
 * Validate PESEL checksum
 */
function validatePesel(pesel) {
  if (pesel.length !== 11 || !/^\\d+$/.test(pesel)) return false;
  
  const weights = [1, 3, 7, 9, 1, 3, 7, 9, 1, 3];
  let sum = 0;
  
  for (let i = 0; i < 10; i++) {
    sum += parseInt(pesel[i]) * weights[i];
  }
  
  const expected = (10 - (sum % 10)) % 10;
  return parseInt(pesel[10]) === expected;
}

/**
 * Find all structured PII in text
 * @param {string} text - Input text
 * @returns {Array<{start: number, end: number, text: string, label: string}>}
 */
export function findStructuredPII(text) {
  const matches = [];
  
  for (const [label, config] of Object.entries(PATTERNS)) {
    const pattern = new RegExp(config.pattern.source, config.pattern.flags);
    let match;
    
    while ((match = pattern.exec(text)) !== null) {
      // Validate if validator exists
      if (config.validate && !config.validate(match[0])) {
        continue;
      }
      
      matches.push({
        start: match.index,
        end: match.index + match[0].length,
        text: match[0],
        label,
        source: 'regex',
        confidence: 1.0,
      });
    }
  }
  
  return matches.sort((a, b) => a.start - b.start);
}
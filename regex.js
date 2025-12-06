/**
 * Regex patterns for structured Polish PII
 * High precision, used as first pass before LLM
 */

const PATTERNS = {
  pesel: {
    pattern: /\b\d{11}\b/g,
    validate: validatePesel,
  },
  email: {
    pattern: /\b[\w.-]+@[\w.-]+\.\w{2,}\b/gi,
  },
  phone: {
    pattern: /(?:\+48[\s-]?)?\d{3}[\s-]?\d{3}[\s-]?\d{3}\b/g,
  },
  'bank-account': {
    pattern: /\b(?:PL)?\d{2}[\s]?(?:\d{4}[\s]?){6}\b/g,
  },
  'credit-card-number': {
    pattern: /\b(?:\d{4}[\s-]?){3}\d{4}\b/g,
  },
  'document-number': {
    pattern: /\b[A-Z]{3}\s?\d{6}\b/g,
  },
};

/**
 * Validate PESEL checksum
 */
function validatePesel(pesel) {
  if (pesel.length !== 11 || !/^\d+$/.test(pesel)) return false;
  
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
  
  // Sort by position
  matches.sort((a, b) => a.start - b.start);
  
  return matches;
}

/**
 * Check if position has postal code nearby (indicates address)
 */
export function hasPostalCodeNearby(text, position, window = 100) {
  const start = Math.max(0, position - window);
  const end = Math.min(text.length, position + window);
  const context = text.slice(start, end);
  return /\d{2}-\d{3}/.test(context);
}

export { PATTERNS, validatePesel };

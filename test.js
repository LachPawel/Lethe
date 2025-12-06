import { process } from '../src/pipeline.js';
import 'dotenv/config';

const testCases = [
  {
    name: 'Basic PII',
    input: 'Nazywam się Jan Kowalski, mój PESEL to 90010112345.',
    expected: ['name', 'surname', 'pesel'],
  },
  {
    name: 'Address vs City',
    input: 'Byłem wczoraj w Krakowie. Mieszkam w Warszawie przy ul. Długiej 5, 00-001.',
    expected: ['city', 'address'],
  },
  {
    name: 'Multiple names (synthetic test)',
    input: 'Mój kolega Piotrek pożyczył mi 10zł, a potem Janek oddał 12zł.',
    expected: ['name', 'name'],
  },
  {
    name: 'Contact data',
    input: 'Kontakt: jan.kowalski@example.pl, tel. +48 123 456 789',
    expected: ['email', 'phone'],
  },
  {
    name: 'Inflection',
    input: 'Rozmawiałem z Kowalskim o Janie.',
    expected: ['surname', 'name'],
  },
];

async function runTests() {
  console.log('🧪 Running Lethe tests...\n');
  
  for (const tc of testCases) {
    console.log(`📝 Test: ${tc.name}`);
    console.log(`   Input: "${tc.input}"`);
    
    try {
      const result = await process(tc.input, { generateSynthetic: true });
      
      console.log(`   Output: "${result.anonymized}"`);
      console.log(`   Entities: ${result.entities.map(e => e.label).join(', ')}`);
      
      if (result.synthetic) {
        console.log(`   Synthetic: "${result.synthetic}"`);
      }
      
      // Check expected labels
      const foundLabels = result.entities.map(e => e.label);
      const missing = tc.expected.filter(l => !foundLabels.includes(l));
      
      if (missing.length === 0) {
        console.log(`   ✅ PASS\n`);
      } else {
        console.log(`   ⚠️  Missing: ${missing.join(', ')}\n`);
      }
    } catch (e) {
      console.log(`   ❌ ERROR: ${e.message}\n`);
    }
  }
}

runTests();

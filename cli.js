#!/usr/bin/env node
import 'dotenv/config';
import fs from 'fs';
import { process as processText } from './pipeline.js';

const nodeProcess = globalThis.process;
const args = nodeProcess.argv.slice(2);

function printHelp() {
  console.log(`
🏛️  Lethe - Polish PII Anonymization Tool

USAGE:
  node src/cli.js [options] <input>

OPTIONS:
  -i, --input <file>     Input file (TXT)
  -o, --output <file>    Output file (default: stdout)
  -t, --text <string>    Direct text input
  -s, --synthetic        Generate synthetic data
  -h, --help             Show this help

EXAMPLES:
  node src/cli.js -t "Jan Kowalski, PESEL 90010112345"
  node src/cli.js -i input.txt -o output.json
  node src/cli.js -i input.txt -s
`);
}

async function main() {
  let inputFile = null;
  let outputFile = null;
  let directText = null;
  let generateSynthetic = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '-h' || arg === '--help') {
      printHelp();
      nodeProcess.exit(0);
    }
    if (arg === '-i' || arg === '--input') {
      inputFile = args[++i];
    } else if (arg === '-o' || arg === '--output') {
      outputFile = args[++i];
    } else if (arg === '-t' || arg === '--text') {
      directText = args[++i];
    } else if (arg === '-s' || arg === '--synthetic') {
      generateSynthetic = true;
    }
  }

  let text;
  if (directText) {
    text = directText;
  } else if (inputFile) {
    text = fs.readFileSync(inputFile, 'utf-8');
  } else {
    const chunks = [];
    for await (const chunk of nodeProcess.stdin) {
      chunks.push(chunk);
    }
    text = Buffer.concat(chunks).toString('utf-8');
  }

  if (!text?.trim()) {
    console.error('❌ No input provided');
    printHelp();
    nodeProcess.exit(1);
  }

  console.error('🔄 Processing...');
  const result = await processText(text, { generateSynthetic });

  const output = JSON.stringify(result, null, 2);
  
  if (outputFile) {
    fs.writeFileSync(outputFile, output);
    console.error(`✅ Output saved to ${outputFile}`);
  } else {
    console.log(output);
  }

  console.error(`\n📊 Found ${result.entities.length} entities`);
  if (result.synthetic) {
    console.error('🔄 Synthetic data generated');
  }
}

main().catch(e => {
  console.error('❌ Error:', e.message);
  nodeProcess.exit(1);
});

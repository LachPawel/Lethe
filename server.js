import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { process as processText, anonymize, synthesize } from './pipeline.js';

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', name: 'Lethe', version: '1.0.0' });
});

// Anonymize text
app.post('/api/anonymize', async (req, res) => {
  try {
    const { text, generateSynthetic = false } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'Brak tekstu' });
    }

    const result = await processText(text, { generateSynthetic });
    res.json(result);
    
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Anonymize file (TXT)
app.post('/api/anonymize/file', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Brak pliku' });
    }

    const text = req.file.buffer.toString('utf-8');
    const generateSynthetic = req.body.generateSynthetic === 'true';
    
    const result = await process(text, { generateSynthetic });
    
    res.json({
      ...result,
      filename: req.file.originalname,
    });
    
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Batch processing
app.post('/api/anonymize/batch', async (req, res) => {
  try {
    const { texts, generateSynthetic = false } = req.body;
    
    if (!Array.isArray(texts)) {
      return res.status(400).json({ error: 'texts musi być tablicą' });
    }

    const results = await Promise.all(
      texts.map(text => process(text, { generateSynthetic }))
    );
    
    res.json({ results });
    
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Generate synthetic only (for already anonymized text)
app.post('/api/synthetic', async (req, res) => {
  try {
    const { text, entities } = req.body;
    
    if (!text || !entities) {
      return res.status(400).json({ error: 'Wymagane: text i entities' });
    }

    const result = await synthesize(text, entities);
    res.json(result);
    
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🏛️  Lethe API @ http://localhost:${PORT}`);
  console.log(`📜 Endpoints:`);
  console.log(`   POST /api/anonymize - Anonymize text`);
  console.log(`   POST /api/anonymize/file - Anonymize file`);
  console.log(`   POST /api/anonymize/batch - Batch processing`);
  console.log(`   POST /api/synthetic - Generate synthetic data`);
});

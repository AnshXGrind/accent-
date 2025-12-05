const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const multer = require('multer');
const axios = require('axios');
const { GoogleGenerativeAI } = require("@google/generative-ai");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Configure Multer for memory storage (for STT uploads)
const upload = multer({ storage: multer.memoryStorage() });

// --- INITIALIZE GEMINI ---
// Make sure GEMINI_API_KEY is in your .env file
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// UPDATED: Using Gemini 2.5 Flash as requested
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

// --- MAPPINGS (Murf Voice IDs) ---
// NOTE: Ensure these IDs match your actual Murf Studio dashboard
const VOICE_MAP = {
  'English (US)': {
    'Friendly': 'en-US-alina', 
    'Tutor': 'en-US-wayne',
    'Call Center': 'en-US-imani',
    'Professional': 'en-US-cooper'
  },
  'English (UK)': {
    'Friendly': 'en-UK-hazel',
    'Tutor': 'en-UK-juliet',
    'Call Center': 'en-UK-hugo',
    'Professional': 'en-UK-gabriel'
  },
  'English (AU)': {
    'Friendly': 'en-AU-joyce',
    'Tutor': 'en-AU-shane',
    'Call Center': 'en-AU-jimm',
    'Professional': 'en-AU-ivy'
  },
  'Spanish': {
    'Friendly': 'es-ES-carla',
    'Tutor': 'es-ES-enrique',
    'Call Center': 'es-ES-carmen',
    'Professional': 'es-ES-elvira'
  },
  'French': {
    'Friendly': 'fr-FR-maxime',
    'Tutor': 'fr-FR-adélie',
    'Call Center': 'fr-FR-axel',
    'Professional': 'fr-FR-justine'
  },
  'German': {
    'Friendly': 'de-DE-lia',
    'Tutor': 'de-DE-josephine',
    'Call Center': 'de-DE-erna',
    'Professional': 'de-DE-josephine'
  },
  'Italian': {
    'Friendly': 'it-IT-giorgio',
    'Tutor': 'it-IT-greta',
    'Call Center': 'it-IT-giulia',
    'Professional': 'it-IT-vincenzo'
  },
  'Portuguese': {
    'Friendly': 'pt-BR-antonio',
    'Tutor': 'pt-BR-francisca',
    'Call Center': 'pt-BR-rafael',
    'Professional': 'pt-BR-helena'
  },
  'Hindi': {
    'Friendly': 'hi-IN-rahul',
    'Tutor': 'hi-IN-shweta',
    'Call Center': 'hi-IN-amit',
    'Professional': 'hi-IN-shaan'
  },
  'Japanese': {
    'Friendly': 'ja-JP-denki',
    'Tutor': 'ja-JP-kenji',
    'Call Center': 'ja-JP-kimi',
    'Professional': 'ja-JP-kenji'
  },
  'Chinese': {
    'Friendly': 'zh-CN-baolin',
    'Tutor': 'zh-CN-wei',
    'Call Center': 'zh-CN-jiao',
    'Professional': 'zh-CN-zhang'
  }
};

function getToneDescription(mode) {
  switch (mode) {
    case 'Tutor': return 'Slow, helpful, and patient.';
    case 'Professional': return 'Formal, concise, and polite.';
    case 'Friendly': return 'Warm, casual, and enthusiastic.';
    case 'Call Center': return 'Short, clear, and efficient.';
    default: return 'Neutral and helpful.';
  }
}

// --- ENDPOINTS ---

// 1. STT Endpoint (Backup - Uses Gemini Multimodal)
app.post('/api/stt', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    console.log(`[STT] Received audio file: ${req.file.mimetype}`);

    // Convert buffer to Base64 for Gemini
    const audioBase64 = req.file.buffer.toString('base64');

    const result = await model.generateContent([
      "Transcribe this audio file exactly as spoken. Return only the text.",
      {
        inlineData: {
          mimeType: req.file.mimetype,
          data: audioBase64
        }
      }
    ]);

    const transcription = result.response.text();
    console.log('[STT] Transcription:', transcription);
    res.json({ text: transcription });

  } catch (error) {
    console.error('[STT] Error:', error.message);
    res.status(500).json({ error: 'Failed to transcribe audio with Gemini' });
  }
});

// 2. LLM Endpoint (Gemini 2.5 Flash)
app.post('/api/llm', async (req, res) => {
  try {
    const { userText, mode, targetLanguage } = req.body;

    if (!userText) {
      return res.status(400).json({ error: 'No text provided' });
    }

    console.log(`[LLM/Gemini] Processing text: "${userText}" in mode: ${mode}`);

    // Construct System Prompt
    let systemPrompt = `
    You are PolyVoice, a helpful voice assistant.
    - Your current persona is: ${mode} (Tone: ${getToneDescription(mode)}).
    - Respond in the following language: ${targetLanguage || 'English'}.
    - Keep responses natural and short (maximum 2-3 sentences).
    - If the user asks for pronunciation help, strictly follow this format:
      Here’s how it sounds:
      🇺🇸 US: [Phonetic/Description]
      🇬🇧 British: [Phonetic/Description]
      🇮🇳 Indian English: [Phonetic/Description]
    - Speak respectfully. Do not judge accents.

    User Input: "${userText}"
    `;

    const result = await model.generateContent(systemPrompt);
    const aiResponse = result.response.text();

    console.log('[LLM/Gemini] Response:', aiResponse);
    res.json({ text: aiResponse });

  } catch (error) {
    console.error('[LLM/Gemini] Critical Error:', error.message);
    res.status(500).json({ 
        error: "Gemini Error: " + (error.message || "Unknown error") 
    });
  }
});

// 3. TTS Endpoint (Murf - Unchanged)
app.post('/api/tts', async (req, res) => {
  try {
    const { text, targetLanguage, style } = req.body;

    if (!text) return res.status(400).json({ error: 'No text provided' });

    // Voice ID
    const langMap = VOICE_MAP[targetLanguage] || VOICE_MAP['English (US)'];
    const voiceId = langMap[style] || langMap['Professional'];

    console.log(`[TTS] Generating for VoiceID: ${voiceId}`);

    const murfResponse = await axios.post('https://api.murf.ai/v1/speech/generate', {
      voiceId: voiceId,
      text: text,
      format: 'MP3',
      channel: 'MONO'
    }, {
      headers: {
        'api-key': process.env.MURF_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    const audioUrl = murfResponse.data.audioFile; 
    console.log('[TTS] Audio URL generated');
    res.json({ audioUrl: audioUrl });

  } catch (error) {
    console.error('[TTS] Critical Error:', error.response ? error.response.data : error.message);
    
    if (error.response && error.response.status === 401) {
        return res.status(401).json({ error: "Murf API Key is invalid or missing." });
    }
    if (error.response && error.response.status === 400) {
        return res.status(400).json({ error: "Murf rejected the request. Check Voice ID." });
    }

    res.status(500).json({ error: "Murf TTS Failed. Check server logs." });
  }
});

// Export the app for Vercel (serverless)
module.exports = app;

// Only listen if run directly (local development)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}
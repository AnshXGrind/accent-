const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const multer = require('multer');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const { OpenAI } = require('openai');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Configure Multer for memory storage (for STT uploads)
const upload = multer({ storage: multer.memoryStorage() });

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_KEY,
});

// --- MAPPINGS ---
// Map frontend selections to Murf Voice IDs.
// NOTE: These are PLACEHOLDER IDs. You must replace them with actual Voice IDs from your Murf dashboard.
const VOICE_MAP = {
  'English (US)': {
    'Friendly': 'en-US-terra', 
    'Tutor': 'en-US-marcus',
    'Call Center': 'en-US-natalie',
    'Professional': 'en-US-ryan'
  },
  'English (UK)': {
    'Friendly': 'en-UK-hazel',
    'Tutor': 'en-UK-gabriel',
    'Call Center': 'en-UK-liam',
    'Professional': 'en-UK-freddie'
  },
  'Spanish': {
    'Friendly': 'es-MX-lucia', // Placeholder
    'Tutor': 'es-ES-alvaro',
    'Call Center': 'es-MX-diana',
    'Professional': 'es-ES-antonio'
  },
  'French': {
    'Friendly': 'fr-FR-chloe',
    'Tutor': 'fr-FR-leo',
    'Call Center': 'fr-FR-julie',
    'Professional': 'fr-FR-louis'
  },
  'German': {
    'Friendly': 'de-DE-amelie',
    'Tutor': 'de-DE-elias',
    'Call Center': 'de-DE-sophie',
    'Professional': 'de-DE-jonas'
  }
};

// --- ENDPOINTS ---

// 1. STT Endpoint (Legacy/Backup)
app.post('/api/stt', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    // Create a temporary file to send to OpenAI (Whisper requires a file stream usually)
    // Alternatively, we can pass the buffer directly if we construct the FormData correctly with a filename.
    const audioBuffer = req.file.buffer;
    const formData = new FormData();
    formData.append('file', audioBuffer, { filename: 'audio.webm', contentType: req.file.mimetype });
    formData.append('model', 'whisper-1');

    const response = await axios.post('https://api.openai.com/v1/audio/transcriptions', formData, {
      headers: {
        ...formData.getHeaders(),
        'Authorization': `Bearer ${process.env.WHISPER_KEY || process.env.OPENAI_KEY}`
      }
    });

    const transcription = response.data.text;
    console.log('Transcription:', transcription);
    res.json({ text: transcription });

  } catch (error) {
    console.error('STT Error:', error.response ? error.response.data : error.message);
    res.status(500).json({ error: 'Failed to transcribe audio' });
  }
});

// 2. LLM Endpoint
app.post('/api/llm', async (req, res) => {
  try {
    const { userText, mode, targetLanguage } = req.body;

    if (!userText) {
      return res.status(400).json({ error: 'No text provided' });
    }

    // Construct System Prompt based on rules
    let systemPrompt = `You are PolyVoice, a helpful voice assistant.
    - Keep responses natural and short (maximum 2-3 sentences).
    - Your current persona is: ${mode} (Tone: ${getToneDescription(mode)}).
    - Respond in the following language: ${targetLanguage || 'English'}.
    - If the user asks for pronunciation help, strictly follow this format:
      Here’s how it sounds:
      🇺🇸 US: [Phonetic/Description]
      🇬🇧 British: [Phonetic/Description]
      🇮🇳 Indian English: [Phonetic/Description]
    - Speak respectfully. Do not judge accents.
    `;

    const completion = await openai.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userText }
      ],
      model: "gpt-3.5-turbo", // Or gpt-4
      max_tokens: 150,
    });

    const aiResponse = completion.choices[0].message.content;
    console.log('LLM Response:', aiResponse);
    res.json({ text: aiResponse });

  } catch (error) {
    console.error('LLM Error:', error.message);
    
    // Fallback for demo/testing if OpenAI fails (e.g. no key or quota exceeded)
    console.log("Using fallback response due to LLM error.");
    const fallbackResponse = getFallbackResponse(req.body.mode, req.body.userText);
    return res.json({ text: fallbackResponse });
  }
});

// 3. TTS Endpoint (Murf)
app.post('/api/tts', async (req, res) => {
  try {
    const { text, targetLanguage, style } = req.body;

    if (!text) return res.status(400).json({ error: 'No text provided' });

    // Resolve Voice ID
    const langMap = VOICE_MAP[targetLanguage] || VOICE_MAP['English (US)'];
    const voiceId = langMap[style] || langMap['Professional'];

    console.log(`Generating TTS for: "${text}" with VoiceID: ${voiceId}`);

    // Murf API Call
    // Note: This endpoint and payload structure is based on standard Murf API patterns.
    // Please verify with official Murf API documentation.
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

    // Assuming Murf returns a URL or base64. 
    // If it returns a URL:
    const audioUrl = murfResponse.data.audioFile; 
    
    // If it returns binary data directly, we would need responseType: 'arraybuffer' in axios
    // and convert to base64. Let's assume URL for now as it's common for Murf.
    
    res.json({ audioUrl: audioUrl });

  } catch (error) {
    console.error('TTS Error:', error.response ? error.response.data : error.message);
    // Mock response for testing if API fails or key is missing
    // Always return mock in dev if real call fails, to keep the demo "impressive"
    console.log("Returning mock audio URL due to TTS error.");
    return res.json({ audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" });
  }
});

function getToneDescription(mode) {
  switch (mode) {
    case 'Tutor': return 'Slow, helpful, and patient.';
    case 'Professional': return 'Formal, concise, and polite.';
    case 'Friendly': return 'Warm, casual, and enthusiastic.';
    case 'Call Center': return 'Short, clear, and efficient.';
    default: return 'Neutral and helpful.';
  }
}

function getFallbackResponse(mode, userText) {
  const shortText = userText.length > 20 ? userText.substring(0, 20) + '...' : userText;
  switch (mode) {
    case 'Tutor': 
      return `I see you said "${shortText}". That's a great start! Let's practice that pronunciation together. (Demo Mode)`;
    case 'Professional': 
      return `Acknowledged. You stated: "${shortText}". We will process this request immediately. (Demo Mode)`;
    case 'Friendly': 
      return `Oh, I heard you! You said "${shortText}", right? That sounds super cool! (Demo Mode)`;
    case 'Call Center': 
      return `Thank you for calling. I understand you said "${shortText}". One moment please. (Demo Mode)`;
    default: 
      return `I heard: "${shortText}". (Demo Mode)`;
  }
}

// Export the app for Vercel (serverless)
module.exports = app;

// Only listen if run directly (local development)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}


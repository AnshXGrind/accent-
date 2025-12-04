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
  'US': {
    'Friendly': 'en-US-terra', 
    'Tutor': 'en-US-marcus',
    'Call Center': 'en-US-natalie',
    'Professional': 'en-US-ryan'
  },
  'UK': {
    'Friendly': 'en-UK-hazel',
    'Tutor': 'en-UK-gabriel',
    'Call Center': 'en-UK-liam',
    'Professional': 'en-UK-freddie'
  },
  'Indian English': {
    'Friendly': 'en-IN-aravind',
    'Tutor': 'en-IN-anjali',
    'Call Center': 'en-IN-kabir',
    'Professional': 'en-IN-tara'
  },
  'Australian English': {
    'Friendly': 'en-AU-claire',
    'Tutor': 'en-AU-jack',
    'Call Center': 'en-AU-layla',
    'Professional': 'en-AU-oliver'
  },
  'Neutral': {
    'Friendly': 'en-US-terra', // Fallback to US
    'Tutor': 'en-US-marcus',
    'Call Center': 'en-US-natalie',
    'Professional': 'en-US-ryan'
  }
};

// --- ENDPOINTS ---

// 1. STT Endpoint
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
    const { userText, mode, language, accent } = req.body;

    if (!userText) {
      return res.status(400).json({ error: 'No text provided' });
    }

    // Construct System Prompt based on rules
    let systemPrompt = `You are PolyVoice, a helpful voice assistant.
    - Keep responses natural and short (maximum 2-3 sentences).
    - Your current persona is: ${mode} (Tone: ${getToneDescription(mode)}).
    - The user is speaking ${language || 'English'} with a ${accent || 'Neutral'} accent context.
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
    console.error('LLM Error:', error);
    res.status(500).json({ error: 'Failed to generate response' });
  }
});

// 3. TTS Endpoint (Murf)
app.post('/api/tts', async (req, res) => {
  try {
    const { text, accent, style } = req.body;

    if (!text) return res.status(400).json({ error: 'No text provided' });

    // Resolve Voice ID
    const accentMap = VOICE_MAP[accent] || VOICE_MAP['US'];
    const voiceId = accentMap[style] || accentMap['Professional'];

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
    if (process.env.NODE_ENV !== 'production') {
        console.log("Returning mock audio URL for development.");
        return res.json({ audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" });
    }
    res.status(500).json({ error: 'Failed to generate speech' });
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

// Export the app for Vercel (serverless)
module.exports = app;

// Only listen if run directly (local development)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}


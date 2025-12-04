import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './App.css';

function App() {
  const [accent, setAccent] = useState('US');
  const [style, setStyle] = useState('Friendly');
  const [userText, setUserText] = useState('');
  const [aiText, setAiText] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const [status, setStatus] = useState('Ready');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isListening, setIsListening] = useState(false);

  const audioPlayerRef = useRef(null);

  // Determine API Base URL
  // In development: uses Vite proxy (redirects /api -> localhost:5000)
  // In production: set VITE_API_URL env var to your backend URL (e.g., https://my-backend.vercel.app)
  const API_BASE_URL = import.meta.env.VITE_API_URL || '';

  const startListening = () => {
    if (!('webkitSpeechRecognition' in window)) {
      alert("Web Speech API is not supported in this browser. Please use Chrome or Edge.");
      return;
    }

    const recognition = new window.webkitSpeechRecognition();
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsListening(true);
      setStatus('Listening...');
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setUserText(transcript);
      setStatus('Speech recognized. Ready to generate.');
      setIsListening(false);
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error", event.error);
      setStatus('Error recognizing speech. Please try again.');
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  const handleGenerate = async () => {
    if (!userText) {
      alert('Please speak or enter text first!');
      return;
    }

    setIsProcessing(true);
    setStatus('Generating AI response...');
    setAiText('');
    setAudioUrl('');

    try {
      // 1. LLM (Skipping server-side STT)
      const llmResponse = await axios.post(`${API_BASE_URL}/api/llm`, {
        userText: userText,
        mode: style,
        language: 'English',
        accent: accent
      });

      const generatedText = llmResponse.data.text;
      setAiText(generatedText);
      setStatus('Synthesizing speech...');

      // 2. TTS
      const ttsResponse = await axios.post(`${API_BASE_URL}/api/tts`, {
        text: generatedText,
        accent: accent,
        style: style
      });

      const generatedAudioUrl = ttsResponse.data.audioUrl;
      setAudioUrl(generatedAudioUrl);
      setStatus('Playing response...');

      // Auto-play
      if (audioPlayerRef.current) {
        audioPlayerRef.current.src = generatedAudioUrl;
        audioPlayerRef.current.play().catch(e => console.error("Auto-play failed:", e));
      }
      
      setStatus('Complete.');

    } catch (error) {
      console.error('Error in flow:', error);
      setStatus(`Error: ${error.response?.data?.error || error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="container">
      <h1>PolyVoice 🎙️</h1>
      <p>AI Voice Assistant with Accent & Persona Control</p>

      <div className="controls">
        <div className="control-group">
          <label>Accent</label>
          <select value={accent} onChange={(e) => setAccent(e.target.value)}>
            <option value="Neutral">Neutral</option>
            <option value="US">US English</option>
            <option value="UK">UK English</option>
            <option value="Indian English">Indian English</option>
            <option value="Australian English">Australian English</option>
          </select>
        </div>

        <div className="control-group">
          <label>Voice Style</label>
          <select value={style} onChange={(e) => setStyle(e.target.value)}>
            <option value="Friendly">Friendly</option>
            <option value="Tutor">Tutor</option>
            <option value="Call Center">Call Center</option>
            <option value="Professional">Professional</option>
          </select>
        </div>
      </div>

      <div className="recorder-section">
        <button 
          className={`record-btn ${isListening ? 'listening' : ''}`}
          onClick={startListening}
          disabled={isListening || isProcessing}
        >
          {isListening ? 'Listening...' : '🎤 Start Speaking'}
        </button>
        <p className="status-log">{status}</p>
      </div>

      <button 
        className="generate-btn" 
        onClick={handleGenerate} 
        disabled={isProcessing || !userText}
      >
        {isProcessing ? 'Processing...' : 'Generate Response'}
      </button>

      <div className="display-area">
        <div className="text-box">
          <h3>You said:</h3>
          <p>{userText || '...'}</p>
        </div>

        <div className="text-box">
          <h3>PolyVoice Answer:</h3>
          <p style={{ whiteSpace: 'pre-wrap' }}>{aiText || '...'}</p>
        </div>

        {audioUrl && (
          <audio 
            ref={audioPlayerRef} 
            controls 
            className="audio-player" 
            src={audioUrl}
          />
        )}
      </div>
    </div>
  );
}

export default App;

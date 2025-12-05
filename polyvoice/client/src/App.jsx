import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './App.css';

function App() {
  const [inputLanguage, setInputLanguage] = useState('en-US');
  const [targetLanguage, setTargetLanguage] = useState('English (US)');
  const [style, setStyle] = useState('Friendly');
  const [userText, setUserText] = useState('');
  const [aiText, setAiText] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const [status, setStatus] = useState('Ready');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [autoGenerate, setAutoGenerate] = useState(false);

  const audioPlayerRef = useRef(null);
  const autoGenerateRef = useRef(autoGenerate);

  useEffect(() => {
    autoGenerateRef.current = autoGenerate;
  }, [autoGenerate]);

  // Determine API Base URL
  const API_BASE_URL = import.meta.env.VITE_API_URL || '';

  const startListening = () => {
    if (!('webkitSpeechRecognition' in window)) {
      alert("Web Speech API is not supported in this browser. Please use Chrome or Edge.");
      return;
    }

    const recognition = new window.webkitSpeechRecognition();
    recognition.lang = inputLanguage; // Will be overridden if auto-detect works, but good fallback
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onstart = () => {
      setIsListening(true);
      setStatus('Listening...');
    };

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map(result => result[0])
        .map(result => result.transcript)
        .join('');
      
      setUserText(transcript);
      
      if (event.results[0].isFinal) {
        setStatus('Speech recognized.');
        setIsListening(false);
        
        if (autoGenerateRef.current) {
          handleGenerate(transcript);
        } else {
          setStatus('Speech recognized. Ready to generate.');
        }
      }
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

  const handleGenerate = async (textOverride) => {
    const textToProcess = typeof textOverride === 'string' ? textOverride : userText;

    if (!textToProcess) {
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
        userText: textToProcess,
        mode: style,
        targetLanguage: targetLanguage
      });

      const generatedText = llmResponse.data.text;
      setAiText(generatedText);
      setStatus('Synthesizing speech...');

      // 2. TTS
      const ttsResponse = await axios.post(`${API_BASE_URL}/api/tts`, {
        text: generatedText,
        targetLanguage: targetLanguage,
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
    <div className="app-container">
      <div className="glass-card">
        <header>
          <h1>PolyVoice <span className="pulse-icon">🎙️</span></h1>
          <p>AI Voice Assistant • Translate • Speak</p>
        </header>

        <div className="controls-grid">
          <div className="control-group">
            <label>Input Language</label>
            <select value={inputLanguage} onChange={(e) => setInputLanguage(e.target.value)}>
              <option value="en-US">English (US)</option>
              <option value="en-GB">English (UK)</option>
              <option value="en-AU">English (Australia)</option>
              <option value="es-ES">Spanish (Spain)</option>
              <option value="es-MX">Spanish (Mexico)</option>
              <option value="fr-FR">French</option>
              <option value="de-DE">German</option>
              <option value="it-IT">Italian</option>
              <option value="pt-BR">Portuguese (Brazil)</option>
              <option value="hi-IN">Hindi</option>
              <option value="ja-JP">Japanese</option>
              <option value="zh-CN">Chinese (Simplified)</option>
            </select>
          </div>

          <div className="control-group">
            <label>Output Language</label>
            <select value={targetLanguage} onChange={(e) => setTargetLanguage(e.target.value)}>
              <option value="English (US)">English (US)</option>
              <option value="English (UK)">English (UK)</option>
              <option value="English (AU)">English (Australia)</option>
              <option value="Spanish">Spanish</option>
              <option value="French">French</option>
              <option value="German">German</option>
              <option value="Italian">Italian</option>
              <option value="Portuguese">Portuguese</option>
              <option value="Hindi">Hindi</option>
              <option value="Japanese">Japanese</option>
              <option value="Chinese">Chinese</option>
            </select>
          </div>

          <div className="control-group">
            <label>Persona</label>
            <select value={style} onChange={(e) => setStyle(e.target.value)}>
              <option value="Friendly">Friendly</option>
              <option value="Tutor">Tutor</option>
              <option value="Call Center">Call Center</option>
              <option value="Professional">Professional</option>
            </select>
          </div>

          <div className="control-group toggle-group">
            <label>Auto-Generate</label>
            <label className="switch">
              <input 
                type="checkbox" 
                checked={autoGenerate} 
                onChange={(e) => setAutoGenerate(e.target.checked)} 
              />
              <span className="slider round"></span>
            </label>
          </div>
        </div>

        <div className="recorder-section">
          <div className={`wave-container ${isListening ? 'active' : ''}`}>
            <div className="wave"></div>
            <div className="wave"></div>
            <div className="wave"></div>
          </div>
          
          <button 
            className={`record-btn ${isListening ? 'listening' : ''}`}
            onClick={startListening}
            disabled={isListening || isProcessing}
          >
            {isListening ? 'Listening...' : '🎤 Tap to Speak'}
          </button>
          <p className="status-log">{status}</p>
        </div>

        <div className="action-section">
          <button 
            className="generate-btn" 
            onClick={handleGenerate} 
            disabled={isProcessing || !userText}
          >
            {isProcessing ? 'Processing...' : '✨ Generate Response'}
          </button>
        </div>

        <div className="display-area">
          <div className="text-box user-box">
            <h3>You said:</h3>
            <p>{userText || '...'}</p>
          </div>

          <div className="text-box ai-box">
            <h3>PolyVoice Answer:</h3>
            <p>{aiText || '...'}</p>
          </div>

          {audioUrl && (
            <div className="audio-wrapper">
              <audio 
                ref={audioPlayerRef} 
                controls 
                className="audio-player" 
                src={audioUrl}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;

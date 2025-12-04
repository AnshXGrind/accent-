# PolyVoice

PolyVoice is an AI-powered voice assistant that allows users to interact with different personas and accents. It uses OpenAI for Speech-to-Text (STT) and LLM processing, and Murf.ai for realistic Text-to-Speech (TTS).

## Project Structure

- `client/`: React frontend (Vite)
- `server/`: Node.js Express backend

## Prerequisites

- Node.js (v16+)
- OpenAI API Key
- Murf.ai API Key

## Setup & Installation

### 1. Backend Setup

1. Navigate to the server directory:

   ```bash
   cd server
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Configure environment variables:
   - Rename `.env.example` to `.env`.
   - Add your API keys:

     ```env
     MURF_API_KEY=your_murf_key
     OPENAI_KEY=your_openai_key
     # Optional: WHISPER_KEY=your_openai_key
     ```

4. Start the server:

   ```bash
   npm start
   ```

   The server will run on `http://localhost:5000`.

### 2. Frontend Setup

1. Open a new terminal and navigate to the client directory:

   ```bash
   cd client
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Start the development server:

   ```bash
   npm run dev
   ```

   The application will open at `http://localhost:5173` (or similar).

## Usage

1. Select an **Accent** (e.g., US, UK, Indian) and **Voice Style** (e.g., Friendly, Tutor).
2. Click the **Microphone** icon to start recording. Speak your query.
3. Click the **Check/Save** icon (in the recorder) to stop and save the recording.
4. Click **Generate Response**.
5. The system will:
   - Transcribe your audio.
   - Generate a text response using the selected persona.
   - Synthesize speech using Murf.ai.
   - Auto-play the response.

## Troubleshooting

- **Microphone not working?** Ensure your browser has permission to access the microphone.
- **API Errors?** Check the server console for detailed error logs. Verify your API keys in `server/.env`.
- **No Audio?** Ensure your volume is up. If using a mock/test environment, the audio URL might be a placeholder.

## Tech Stack

- **Frontend:** React, Vite, Axios, React Audio Voice Recorder
- **Backend:** Node.js, Express, Multer, OpenAI SDK
- **AI Services:** OpenAI Whisper (STT), OpenAI GPT-3.5/4 (LLM), Murf.ai (TTS)

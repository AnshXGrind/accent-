import os
import base64
from flask import Flask, render_template, request, jsonify
from flask_socketio import SocketIO, emit
from accent_equalizer import AccentStreamProcessor

app = Flask(__name__)
app.config['SECRET_KEY'] = 'secret!'
# SocketIO is kept for local dev, but Vercel will use the REST API below
socketio = SocketIO(app, cors_allowed_origins="*")

# Initialize the stream processor
processor = AccentStreamProcessor()

@app.route('/')
def index():
    return render_template('index.html')

# ==========================================
# VERCEL COMPATIBLE REST API
# ==========================================
@app.route('/api/process_chunk', methods=['POST'])
def process_chunk_rest():
    """
    REST Endpoint for Vercel Serverless compatibility.
    Receives audio blob + metadata, returns processed audio.
    """
    try:
        # Get data from form-data or json
        # We expect 'audio' file and 'target_accent' string
        
        audio_file = request.files.get('audio')
        target_accent = request.form.get('target_accent', 'Neutral')

        if not audio_file:
            return jsonify({'error': 'No audio provided'}), 400

        # Read bytes
        audio_bytes = audio_file.read()
        
        # Process
        result = processor.process_chunk(audio_bytes, target_accent)
        
        # Return as JSON with base64 audio to avoid complex binary responses in serverless
        # (Or could return raw bytes, but JSON is safer for metadata + audio)
        processed_audio_b64 = base64.b64encode(result['audio']).decode('utf-8')
        
        return jsonify({
            'audio_b64': processed_audio_b64,
            'detected_accent': result['detected_accent'],
            'target_accent': result['target_accent'],
            'status': 'processed'
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ==========================================
# SOCKET.IO (Local / Render)
# ==========================================
@socketio.on('connect')
def handle_connect():
    print('Client connected')
    emit('server_status', {'status': 'Connected to Accent Equalizer Core'})

@socketio.on('audio_stream')
def handle_audio_stream(data):
    """
    Receives audio chunks from the client.
    data: { 'audio': <binary/blob>, 'target_accent': <str> }
    """
    audio_chunk = data.get('audio')
    target_accent = data.get('target_accent', 'Neutral')
    
    if audio_chunk:
        # Process the chunk
        result = processor.process_chunk(audio_chunk, target_accent)
        
        # Send back the processed result
        emit('audio_response', result)

if __name__ == '__main__':
    socketio.run(app, debug=True, port=5000)

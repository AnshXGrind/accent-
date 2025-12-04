import os
from flask import Flask, render_template
from flask_socketio import SocketIO, emit
from accent_equalizer import AccentStreamProcessor

app = Flask(__name__)
app.config['SECRET_KEY'] = 'secret!'
socketio = SocketIO(app, cors_allowed_origins="*")

# Initialize the stream processor
processor = AccentStreamProcessor()

@app.route('/')
def index():
    return render_template('index.html')

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

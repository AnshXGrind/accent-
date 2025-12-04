import os
from flask import Flask, render_template, request, jsonify, url_for
from werkzeug.utils import secure_filename
from accent_equalizer import process_audio

app = Flask(__name__)

# Configuration
UPLOAD_FOLDER = os.path.join('static', 'uploads')
OUTPUT_FOLDER = os.path.join('static', 'outputs')
ALLOWED_EXTENSIONS = {'wav', 'mp3', 'ogg', 'm4a'}

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['OUTPUT_FOLDER'] = OUTPUT_FOLDER

# Ensure directories exist
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(OUTPUT_FOLDER, exist_ok=True)

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/equalize', methods=['POST'])
def equalize_audio():
    if 'audio_file' not in request.files:
        return jsonify({'success': False, 'error': 'No file part'}), 400
    
    file = request.files['audio_file']
    target_accent = request.form.get('target_accent')
    preserve_identity = request.form.get('preserve_identity') == 'true'

    if file.filename == '':
        return jsonify({'success': False, 'error': 'No selected file'}), 400

    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        input_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(input_path)

        try:
            # Call the core logic
            output_file_path = process_audio(input_path, target_accent, preserve_identity)
            
            # Generate URL for the output file
            # output_file_path is like 'static/outputs/file.mp3', we need the web path
            filename_only = os.path.basename(output_file_path)
            output_url = url_for('static', filename=f'outputs/{filename_only}')
            
            return jsonify({
                'success': True,
                'message': 'Audio processed successfully',
                'output_url': output_url,
                'logs': [
                    "Simulating deep learning disentanglement...",
                    f"Substituting target accent: {target_accent}...",
                    "Synthesizing final audio..."
                ]
            })
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)}), 500
    else:
        return jsonify({'success': False, 'error': 'Invalid file type'}), 400

if __name__ == '__main__':
    app.run(debug=True, port=5000)

import os
import numpy as np
import cv2
import librosa
from moviepy.editor import VideoFileClip
from tensorflow.keras.models import load_model
from collections import Counter

# Class labels (keep same as training)
CLASSES = ['ambulance', 'firetruck', 'traffic']

# Load model ONCE at module level (converted .h5 format for Keras 2 compat)
MODEL_PATH = os.environ.get("AUDIO_MODEL_PATH", "raahat_audio_model.h5")
_audio_model = load_model(MODEL_PATH, compile=False)
print(f"Audio model loaded from {MODEL_PATH}")


def raahat_predict_audio(video_path):
    """Extract audio from video and classify emergency vs traffic."""

    audio_path = None

    try:
        # Step 1: Extract audio from video
        audio_path = f"temp_audio_{os.getpid()}.wav"

        video = VideoFileClip(video_path)

        if video.audio is None:
            video.close()
            return {"error": "Video has no audio track"}

        video.audio.write_audiofile(audio_path, verbose=False, logger=None)
        video.close()

        # Step 2: Load full audio
        y, sr = librosa.load(audio_path, sr=22050)

        # Step 3: Split into chunks (3 sec)
        chunk_duration = 3
        chunk_length = sr * chunk_duration

        predictions = []
        confidences = []

        for i in range(0, len(y), chunk_length):
            chunk = y[i:i + chunk_length]

            if len(chunk) < chunk_length:
                continue

            try:
                # Convert to Mel Spectrogram
                mel = librosa.feature.melspectrogram(y=chunk, sr=sr)
                mel_db = librosa.power_to_db(mel, ref=np.max)

                # Resize + normalize
                mel_db = cv2.resize(mel_db, (128, 128))
                mel_db = mel_db / 255.0
                mel_db = mel_db[np.newaxis, ..., np.newaxis]

                # Predict
                pred = _audio_model.predict(mel_db, verbose=0)
                pred_class = np.argmax(pred)
                confidence = float(np.max(pred))

                predictions.append(pred_class)
                confidences.append(confidence)

            except Exception as chunk_err:
                print(f"Skipped audio chunk: {chunk_err}")
                continue

        # Safety check
        if len(predictions) == 0:
            return {"error": "No valid audio chunks found"}

        # Majority voting
        most_common = Counter(predictions).most_common(1)[0][0]
        avg_conf = sum(confidences) / len(confidences)

        final_class = CLASSES[most_common]

        # Emergency-sensitive logic
        emergency = any(p in [0, 1] for p in predictions)

        return {
            "emergency_audio": emergency,
            "confidence": round(avg_conf, 3) if emergency else 0.0,
            "chunks_analyzed": len(predictions),
        }

    finally:
        # Cleanup temp audio file
        if audio_path and os.path.exists(audio_path):
            os.remove(audio_path)
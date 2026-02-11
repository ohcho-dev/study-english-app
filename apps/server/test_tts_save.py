
import base64
import hashlib
import time
from pathlib import Path
import os
import io

def mock_save_audio_file(audio_bytes: bytes, mime_type: str, static_dir: Path):
    text = "test_audio"
    text_hash = hashlib.md5(text.encode()).hexdigest()[:12]
    timestamp = int(time.time())
    
    filename = f"gemini_tts_{timestamp}_{text_hash}.mp3"
    filepath = static_dir / filename
    
    print(f"Attempting to save to {filepath}")
    print(f"Mime type: {mime_type}")
    print(f"Audio bytes length: {len(audio_bytes)}")
    
    if "audio/L16" in mime_type or "pcm" in mime_type or "wav" not in mime_type:
        try:
            print("Attempting conversion with pydub...")
            from pydub import AudioSegment
            
            # Create AudioSegment from raw PCM data
            # Gemini TTS standard: 24kHz, 16-bit (2 bytes), Mono
            audio_segment = AudioSegment.from_raw(
                io.BytesIO(audio_bytes),
                sample_width=2,
                frame_rate=24000,
                channels=1
            )
            
            # Export as MP3
            print("Exporting to mp3...")
            audio_segment.export(str(filepath), format="mp3")
            print("Export successful.")
        except ImportError:
            print("Warning: pydub not installed")
            filepath.write_bytes(audio_bytes)
        except Exception as e:
            print(f"Error converting audio: {e}")
            filepath.write_bytes(audio_bytes)
    else:
        print("Direct write (no conversion)")
        filepath.write_bytes(audio_bytes)
    
    return filepath

if __name__ == "__main__":
    # Create dummy PCM data (silence)
    # 24kHz * 2 bytes * 1 second = 48000 bytes
    dummy_pcm = b'\x00' * 48000
    
    static_dir = Path("static/audio")
    static_dir.mkdir(parents=True, exist_ok=True)
    
    # Test case 1: Raw PCM
    result_path = mock_save_audio_file(dummy_pcm, "audio/pcm", static_dir)
    
    # Check if file exists and size
    if result_path.exists():
        print(f"File saved. Size: {result_path.stat().st_size} bytes")
        # Check if it looks like MP3 (very rough check)
        content = result_path.read_bytes()
        print(f"First 4 bytes: {content[:4].hex()}")
    else:
        print("File not saved.")

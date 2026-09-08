import wave
import struct
import math
import os

def generate_tone(filename, freq_duration_pairs, volume=0.3):
    sample_rate = 44100
    with wave.open(filename, 'w') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sample_rate)
        
        for freq, duration in freq_duration_pairs:
            num_samples = int(sample_rate * duration)
            for i in range(num_samples):
                # Envelope to avoid clicking (attack/decay)
                env = 1.0
                if i < 500: env = i / 500
                elif i > num_samples - 500: env = (num_samples - i) / 500
                
                if freq == 0:
                    value = 0
                else:
                    # Square wave for arcade feel
                    period = sample_rate / freq
                    value = volume * (1 if (i % period) < (period/2) else -1) * env
                
                data = struct.pack('<h', int(value * 32767.0))
                w.writeframesraw(data)

# Ensure sounds dir exists
sounds_dir = r"c:\Users\Israel\sistema-postres\frontend\public\sounds"
os.makedirs(sounds_dir, exist_ok=True)

# click: short 1000Hz
generate_tone(os.path.join(sounds_dir, 'click.wav'), [(1000, 0.05)])
# success: 500Hz -> 1000Hz -> 1500Hz
generate_tone(os.path.join(sounds_dir, 'success.wav'), [(500, 0.1), (1000, 0.1), (1500, 0.15)])
# error: 300Hz -> 150Hz
generate_tone(os.path.join(sounds_dir, 'error.wav'), [(300, 0.15), (150, 0.25)])
# notify: 800Hz -> 0 -> 1200Hz
generate_tone(os.path.join(sounds_dir, 'notify.wav'), [(800, 0.1), (0, 0.05), (1200, 0.2)])

print("Sound files generated successfully.")

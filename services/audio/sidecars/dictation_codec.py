"""Private runtime FLAC boundary: bounded stdin/stdout only, no filesystem authority."""
import io
import sys
import numpy as np
import soundfile as sf

data = sys.stdin.buffer.read(8_000_001)
if len(data) > 8_000_000:
    raise ValueError("Audio exceeds checkpoint bounds")
if sys.argv[1] == "encode":
    if len(data) % 2:
        raise ValueError("Invalid PCM16 length")
    output = io.BytesIO()
    sf.write(output, np.frombuffer(data, dtype="<i2"), 16000, format="FLAC", subtype="PCM_16")
    sys.stdout.buffer.write(output.getvalue())
elif sys.argv[1] == "decode":
    with sf.SoundFile(io.BytesIO(data)) as audio:
        if audio.samplerate != 16000 or audio.channels != 1 or audio.frames > 16000 * 240:
            raise ValueError("Unexpected FLAC format")
        sys.stdout.buffer.write(audio.read(dtype="int16").astype("<i2").tobytes())
else:
    raise ValueError("Unknown codec operation")

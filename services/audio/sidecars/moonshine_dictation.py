"""Fixed local inference adapter; no downloads, model code, microphone or project writes."""
import array
import base64
import importlib.metadata
import json
import sys


def reply(value):
    print(json.dumps(value), flush=True)


def main():
    from moonshine_voice import Transcriber, ModelArch
    from moonshine_voice.transcriber import LineCompleted, LineTextChanged, LineStarted
    version = importlib.metadata.version("moonshine-voice")
    if version != "0.1.6":
        raise RuntimeError("Install the validated moonshine-voice==0.1.6 runtime separately.")
    if len(sys.argv) == 2 and sys.argv[1] == "--probe":
        from moonshine_voice.moonshine_api import _MoonshineLib
        library = _MoonshineLib()
        reply({"ready": True, "runtime": version, "nativeVersion": library.lib.moonshine_get_version(), "backend": "cpu"})
        return
    transcriber = Transcriber(sys.argv[1], ModelArch.TINY_STREAMING, update_interval=0.25)
    stream = transcriber.create_stream(update_interval=0.25)
    revisions, finals, events = {}, set(), []

    def event_received(event):
        if not isinstance(event, (LineStarted, LineTextChanged, LineCompleted)):
            if hasattr(event, "error"):
                raise event.error
            return
        line = event.line
        key = str(line.line_id)
        if key in finals:
            return
        revisions[key] = revisions.get(key, 0) + 1
        final = isinstance(event, LineCompleted)
        if final:
            finals.add(key)
        # Only utterance timing is exposed. Optional upstream word timing is not validated here.
        events.append({"utteranceId": key, "revision": revisions[key], "status": "final" if final else "partial", "text": line.text, "startSample": max(0, round(line.start_time * 16000)), "endSample": max(0, round((line.start_time + line.duration) * 16000)), "timestampSource": "engine", "timestampGranularity": "utterance"})

    stream.add_listener(event_received)
    stream.start()
    reply({"ready": True, "runtime": version, "nativeVersion": transcriber.get_version(), "backend": "cpu"})
    try:
        for raw in sys.stdin:
            request = json.loads(raw)
            events.clear()
            if request["type"] == "audio":
                pcm = array.array("h")
                pcm.frombytes(base64.b64decode(request["pcm16Base64"], validate=True))
                if sys.byteorder != "little":
                    pcm.byteswap()
                stream.add_audio([sample / 32768 for sample in pcm], 16000)
            elif request["type"] == "stop":
                stream.stop()
            else:
                raise ValueError("Unsupported dictation request")
            reply({"events": list(events)})
            if request["type"] == "stop":
                break
    finally:
        stream.close()
        transcriber.close()


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        reply({"error": str(error)})
        sys.exit(1)

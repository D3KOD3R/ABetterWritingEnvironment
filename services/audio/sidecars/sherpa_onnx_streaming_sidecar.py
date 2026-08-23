"""Local sherpa-onnx streaming ASR sidecar for browser narration follow."""

from __future__ import annotations

import argparse
import base64
import json
import os
import threading
import time
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

try:
    import numpy as np  # type: ignore
except Exception:  # noqa: BLE001
    np = None  # type: ignore

try:
    import sherpa_onnx  # type: ignore
except Exception:  # noqa: BLE001
    sherpa_onnx = None  # type: ignore


SESSION_WORD_LIMIT = 192


def _json_response(handler: BaseHTTPRequestHandler, status: int, payload: dict[str, Any]) -> None:
    body = json.dumps(payload).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Cache-Control", "no-store")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


def _read_json(handler: BaseHTTPRequestHandler) -> dict[str, Any]:
    content_length = int(handler.headers.get("Content-Length", "0") or "0")
    if content_length <= 0:
        return {}
    raw = handler.rfile.read(content_length)
    try:
        parsed = json.loads(raw.decode("utf-8"))
    except Exception:  # noqa: BLE001
        return {}
    return parsed if isinstance(parsed, dict) else {}


def _live_words(text: str) -> list[str]:
    return [word for word in str(text or "").strip().split() if word]


def _common_prefix_len(left: list[str], right: list[str]) -> int:
    count = 0
    for left_word, right_word in zip(left, right):
        if left_word != right_word:
            break
        count += 1
    return count


def _truncate_words(words: list[str]) -> str:
    if len(words) <= SESSION_WORD_LIMIT:
        return " ".join(words).strip()
    return " ".join(words[-SESSION_WORD_LIMIT:]).strip()


class SherpaSession:
    """Own one sherpa stream and stable-prefix policy for a narration recording."""

    def __init__(self, session_id: str, payload: dict[str, Any]) -> None:
        if sherpa_onnx is None:
            raise RuntimeError("sherpa_onnx is not installed in the selected Python runtime.")
        if np is None:
            raise RuntimeError("numpy is not installed in the selected Python runtime.")

        model_bundle = payload.get("modelBundle") if isinstance(payload.get("modelBundle"), dict) else {}
        self.session_id = session_id
        self.sample_rate = int(payload.get("sampleRate") or 16000)
        self.channel_count = max(1, int(payload.get("channelCount") or 1))
        self._lock = threading.Lock()
        self._session_words: list[str] = []
        self._previous_candidate_words: list[str] = []
        self._current_stream_committed_len = 0
        self._last_text = ""
        self._recognizer = sherpa_onnx.OnlineRecognizer.from_transducer(
            tokens=str(Path(str(model_bundle.get("tokens") or "")).resolve()),
            encoder=str(Path(str(model_bundle.get("encoder") or "")).resolve()),
            decoder=str(Path(str(model_bundle.get("decoder") or "")).resolve()),
            joiner=str(Path(str(model_bundle.get("joiner") or "")).resolve()),
            num_threads=max(1, min(4, (os.cpu_count() or 1) // 2 or 1)),
            sample_rate=16000,
            feature_dim=80,
            enable_endpoint_detection=True,
            rule1_min_trailing_silence=1.2,
            rule2_min_trailing_silence=0.6,
            rule3_min_utterance_length=300,
            decoding_method=str(payload.get("decodingMethod") or "greedy_search"),
            provider=str(payload.get("provider") or "cpu"),
            max_active_paths=4,
        )
        self._stream = self._recognizer.create_stream()

    def accept_frame(self, payload: dict[str, Any]) -> dict[str, Any]:
        with self._lock:
            pcm16_base64 = str(payload.get("pcm16Base64") or "")
            if not pcm16_base64:
                return self._snapshot([], is_endpoint=False)

            raw = base64.b64decode(pcm16_base64)
            samples = np.frombuffer(raw, dtype=np.int16)
            if samples.size == 0:
                return self._snapshot([], is_endpoint=False)
            if self.channel_count > 1:
                frame_count = samples.size // self.channel_count
                samples = samples[: frame_count * self.channel_count].reshape(frame_count, self.channel_count).mean(axis=1)
            float_samples = (samples.astype(np.float32) / 32768.0).copy()
            self._stream.accept_waveform(self.sample_rate, float_samples)
            while self._recognizer.is_ready(self._stream):
                self._recognizer.decode_stream(self._stream)

            result = str(self._recognizer.get_result(self._stream) or "").strip()
            candidate_words = _live_words(result)
            if candidate_words:
                self._promote_stable_prefix(candidate_words)
            is_endpoint = bool(self._recognizer.is_endpoint(self._stream))
            if is_endpoint:
                text = self._finalize_stream(candidate_words)
                return self._snapshot([text], is_endpoint=True)

            text = self._preview_text(candidate_words)
            return self._snapshot([text] if text else [], is_endpoint=False)

    def stop(self) -> dict[str, Any]:
        with self._lock:
            while self._recognizer.is_ready(self._stream):
                self._recognizer.decode_stream(self._stream)
            result = str(self._recognizer.get_result(self._stream) or "").strip()
            final_words = _live_words(result)
            if final_words:
                self._promote_stable_prefix(final_words)
                text = self._finalize_stream(final_words)
            else:
                text = _truncate_words(self._session_words)
            return self._snapshot([text] if text else [], is_endpoint=True)

    def _promote_stable_prefix(self, candidate_words: list[str]) -> None:
        shared_prefix = _common_prefix_len(self._previous_candidate_words, candidate_words)
        next_commit_len = max(self._current_stream_committed_len, max(0, shared_prefix - 1))
        if next_commit_len > self._current_stream_committed_len:
            self._session_words.extend(candidate_words[self._current_stream_committed_len : next_commit_len])
            if len(self._session_words) > SESSION_WORD_LIMIT:
                del self._session_words[: len(self._session_words) - SESSION_WORD_LIMIT]
            self._current_stream_committed_len = next_commit_len
        self._previous_candidate_words = candidate_words

    def _preview_text(self, candidate_words: list[str]) -> str:
        display_words = self._session_words + candidate_words[self._current_stream_committed_len :]
        text = _truncate_words(display_words)
        if text == self._last_text:
            return ""
        self._last_text = text
        return text

    def _finalize_stream(self, candidate_words: list[str]) -> str:
        if candidate_words:
            self._session_words.extend(candidate_words[self._current_stream_committed_len :])
            if len(self._session_words) > SESSION_WORD_LIMIT:
                del self._session_words[: len(self._session_words) - SESSION_WORD_LIMIT]
        self._current_stream_committed_len = 0
        self._previous_candidate_words = []
        self._recognizer.reset(self._stream)
        text = _truncate_words(self._session_words)
        self._last_text = text
        return text

    def _snapshot(self, texts: list[str], *, is_endpoint: bool) -> dict[str, Any]:
        transcript = " ".join(text for text in texts if text).strip()
        return {
            "ok": True,
            "sessionId": self.session_id,
            "isEndpoint": is_endpoint,
            "segments": [
                {
                    "index": 0,
                    "transcript": transcript,
                    "isFinal": is_endpoint,
                    "confidence": None,
                }
            ] if transcript else [],
        }


class SidecarState:
    def __init__(self) -> None:
        self.sessions: dict[str, SherpaSession] = {}
        self.lock = threading.Lock()
        self.started_at = time.time()

    def start_session(self, payload: dict[str, Any]) -> dict[str, Any]:
        session_id = uuid.uuid4().hex
        session = SherpaSession(session_id, payload)
        with self.lock:
            self.sessions[session_id] = session
        return {"ok": True, "sessionId": session_id}

    def accept_frame(self, session_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        with self.lock:
            session = self.sessions.get(session_id)
        if session is None:
            return {"ok": False, "message": f"Unknown realtime speech session '{session_id}'."}
        return session.accept_frame(payload)

    def stop_session(self, session_id: str) -> dict[str, Any]:
        with self.lock:
            session = self.sessions.pop(session_id, None)
        if session is None:
            return {"ok": False, "message": f"Unknown realtime speech session '{session_id}'."}
        return session.stop()


def create_handler(state: SidecarState):
    class SherpaSidecarHandler(BaseHTTPRequestHandler):
        def log_message(self, _format: str, *_args: Any) -> None:
            return

        def do_GET(self) -> None:  # noqa: N802
            if self.path == "/health":
                _json_response(self, 200, {
                    "ok": True,
                    "engine": "sherpa-onnx",
                    "runtimeAvailable": sherpa_onnx is not None and np is not None,
                    "sherpaOnnxInstalled": sherpa_onnx is not None,
                    "numpyInstalled": np is not None,
                    "uptimeSeconds": round(time.time() - state.started_at, 3),
                })
                return
            _json_response(self, 404, {"ok": False, "message": "Not found."})

        def do_POST(self) -> None:  # noqa: N802
            payload = _read_json(self)
            try:
                if self.path == "/sessions/start":
                    _json_response(self, 200, state.start_session(payload))
                    return
                if self.path.startswith("/sessions/") and self.path.endswith("/audio"):
                    session_id = self.path.split("/")[2]
                    result = state.accept_frame(session_id, payload)
                    _json_response(self, 200 if result.get("ok") else 404, result)
                    return
                if self.path.startswith("/sessions/") and self.path.endswith("/stop"):
                    session_id = self.path.split("/")[2]
                    result = state.stop_session(session_id)
                    _json_response(self, 200 if result.get("ok") else 404, result)
                    return
            except Exception as exc:  # noqa: BLE001
                _json_response(self, 500, {"ok": False, "message": str(exc)})
                return
            _json_response(self, 404, {"ok": False, "message": "Not found."})

    return SherpaSidecarHandler


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the local sherpa-onnx narration sidecar.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=4322)
    args = parser.parse_args()

    state = SidecarState()
    server = ThreadingHTTPServer((args.host, args.port), create_handler(state))
    print(json.dumps({"event": "ready", "host": args.host, "port": args.port}), flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()

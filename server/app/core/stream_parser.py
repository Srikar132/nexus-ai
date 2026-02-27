"""
core/stream_parser.py
Parses AI token stream, detects <<<ARTIFACT_START>>> markers,
buffers JSON silently, emits text chunks in real-time.
"""
import json
from dataclasses import dataclass
from typing import Optional

ARTIFACT_START = "<<<ARTIFACT_START>>>"
ARTIFACT_END   = "<<<ARTIFACT_END>>>"


@dataclass
class ParsedEvent:
    kind: str                          # "text" | "artifact"
    text: Optional[str] = None
    artifact: Optional[dict] = None


class StreamParser:
    def __init__(self):
        self._text_buf     = ""
        self._art_buf      = ""
        self._in_artifact  = False

    def feed(self, token: str) -> list[ParsedEvent]:
        events = []
        if not self._in_artifact:
            self._text_buf += token
            if ARTIFACT_START in self._text_buf:
                before, after      = self._text_buf.split(ARTIFACT_START, 1)
                if before:
                    events.append(ParsedEvent(kind="text", text=before))
                self._in_artifact  = True
                self._art_buf      = after
                self._text_buf     = ""
            else:
                safe, self._text_buf = self._split_safe(self._text_buf)
                if safe:
                    events.append(ParsedEvent(kind="text", text=safe))
        else:
            self._art_buf += token
            if ARTIFACT_END in self._art_buf:
                json_str, remaining = self._art_buf.split(ARTIFACT_END, 1)
                try:
                    data = json.loads(json_str.strip())
                except json.JSONDecodeError:
                    data = {"artifact_type": "unknown", "title": "Parse Error", "content": {}}
                events.append(ParsedEvent(kind="artifact", artifact=data))
                self._in_artifact  = False
                self._art_buf      = ""
                self._text_buf     = remaining
        return events

    def flush(self) -> list[ParsedEvent]:
        events = []
        if self._text_buf:
            events.append(ParsedEvent(kind="text", text=self._text_buf))
            self._text_buf = ""
        return events

    def _split_safe(self, text: str) -> tuple[str, str]:
        hold = len(ARTIFACT_START)
        if len(text) > hold:
            return text[:-hold], text[-hold:]
        return "", text
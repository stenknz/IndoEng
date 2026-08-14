#!/bin/sh
set -e
VOICE_DIR="${PIPER_DATA_DIR:-/data}"
VOICE_ID="${PIPER_VOICE:-id_ID-news_tts-medium}"
MODEL="$VOICE_DIR/$VOICE_ID.onnx"
if [ ! -f "$MODEL" ]; then
  echo "Downloading Piper voice: $VOICE_ID"
  mkdir -p "$VOICE_DIR"
  python3 -m piper.download_voices "$VOICE_ID" --data-dir "$VOICE_DIR" || \
  { curl -fsSL "https://huggingface.co/rhasspy/piper-voices/resolve/main/id/id_ID/news_tts/medium/$VOICE_ID.onnx" -o "$MODEL" \
            && curl -fsSL "https://huggingface.co/rhasspy/piper-voices/resolve/main/id/id_ID/news_tts/medium/$VOICE_ID.onnx.json" -o "$MODEL.json"; }
fi
exec python3 -m piper.http_server --host 0.0.0.0 --port 5000 --data-dir "$VOICE_DIR" -m "$VOICE_ID"

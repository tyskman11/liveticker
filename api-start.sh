#!/usr/bin/env sh
# Startet Webseite und API gemeinsam auf Linux/NAS.
set -eu
cd "$(dirname "$0")"
exec "${PYTHON:-python3}" server.py

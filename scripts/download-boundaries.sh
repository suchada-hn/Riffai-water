#!/usr/bin/env bash
set -euo pipefail

SRC="gs://onwr-data/Hydro_3Basins_Export_v2"
DST="backend/app/data/boundaries"

mkdir -p "$DST"

echo "Listing $SRC ..."
if command -v gcloud >/dev/null 2>&1; then
  gcloud storage ls "$SRC/**" || true
  echo "Copying from $SRC to $DST ..."
  gcloud storage cp --recursive "$SRC/" "$DST/"
elif command -v gsutil >/dev/null 2>&1; then
  gsutil ls "$SRC/**" || true
  echo "Copying from $SRC to $DST ..."
  gsutil -m cp -r "$SRC/*" "$DST/"
else
  echo "ERROR: neither 'gcloud' nor 'gsutil' found in PATH."
  echo "Install Google Cloud SDK, authenticate, then rerun."
  exit 1
fi

echo "Done. Ensure basins.geojson and subbasins_*.geojson exist in $DST."


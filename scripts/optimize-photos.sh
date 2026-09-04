#!/usr/bin/env bash
# Turn full-size originals in photos-raw/ into web-ready JPEGs in src/photos/.
#
#   ./scripts/optimize-photos.sh          # long edge 520px, quality 5
#   ./scripts/optimize-photos.sh 1600 3   # bigger / higher quality
#
# 520px is deliberate: these are only ever drawn as a heavily blurred backdrop,
# so anything sharper is bytes she waits for and never sees. Raise it if you
# ever want the photos shown properly.
#
# Quality is ffmpeg's -q:v scale: 2 is best, 31 is worst. 4-6 is a good web range.
# Originals are never touched. Output is numbered in sorted filename order, so
# name the originals however you want them to appear on the page.
set -euo pipefail

SRC="photos-raw"
OUT="src/photos"
MAX="${1:-520}"
Q="${2:-5}"

command -v ffmpeg >/dev/null || { echo "ffmpeg not found (brew install ffmpeg)"; exit 1; }
[ -d "$SRC" ] || { echo "no $SRC/ directory — put the originals there first"; exit 1; }

mkdir -p "$OUT"
rm -f "$OUT"/*.jpg

shopt -s nullglob nocaseglob
files=("$SRC"/*.{jpg,jpeg,png,heic,heif,tif,tiff,webp})
shopt -u nocaseglob
[ ${#files[@]} -gt 0 ] || { echo "no images found in $SRC/"; exit 1; }
IFS=$'\n' files=($(sort <<<"${files[*]}")); unset IFS

i=0; total_in=0; total_out=0
for f in "${files[@]}"; do
  i=$((i + 1))
  n=$(printf '%02d' "$i")
  # strip any leading number the original already had, so we don't end up
  # with names like 01-01-pines-selfie
  base=$(basename "${f%.*}" | tr '[:upper:] ' '[:lower:]-' | tr -cd 'a-z0-9-' \
    | sed 's/^[0-9][0-9]*-*//' | cut -c1-40)
  dest="$OUT/$n-${base:-photo}.jpg"
  work="$f"; tmp=""

  # ffmpeg cannot decode HEIC, which is what an iPhone shoots by default.
  # sips is built into macOS and can. (bash 3.2 here — no ${var,,}.)
  lower=$(printf '%s' "$f" | tr '[:upper:]' '[:lower:]')
  case "$lower" in
    *.heic|*.heif)
      tmp="$(mktemp -t heic)"; mv "$tmp" "$tmp.jpg"; tmp="$tmp.jpg"
      sips -s format jpeg "$f" --out "$tmp" >/dev/null
      work="$tmp"
      ;;
  esac

  # -map_metadata -1 strips EXIF. That matters: phone photos carry GPS
  # coordinates, and these are going onto a public URL.
  ffmpeg -loglevel error -y -i "$work" \
    -vf "scale='if(gt(iw,ih),min($MAX,iw),-2)':'if(gt(iw,ih),-2,min($MAX,ih))'" \
    -map_metadata -1 -c:v mjpeg -q:v "$Q" -pix_fmt yuvj420p \
    "$dest"

  [ -n "$tmp" ] && rm -f "$tmp"

  in_kb=$(( $(stat -f%z "$f") / 1024 ))
  out_kb=$(( $(stat -f%z "$dest") / 1024 ))
  total_in=$((total_in + in_kb)); total_out=$((total_out + out_kb))
  printf '  %s  %6s KB → %5s KB   %s\n' "$n" "$in_kb" "$out_kb" "$(basename "$dest")"
done

echo
saved=$(awk -v a="$total_in" -v b="$total_out" 'BEGIN { printf "%.1f", 100 - b * 100 / a }')
echo "$i photo(s) · ${total_in} KB → ${total_out} KB (${saved}% smaller)"

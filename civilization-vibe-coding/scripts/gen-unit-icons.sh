#!/usr/bin/env bash
set -euo pipefail

# Generate simple SVG icons for each unit based on its type
mkdir -p public/icons/units

awk 'BEGIN{inside=0}
/^[[:space:]]*const[[:space:]]+info[[:space:]]*[:=]/ { inside=1; next }
/^[[:space:]]*\]/ && inside { exit }
/^[[:space:]]*name:/ && inside {
  nm=$0; sub(/^[[:space:]]*name: *"/, "", nm); sub(/".*$/, "", nm);
}
/^[[:space:]]*type:/ && inside {
  tp=$0; sub(/^[[:space:]]*type: *"/, "", tp); sub(/".*$/, "", tp);
  print nm ":" tp;
}' src/config/units.ts |
while IFS=: read -r name type; do
  file="public/icons/units/${name}.svg"
  case "$type" in
    melee)
      cat > "$file" <<SVG
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <path d="M16,48 L48,16 M16,16 L48,48" stroke="#000" stroke-width="4" fill="none"/>
</svg>
SVG
      ;;
    ranged)
      cat > "$file" <<SVG
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <path d="M16,32 L48,32 L40,24 M48,32 L40,40" stroke="#000" stroke-width="4" fill="none"/>
</svg>
SVG
      ;;
    siege)
      cat > "$file" <<SVG
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect x="20" y="32" width="24" height="8" fill="none" stroke="#000" stroke-width="4"/>
  <path d="M32,32 L32,16" stroke="#000" stroke-width="4"/>
</svg>
SVG
      ;;
    mounted)
      cat > "$file" <<SVG
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <circle cx="32" cy="32" r="20" fill="none" stroke="#000" stroke-width="4"/>
  <text x="32" y="38" text-anchor="middle" font-size="24" fill="#000" font-family="sans-serif">🐎</text>
</svg>
SVG
      ;;
    armored)
      cat > "$file" <<SVG
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect x="16" y="32" width="32" height="16" fill="none" stroke="#000" stroke-width="4"/>
  <rect x="28" y="24" width="16" height="8" fill="none" stroke="#000" stroke-width="4"/>
</svg>
SVG
      ;;
    air)
      cat > "$file" <<SVG
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <polygon points="32,16 16,48 48,48" fill="none" stroke="#000" stroke-width="4"/>
</svg>
SVG
      ;;
    "naval melee"|"naval ranged")
      cat > "$file" <<SVG
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <path d="M16,44 L48,44 L56,36 L8,36 Z" fill="none" stroke="#000" stroke-width="4"/>
</svg>
SVG
      ;;
    recon)
      cat > "$file" <<SVG
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <circle cx="24" cy="24" r="10" fill="none" stroke="#000" stroke-width="4"/>
  <line x1="34" y1="34" x2="48" y2="48" stroke="#000" stroke-width="4"/>
</svg>
SVG
      ;;
    support)
      cat > "$file" <<SVG
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect x="20" y="20" width="8" height="20" fill="none" stroke="#000" stroke-width="4"/>
  <rect x="28" y="20" width="16" height="8" fill="none" stroke="#000" stroke-width="4"/>
</svg>
SVG
      ;;
    *)
      echo "Unknown unit type '$type' for $name, using generic icon" >&2
      cat > "$file" <<SVG
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <circle cx="32" cy="32" r="30" fill="none" stroke="#000" stroke-width="4"/>
  <text x="32" y="38" text-anchor="middle" font-size="32" fill="#000" font-family="sans-serif">${name:0:1}</text>
</svg>
SVG
      ;;
  esac
done
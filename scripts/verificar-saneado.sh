#!/usr/bin/env bash
# Verifica que la copia de portafolio NO tenga secretos ni datos reales.
# Uso:  bash scripts/verificar-saneado.sh
# Salida esperada: las tres líneas en ✅ (0 hallazgos).
set -u
cd "$(dirname "$0")/.."
fallos=0

echo "1) Credenciales y llaves:"
if grep -rniE "tsn_9f4c1a7b|tsr_4d7b1e9c|Guillermo23568|sk-55be|sk-ant-|BEGIN PRIVATE KEY|AIzaSy|api_access_token=|firebase-adminsdk-fbsvc|pk\.eyJ|sk\.eyJ|ghp_|github_pat_" \
      . --include='*.ts' --include='*.tsx' --include='*.js' --include='*.json' --include='*.md' --include='*.sql' --include='*.html' \
      2>/dev/null | grep -v node_modules | grep -v '^./scripts/'; then
  echo "   ❌ HAY SECRETOS — no publiques"; fallos=$((fallos+1))
else
  echo "   ✅ ninguna"
fi

echo "2) IPs privadas reales:"
if grep -rnE "100\.98\.127\.95|192\.168\.[0-9]+\.[0-9]+" . 2>/dev/null | grep -v node_modules | grep -v '^./scripts/'; then
  echo "   ❌ HAY IPs REALES"; fallos=$((fallos+1))
else
  echo "   ✅ ninguna"
fi

echo "3) Dominios y nombres de clientes:"
if grep -rlE "talossentinel|Carnaval de Sabores|Niche Sabor" . 2>/dev/null | grep -v node_modules | grep -v '^./scripts/'; then
  echo "   ❌ HAY DATOS DE CLIENTES"; fallos=$((fallos+1))
else
  echo "   ✅ ninguno"
fi

echo "4) Archivos que NUNCA deben versionarse:"
malos=$(git ls-files 2>/dev/null | grep -E "(^|/)\.env$|\.pem$|\.key$|serviceAccount|client_secret_" || true)
if [ -n "$malos" ]; then echo "   ❌ $malos"; fallos=$((fallos+1)); else echo "   ✅ ninguno"; fi

echo
if [ "$fallos" -eq 0 ]; then echo "✅ TODO LIMPIO — se puede publicar"; else echo "❌ $fallos problema(s) — NO publicar todavía"; exit 1; fi

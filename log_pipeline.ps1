# =========================
# ReqTracker Log Pipeline
# =========================

$SERVICE_ID = "srv-d7u5l257vvec73bfvma0"
$OUTPUT_FILE = "frontend_logs.txt"
$REPORT_FILE = "structured_report.md"

Write-Host "📡 Fetching Render logs..."

# 1. Obtener logs
render logs --resources $SERVICE_ID --limit 50 > $OUTPUT_FILE

Write-Host "🧹 Logs saved to $OUTPUT_FILE"

# 2. Filtrado básico de errores
$errors = Get-Content $OUTPUT_FILE | Select-String "error|Error|Exception|failed|OAuth|Mongo"

$errors | Out-File "filtered_logs.txt"

Write-Host "🔍 Filtered logs ready"

# 3. Generar input para IA
@"
Analiza estos logs de ReqTracker y genera:
- clasificación de errores
- root cause analysis
- fixes sugeridos
- tabla estructurada
- salida lista para PROGRESS.md y HANDOFF.md

LOGS:
$errors
"@ | Out-File "ai_prompt.txt"

Write-Host "🤖 Ready for Continue/Ollama analysis"

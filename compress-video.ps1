# Video Compression Script for NILIN Premium Plan Video
# Target: Under 100-150 MB for Burnt.net upload
# Output: Web-ready MP4 (H.264 + AAC)

$ffmpeg = "C:\Users\user\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1.1-full_build\bin\ffmpeg.exe"
$inputFile = "C:\Users\user\Downloads\premium-plus-plan-1.mp4"
$outputFile = "C:\Users\user\Downloads\premium-plus-plan-1-compressed.mp4"

# Get original file size
$originalSize = (Get-Item $inputFile).Length / 1MB
Write-Host "Original video size: $([math]::Round($originalSize, 2)) MB" -ForegroundColor Cyan

# Check if output exists and remove
if (Test-Path $outputFile) {
    Remove-Item $outputFile -Force
}

Write-Host "`nCompressing video..." -ForegroundColor Yellow
Write-Host "Settings: H.264 codec, 1920x1080 max, 24fps, 256kbps audio, CRF 23 for quality" -ForegroundColor Gray

# FFmpeg compression settings:
# -c:v libx264: H.264 codec (best compatibility)
# -crf 23: Constant Rate Factor (0=lossless, 23=good quality, 28=more compression)
# -preset medium: Encoding speed vs compression ratio
# -vf scale=1920:-2: Scale to max 1920px width, maintain aspect ratio
# -r 24: 24fps (smooth, standard)
# -c:a aac: AAC audio codec
# -b:a 256k: 256kbps audio bitrate
# -movflags +faststart: Enable streaming (starts playing before fully downloaded)

& $ffmpeg -i $inputFile `
    -c:v libx264 `
    -crf 23 `
    -preset medium `
    -vf "scale=1920:-2" `
    -r 24 `
    -c:a aac `
    -b:a 256k `
    -movflags +faststart `
    -y `
    $outputFile 2>&1

if ($LASTEXITCODE -eq 0) {
    $newSize = (Get-Item $outputFile).Length / 1MB
    $compression = (1 - ($newSize / $originalSize)) * 100

    Write-Host "`n========================================" -ForegroundColor Green
    Write-Host "Compression Complete!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "Original size: $([math]::Round($originalSize, 2)) MB" -ForegroundColor Cyan
    Write-Host "New size: $([math]::Round($newSize, 2)) MB" -ForegroundColor Cyan
    Write-Host "Compression: $([math]::Round($compression, 1))% smaller" -ForegroundColor Green
    Write-Host "Saved: $([math]::Round($originalSize - $newSize, 2)) MB" -ForegroundColor Green
    Write-Host "`nOutput file: $outputFile" -ForegroundColor White

    if ($newSize -gt 150) {
        Write-Host "`nNote: File is still larger than 150MB. You can:" -ForegroundColor Yellow
        Write-Host "  1. Use higher CRF value (e.g., -crf 26) for more compression" -ForegroundColor Gray
        Write-Host "  2. Lower resolution (e.g., 1280 instead of 1920)" -ForegroundColor Gray
        Write-Host "  3. Lower audio bitrate (e.g., 192k instead of 256k)" -ForegroundColor Gray
    }
} else {
    Write-Host "`nCompression failed! Exit code: $LASTEXITCODE" -ForegroundColor Red
}

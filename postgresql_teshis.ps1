# PostgreSQL çakışma teşhisi – Yönetici PowerShell'de çalıştırın
# Bu script hiçbir şeyi değiştirmez, sadece bilgi toplar.

Write-Host "=== 1) PostgreSQL servisleri ===" -ForegroundColor Cyan
Get-Service -Name "*postgres*" -ErrorAction SilentlyContinue | Format-Table Name, Status, DisplayName -AutoSize

Write-Host "`n=== 2) postgresql-x64-17 ImagePath (-D yolu) ===" -ForegroundColor Cyan
$regPath = "HKLM:\SYSTEM\CurrentControlSet\Services\postgresql-x64-17"
if (Test-Path $regPath) {
    $img = (Get-ItemProperty -Path $regPath -Name ImagePath -ErrorAction SilentlyContinue).ImagePath
    Write-Host $img
} else {
    Write-Host "postgresql-x64-17 kayıt defteri bulunamadı."
}

Write-Host "`n=== 3) Data klasörleri - PG_VERSION var mı? ===" -ForegroundColor Cyan
$folders = @("C:\postgresql", "C:\PostgreSQLData", "C:\FizyoPark_PostgreSQL", "C:\Program Files\PostgreSQL\17\data")
foreach ($f in $folders) {
    $pv = Join-Path $f "PG_VERSION"
    if (Test-Path $pv) { Write-Host "  [OK] $f  -> PG_VERSION var (initdb calismis)" }
    elseif (Test-Path $f) { Write-Host "  [--] $f  -> klasor var, PG_VERSION yok" }
    else { Write-Host "  [ ] $f  -> yok" }
}

Write-Host "`n=== 4) Port 5432 kullanımı ===" -ForegroundColor Cyan
netstat -ano | findstr ":5432"

Write-Host "`nBu ciktinin ekran goruntusunu alin veya kopyalayip paylasin." -ForegroundColor Yellow

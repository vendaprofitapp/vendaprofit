$chunks = Get-ChildItem -Path "sql_chunks\chunk_*.sql" | Sort-Object Name
foreach ($file in $chunks) {
    Write-Host "Enviando $file para o Supabase..."
    npx.cmd supabase db query --file $file.FullName --linked
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Erro na execução do $file! Abortando." -ForegroundColor Red
        exit 1
    }
}
Write-Host "Importação concluída com sucesso!" -ForegroundColor Green

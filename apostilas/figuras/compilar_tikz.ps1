# Compila as cinco figuras TikZ `standalone` de `tikz\` e move os PDFs para `out\`.
#
# O MiKTeX nao esta no PATH da maquina: a linha abaixo o acrescenta so nesta
# sessao. Sem ela, `pdflatex` nao e encontrado.
$ErrorActionPreference = "Stop"
$env:PATH = "C:\Users\Narcísius\AppData\Local\Programs\MiKTeX\miktex\bin\x64;" + $env:PATH

$raiz = Split-Path -Parent $MyInvocation.MyCommand.Path
$tikz = Join-Path $raiz "tikz"
$out  = Join-Path $raiz "out"
# "aux" e nome de dispositivo reservado no Windows: usar "build".
$temp = Join-Path $tikz "build"

New-Item -ItemType Directory -Force -Path $out, $temp | Out-Null
Set-Location $tikz

$falhas = @()
Get-ChildItem -Path $tikz -Filter "c*.tex" | Sort-Object Name | ForEach-Object {
    $nome = $_.BaseName
    Write-Host "compilando $nome ..." -NoNewline
    # batchmode, e nao nonstopmode: diante de um erro o nonstopmode ainda
    # tenta ler do terminal e o processo fica pendurado indefinidamente.
    & pdflatex -interaction=batchmode -halt-on-error `
               -output-directory="$temp" $_.Name | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  FALHOU"
        Get-Content (Join-Path $temp "$nome.log") |
            Select-String -Pattern "^!" -Context 0,4 |
            Select-Object -First 5 | ForEach-Object { Write-Host $_ }
        $falhas += $nome
        return
    }
    $pdf = Join-Path $temp "$nome.pdf"
    Copy-Item $pdf (Join-Path $out "$nome.pdf") -Force
    Write-Host "  ok"
}

if ($falhas.Count -gt 0) {
    Write-Host ""
    Write-Host "$($falhas.Count) figura(s) TikZ falharam: $($falhas -join ', ')"
    exit 1
}
Write-Host ""
Write-Host "5 figuras TikZ compiladas em $out"


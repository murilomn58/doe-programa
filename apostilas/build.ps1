<#
.SYNOPSIS
    Compila os cinco cadernos e publica os PDFs em frontend/public/conteudo/pdf/.

.DESCRIPTION
    Roda pdflatex tres vezes por caderno. Tres passadas, e nao duas: com sumario,
    a segunda ainda deixa "Label(s) may have changed" por causa da paginacao do
    proprio indice.

    O diretorio de cada caderno carrega prefixo numerico, para ordenar no
    explorador; o slug publicado nao carrega, para a URL ficar limpa. A tabela
    $CADERNOS faz a traducao, e os slugs precisam bater com
    frontend/src/domain/apostilas.ts.

    Aborta no primeiro erro de compilacao, para nao publicar PDF quebrado.

.EXAMPLE
    cd C:\dev\iacommurilo\DoE_programa\apostilas
    .\build.ps1
#>

[CmdletBinding()]
param(
    # Compila apenas os cadernos indicados pelo prefixo numerico. Ex.: -Somente 4
    [int[]] $Somente
)

$ErrorActionPreference = 'Stop'

# Derivado de $env:LOCALAPPDATA de proposito: o caminho real contem um nome de
# usuario acentuado, e o PowerShell 5.1 le .ps1 sem BOM como ANSI, corrompendo
# qualquer acento escrito literalmente aqui.
$MIKTEX = Join-Path $env:LOCALAPPDATA 'Programs\MiKTeX\miktex\bin\x64'
if (-not (Test-Path $MIKTEX)) {
    $achado = Get-Command pdflatex -ErrorAction SilentlyContinue
    if ($achado) {
        $MIKTEX = Split-Path -Parent $achado.Source
    } else {
        throw "MiKTeX nao encontrado em $MIKTEX e pdflatex nao esta no PATH."
    }
}
$env:PATH = "$MIKTEX;$env:PATH"

$RAIZ = Split-Path -Parent $PSCommandPath
$DESTINO = Join-Path (Split-Path -Parent $RAIZ) 'frontend\public\conteudo\pdf'

$CADERNOS = @(
    @{ Numero = 1; Dir = '01-por-que-planejar';       Slug = 'por-que-planejar' }
    @{ Numero = 2; Dir = '02-fatorial-2k';            Slug = 'fatorial-2k' }
    @{ Numero = 3; Dir = '03-regressao-e-anova';      Slug = 'regressao-e-anova' }
    @{ Numero = 4; Dir = '04-curvatura-e-superficie'; Slug = 'curvatura-e-superficie' }
    @{ Numero = 5; Dir = '05-economia-de-ensaios';    Slug = 'economia-de-ensaios' }
)

if ($Somente) {
    $CADERNOS = $CADERNOS | Where-Object { $Somente -contains $_.Numero }
}

if (-not (Test-Path $DESTINO)) {
    New-Item -ItemType Directory -Force -Path $DESTINO | Out-Null
}

# Le a contagem de paginas da linha "Output written on main.pdf (N pages, ...)".
function Get-PaginasDoLog {
    param([string] $CaminhoLog)
    if (-not (Test-Path $CaminhoLog)) { return 0 }
    $linha = Select-String -Path $CaminhoLog -Pattern 'Output written on .*\((\d+) pages?' |
             Select-Object -Last 1
    if ($null -eq $linha) { return 0 }
    return [int] $linha.Matches[0].Groups[1].Value
}

$resumo = @()

foreach ($caderno in $CADERNOS) {
    $pasta = Join-Path $RAIZ $caderno.Dir
    if (-not (Test-Path (Join-Path $pasta 'main.tex'))) {
        throw "main.tex nao encontrado em $pasta"
    }

    Write-Host "Caderno $($caderno.Numero): $($caderno.Dir)" -ForegroundColor Cyan
    Push-Location $pasta
    try {
        # A classe vive em ../estilo e o pdflatex nao a acha sozinho a partir do
        # diretorio do caderno. Barra normal, nao invertida: com "..\estilo" o TeX
        # le "\e" como sequencia de escape e aborta com "Undefined control sequence".
        $argumentos = @(
            '-interaction=nonstopmode'
            '-halt-on-error'
            '-include-directory=../estilo'
            'main.tex'
        )

        foreach ($passada in 1..3) {
            Write-Host "  passada $passada de 3" -NoNewline
            & pdflatex @argumentos | Out-Null
            if ($LASTEXITCODE -ne 0) {
                Write-Host ''
                $erros = @()
                if (Test-Path 'main.log') {
                    $erros = Select-String -Path 'main.log' -Pattern '^!' |
                             Select-Object -First 10 |
                             ForEach-Object { $_.Line }
                }
                if (-not $erros) { $erros = @('(sem main.log; pdflatex abortou antes de escrever o log)') }
                throw ("pdflatex falhou no caderno $($caderno.Numero), passada $passada.`n" +
                       ($erros -join "`n"))
            }
            Write-Host ' ok'
        }

        $paginas = Get-PaginasDoLog 'main.log'
        $overfull = @(Select-String -Path 'main.log' -Pattern 'Overfull \\hbox \((\d+(\.\d+)?)pt' |
                      Where-Object { [double] $_.Matches[0].Groups[1].Value -gt 10 })

        $destinoPdf = Join-Path $DESTINO "$($caderno.Slug).pdf"
        Copy-Item 'main.pdf' $destinoPdf -Force

        $tamanhoKB = [math]::Round((Get-Item $destinoPdf).Length / 1KB)
        $resumo += [pscustomobject] @{
            Caderno       = $caderno.Numero
            Slug          = $caderno.Slug
            Paginas       = $paginas
            KB            = $tamanhoKB
            OverfullGrave = $overfull.Count
        }
    }
    finally {
        Pop-Location
    }
}

Write-Host ''
Write-Host 'Publicado em frontend\public\conteudo\pdf\' -ForegroundColor Green
$resumo | Format-Table -AutoSize

$totalPaginas = ($resumo | Measure-Object -Property Paginas -Sum).Sum
$totalMB = [math]::Round((($resumo | Measure-Object -Property KB -Sum).Sum) / 1024, 2)
Write-Host "Total: $totalPaginas paginas, $totalMB MB."
Write-Host 'Atualize o campo `paginas` em frontend\src\domain\apostilas.ts com estes numeros.'

$graves = ($resumo | Measure-Object -Property OverfullGrave -Sum).Sum
if ($graves -gt 0) {
    Write-Warning "$graves ocorrencia(s) de Overfull \hbox acima de 10 pt. Revise o texto."
}

param(
    [Parameter(Mandatory = $true)]
    [string]$Origen,
    [Parameter(Mandatory = $true)]
    [string]$Destino
)

$aplicacion = $null
$documento = $null

try {
    $origenResuelto = (Resolve-Path -LiteralPath $Origen).Path
    $carpetaDestino = Split-Path -Parent $Destino
    New-Item -ItemType Directory -Path $carpetaDestino -Force | Out-Null

    $aplicacion = New-Object -ComObject Word.Application
    $aplicacion.Visible = $false
    $aplicacion.DisplayAlerts = 0
    $documento = $aplicacion.Documents.Open($origenResuelto, $false, $true)
    $documento.ExportAsFixedFormat($Destino, 17)
}
finally {
    if ($documento) { $documento.Close(0) }
    if ($aplicacion) { $aplicacion.Quit() }
}

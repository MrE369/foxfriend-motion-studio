# Start AI Painter — Windows Codex headless runner
# Runs in an ordinary user's Documents workspace, no browser control or admin.
param(
 [string]$Workspace = (Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'Finn-Sylvara-AI-Painter')
)
$ErrorActionPreference = 'Stop'
$Host.UI.RawUI.WindowTitle = 'Finn & Sylvara - Start AI Painter'
function Stop-ForArtist([string]$Message,[string]$Folder){
 Write-Host ''
 Write-Host $Message -ForegroundColor Yellow
 if($Folder -and (Test-Path -LiteralPath $Folder)){Start-Process explorer.exe -ArgumentList ('"{0}"' -f $Folder) | Out-Null}
 [void](Read-Host 'Press Enter to close')
 exit 1
}
try {
 $Workspace = [IO.Path]::GetFullPath($Workspace)
 $modelDir = Join-Path $Workspace 'input\models'
 $refDir = Join-Path $Workspace 'input\references'
 $runsDir = Join-Path $Workspace 'output\runs'
 foreach($dir in @($Workspace,$modelDir,$refDir,$runsDir,(Join-Path $Workspace 'logs'))){
  [void](New-Item -ItemType Directory -Force -Path $dir)
 }
 $missionPath = Join-Path $Workspace 'MASTER_PAINTER_MISSION.md'
 if(-not (Test-Path -LiteralPath $missionPath)){
  Stop-ForArtist 'Mission file missing. Have Codex run Install-Start-AI-Painter.ps1 again.' $Workspace
 }
 $models = @(Get-ChildItem -LiteralPath $modelDir -File | Where-Object {$_.Extension.ToLowerInvariant() -in @('.fbx','.glb')})
 $refs = @(Get-ChildItem -LiteralPath $refDir -File | Where-Object {$_.Extension.ToLowerInvariant() -in @('.png','.jpg','.jpeg','.webp')})
 if($models.Count -ne 1){
  Stop-ForArtist 'Place EXACTLY ONE blank Sylvara FBX or GLB inside input\models. Nothing will be overwritten.' $modelDir
 }
 if($refs.Count -eq 0){
  Stop-ForArtist 'Add Sylvara reference pictures to input\references. Reference images are essential for matching her appearance.' $refDir
 }
 $codex = Get-Command codex -ErrorAction SilentlyContinue | Select-Object -First 1
 if(-not $codex){
  Stop-ForArtist 'Codex CLI was not found. Have Codex install/sign in to Codex CLI first (codex --version).' $Workspace
 }
 $timestamp = (Get-Date).ToString('yyyyMMdd-HHmmss')
 $runDir = Join-Path $runsDir $timestamp
 if(Test-Path -LiteralPath $runDir){$runDir += '-'+[Guid]::NewGuid().ToString('N').Substring(0,6)}
 [void](New-Item -ItemType Directory -Path $runDir)
 $lastFile = Join-Path $runDir 'codex-final-message.md'
 $logFile = Join-Path $runDir 'codex-terminal.log'
 $mission = Get-Content -LiteralPath $missionPath -Raw -Encoding UTF8
 $prompt = @"
$mission

## This run
Source model: $($models[0].FullName)
Reference directory: $refDir
Run output directory: $runDir
Windows Documents workspace: $Workspace

You are operating headlessly; never click around CoLab or Blender.
Execute the stages and produce assets in the run directory.
Inspect the blank FBX and every supplied approved reference image.
Prefer headless Blender/bpy when available; compare all realistic tool choices.
Preserve all original inputs and previously generated runs.
Create a complete painted Sylvara candidate if feasible.
If blocked, produce BLOCKED.md with a reproducible diagnosis and the next safe engineering step.
Do not ask the user to buy anything, change production, or install paid software.
Do not claim final artistic approval: Bill and Callie will review renders.
"@
 $argsList = @('exec','--skip-git-repo-check','-C',$Workspace,'--sandbox','workspace-write',
              '--output-last-message',$lastFile)
 # Explicit image attachments let Codex see the actual Style 3 references.
 foreach($img in ($refs | Sort-Object Name | Select-Object -First 6)){
  $argsList += @('--image',$img.FullName)
 }
 $argsList += '-'
 Write-Host ''
 Write-Host 'Finn & Sylvara — MASTER AI PAINTER' -ForegroundColor Cyan
 Write-Host ('Model: '+$models[0].Name)
 Write-Host ('References: '+$refs.Count+' images')
 Write-Host ('Run artifacts: '+$runDir)
 Write-Host 'Codex is running headlessly. It may use installed Blender, Python, and CoLab batch tooling.'
 Write-Host 'Original inputs are protected. Final model is a candidate until approved.' -ForegroundColor Yellow
 Write-Host ''
 $ErrorActionPreference='Continue'
 $prompt | & $codex.Source @argsList 2>&1 | Tee-Object -FilePath $logFile
 $exitCode=$LASTEXITCODE
 $ErrorActionPreference='Stop'
 Write-Host ''
 if($exitCode -eq 0){Write-Host 'Codex session completed. Inspect renders, reports and candidate GLB.' -ForegroundColor Green}
 else{Write-Host ('Codex exited with code '+$exitCode+'. Inspect the log and any partial outputs.') -ForegroundColor Yellow}
 Start-Process explorer.exe -ArgumentList ('"{0}"' -f $runDir) | Out-Null
 [void](Read-Host 'Press Enter when finished reviewing the run folder')
 exit $exitCode
}catch{
 Write-Host ('AI Painter launcher error: '+$_.Exception.Message) -ForegroundColor Red
 [void](Read-Host 'Press Enter to close')
 exit 1
}

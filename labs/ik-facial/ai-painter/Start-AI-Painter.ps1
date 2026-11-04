# Versioned, non-interactive local Codex runner. No GUI or global configuration changes.
param(
 [string]$Workspace=(Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'Finn-Sylvara-AI-Painter'),
 [string]$CodexPath,
 [switch]$CheckOnly,
 [switch]$VerifyLauncher
)
$ErrorActionPreference='Stop'
function Get-PainterHash([string]$Path){
 $stream=[IO.File]::OpenRead($Path);$sha=[Security.Cryptography.SHA256]::Create()
 try{return [BitConverter]::ToString($sha.ComputeHash($stream)).Replace('-','')}finally{$sha.Dispose();$stream.Dispose()}
}
function Write-PainterStatus([string]$Message){
 Write-Host $Message
 $Message|Set-Content -LiteralPath (Join-Path $Workspace 'logs\last-launch.txt') -Encoding UTF8
}
try {
 $Workspace=[IO.Path]::GetFullPath($Workspace)
 foreach($rel in @('input\models','input\references','output\runs','logs')){[void](New-Item -ItemType Directory -Path (Join-Path $Workspace $rel) -Force)}
 $verifyFlag=Join-Path $Workspace 'logs\verify-next-launch.flag'
 if(Test-Path -LiteralPath $verifyFlag){$VerifyLauncher=$true;Remove-Item -LiteralPath $verifyFlag}
 $modelDir=Join-Path $Workspace 'input\models';$refDir=Join-Path $Workspace 'input\references'
 $models=@(Get-ChildItem -LiteralPath $modelDir -File|Where-Object Extension -in '.fbx','.glb')
 $refs=@(Get-ChildItem -LiteralPath $refDir -File|Where-Object Extension -in '.png','.jpg','.jpeg','.webp')
 if($models.Count -ne 1){Write-PainterStatus "Add exactly ONE blank FBX or GLB to $modelDir. No painting was started.";exit 10}
 if($refs.Count -eq 0){Write-PainterStatus "Add approved reference images to $refDir. No painting was started.";exit 11}
 $missionPath=Join-Path $Workspace 'MASTER_PAINTER_MISSION.md'
 if(-not(Test-Path -LiteralPath $missionPath)){throw 'Mission is missing; rerun the installer.'}
 if(-not $CodexPath){
  $cmd=Get-Command codex.exe -ErrorAction SilentlyContinue|Select-Object -First 1
  if($cmd){$CodexPath=$cmd.Source}
  $config=Join-Path $Workspace 'launcher-config.json'
  if(-not $CodexPath -and (Test-Path -LiteralPath $config)){$CodexPath=(Get-Content -LiteralPath $config -Raw|ConvertFrom-Json).codexPath}
  if(-not $CodexPath -or -not(Test-Path -LiteralPath $CodexPath)){
   $pkg=Get-AppxPackage -Name OpenAI.Codex -ErrorAction SilentlyContinue|Select-Object -First 1
   if($pkg){$CodexPath=Join-Path $pkg.InstallLocation 'app\resources\codex.exe'}
  }
 }
 if(-not $CodexPath -or -not(Test-Path -LiteralPath $CodexPath)){throw 'Existing Codex CLI not found; no painting was started.'}
 & $CodexPath login status
 if($LASTEXITCODE -ne 0){throw 'Sign in to Codex CLI before starting the painter.'}
 if($CheckOnly){Write-PainterStatus ('READY: '+$models[0].Name+'; '+$refs.Count+' references; '+$CodexPath);exit 0}
 $runDir=Join-Path $Workspace ('output\runs\'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'-'+[Guid]::NewGuid().ToString('N').Substring(0,6))
 [void](New-Item -ItemType Directory -Path $runDir)
 $manifest=@($models+$refs|ForEach-Object{[pscustomobject]@{path=$_.FullName;sha256=(Get-PainterHash $_.FullName)}})
 $manifest|ConvertTo-Json -Depth 3|Set-Content -LiteralPath (Join-Path $runDir 'input-hashes-before.json') -Encoding UTF8
 $prompt=Get-Content -LiteralPath $missionPath -Raw -Encoding UTF8
 $prompt+="`nSource model: $($models[0].FullName)`nReferences: $refDir`nOutput: $runDir`nReusable deterministic scripts: $(Join-Path $Workspace 'scripts')`nUse and improve the supplied scripts. No UI, purchases or paid services. Original inputs and prior runs are read-only."
 if($VerifyLauncher){$prompt="Creator-authorized launcher verification: use only a local shell/file tool to write VERIFIED to '$runDir\headless-write-proof.txt'. No asset reads, browser, installs, or painting. Check the marker and report the result."}
 $prompt|Set-Content -LiteralPath (Join-Path $runDir 'mission-this-run.md') -Encoding UTF8
 # Keep the existing authenticated runtime configuration. In the installed alpha,
 # --ignore-user-config incorrectly resets the reported sandbox to read-only.
 $cliArgs=@('exec','--sandbox','workspace-write','--ephemeral','--skip-git-repo-check','-C',$Workspace,'--output-last-message',(Join-Path $runDir 'codex-final-message.md'))
 if(-not $VerifyLauncher){foreach($ref in ($refs|Sort-Object Name|Select-Object -First 6)){$cliArgs+=@('--image',$ref.FullName)}}
 $cliArgs+='-'
 Write-PainterStatus ('RUNNING: '+$runDir)
 $ErrorActionPreference='Continue'
 $prompt|& $CodexPath @cliArgs 2>&1|Tee-Object -FilePath (Join-Path $runDir 'codex-terminal.log')
 $code=$LASTEXITCODE;$ErrorActionPreference='Stop'
 $after=@($manifest|ForEach-Object{$hash=Get-PainterHash $_.path;[pscustomobject]@{path=$_.path;sha256=$hash;unchanged=($_.sha256 -eq $hash)}})
 $after|ConvertTo-Json -Depth 3|Set-Content -LiteralPath (Join-Path $runDir 'input-hashes-after.json') -Encoding UTF8
 if(@($after|Where-Object {-not $_.unchanged}).Count){throw 'An input hash changed; review this run before using any output.'}
 Write-PainterStatus ('FINISHED (exit '+$code+'): '+$runDir+' - inspect reports/previews; artistic approval remains required.')
 exit $code
}catch{
 Write-Host ('AI Painter: '+$_.Exception.Message) -ForegroundColor Red
 if(Test-Path -LiteralPath (Join-Path $Workspace 'logs')){Write-PainterStatus ('ERROR: '+$_.Exception.Message)}
 exit 1
}

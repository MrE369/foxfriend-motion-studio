# Install desktop shortcut "Start AI Painter" without administrator privileges.
# This script copies only launcher/mission files; it does not touch Sylvara assets.
param(
 [string]$Workspace = (Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'Finn-Sylvara-AI-Painter'),
 [string]$CodexPath
)
$ErrorActionPreference = 'Stop'
function Get-PainterHash([string]$Path){
 $stream=[IO.File]::OpenRead($Path);$sha=[Security.Cryptography.SHA256]::Create()
 try{return [BitConverter]::ToString($sha.ComputeHash($stream)).Replace('-','')}finally{$sha.Dispose();$stream.Dispose()}
}
if(-not $IsWindows -and $PSVersionTable.PSEdition -eq 'Core'){
 # Windows PowerShell 5.1 does not define $IsWindows; the condition stays safe.
 throw 'The desktop shortcut installer requires Windows.'
}
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$runnerSource = Join-Path $scriptDir 'Start-AI-Painter.ps1'
$missionSource = Join-Path $scriptDir 'MASTER_PAINTER_MISSION.md'
$readmeSource = Join-Path $scriptDir 'README.md'
foreach($source in @($runnerSource,$missionSource)){
 if(-not (Test-Path -LiteralPath $source)){throw ('Required file missing: '+$source)}
}
$Workspace = [IO.Path]::GetFullPath($Workspace)
foreach($folder in @($Workspace,(Join-Path $Workspace 'input\models'),
 (Join-Path $Workspace 'input\references'),(Join-Path $Workspace 'output\runs'),
 (Join-Path $Workspace 'logs'))){
 [void](New-Item -Path $folder -ItemType Directory -Force)
}
$backup=Join-Path $Workspace ('installer-backups\'+(Get-Date -Format 'yyyyMMdd-HHmmss-fff'))
function Copy-WithBackup([string]$Source,[string]$Destination){
 if(Test-Path -LiteralPath $Destination){
  if((Get-PainterHash $Source) -eq (Get-PainterHash $Destination)){return}
  [void](New-Item -ItemType Directory -Path $backup -Force)
  Copy-Item -LiteralPath $Destination -Destination (Join-Path $backup ([IO.Path]::GetFileName($Destination)))
 }
 Copy-Item -LiteralPath $Source -Destination $Destination -Force
}
foreach($source in @($runnerSource,$missionSource,$readmeSource)){if(Test-Path -LiteralPath $source){Copy-WithBackup $source (Join-Path $Workspace ([IO.Path]::GetFileName($source)))}}
$scripts=Join-Path $Workspace 'scripts';[void](New-Item -ItemType Directory -Path $scripts -Force)
Get-ChildItem -LiteralPath $scriptDir -File|Where-Object Extension -in '.py','.gd'|ForEach-Object{Copy-WithBackup $_.FullName (Join-Path $scripts $_.Name)}
if(-not $CodexPath){$cmd=Get-Command codex.exe -ErrorAction SilentlyContinue|Select-Object -First 1;if($cmd){$CodexPath=$cmd.Source}}
if(-not $CodexPath){$pkg=Get-AppxPackage -Name OpenAI.Codex|Select-Object -First 1;if($pkg){$CodexPath=Join-Path $pkg.InstallLocation 'app\resources\codex.exe'}}
if(-not $CodexPath -or -not(Test-Path -LiteralPath $CodexPath)){throw 'Existing Codex CLI not found; specify -CodexPath.'}
@{codexPath=$CodexPath;installedAt=(Get-Date -Format o);repository=$scriptDir}|ConvertTo-Json|Set-Content -LiteralPath (Join-Path $Workspace 'launcher-config.json') -Encoding UTF8
try{
 $repoRoot = (Resolve-Path -LiteralPath (Join-Path $scriptDir '..\..\..')).Path
 Set-Content -LiteralPath (Join-Path $Workspace 'source_repository.txt') -Value $repoRoot -Encoding UTF8
}catch{
 # Installation may be from a standalone bundle, not a git checkout.
}
$desktop=[Environment]::GetFolderPath('DesktopDirectory')
if(-not $desktop -or -not (Test-Path -LiteralPath $desktop)){throw 'Could not locate the Windows Desktop folder.'}
$powershell=Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
if(-not (Test-Path -LiteralPath $powershell)){throw 'Windows PowerShell executable not found.'}
$shortcutPath=Join-Path $desktop 'Start AI Painter.lnk'
if(Test-Path -LiteralPath $shortcutPath){[void](New-Item -ItemType Directory -Path $backup -Force);Copy-Item -LiteralPath $shortcutPath -Destination (Join-Path $backup 'Start AI Painter.lnk')}
$runner=Join-Path $Workspace 'Start-AI-Painter.ps1'
$shell=New-Object -ComObject WScript.Shell
$shortcut=$shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath=$powershell
$shortcut.Arguments='-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "'+$runner+'" -Workspace "'+$Workspace+'"'
$shortcut.WorkingDirectory=$Workspace
$shortcut.IconLocation=(Join-Path $env:SystemRoot 'System32\shell32.dll')+',22'
$shortcut.Description='Finn & Sylvara — Codex headless Sylvara texture painter'
$shortcut.Save()
if(-not (Test-Path -LiteralPath $shortcutPath)){throw 'Shortcut was not written to the Desktop.'}
$verified=$shell.CreateShortcut($shortcutPath)
if($verified.TargetPath -ne $powershell -or $verified.WorkingDirectory -ne $Workspace -or $verified.Arguments -ne $shortcut.Arguments -or $verified.IconLocation -ne $shortcut.IconLocation){
 throw 'Desktop shortcut verification failed.'
}
Write-Host ''
Write-Host 'Start AI Painter shortcut INSTALLED on this Windows desktop.' -ForegroundColor Green
Write-Host ('Shortcut: '+$shortcutPath)
Write-Host ('Workspace: '+$Workspace)
Write-Host 'Place one blank FBX inside input\models and approved reference images inside input\references.'
Write-Host 'Then double-click Start AI Painter on the desktop.'

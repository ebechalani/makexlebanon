# One-time: commit + push the 2026 event photos in small verified chunks.
Set-Location "C:\Users\PC\Documents\GitHub\makexlebanon"
$G = "public/gallery/2026"

function Push-Verified([string]$msg) {
  git commit -q -m "$msg`n`nCo-Authored-By: Claude Fable 5 <noreply@anthropic.com>" 2>$null
  for ($i = 0; $i -lt 8; $i++) {
    git push -q 2>$null
    if ($LASTEXITCODE -eq 0) { Write-Output "PUSHED: $msg"; return $true }
    Write-Output "retry $i for: $msg"
    Start-Sleep 20
  }
  Write-Output "FAILED: $msg"
  return $false
}

$chunks = @(
  @{ msg = "2026 event photos: site code + Signal Rise";        paths = @("src", "content", "$G/signal-rise") },
  @{ msg = "2026 event photos: Football";                        paths = @("$G/football") },
  @{ msg = "2026 event photos: Locker Room";                     paths = @("$G/locker-room") },
  @{ msg = "2026 event photos: Smart Logistics";                 paths = @("$G/smart-logistics") },
  @{ msg = "2026 event photos: SportsWonderland (1/2)";          paths = @("$G/sportswonderland/event-0*.webp") },
  @{ msg = "2026 event photos: SportsWonderland (2/2)";          paths = @("$G/sportswonderland") },
  @{ msg = "2026 event photos: Code Courier (1/3)";              paths = @("$G/code-courier/event-0*.webp") },
  @{ msg = "2026 event photos: Code Courier (2/3)";              paths = @("$G/code-courier/event-1*.webp") },
  @{ msg = "2026 event photos: Code Courier (3/3)";              paths = @("$G/code-courier") },
  @{ msg = "2026 competition day gallery (1/8)";                 paths = @("$G/event/photo-0*.webp") },
  @{ msg = "2026 competition day gallery (2/8)";                 paths = @("$G/event/photo-1*.webp") },
  @{ msg = "2026 competition day gallery (3/8)";                 paths = @("$G/event/photo-2*.webp") },
  @{ msg = "2026 competition day gallery (4/8)";                 paths = @("$G/event/photo-3*.webp") },
  @{ msg = "2026 competition day gallery (5/8)";                 paths = @("$G/event/photo-4*.webp") },
  @{ msg = "2026 competition day gallery (6/8)";                 paths = @("$G/event/photo-5*.webp") },
  @{ msg = "2026 competition day gallery (7/8)";                 paths = @("$G/event/photo-6*.webp") },
  @{ msg = "2026 competition day gallery (8/8)";                 paths = @("$G/event", ".") }
)

foreach ($c in $chunks) {
  foreach ($p in $c.paths) { git add $p 2>$null }
  $staged = git diff --cached --name-only
  if (-not $staged) { Write-Output "nothing staged for: $($c.msg)"; continue }
  if (-not (Push-Verified $c.msg)) { Write-Output "STOPPING at failed chunk"; exit 1 }
}
Write-Output "ALL CHUNKS PUSHED"
git status -sb | Select-Object -First 1

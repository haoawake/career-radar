$ErrorActionPreference='Stop'
$base='http://localhost:3000'
$before=Invoke-RestMethod "$base/api/jobs"
$j=$before.jobs | Where-Object source -eq 'figma' | Select-Object -First 1
if(!$j){throw 'No live job fixture'}
try {
 foreach($field in @('starred','applied')){Invoke-RestMethod "$base/api/jobs" -Method Patch -ContentType 'application/json' -Body (ConvertTo-Json @{id=$j.id;field=$field;value=$true}) | Out-Null}
 Invoke-RestMethod "$base/api/sync" -Method Post -ContentType 'application/json' -Body '{"source":"figma"}' | Out-Null
 $after=Invoke-RestMethod "$base/api/jobs"
 $updated=$after.jobs | Where-Object id -eq $j.id
 if(!$updated.starred -or !$updated.applied){throw 'Marks lost during refresh'}
 if($updated.first_seen -ne $j.first_seen){throw 'First seen changed'}
 if(($after.jobs.id | Sort-Object -Unique).Count -ne $after.jobs.Count){throw 'Duplicate IDs'}
 if($after.jobs.Count -ne $before.jobs.Count){throw 'Job count changed during immediate repeated fetch'}
 Write-Output "PASS: $($after.jobs.Count) live jobs; duplicate refresh stable; both marks persist; first-seen preserved."
} finally {
 foreach($field in @('starred','applied')){Invoke-RestMethod "$base/api/jobs" -Method Patch -ContentType 'application/json' -Body (ConvertTo-Json @{id=$j.id;field=$field;value=[bool]$j.$field}) | Out-Null}
}

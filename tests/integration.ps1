$ErrorActionPreference='Stop'
$base='http://localhost:3000'
# 更新是分页的，而且同一来源同时只允许一个调用持有租约，所以要轮询到本轮真正完成为止
function Sync-Source($id){
 for($i=0;$i -lt 60;$i++){
  $r=Invoke-RestMethod "$base/api/sync" -Method Post -ContentType 'application/json' -Body (ConvertTo-Json @{source=$id;pages=6})
  if($r.busy){Start-Sleep -Milliseconds 800;continue}
  if($r.done){return $r}
 }
 throw "Sync of $id did not finish"
}
$before=Invoke-RestMethod "$base/api/jobs?company=figma"
$j=$before.jobs | Select-Object -First 1
if(!$j){throw 'No live job fixture; sync the figma source first'}
try {
 foreach($field in @('starred','applied')){Invoke-RestMethod "$base/api/jobs" -Method Patch -ContentType 'application/json' -Body (ConvertTo-Json @{id=$j.id;field=$field;value=$true}) | Out-Null}
 # 连续同步两次：比较两次自己报告的收录数，而不是拿同步前后的总数比——
 # 上游随时可能真的新发或下架岗位，那种变化不该判成失败，真正要守住的是重复同步不产生重复岗位。
 $s1=Sync-Source 'figma'
 $s2=Sync-Source 'figma'
 if($s1.count -ne $s2.count){throw "Repeated sync changed job count: $($s1.count) -> $($s2.count)"}
 $after=Invoke-RestMethod "$base/api/jobs?company=figma"
 $updated=$after.jobs | Where-Object id -eq $j.id
 # Greenhouse 改用轻量列表后，重复更新不能把已有的岗位描述冲成空
 $described=($before.jobs | Where-Object {$_.description}).Count
 $describedAfter=($after.jobs | Where-Object {$_.description}).Count
 if($describedAfter -lt $described){throw "Descriptions lost on refresh: $described -> $describedAfter"}
 if(!$updated.starred -or !$updated.applied){throw 'Marks lost during refresh'}
 if($updated.first_seen -ne $j.first_seen){throw 'First seen changed'}
 if(($after.jobs.id | Sort-Object -Unique).Count -ne $after.jobs.Count){throw 'Duplicate IDs'}
 # 库里的数量只会不少于本轮抓到的数量：已从来源下架的岗位会保留下来（带「来源已移除」标记），
 # 以免连带丢掉重点与投递记录。真正防重复的断言是上面两次同步计数相等。
 if($after.total -lt $s2.count){throw "Stored count lower than sync result: $($after.total) vs $($s2.count)"}

 # 地区筛选：都会区与城市各自收窄结果，且城市不会多于所属都会区
 $all=Invoke-RestMethod "$base/api/jobs"
 $facets=Invoke-RestMethod "$base/api/overview?fresh=1"
 if(!$facets.metroCounts){throw 'No metro facets returned'}
 $metro=($facets.metroCounts.PSObject.Properties | Where-Object {$_.Name -ne 'remote' -and $_.Name -ne 'other-us'} | Sort-Object {$_.Value} -Descending | Select-Object -First 1).Name
 $inMetro=Invoke-RestMethod "$base/api/jobs?metro=$metro"
 if($inMetro.total -le 0){throw "Metro filter $metro returned nothing"}
 if($inMetro.total -gt $all.total){throw 'Metro filter widened the result set'}
 $cityFacets=Invoke-RestMethod "$base/api/overview?metro=$metro&fresh=1"
 $city=($cityFacets.cityCounts.PSObject.Properties | Sort-Object {$_.Value} -Descending | Select-Object -First 1).Name
 $inCity=Invoke-RestMethod "$base/api/jobs?metro=$metro&city=$city"
 if($inCity.total -le 0){throw "City filter $city returned nothing"}
 if($inCity.total -gt $inMetro.total){throw 'City filter exceeded its metro'}

 # 两个来源分类各自可用；用同一次响应里的统计比较，避免更新过程中数量变化造成误判
 $c=Invoke-RestMethod "$base/api/jobs?group=company"
 $p=Invoke-RestMethod "$base/api/jobs?group=platform"
 if($c.total -le 0 -or $p.total -le 0){throw 'A source category returned nothing'}
 if($facets.stats.company + $facets.stats.platform -ne $facets.stats.total){throw 'Some jobs belong to no registered source'}
 if($facets.sources.Count -le 0){throw 'Overview returned no sources'}
 Write-Output "PASS: $($all.total) live jobs; figma 重复同步 $($s1.count)=$($s2.count); $describedAfter/$($after.jobs.Count) 条带描述; $metro -> $($inMetro.total), $city -> $($inCity.total); company $($c.total) + platform $($p.total); marks and first-seen preserved."
} finally {
 foreach($field in @('starred','applied')){Invoke-RestMethod "$base/api/jobs" -Method Patch -ContentType 'application/json' -Body (ConvertTo-Json @{id=$j.id;field=$field;value=[bool]$j.$field}) | Out-Null}
}

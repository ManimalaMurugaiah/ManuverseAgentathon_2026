$ErrorActionPreference = 'Stop'
$base = 'http://127.0.0.1:8000/api/v1'
$login = Invoke-RestMethod -Uri "$base/auth/login" -Method Post -ContentType 'application/json' -Body (@{username='admin';password='Admin@123'} | ConvertTo-Json)
$h = @{Authorization = "Bearer $($login.access_token)"}

function Get-Api($path) { Invoke-RestMethod -Uri "$base$path" -Headers $h }
function Try-Api($label, $block) {
    try { $r = & $block; Write-Output ("PASS  {0}  {1}" -f $label, $r) }
    catch {
        $detail = ''
        if ($_.ErrorDetails.Message) { $detail = $_.ErrorDetails.Message }
        Write-Output ("FAIL  {0}  {1} {2}" -f $label, $_.Exception.Message, $detail)
    }
}

Try-Api 'lookups'          { $l = Get-Api '/lookups'; "types=$($l.project_types.Count) owners=$($l.owners.Count) plants=$($l.plants -join ',') templates=$($l.templates.Count)" }
Try-Api 'projects list'    { $p = Get-Api '/projects?page_size=10'; "total=$($p.total) first=$($p.items[0].name) sched=$($p.items[0].schedule_status) health=$($p.items[0].health)" }
Try-Api 'projects summary' { $s = Get-Api '/projects/summary'; "total=$($s.total) on=$($s.on_track) risk=$($s.at_risk) delayed=$($s.delayed) done=$($s.completed)" }
Try-Api 'project detail'   { $d = Get-Api '/projects/1'; "name=$($d.name) type=$($d.project_type) milestones=$($d.metrics.milestones_total) risksHigh=$($d.metrics.risks_high) actionsOpen=$($d.metrics.actions_open)" }
Try-Api 'next code'        { (Get-Api '/projects/next-code').code }
Try-Api 'risks'            { $r = Get-Api '/risks'; "total=$($r.total) open=$($r.open_count) first=$($r.items[0].title) sev=$($r.items[0].severity)" }
Try-Api 'actions'          { $a = Get-Api '/actions'; "total=$($a.total) overdue=$($a.overdue) first=$($a.items[0].title)" }
Try-Api 'dependencies'     { $g = Get-Api '/projects/1/dependencies'; "nodes=$($g.nodes.Count) edges=$($g.edges.Count) critical=$($g.critical_path -join '>') bottleneck=$($g.bottleneck.name)" }
Try-Api 'simulate'         { $s = Invoke-RestMethod -Uri "$base/projects/1/dependencies/simulate" -Method Post -Headers $h -ContentType 'application/json' -Body (@{milestone_id=1;delay_days=3} | ConvertTo-Json); $s.summary }
Try-Api 'overview'         { $o = Get-Api '/dashboard/overview'; "total=$($o.summary.total) ms=$($o.milestones.completed)/$($o.milestones.in_progress)/$($o.milestones.upcoming)/$($o.milestones.delayed) risks=$($o.top_risks.Count) activity=$($o.activity.Count) trend=$(($o.trend | ForEach-Object { $_.value }) -join ',')" }
Try-Api 'report data'      { $r = Get-Api '/reports/data?interval=Year&value=2026'; "range=$($r.stats.range_label) ms=$($r.stats.milestones) budget=$($r.budget.pct)% perf=$($r.performance.Count) deps=$($r.dependencies.Count)" }
Try-Api 'saved reports'    { "n=$((Get-Api '/reports/saved').Count)" }
Try-Api 'schedules'        { "n=$((Get-Api '/reports/schedules').Count)" }
Try-Api 'settings'         { $s = Get-Api '/settings'; "email=$($s.email_notifications) recipients=$($s.notification_recipients -join '|')" }
Try-Api 'integrations'     { (Get-Api '/settings/integrations' | ForEach-Object { "$($_.name)=$($_.status)" }) -join ' ' }
Try-Api 'users'            { $u = Get-Api '/users'; "n=$($u.Count) first=$($u[0].username)/$($u[0].role)/active=$($u[0].is_active)" }
Try-Api 'gov rules'        { $r = Get-Api '/governance/rules'; "n=$($r.Count) first=$($r[0].code) active=$($r[0].is_active)" }

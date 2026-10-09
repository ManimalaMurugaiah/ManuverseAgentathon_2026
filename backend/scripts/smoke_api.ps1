$base='http://127.0.0.1:8000/api/v1'
function Step($name,$ok,$msg){ if($ok){ Write-Output "PASS $name $msg" } else { Write-Output "FAIL $name $msg"; $script:failed=$true } }
$failed=$false

$loginBody=@{username='admin';password='Admin@123'}|ConvertTo-Json
try { $login=Invoke-RestMethod -Uri "$base/auth/login" -Method Post -ContentType 'application/json' -Body $loginBody; Step 'login_valid' ($login.access_token -and $login.refresh_token) 'status=200 tokens=present' } catch { Step 'login_valid' $false 'request_failed' }

$badBody=@{username='admin';password='wrong'}|ConvertTo-Json
try { Invoke-RestMethod -Uri "$base/auth/login" -Method Post -ContentType 'application/json' -Body $badBody | Out-Null; Step 'login_invalid' $false 'expected_401_got_200' } catch { $code=$_.Exception.Response.StatusCode.value__; $detail=''; try{ $r=New-Object IO.StreamReader($_.Exception.Response.GetResponseStream()); $detail=$r.ReadToEnd() } catch{}; Step 'login_invalid' ($code -eq 401 -and $detail -match 'Invalid username or password') "status=$code" }

try { $refreshBody=@{refresh_token=$login.refresh_token}|ConvertTo-Json; $refresh=Invoke-RestMethod -Uri "$base/auth/refresh" -Method Post -ContentType 'application/json' -Body $refreshBody; Step 'refresh' ($refresh.access_token -and $refresh.refresh_token) 'status=200 tokens=present' } catch { Step 'refresh' $false 'request_failed' }

try { $headers=@{Authorization="Bearer $($refresh.access_token)"}; $govBody=@{facts=@{DelayDays=6;SafetyClearance='Missing'}}|ConvertTo-Json -Depth 5; $gov=Invoke-RestMethod -Uri "$base/governance/evaluate" -Method Post -ContentType 'application/json' -Headers $headers -Body $govBody; $count=0; if($gov.findings){ $count=$gov.findings.Count }; Step 'governance_evaluate' ($count -gt 0) "status=200 findings=$count" } catch { Step 'governance_evaluate' $false 'request_failed' }

try { $headers=@{Authorization="Bearer $($refresh.access_token)"}; $lo=Invoke-RestMethod -Uri "$base/auth/logout" -Method Post -Headers $headers; Step 'logout_access' ($lo.message -eq 'Logged out') 'status=200' } catch { Step 'logout_access' $false 'request_failed' }

try { $headers=@{Authorization="Bearer $($refresh.access_token)"}; Invoke-RestMethod -Uri "$base/auth/me" -Method Get -Headers $headers | Out-Null; Step 'me_after_logout' $false 'expected_401_got_200' } catch { $code=$_.Exception.Response.StatusCode.value__; Step 'me_after_logout' ($code -eq 401) "status=$code" }

try { $lrBody=@{refresh_token=$refresh.refresh_token}|ConvertTo-Json; $lrr=Invoke-RestMethod -Uri "$base/auth/logout-refresh" -Method Post -ContentType 'application/json' -Body $lrBody; Step 'logout_refresh' ($lrr.message -eq 'Refresh token revoked') 'status=200' } catch { Step 'logout_refresh' $false 'request_failed' }

if($failed){ exit 1 }

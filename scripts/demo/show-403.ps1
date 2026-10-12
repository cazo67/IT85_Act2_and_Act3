# Sends one real request as the Student to an Admin-only endpoint and prints the status and safe body.
# The token is held in a variable and never printed.
$api = "http://127.0.0.1:8200/api/v1"
$login = Invoke-RestMethod -Method Post "$api/auth/login" -ContentType "application/json" -Body (@{ email = "student@example.com"; password = $env:DEMO_STUDENT_PASSWORD } | ConvertTo-Json)
$token = $login.data.access_token
Write-Host "Signed in as: $($login.data.user.name) ($($login.data.user.role))"
Write-Host "GET $api/users   (Authorization header sent, value hidden)"
try {
  Invoke-RestMethod "$api/users" -Headers @{ Authorization = "Bearer $token" } | Out-Null
  Write-Host "Unexpected success"
} catch {
  $status = [int]$_.Exception.Response.StatusCode
  Write-Host "HTTP status: $status $($_.Exception.Response.StatusDescription)"
  Write-Host "Response body: $($_.ErrorDetails.Message)"
}

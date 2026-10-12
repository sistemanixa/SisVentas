param([string]$Account='severiens2@gmail.com')
$ErrorActionPreference='Stop'
$cloudCli='C:\Users\gon_s\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd'
foreach($entry in @(@{Name='correoSolicitudConfirmada';Path='sv_catalogo_solicitudes_atencion/{id}'},@{Name='correoSolicitudDeclinada';Path='sv_catalogo_solicitudes_declinacion/{id}'})) {
 & $cloudCli functions deploy $entry.Name --gen2 --project=nixa-sisventas --account=$Account --region=us-central1 --runtime=nodejs22 --source=cloud-functions/solicitudes-correo --entry-point=$entry.Name --trigger-location=us-central1 --trigger-event-filters='type=google.firebase.database.ref.v1.created,instance=nixa-sisventas-default-rtdb' --trigger-event-filters-path-pattern="ref=$($entry.Path)" --set-secrets='NIXA_GMAIL_APP_PASSWORD=NIXA_GMAIL_APP_PASSWORD:latest' --set-env-vars=FUNCTION_SIGNATURE_TYPE=cloudevent --retry --memory=256Mi --timeout=60s --max-instances=3 --quiet
 if($LASTEXITCODE -ne 0){throw "No se pudo desplegar $($entry.Name)"}
}

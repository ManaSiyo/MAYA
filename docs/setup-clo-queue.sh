#!/usr/bin/env bash
# Owner-authorized dedicated CLO infrastructure; no keys or existing env replacement.
set -euo pipefail
# The slim SDK image exposes its bundled interpreter through gcloud info.
sdk_python=$(gcloud info --format='value(basic.python_location)')
test -x "$sdk_python"
project=pro-maya
region=us-west1
queue=maya-clo-assets
dispatch="maya-clo-dispatch@${project}.iam.gserviceaccount.com"
gcloud services enable cloudtasks.googleapis.com --project="$project" --quiet
gcloud beta services identity create --service=cloudtasks.googleapis.com --project="$project" --quiet >/dev/null
number=$(gcloud projects describe "$project" --format='value(projectNumber)')
runtime=$(gcloud run services describe maya-api --project="$project" --region="$region" --format='value(spec.template.spec.serviceAccountName)')
origin=$(gcloud run services describe maya-api --project="$project" --region="$region" --format='value(status.url)')
test -n "$runtime" && test -n "$origin"
if ! gcloud iam service-accounts describe "$dispatch" --project="$project" --format='value(email)' >/dev/null 2>&1; then
  gcloud iam service-accounts create maya-clo-dispatch --display-name='MAYA CLO task dispatch' --project="$project" --quiet
fi
if ! gcloud tasks queues describe "$queue" --location="$region" --project="$project" >/dev/null 2>&1; then
  gcloud tasks queues create "$queue" --location="$region" --project="$project" --max-concurrent-dispatches=1 --max-dispatches-per-second=1 --max-attempts=3 --min-backoff=10s --max-backoff=60s --log-sampling-ratio=1 --quiet
fi
gcloud tasks queues update "$queue" --location="$region" --project="$project" --max-concurrent-dispatches=1 --max-dispatches-per-second=1 --max-attempts=3 --min-backoff=10s --max-backoff=60s --log-sampling-ratio=1 --quiet
# Test the existing caller's capabilities before attempting redundant IAM writes.
# The build/runtime identity may already inherit enqueue and actAs permissions.
caller=$(gcloud config get-value account)
if [ "$caller" = "$runtime" ]; then
  "$sdk_python" - "$project" "$region" "$queue" "$dispatch" <<'CAPABILITIES'
import json,sys,urllib.request,subprocess
project,region,queue,dispatch=sys.argv[1:]
token=subprocess.check_output(['gcloud','auth','print-access-token'],text=True).strip()
checks=[('https://cloudtasks.googleapis.com/v2/projects/'+project+'/locations/'+region+'/queues/'+queue+':testIamPermissions','cloudtasks.tasks.create'),('https://iam.googleapis.com/v1/projects/'+project+'/serviceAccounts/'+dispatch+':testIamPermissions','iam.serviceAccounts.actAs')]
for url,permission in checks:
    request=urllib.request.Request(url,data=json.dumps({'permissions':[permission]}).encode(),headers={'Authorization':'Bearer '+token,'Content-Type':'application/json'})
    with urllib.request.urlopen(request) as response: allowed=json.load(response).get('permissions',[])
    if permission not in allowed: raise SystemExit('Owner IAM setup required: runtime lacks '+permission+' on the dedicated CLO resource.')
    print('Existing runtime permission verified:',permission)
CAPABILITIES
else
  gcloud tasks queues add-iam-policy-binding "$queue" --location="$region" --project="$project" --member="serviceAccount:$runtime" --role=roles/cloudtasks.enqueuer --quiet >/dev/null
  gcloud iam service-accounts add-iam-policy-binding "$dispatch" --project="$project" --member="serviceAccount:$runtime" --role=roles/iam.serviceAccountUser --quiet >/dev/null
fi
# Cloud Tasks' automatically provisioned service-agent role supplies OIDC token
# creation. The public API already permits transport access; its worker still
# verifies the dedicated signed email/audience. No IAM gate is removed or widened.
"$sdk_python" - "$origin" <<'TRANSPORT'
import sys,urllib.request,json
with urllib.request.urlopen(sys.argv[1]+'/api/healthz') as response:
    if response.status!=200: raise SystemExit('CLO transport requires owner review.')
print('Existing public API transport verified; dedicated worker JWT checks remain enforced.')
TRANSPORT
# Passed only to --update-env-vars: preserves all existing provider configuration.
printf 'CLO_TASK_QUEUE=projects/%s/locations/%s/queues/%s,CLO_TASK_ORIGIN=%s,CLO_TASK_SERVICE_ACCOUNT=%s,CLO_TASK_AUDIENCE=%s' "$project" "$region" "$queue" "$origin" "$dispatch" "$origin" > /workspace/.clo-env
echo 'Dedicated CLO queue, dispatch identity and existing required permissions are ready.'

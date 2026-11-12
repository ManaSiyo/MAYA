#!/usr/bin/env bash
# Owner-authorized dedicated CLO infrastructure; no keys or existing env replacement.
set -euo pipefail
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
gcloud tasks queues add-iam-policy-binding "$queue" --location="$region" --project="$project" --member="serviceAccount:$runtime" --role=roles/cloudtasks.enqueuer --quiet >/dev/null
for identity in "$runtime" "service-${number}@gcp-sa-cloudtasks.iam.gserviceaccount.com"; do
  gcloud iam service-accounts add-iam-policy-binding "$dispatch" --project="$project" --member="serviceAccount:$identity" --role=roles/iam.serviceAccountUser --quiet >/dev/null
done
gcloud run services add-iam-policy-binding maya-api --region="$region" --project="$project" --member="serviceAccount:$dispatch" --role=roles/run.invoker --quiet >/dev/null
# Passed only to --update-env-vars: preserves all existing provider configuration.
printf 'CLO_TASK_QUEUE=projects/%s/locations/%s/queues/%s,CLO_TASK_ORIGIN=%s,CLO_TASK_SERVICE_ACCOUNT=%s,CLO_TASK_AUDIENCE=%s' "$project" "$region" "$queue" "$origin" "$dispatch" "$origin" > /workspace/.clo-env
echo 'Dedicated CLO queue, dispatch identity and scoped permissions are ready.'

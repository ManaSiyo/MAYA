#!/bin/zsh
# MAYA, publish the SERVER (the API on Cloud Run). Double click, watch the last line.
[ -s "$HOME/.zprofile" ] && source "$HOME/.zprofile" >/dev/null 2>&1
[ -s "$HOME/.zshrc" ] && source "$HOME/.zshrc" >/dev/null 2>&1
export PATH="$PATH:/opt/homebrew/bin:/usr/local/bin"
cd "$(dirname "$0")/server" || { echo "Could not find docs/server."; read -k 1 -s; exit 1; }
echo "Publishing the MAYA API to Cloud Run (takes 2 to 4 minutes) ..."
gcloud run deploy maya-api --source . --region us-west1 --project pro-maya --quiet
if [ $? -eq 0 ]; then echo ""; echo "SUCCESS. The server is live."; else echo ""; echo "The server deploy FAILED, read the message above."; fi
read -k 1 -s

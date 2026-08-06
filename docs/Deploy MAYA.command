#!/bin/zsh
# MAYA, publish the website. Double click, read the last line.
# The config lives in docs; it is borrowed to the top for the minute the
# deploy runs, then removed again so the folder stays clean.
[ -s "$HOME/.zprofile" ] && source "$HOME/.zprofile" >/dev/null 2>&1
[ -s "$HOME/.zshrc" ] && source "$HOME/.zshrc" >/dev/null 2>&1
export PATH="$PATH:/opt/homebrew/bin:/usr/local/bin"
cd "$(dirname "$0")/.." || { echo "Could not find the MAYA folder."; read -k 1 -s; exit 1; }
cp docs/firebase.json ./firebase.json || { echo "docs/firebase.json is missing."; read -k 1 -s; exit 1; }
echo "Publishing $(pwd) to maya.manasiyo.com ..."
if command -v firebase >/dev/null 2>&1; then FB="firebase"; else FB="npx -y firebase-tools"; fi
${=FB} deploy --only hosting
st=$?
rm -f ./firebase.json
if [ $st -eq 0 ]; then
  echo ""
  echo "SUCCESS. The live site now matches this folder. Hard refresh the browser (shift + reload)."
else
  echo ""
  echo "The deploy FAILED, read the message above. If it mentions login, run: firebase login"
fi
read -k 1 -s

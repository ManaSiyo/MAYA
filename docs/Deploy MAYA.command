#!/bin/zsh
# MAYA, publish the website. Double click, Terminal runs it, read the last line.
[ -s "$HOME/.zprofile" ] && source "$HOME/.zprofile" >/dev/null 2>&1
[ -s "$HOME/.zshrc" ] && source "$HOME/.zshrc" >/dev/null 2>&1
[ -s "$HOME/.nvm/nvm.sh" ] && source "$HOME/.nvm/nvm.sh" >/dev/null 2>&1
export PATH="$PATH:/opt/homebrew/bin:/usr/local/bin:$HOME/.npm-global/bin"
cd "$HOME/Desktop/MAYA" || { echo "Could not find the MAYA folder."; read -k 1 -s; exit 1; }

FB=""
if command -v firebase >/dev/null 2>&1; then FB="firebase"
elif command -v npx >/dev/null 2>&1; then FB="npx -y firebase-tools"
fi

if [ -z "$FB" ]; then
  echo ""
  echo "The Firebase tool is not installed on this Mac yet. One time fix,"
  echo "copy this line, paste it here in Terminal, press return:"
  echo ""
  echo "  curl -sL https://firebase.tools | bash"
  echo ""
  echo "Then double click this file again."
  read -k 1 -s; exit 1
fi

echo "Publishing MAYA to maya.manasiyo.com ..."
${=FB} deploy --only hosting
if [ $? -eq 0 ]; then
  echo ""
  echo "SUCCESS. The live site now matches the folder. Hard refresh the browser (shift + reload)."
else
  echo ""
  echo "The deploy FAILED, read the message above. If it mentions login or credentials, run:"
  echo "  ${=FB} login"
  echo "then double click this file again."
fi
read -k 1 -s

#!/bin/sh
# git のフックを入れる（クローンしただけでは入らないので、一度だけ実行する）
#   sh tools/install-hooks.sh
set -e
cd "$(dirname "$0")/.."
mkdir -p .git/hooks
cat > .git/hooks/pre-commit <<'HOOK'
#!/bin/sh
# キャッシュ対象のファイルが1つでもステージされていたら、sw.js の VERSION を上げる。
# これを忘れると、更新をpushしてもテスターの端末に古い版が出続ける。
set -e
WATCH='invader_game.html spacewalk_game.html shootingstar_game.html abduction_game.html index.html manual.html fonts.css register-sw.js manifest.json apple-touch-icon.png pressstart2p-latin.woff2'
STAGED=$(git diff --cached --name-only)
HIT=0
for f in $WATCH; do
  case " $STAGED " in *" $f "*) HIT=1 ;; esac
done
[ "$HIT" = "1" ] || exit 0
sh tools/bump-sw.sh
git add sw.js
HOOK
chmod +x .git/hooks/pre-commit
echo "pre-commit フックを入れました（.git/hooks/pre-commit）"

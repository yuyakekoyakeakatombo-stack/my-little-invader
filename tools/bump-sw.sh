#!/bin/sh
# sw.js の VERSION を「日付＋その日の連番」に書き換える。
#
#  キャッシュ名は VERSION から作られるので、これを上げないと
#  テスターの端末に古い版が出続ける。上げ忘れが一番よくある事故なので、
#  pre-commit フックから自動で呼ぶ（tools/install-hooks.sh で導入）。
set -e
cd "$(dirname "$0")/.."
SW=sw.js
TODAY=$(date +%Y-%m-%d)
CUR=$(sed -n "s/^const VERSION = '\(.*\)';/\1/p" "$SW")

case "$CUR" in
  "$TODAY"-*) N=$(printf '%02d' $(( 10#${CUR##*-} + 1 )) ) ;;   # 同じ日なら連番を進める
  *)          N=01 ;;                                            # 日が変わったら01から
esac
NEW="$TODAY-$N"

# BSD/GNU どちらの sed でも動くように一時ファイル経由で書く
sed "s/^const VERSION = '.*';/const VERSION = '$NEW';/" "$SW" > "$SW.tmp" && mv "$SW.tmp" "$SW"

# ゲームの SETTINGS に出す版も同じものにする。ずれると、
#  テスターの画面に出ている版と 中身が食い違う
GAME=invader_game.html
sed "s/^  const APP_VERSION = '.*';/  const APP_VERSION = '$NEW';/" "$GAME" > "$GAME.tmp" && mv "$GAME.tmp" "$GAME"

echo "VERSION $CUR -> $NEW (sw.js / $GAME)"

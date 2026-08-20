#!/bin/sh
# git のフックを入れる（クローンしただけでは入らないので、一度だけ実行する）
#   sh tools/install-hooks.sh
#
# 中身は tools/pre-commit をそのまま置くだけ。
#  以前はこのファイルにフックの写しを埋め込んでいたが、tools/pre-commit を
#  更新しても写しのほうが古いままになり、実行するとテストを走らせない版に
#  戻ってしまっていた。写しは持たない。
set -e
cd "$(dirname "$0")/.."
[ -f tools/pre-commit ] || { echo "tools/pre-commit が見つかりません"; exit 1; }
mkdir -p .git/hooks
cp tools/pre-commit .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
echo "pre-commit フックを入れました（.git/hooks/pre-commit）"

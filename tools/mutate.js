// ══════════════════════════════════════════════════════════════
//  突然変異チェック。node tools/mutate.js で走る。
//
//  テストそのものが機能しているかを確かめる道具。本体をわざと壊して、
//  tools/test.js が落ちるかを見る。落ちなければ、その挙動は誰も見張っていない。
//
//  ここに並べてあるのは、実際にこのゲームで起きたバグの再現。
//  本体は毎回かならず元に戻す（途中で止めても復元されるよう finally で囲ってある）。
// ══════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const GAME = path.join(__dirname, '..', 'invader_game.html');
const TEST = path.join(__dirname, 'test.js');

// [名前, 置換前, 置換後, 期待]  期待='caught' … 検出できるべき
//                               期待='equivalent' … 壊しても挙動が変わらない（検出できなくてよい）
const MUTATIONS = [
  ['なかよしの上限を連続日数と無関係にする',
   'const BOND_CAP = [1, 1, 2, 2, 3];', 'const BOND_CAP = [5, 5, 5, 5, 5];', 'caught'],
  ['ふれあいを種類ではなく回数で数える',
   'if(!k[kind]){ k[kind] = 1; pet.touchCount = (pet.touchCount||0) + 1; }',
   'pet.touchCount = (pet.touchCount||0) + 1;', 'caught'],
  ['治した病気も放置に数える',
   'const sickLeft = d.sick && !d.cured;', 'const sickLeft = d.sick;', 'caught'],
  ['ワイルドにもお迎えが来るようにする',
   '!pet.departFlag && !isWild() &&', '!pet.departFlag &&', 'caught'],
  ['潜伏中でもくすりを嫌がる',
   "else if(pet.incubAt){", "else if(false){", 'caught'],
  ['恨みが溜まっていても帰還を止めない',
   "if(wrathful() && pet.stage !== 'final') return;", '', 'caught'],
  ['ワイルドでなくても侵攻する',
   "if(pet.stage !== 'final' || !isWild()) return false;",
   "if(pet.stage !== 'final') return false;", 'caught'],
  ['夜型シフトを無くす',
   'const OWL_MAX = 5;', 'const OWL_MAX = 0;', 'caught'],
  ['ごはんの回復量を段階で変えない',
   "const FEED_GAIN  = { egg: 3, mid: 3, larva: 2, adult: 1, final: 1 };",
   "const FEED_GAIN  = { egg: 1, mid: 1, larva: 1, adult: 1, final: 1 };", 'caught'],
  ['なかよしの上限（100）を外す',
   'pet.B = Math.min(100, pet.B + add);', 'pet.B = pet.B + add;', 'caught'],
  ['セーブ移行をせず、既定値まかせに戻す',
   'pet = migratePet(sv);', 'pet = Object.assign(defaultPet(), sv);', 'caught'],
  ['古いセーブに口調を与えない',
   "if(!p.voice && (p.stage === 'adult' || p.stage === 'final')) p.voice = pickVoice(p);", '', 'caught'],
  ['古いセーブのワイルドの印を復元しない',
   "        p.formWild = /3$/.test(p.form || '') && !wasHiddenRoute(p);",
   '        p.formWild = false;', 'caught'],
  ['古いセーブで、隠しルートで進化した子もワイルド扱いにする',
   "&& !wasHiddenRoute(p);", ';', 'caught'],
  ['大食いがワイルドを上書きできてしまう（順序の入れ替え）',
   "    if(pet.C < C_FORM_BAD){ pet.formWild = true; return key + '3'; }\n    if(bigEater()) return key + '1';",
   "    if(bigEater()) return key + '1';\n    if(pet.C < C_FORM_BAD){ pet.formWild = true; return key + '3'; }", 'caught'],
  ['大食いがプチではなくノーマルになる',
   "if(bigEater()) return key + '1';", "if(bigEater()) return key + '2';", 'caught'],
  ['条件がそろわなくても最終形態にしてしまう',
   "    return '';                                                         // まだ最終形態にならない",
   "    return key + '2';", 'caught'],
  ['成体で止める判断を無視して進化させる',
   "      if(!f) return;                              // どの条件にも当たらないうちは成体のまま待つ",
   "      if(!f) { pet.form = 'i2'; }", 'caught'],
  ['ノーマルの条件が片方だけで通ってしまう',
   "if(pet.C >= C_FORM_GOOD && allRounder()) return key + '2';",
   "if(pet.C >= C_FORM_GOOD || allRounder()) return key + '2';", 'caught'],
  ['ミニゲームの基準を下げる',
   "const ALLROUND = { sw: 600, ss: 700, ab: 400 };",
   "const ALLROUND = { sw: 1, ss: 1, ab: 1 };", 'caught'],
  ['成体で止まった子に迎えが来なくなる',
   "    if(pet.stage==='adult' && pet.lineageAt && !pet.ufoFlag && !pet.invadeFlag &&\n       now - pet.lineageAt >= STUCK_DAYS*86400000){",
   "    if(false){", 'caught'],
  ['成体の期限が最終形態の子にも効いてしまう',
   "if(pet.stage==='adult' && pet.lineageAt && !pet.ufoFlag && !pet.invadeFlag &&",
   "if(pet.lineageAt && !pet.ufoFlag && !pet.invadeFlag &&", 'caught'],
  ['古いセーブの判定に、いまの基準を使ってしまう',
   "      return (b.sw||0) >= 250 && (b.ss||0) >= 100 && (b.ab||0) >= 400; }",
   "      return allRounder(q); }", 'caught'],
  ['入れ子の欠けたキーを埋めない',
   "    p.best  = Object.assign({sw:0, ss:0, ab:0}, sv.best);", '', 'caught'],
  ['おもいでがメニューに並ばなくなる',
   "const head = (pet.gone || pet.dead) ? [['MEMORY','memory']] : [];", 'const head = [];', 'caught'],
  ['おもいでが育成中にも並んでしまう',
   "const head = (pet.gone || pet.dead) ? [['MEMORY','memory']] : [];", "const head = [['MEMORY','memory']];", 'caught'],
  ['通算カウンタを数えない',
   "        pet.total.feed++;                                           // 通算（おもいで用）", '', 'caught'],
  ['体型の呼び名が末尾と対応しなくなる',
   "return n === '1' ? T('plump') : n === '2' ? T('sleek') : n === '3' ? T('prickly') : '';",
   "return n === '1' ? T('sleek') : n === '2' ? T('plump') : n === '3' ? T('prickly') : '';", 'caught'],
  ['別れの形を見分けなくなる',
   "if(pet.goneBy === 'invade') return T('endInvade');", '', 'caught'],
  // 各分岐が個別に就寝判定を持つので、冒頭のガードだけ外しても挙動は変わらない
  ['doCare 冒頭の無効ガードだけ外す',
   '    if(careDisabled(act)) return;\n', '    \n', 'equivalent'],
];

const orig = fs.readFileSync(GAME, 'utf8');
let caught = 0, missed = [], unexpected = [];
try {
  process.stdout.write('突然変異チェック（本体をわざと壊して、テストが落ちるかを見る）\n\n');
  for(const [name, from, to, expect] of MUTATIONS){
    if(orig.split(from).length - 1 !== 1){
      console.log(`  ？ 対象が1か所に定まらない  ${name}`); continue;
    }
    fs.writeFileSync(GAME, orig.replace(from, to));
    let died = false;
    try { execFileSync(process.execPath, [TEST], { stdio: 'pipe' }); }
    catch(e){ died = true; }
    const good = (expect === 'caught') ? died : !died;
    if(good && expect === 'caught') caught++;
    if(!good && expect === 'caught') missed.push(name);
    if(!good && expect === 'equivalent') unexpected.push(name);
    const mark = good ? (expect === 'caught' ? '✓ 検出' : '－ 挙動不変') : '✗ 見逃し';
    console.log(`  ${mark}  ${name}`);
  }
} finally {
  fs.writeFileSync(GAME, orig);
}
console.log('\n本体は元に戻した');
const total = MUTATIONS.filter(m => m[3] === 'caught').length;
console.log(`検出 ${caught} / ${total}`);
if(missed.length) console.log('見逃し: ' + missed.join(' , '));
process.exit(missed.length ? 1 : 0);

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
  ['与えすぎがプリックリーを上書きできてしまう（順序の入れ替え）',
   "if(pet.C < C_FORM_BAD){ pet.formWild = true; return key + '3'; }     // プリックリー\n    if(bigEater() || pampered()) return key + '1';",
   "if(bigEater() || pampered()) return key + '1';\n    if(pet.C < C_FORM_BAD){ pet.formWild = true; return key + '3'; }", 'caught'],
  ['与えすぎがプランプではなくスリークになる',
   "if(bigEater() || pampered()) return key + '1';",
   "if(bigEater() || pampered()) return key + '2';", 'caught'],
  ['甘やかしの道をふさぐ',
   "if(bigEater() || pampered()) return key + '1';",
   "if(bigEater()) return key + '1';", 'caught'],
  ['甘やかしが大食いを兼ねてしまう（片方だけで通る）',
   "if(bigEater() || pampered()) return key + '1';",
   "if(bigEater() && pampered()) return key + '1';", 'caught'],
  ['甘やかしの条件がおやつだけで通ってしまう',
   "return (s.highBDays||0) >= PAMPER_DAYS && ((s.total||{}).snack||0) >= PAMPER_SNACKS; }",
   "return ((s.total||{}).snack||0) >= PAMPER_SNACKS; }", 'caught'],
  ['甘やかしの条件がなかよしだけで通ってしまう',
   "return (s.highBDays||0) >= PAMPER_DAYS && ((s.total||{}).snack||0) >= PAMPER_SNACKS; }",
   "return (s.highBDays||0) >= PAMPER_DAYS; }", 'caught'],
  ['なかよしの連続日数が切れなくなる',
   "pet.highBDays = (pet.B >= B_PAMPER) ? (pet.highBDays||0) + 1 : 0;",
   "pet.highBDays = (pet.highBDays||0) + 1;", 'caught'],
  ['なかよしを保つ線を下げる',
   "const B_PAMPER = 80, PAMPER_DAYS = 5, PAMPER_SNACKS = 25;",
   "const B_PAMPER = 0, PAMPER_DAYS = 5, PAMPER_SNACKS = 25;", 'caught'],
  ['条件がそろわなくても最終形態にしてしまう',
   "    return '';                                                          // まだ最終形態にならない",
   "    return key + '2';", 'caught'],
  ['成体で止める判断を無視して進化させる',
   "      if(!f) return;                              // どの条件にも当たらないうちは成体のまま待つ",
   "      if(!f) { pet.form = 'i2'; }", 'caught'],
  ['スリークの条件が片方だけで通ってしまう',
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
  ['うまれたては日記を書かないように戻す',
   "function diaryWriting(){ return !!pet.name && !!pet.stage; }",
   "function diaryWriting(){ return !!pet.name && pet.stage !== 'egg'; }", 'caught'],
  ['名前をつける前から日記を書いてしまう',
   "function diaryWriting(){ return !!pet.name && !!pet.stage; }",
   "function diaryWriting(){ return !!pet.stage; }", 'caught'],
  ['日記に段階を焼き付けない（読み返すと今の字になる）',
   "lv: diaryLevel(), wr: Math.round(writeRatio() * 100) / 100 };",
   "wr: Math.round(writeRatio() * 100) / 100 };", 'caught'],
  ['古い日記を、いちばん幼い字として扱ってしまう',
   "return (e && e.lv != null) ? (e.lv|0) : LV_ADULT;",
   "return (e && e.lv != null) ? (e.lv|0) : LV_NEW;", 'caught'],
  ['あかちゃんでも日本語を書けてしまう',
   "const ratio = (lv <= LV_BABY) ? 0 : (e.wr == null ? 1 : e.wr);",
   "const ratio = (e.wr == null ? 1 : e.wr);", 'caught'],
  ['書ける単語の割合を無視して、ぜんぶ書けてしまう',
   "              .map(w => (rnd() < ratio) ? { t: w } : { r: w });",
   "              .map(w => ({ t: w }));", 'caught'],
  ['自分の文字の長さが、もとの単語と合わなくなる',
   "              .map(w => (rnd() < ratio) ? { t: w } : { r: w });",
   "              .map(w => (rnd() < ratio) ? { t: w } : { r: 'あああ' });", 'caught'],
  ['宇宙文字が規則ではなく、字コードまかせになる',
   "    if(k && DIARY_RUNE[k]) return DIARY_RUNE[k];",
   "", 'caught'],
  ['清音と濁音を同じ字にしてしまう',
   "が:'g',ぎ:'g',ぐ:'g',げ:'g',ご:'g',", "が:'k',ぎ:'k',ぐ:'k',げ:'k',ご:'k',", 'caught'],
  ['来たばかりの子の書く量を絞らない',
   "    const cap = Math.min(4, Math.max(1, petDay()));", "    const cap = 4;", 'caught'],
  ['書く量が日を追って増えない（ずっと1話題）',
   "    const cap = Math.min(4, Math.max(1, petDay()));", "    const cap = 1;", 'caught'],
  ['あかちゃんの日記から絵が消える',
   "    if(entryLevel(e) === LV_BABY){", "    if(false){", 'caught'],
  ['こどもの日記にも絵が残ってしまう',
   "    if(entryLevel(e) === LV_BABY){", "    if(entryLevel(e) <= LV_CHILD){", 'caught'],
  ['幼いうちにも結びの言葉を書かせる',
   "      close:  diaryLevel() <= LV_BABY ? '' : voice(),",
   "      close:  voice(),", 'caught'],
  ['日記を開くたびに字の並びが変わる',
   "    const rnd = diaryRnd('w' + (e.cd || '') + (e.d || 0));",
   "    const rnd = () => Math.random();", 'caught'],
  ['うまれたてのページが空になる',
   "    if(!items.length) items.push(pick(DIARY_SCRAWL));",
   "    if(!items.length) return [];", 'caught'],
  ['出来事が絵にならない（絵記号を引かない）',
   "    (e.t || []).forEach(t => { const k = TAG_PICT[t]; if(k) items.push(DIARY_PICT[k]); });",
   "", 'caught'],
  ['段階で字の大きさが変わらない',
   "const LV_DOT = [4, 3, 2, 0];", "const LV_DOT = [2, 2, 2, 0];", 'caught'],
  ['初回起動の言語を英語に戻す',
   "let lang = 'ja';\n  try{ if(localStorage.getItem('myvader_lang') === 'en') lang = 'en'; }catch(e){}",
   "let lang = 'en';\n  try{ if(localStorage.getItem('myvader_lang') === 'ja') lang = 'ja'; }catch(e){}", 'caught'],
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

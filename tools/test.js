// ══════════════════════════════════════════════════════════════
//  回帰テスト。node tools/test.js で走る。
//
//  ねらいは「動くけれど間違っている」を捕まえること。目視では気づけなかった
//  たぐいのバグ（薄いアイコンが効いてしまう／得点が内部で負に沈む／
//  リセットで演出が飛ぶ）を、二度と素通りさせないための網。
// ══════════════════════════════════════════════════════════════
const { load } = require('./harness');

let pass = 0, fail = 0, group = '';
const fails = [];
function describe(name, fn){ group = name; fn(); }
function it(name, fn){
  try { fn(); pass++; }
  catch(e){ fail++; fails.push(`  ${group} › ${name}\n    ${e.message}`); }
}
function eq(actual, expected, msg){
  const a = JSON.stringify(actual), b = JSON.stringify(expected);
  if(a === b) return;
  // オブジェクト同士なら、食い違ったキーだけを出す。丸ごと並べても読めないため
  if(actual && expected && typeof actual === 'object' && typeof expected === 'object'
     && !Array.isArray(actual)){
    const keys = new Set([...Object.keys(expected), ...Object.keys(actual)]);
    const diff = [];
    for(const k of keys){
      const x = JSON.stringify(expected[k]), y = JSON.stringify(actual[k]);
      if(x !== y) diff.push(`${k}: 期待 ${x} / 実際 ${y}`);
    }
    throw new Error(`${msg||''} ${diff.join(' , ')}`);
  }
  throw new Error(`${msg||''} 期待 ${b} / 実際 ${a}`);
}
function ok(v, msg){ if(!v) throw new Error(msg || '真であるべき'); }

// テスト用の子を作る。既定は「起きている昼間の、健康な幼体」。
//  時刻はサンドボックス側の時計（clock）で作ること。テストファイル側の Date.now() は
//  実時刻なので、そのまま入れるとゲーム内の「いま」とずれて判定が狂う
function pet(api, clock, over = {}){
  const now = clock.now();
  const tk = api.todayKey();
  Object.assign(api.pet, {
    name:'TEST', stage:'larva', lineage:'', form:'', formWild:false, voice:'',
    hunger:4, mood:4, health:'GOOD', dead:'', gone:false, goneBy:'',
    ufoFlag:false, departFlag:false, invadeFlag:false,
    B:50, C:50, D:50, Dm:50, P:0, M:0, A:0, EP:2, W:0, incubAt:0, poopSince:0,
    best:{sw:0,ss:0,ab:0}, plays:{sw:0,ss:0,ab:0}, diary:{},
    diaryDay:tk, diaryDue:null, diaryMark:null, calDay:tk,
    careStreak:0, dayKey:'', bGainToday:0, bGainKinds:{},
    touchCount:0, touchKinds:{}, touchedToday:false,
    larvaAt: now - 5*86400000, snapL:{praise:0,bad:0,plays:0},
    lastTick: now, birth: now - 8*86400000,
    starveAcc:0, hungerAcc:0, moodAcc:0, sickAcc:0, sickCount:0,
    estrangedDays:0, lowBDays:0, wrathDays:0, noTouchDays:0,
    nightPlayToday:false, nightCareToday:false, nightCareAt:0,
    mealCount:0, snackCount:0, overAcc:0, praiseCount:0, scoldBadCount:0,
    plateAt:0, plateKind:'meal', plateSpoiled:false, tantrumAt:0, tantrumType:'',
    wokeUntil: now + 7200000, rhythmUntil:0, fullFeeds:0, nightPlays:0, finalAt:0,
  }, over);
  return api.pet;
}
// 1日ぶんを締める。care=きちんと世話をした日か
function day(api, care, extra = {}){
  const d = Object.assign({}, extra);
  let touches = 0;
  if(care){ touches = 2; } else { d.hungry = 1; }
  api.pet.dayKey = '';                     // 新しい日として上限を戻す
  if(care){ api.gainB(2,'play'); api.gainB(1,'praise'); api.gainB(1,'snack'); }
  api.closeOneDay(d, touches, false);
}

// ══ なかよし ══════════════════════════════════════════════
describe('なかよし', () => {
  it('まとめて世話をしても、連続0日ならその日は+1で頭打ち', () => {
    const { api, clock } = load();
    pet(api, clock, { careStreak:0, B:50 });
    api.gainB(2,'play'); api.gainB(1,'praise'); api.gainB(1,'snack'); api.gainB(1,'feed');
    eq(api.pet.B, 51);
  });
  it('連続4日つづけば、その日は+3まで入る', () => {
    const { api, clock } = load();
    pet(api, clock, { careStreak:4, B:50 });
    api.gainB(2,'play'); api.gainB(1,'praise'); api.gainB(1,'snack');
    eq(api.pet.B, 53);
  });
  it('同じ世話を繰り返しても1回ぶんしか効かない', () => {
    const { api, clock } = load();
    pet(api, clock, { careStreak:4, B:50 });
    for(let i=0;i<5;i++) api.gainB(1,'praise');
    eq(api.pet.B, 51);
  });
  it('上限をはみ出さない（以前は最後の1回が超えていた）', () => {
    const { api, clock } = load();
    pet(api, clock, { careStreak:4, B:50 });
    api.gainB(2,'play'); api.gainB(2,'x'); api.gainB(2,'y');
    eq(api.pet.B, 53, '上限3で止まる:');
  });
  it('100を超えない／0を下回らない', () => {
    const { api, clock } = load();
    pet(api, clock, { careStreak:4, B:99 });
    api.gainB(2,'play'); eq(api.pet.B, 100);
    pet(api, clock, { B:2, careStreak:0 });
    api.closeOneDay({hungry:1}, 0, false);
    ok(api.pet.B >= 0, '0未満にならない');
  });
  it('毎日こまめに世話をすると積み上がる', () => {
    const { api, clock } = load();
    pet(api, clock, { B:35, careStreak:2 });
    for(let i=0;i<14;i++) day(api, true);
    ok(api.pet.B >= 70, `14日で70以上になるはず（実際 ${api.pet.B}）`);
  });
  it('2日放置→まとめて世話 を繰り返すと下がっていく', () => {
    const { api, clock } = load();
    pet(api, clock, { B:35, careStreak:2 });
    for(let i=1;i<=12;i++) day(api, i % 3 === 0);
    ok(api.pet.B < 20, `下がるはず（実際 ${api.pet.B}）`);
  });
});

// ══ ふれあいの数え方 ══════════════════════════════════════
describe('ふれあい', () => {
  it('同じ種類は何回でも1回ぶん', () => {
    const { api, clock } = load();
    pet(api, clock);
    api.markTouch('praise'); api.markTouch('praise'); api.markTouch('praise');
    eq(api.pet.touchCount, 1);
  });
  it('種類が違えば数が増える', () => {
    const { api, clock } = load();
    pet(api, clock);
    api.markTouch('praise'); api.markTouch('play'); api.markTouch('snack');
    eq(api.pet.touchCount, 3);
  });
  it('種類なし（そうじ・くすり）は来訪だけ記録して数には入らない', () => {
    const { api, clock } = load();
    pet(api, clock);
    api.markTouch();
    eq(api.pet.touchCount, 0);
    eq(api.pet.touchedToday, true);
  });
});

// ══ 病気とその日の扱い ════════════════════════════════════
describe('病気', () => {
  it('その日のうちに治せば放置に数えない', () => {
    const { api, clock } = load();
    pet(api, clock, { B:50, careStreak:4 });
    api.closeOneDay({ sick:1, cured:1 }, 2, false);
    eq(api.pet.B, 50, 'なかよしは減らない:');
    eq(api.pet.careStreak, 5, '連続日数は伸びる:');
  });
  it('治さないまま日をまたぐと放置になる', () => {
    const { api, clock } = load();
    pet(api, clock, { B:50, careStreak:4 });
    api.closeOneDay({ sick:1 }, 2, false);
    eq(api.pet.B, 47);
    eq(api.pet.careStreak, 2);
  });
  it('ケア度は治しても健康な日に及ばない（+10が得にならない）', () => {
    const { api, clock } = load();
    pet(api, clock);
    const healthy = api.dailyCareScore({ playSw:1 });
    const cured   = api.dailyCareScore({ sick:1, cured:1, playSw:1 });
    ok(cured < healthy, `病気の日は必ず下（健康 ${healthy} / 治療 ${cured}）`);
  });
});

// ══ お世話アイコン ════════════════════════════════════════
describe('お世話', () => {
  it('薄く表示される操作は、押しても状態を変えない', () => {
    const { api, clock } = load();
    clock.setTime(3, 0);                       // 就寝中
    pet(api, clock, { wokeUntil:0, mood:4 });
    ok(api.careDisabled('PET'), '就寝中のほめるは無効のはず');
    const before = api.pet.mood;
    api.doCare('PET');
    eq(api.pet.mood, before, 'きげんが動いてはいけない:');
  });
  // かつて「アイコンは薄いのに、押すと機嫌が下がる」バグがあった。
  //  個々の分岐が就寝判定を持つようになったので今は二重防御だが、
  //  分岐を足したときに破れないよう、不変条件として総当たりで押さえておく
  it('無効な操作は、どれを押しても状態を変えない（総当たり）', () => {
    const acts = ['FEED','SNACK','CLEAN','MED','PET','SCOLD'];
    const situations = [
      ['就寝中',        { hour:3, over:{ wokeUntil:0 } }],
      ['皿が残っている', { hour:14, over:{ plateAt:1 } }],
      ['片づけるものが無い', { hour:14, over:{ W:0, plateAt:0, plateSpoiled:false } }],
      ['命名前',        { hour:14, over:{ name:'' } }],
      ['おばけ',        { hour:14, over:{ dead:'starve' } }],
      ['帰還後',        { hour:14, over:{ gone:true } }],
    ];
    for(const [label, sit] of situations){
      for(const act of acts){
        const { api, clock } = load();
        clock.setTime(sit.hour, 0);
        pet(api, clock, Object.assign({ plateAt:0 }, sit.over));
        if(!api.careDisabled(act)) continue;          // 有効な操作は対象外
        const before = JSON.stringify(api.pet);
        api.doCare(act);
        eq(JSON.parse(JSON.stringify(api.pet)), JSON.parse(before),
           `${label} の ${act}:`);
      }
    }
  });
  it('片づけるものが無いときの そうじ は無効', () => {
    const { api, clock } = load();
    pet(api, clock, { W:0, plateAt:0, plateSpoiled:false });
    ok(api.careDisabled('CLEAN'));
  });
  it('皿が残っているあいだは ごはん を出せない', () => {
    const { api, clock } = load();
    pet(api, clock, { plateAt: Date.now() });
    ok(api.careDisabled('FEED'));
  });
  it('健康なのにくすりを飲ませると、きげんが下がり恨みが増える', () => {
    const { api, clock } = load();
    pet(api, clock, { health:'GOOD', incubAt:0, mood:4, M:0 });
    api.doCare('MED');
    eq(api.pet.mood, 3);
    eq(api.pet.M, api.M_ADJ.medWell);
  });
  it('潜伏中にくすりを飲ませると発症を防げる（病気回数は増えない）', () => {
    const { api, clock } = load();
    pet(api, clock, { incubAt: clock.now() + 1800000, mood:4, M:0, sickCount:0 });
    api.doCare('MED');
    eq(api.pet.incubAt, 0, '潜伏が解除される:');
    eq(api.pet.mood, 4, 'きげんは下がらない:');
    eq(api.pet.M, 0, '恨みは増えない:');
    eq(api.pet.sickCount, 0, '病気になったことにはしない:');
  });
});

// ══ おなかの段階差 ════════════════════════════════════════
describe('おなか', () => {
  const feeds = (api) => { let n = 0; api.pet.hunger = 0;
    while(api.pet.hunger < api.HUNGER_MAX && n < 20){ api.feedFill(); n++; } return n; };
  it('小さい子ほど少ない回数で満腹になる', () => {
    const { api, clock } = load();
    pet(api, clock, { stage:'egg' });    const egg = feeds(api);
    pet(api, clock, { stage:'larva' });  const larva = feeds(api);
    pet(api, clock, { stage:'adult', lineage:'inv' }); const adult = feeds(api);
    eq([egg, larva, adult], [2, 3, 5]);
  });
  it('小さい子ほど早くおなかがすく', () => {
    const { api, clock } = load();
    pet(api, clock, { stage:'egg' });   const egg = api.hungerMin();
    pet(api, clock, { stage:'larva' }); const larva = api.hungerMin();
    pet(api, clock, { stage:'adult', lineage:'inv' }); const adult = api.hungerMin();
    ok(egg < larva && larva < adult, `${egg} < ${larva} < ${adult} であるべき`);
  });
  it('満腹を超えない', () => {
    const { api, clock } = load();
    pet(api, clock, { stage:'egg', hunger:4 });
    api.feedFill();
    eq(api.pet.hunger, api.HUNGER_MAX);
  });
});

// ══ 生活リズム ════════════════════════════════════════════
describe('生活リズム', () => {
  it('やんちゃなほど就寝と起床が後ろへずれる', () => {
    const { api, clock } = load();
    pet(api, clock, { stage:'adult', lineage:'inv', P:0 });
    const calm = api.sleepConfig();
    api.pet.P = 60;
    const wild = api.sleepConfig();
    ok(wild.bed > calm.bed && wild.wake > calm.wake, '就寝も起床も後ろへ');
    eq(Math.round((wild.bed - calm.bed) * 10) / 10, 5, '最大シフトは5時間:');
  });
  it('リズムが整っている子は「乱れた昼寝」にならない', () => {
    const { api, clock } = load();
    pet(api, clock, { stage:'adult', lineage:'inv', P:0 });
    for(let h = 0; h < 24; h++){
      clock.setTime(h, 30);
      ok(api.sleepKind(new Date(clock.now())) !== 'owl', `${h}時が owl になってはいけない`);
    }
  });
  it('昼夜逆転した子は、昼間の睡眠が「乱れ」と判定される', () => {
    const { api, clock } = load();
    pet(api, clock, { stage:'adult', lineage:'inv', P:60 });
    clock.setTime(10, 0);
    eq(api.sleepKind(new Date(clock.now())), 'owl');
  });
  it('夜更かしを叱ると、すぐには寝ないが しばらくして寝る', () => {
    const { api, clock } = load();
    clock.setTime(1, 0);
    pet(api, clock, { stage:'adult', lineage:'inv', P:60, wokeUntil:0, tantrumAt:0 });
    ok(api.stayingUpLate(), '1時は夜更かし中のはず');
    api.doCare('SCOLD');
    ok(!api.effectiveAsleep(), 'しかった直後はまだ起きている');
    clock.advance(10 * 60000);
    ok(api.effectiveAsleep(), '10分後には寝ている');
  });
  it('ふつうの夜の睡眠を起こすのは理不尽なしかるのまま', () => {
    const { api, clock } = load();
    clock.setTime(3, 0);
    pet(api, clock, { stage:'adult', lineage:'inv', P:0, wokeUntil:0, scoldBadCount:0 });
    eq(api.sleepKind(new Date(clock.now())), 'night');
    api.doCare('SCOLD');
    eq(api.pet.scoldBadCount, 1, '理不尽として数える:');
  });
});

// ══ エンディングの棲み分け ════════════════════════════════
describe('エンディング', () => {
  it('無関心な放置は帰還（E3）になる', () => {
    const { api, clock } = load();
    pet(api, clock, { B:40, M:0, larvaAt: clock.now() - 10*86400000, noTouchDays:6 });
    for(let i=0;i<5 && !api.pet.ufoFlag;i++) api.closeOneDay({hungry:1}, 0, false);
    ok(api.pet.ufoFlag, '帰還が確定するはず');
    ok(!api.pet.invadeFlag, '侵攻にはならない');
  });
  it('恨みが溜まっている間は、最終形態に届くまで帰還を止める', () => {
    const { api, clock } = load();
    pet(api, clock, { stage:'larva', M:80, B:10, noTouchDays:6, larvaAt: clock.now() - 10*86400000 });
    for(let i=0;i<6;i++) api.closeOneDay({hungry:1}, 0, false);
    ok(!api.pet.ufoFlag, '出て行かず、居座って恨む');
  });
  it('最終形態のワイルド＋恨み＋低いなかよし＋昼夜逆転 で侵攻（E5）', () => {
    const { api, clock } = load();
    pet(api, clock, { stage:'final', lineage:'inv', form:'i3', formWild:true,
               M:100, B:5, P:80, noTouchDays:3, finalAt: clock.now() - 5*86400000 });
    for(let i=0;i<4 && !api.pet.invadeFlag;i++) api.closeOneDay({hungry:1}, 0, false);
    ok(api.pet.invadeFlag, '侵攻が確定するはず');
  });
  it('ワイルドでなければ、条件がそろっても侵攻しない', () => {
    const { api, clock } = load();
    pet(api, clock, { stage:'final', lineage:'inv', form:'i1', formWild:false,
               M:100, B:5, P:80, noTouchDays:3, finalAt: clock.now() - 5*86400000 });
    for(let i=0;i<5;i++) api.checkInvade();
    ok(!api.pet.invadeFlag);
  });
  it('ワイルドにはお迎え（E4）が来ない', () => {
    const { api, clock } = load();
    pet(api, clock, { stage:'final', lineage:'inv', form:'i3', formWild:true,
               B:90, health:'GOOD', finalAt: clock.now() - 20*86400000,
               lastTick: clock.now() - 120000, touchCount:2 });
    api.advancePet();
    ok(!api.pet.departFlag, '旅立ちは出ない');
    ok(api.pet.ufoFlag, 'かわりに静かな帰還で幕が下りる');
  });
  it('ワイルドでなければ、条件を満たすとお迎えが来る', () => {
    const { api, clock } = load();
    pet(api, clock, { stage:'final', lineage:'inv', form:'i1', formWild:false,
               B:90, health:'GOOD', finalAt: clock.now() - 20*86400000,
               lastTick: clock.now() - 120000, touchCount:2 });
    api.advancePet();
    ok(api.pet.departFlag, '旅立ちが確定するはず');
  });
});

// ══ 日記 ══════════════════════════════════════════════════
describe('日記', () => {
  it('別れの言葉は3口調そろっている', () => {
    const { api, clock } = load();
    for(const tag of ['farewell','farewellWild','departed','wrath'])
      eq(api.DIARY_LINES[tag].length, 3, `${tag}:`);
  });
  it('ひとりごとは全部が3口調ぶんそろっている', () => {
    const { api, clock } = load();
    for(const [k, m] of Object.entries(api.DIARY_MUSINGS))
      for(const lang of ['ja','en'])
        for(const v of ['plain','calm','rough'])
          ok(Array.isArray(m[lang][v]) && m[lang][v].length > 0, `${k}.${lang}.${v} が無い`);
  });
  it('結びも3口調そろっている', () => {
    const { api, clock } = load();
    for(const v of ['plain','calm','rough'])
      ok(api.DIARY_CLOSE[v] && api.DIARY_CLOSE[v].length > 0, `${v} が無い`);
  });
  it('DIARY_PRIORITY に載っているタグは、全部 文面を持っている', () => {
    const { api, clock } = load();
    for(const t of api.DIARY_PRIORITY) ok(api.DIARY_LINES[t], `${t} の文面が無い`);
  });
  it('口調は成体で確定し、それまでは共通', () => {
    const { api, clock } = load();
    pet(api, clock, { stage:'larva', voice:'' });
    eq(api.voice(), 'plain');
    api.pet.lineage = 'grey'; api.pet.P = 60;
    eq(api.pickVoice(), 'rough');
    api.pet.lineage = 'tako'; api.pet.P = -60;
    eq(api.pickVoice(), 'calm');
  });
  it('古い日記（口調を持たない形）でも文面が欠けない', () => {
    const { api, clock } = load();
    pet(api, clock);
    const body = api.diaryBody({ d:1, n:'OLD', t:['farewell'], s:'star1', c:'lively', cv:0 });
    ok(body.length > 0, '本文が出るはず');
  });
});

// ══ 進化 ══════════════════════════════════════════════════
describe('進化', () => {
  it('雑に育てるとワイルド系になり、印が残る', () => {
    const { api, clock } = load();
    pet(api, clock, { stage:'larva', lineage:'inv', C:10, nightPlays:0, D:50 });
    const form = api.pickForm();
    eq(form, 'i3');
    eq(api.pet.formWild, true);
  });
  it('丁寧に育てればワイルドにならない', () => {
    const { api, clock } = load();
    pet(api, clock, { stage:'larva', lineage:'inv', C:90, nightPlays:0, D:50 });
    api.pickForm();
    eq(api.pet.formWild, false);
  });
  it('隠しルートのオールラウンダーはワイルド扱いにしない', () => {
    const { api, clock } = load();
    pet(api, clock, { stage:'larva', lineage:'grey', C:10,
               best:{sw:300, ss:150, ab:500} });
    eq(api.pickForm(), 'g3');
    eq(api.pet.formWild, false, 'ごほうびの姿なのでワイルドではない:');
  });
});

// ══ ファイル全体の健全性 ══════════════════════════════════
//  ミニゲームは本体と別のHTMLで、この足場では動かせない。
//  代わりに「構文が通るか」と「壊しやすい約束事」をソースの上で確かめる
describe('ファイル', () => {
  const fs = require('fs'), path = require('path'), vm = require('vm');
  const dir = path.join(__dirname, '..');
  const files = ['invader_game.html','spacewalk_game.html','shootingstar_game.html',
                 'abduction_game.html','manual.html'];
  const read = f => fs.readFileSync(path.join(dir, f), 'utf8');
  const scripts = f => {
    const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g, out = [];
    let m; while((m = re.exec(read(f)))) out.push(m[1]);
    return out;
  };
  it('すべてのHTMLの中のJavaScriptが構文エラーを起こさない', () => {
    for(const f of files)
      scripts(f).forEach((code, i) => {
        try { new vm.Script(code); }
        catch(e){ throw new Error(`${f} の script#${i+1}: ${e.message}`); }
      });
  });
  it('検証用の一時コードが残っていない', () => {
    //  window.__placeLed は本番のコード（同じファイル内の2つのscriptでLEDの位置を共有する）
    const ALLOWED = ['__placeLed'];
    for(const f of files){
      const src = read(f);
      ok(!src.includes('globalThis.__'), `${f} に globalThis.__ が残っている`);
      ok(!/\bdebugger\b/.test(src), `${f} に debugger が残っている`);
      for(const m of src.matchAll(/window\.(__\w+)/g))
        ok(ALLOWED.includes(m[1]), `${f} に検証用の window.${m[1]} が残っている`);
    }
  });
  it('ミニゲーム3本とも、得点は0未満にならない', () => {
    for(const f of ['spacewalk_game.html','shootingstar_game.html','abduction_game.html']){
      const src = read(f);
      ok(!/score\s*-=/.test(src), `${f}: 下限のない減点（score-=）が残っている`);
      ok(!/padStart\(5,/.test(src), `${f}: 5桁の得点表示が残っている`);
    }
  });
  it('ミニゲーム3本とも、HUDの並びが揃っている', () => {
    for(const f of ['spacewalk_game.html','shootingstar_game.html','abduction_game.html']){
      const src = read(f);
      ok(/txt\('SCORE',1,1,8,ON\)/.test(src), `${f}: ヘッダーの SCORE が定位置にない`);
      ok(/txtR\(String\(Math\.max\(0,score\)\)\.padStart\(4,'0'\), W-1, 1, 8, ON\)/.test(src),
         `${f}: 得点が右そろえ4桁になっていない`);
      ok(/,\s*59,\s*7,/.test(src), `${f}: フッターが y=59 / 7px になっていない`);
    }
  });
  it('サービスワーカーのVERSIONが日付の形をしている', () => {
    const m = read('sw.js').match(/const VERSION = '([^']+)'/);
    ok(m, 'VERSION が見つからない');
    ok(/^\d{4}-\d{2}-\d{2}-\d{2}$/.test(m[1]), `VERSION の形が違う: ${m[1]}`);
  });
});

// ══ 結果 ══════════════════════════════════════════════════
console.log('');
if(fails.length){ console.log(fails.join('\n')); console.log(''); }
console.log(`${pass} 件成功 / ${fail} 件失敗`);
process.exit(fail ? 1 : 0);

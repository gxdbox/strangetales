/**
 * 第一章《画皮》剧情状态机端到端推演（Node 运行，不依赖 cc 引擎）
 * 运行：npx -p typescript tsc -p tools/e2e/tsconfig.e2e.json && node tools/e2e/run_flow.js
 */
const W = require('../e2e/out/assets/scripts/data/WorldData.js');

let progress = 'intro';
let fails = 0;

function apply(r) {
    if (r.next) progress = r.next;
    return r;
}

function expect(cond, msg) {
    if (cond) {
        console.log('[ok] ' + msg);
    } else {
        console.log('[FAIL] ' + msg + '  (current progress=' + progress + ')');
        fails++;
    }
}

// 1. 开场
let r = apply(W.entryStep(progress));
expect(r.key === 'intro' && progress === 'explore', '开场对白 intro -> explore');

// 2. 山门：初遇老僧，习得清心诀、得纸符x2
r = apply(W.npcStep('monk', progress));
expect(r.key === 'monk_first' && progress === 'warned' && r.skill === 'heal' && r.items['纸符'] === 2,
    `初遇老僧 -> warned，传清心诀+纸符x2 (got ${r.key}/${r.skill}/${JSON.stringify(r.items)})`);

// 3. 大殿供桌
r = apply(W.triggerStep('altar', progress));
expect(r.key === 'altar', '供桌触发 altar');

// 4. 偏院：初遇若娘，得红罗帕
r = apply(W.npcStep('maiden', progress));
expect(r.key === 'maiden_first' && progress === 'met_m' && r.items['红罗帕'] === 1, '初遇若娘 -> met_m + 红罗帕');

// 5. 山门：再遇老僧 -> 夜半勿应声
r = apply(W.npcStep('monk', progress));
expect(r.key === 'monk_second' && progress === 'watch_night', '再遇老僧 -> watch_night');

// 6. 老僧已离寺
r = apply(W.npcStep('monk', progress));
expect(r.key === 'monk_gone', '老僧离寺 monk_gone');

// 7. 夜探偷窥 -> 揭画皮 -> Boss 战
r = apply(W.triggerStep('peep', progress));
expect(r.key === 'peep' && progress === 'revealed' && r.boss === true, '偷窥揭画皮 -> revealed + boss');

// 8. 再次偷窥不重复触发 boss（revealed 不在触发条件内）
r = apply(W.triggerStep('peep', progress));
expect(!r.boss && !r.next, 'peep 在 revealed 后不再触发');

// 9. Boss 战胜利 -> cleared（由 BattleScreen 设置，这里模拟）
progress = 'cleared';
r = apply(W.npcStep('maiden', progress));
expect(r.key === 'victory' && r.next === 'ending', '胜利后对话 -> ending');

// 10. 结局画面（EndingScreen 播放 TEXT.ending）
expect(!!W.TEXT.ending && W.TEXT.ending.length > 0, '存在结局文案 TEXT.ending');

// 11. 暗林提示与井道具
progress = 'warned';
r = apply(W.triggerStep('forest_hint', progress));
expect(r.key === 'forest_hint', '暗林提示 forest_hint');
r = apply(W.triggerStep('well', progress));
expect(r.key === 'well' && r.items['药汤'] === 1, '井中取药汤 x1');

// 12. 未到 watch_night 时偷窥不触发
expect(!apply(W.triggerStep('peep', progress)).boss, 'warned 阶段 peep 不触发');

// 13. 若娘在 met_m 阶段二段对话
progress = 'met_m';
r = apply(W.npcStep('maiden', progress));
expect(r.key === 'maiden_second' && progress === 'met_m', '若娘二段对话不推进进度');

console.log(fails === 0 ? '\n=== FLOW ALL OK ===' : `\n=== FLOW ${fails} FAILED ===`);
process.exit(fails === 0 ? 0 : 1);
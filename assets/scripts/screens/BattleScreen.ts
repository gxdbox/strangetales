/**
 * DQ 式第一人称回合制战斗
 * 上半：敌人立绘；下半：信息窗 + 指令菜单（攻击/道术/道具/逃跑）。
 * 流程以「演出序列」驱动：msgs → 动作 → 检查胜负 → 轮转。
 */
import {
    _decorator, Component, Node, Sprite, SpriteFrame, UITransform, Vec3, Color, Graphics,
    input, Input, EventKeyboard, KeyCode, Label,
} from 'cc';
import { CFG, FC, clamp, rndInt } from '../config/GameConfig';
import { loadSpriteFrame } from '../ui/Assets';
import { makePanel, makeLabel, makeCursor, toColor, ScreenBase } from '../ui/FCUi';
import { ENEMIES, EnemyDef, SKILLS } from '../data/WorldData';
import { Game, expNext } from '../state/GameState';
import { Sound } from '../audio/SoundManager';
import { App } from '../Boot';

const { ccclass, property } = _decorator;

interface Foe {
    def: EnemyDef;
    hp: number;
    sprite: Sprite;
    node: Node;
    alive: boolean;
    skinHealCooldown: number;
}

interface SeqAction {
    msg?: string;
    /** 攻击敌人的索引 */
    foeIdx?: number;
    /** 对敌人伤害（负值为回复） */
    foeDmg?: number;
    /** 对我方伤害 */
    heroDmg?: number;
    heroHeal?: number;
    sfx?: string;
    /** 等待输入确认后继续 */
    waitKey?: boolean;
    ended?: boolean;
}

type MenuMode = 'main' | 'target' | 'skill' | 'item';

@ccclass('BattleScreen')
export class BattleScreen extends ScreenBase {
    @property([String])
    public packs: string[][] = [['wolf']];
    @property
    public isBoss = false;
    @property
    public returnMap = 'map_gate';

    private foes: Foe[] = [];
    private foeLayer: Node | null = null;
    private infoLabel: Label | null = null;
    private statusLabel: Label | null = null;
    private menuNode: Node | null = null;
    private menuCursor: Node | null = null;
    private menuItems: { text: string; y: number }[] = [];
    private menuIdx = 0;
    private mode: MenuMode = 'main';
    private pendingTarget = '';
    private seq: SeqAction[] = [];
    private seqIdx = 0;
    private seqEnd: (() => void) | null = null;
    private seqClock = 0;
    private playing = false;
    private phase = 0; // 0 玩家回合 1 敌人回合 2 结束
    private waveIndex = 0;
    private flashClock = 0;

    protected onLoad(): void {
        input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this);
        this.buildUI();
        this.spawnPack(0);
        this.writeStatus();
        Sound.playBgm(this.isBoss ? 'boss' : 'battle');
    }

    protected onDestroy(): void {
        input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this);
    }

    /* ================= 初始化 ================= */

    private buildUI(): void {
        // 战斗底幕：纯黑，分割线
        const g = makePanel('battleBg', 256, 224, 0, 0, this.node, false);
        void g;
        this.foeLayer = new Node('foes');
        this.foeLayer.layer = this.node.layer;
        this.node.addChild(this.foeLayer);
        // 信息窗（两行）
        const infoPanel = makePanel('info', 236, 40, 0, 8, this.node, true);
        this.infoLabel = makeLabel('', 11, FC.WHITE, infoPanel, -108, 8, 214);
        this.infoLabel.overflow = Label.Overflow.SHRINK;
        // 状态条
        this.statusLabel = makeLabel('', 10, FC.WHITE, this.node, 0, -106, 240);
        // 按键提示（信息窗下方、触屏按键与状态条之间，不与其他元素重叠）
        makeLabel('↑↓选择　J 确认　K 取消', 10, FC.GRAY, this.node, 0, -90);
        this.buildTouchPad();
    }

    private spawnPack(packIdx: number): void {
        const pack = this.packs[packIdx];
        if (!pack) return;
        // 清除旧敌人
        for (const f of this.foes) f.node.destroy();
        this.foes = [];
        const spots = this.layoutSpots(pack.length);
        pack.forEach((id, i) => {
            const def = ENEMIES[id];
            const node = new Node('foe_' + id);
            node.layer = this.foeLayer!.layer;
            this.foeLayer!.addChild(node);
            const spr = node.addComponent(Sprite);
            spr.sizeMode = Sprite.SizeMode.CUSTOM;
            node.addComponent(UITransform).setContentSize(def.id.startsWith('skin') ? 48 : 32, def.id.startsWith('skin') ? 48 : 40);
            const [sx, sy] = spots[i];
            node.setPosition(new Vec3(sx, sy, 0));
            node.setScale(2, 2, 1);
            this.foes.push({ def, hp: def.hp, sprite: spr, node, alive: true, skinHealCooldown: 0 });
            loadSpriteFrame(def.sprite).then(sf => { spr.spriteFrame = sf; }).catch(() => void 0);
        });
    }

    /** 敌人站位：1 只居中，2 只分列 */
    private layoutSpots(count: number): [number, number][] {
        if (count === 1) return [[0, 62]];
        if (count === 2) return [[-66, 62], [66, 62]];
        return [[-88, 70], [0, 56], [88, 70]];
    }

    private buildTouchPad(): void {
        const holdBtn = (key: 'up' | 'down' | 'left' | 'right', x: number, y: number) => {
            const btn = new Node('key_' + key);
            btn.layer = this.node.layer;
            this.node.addChild(btn);
            btn.addComponent(UITransform).setContentSize(14, 14);
            makePanel('kp', 14, 14, x, y, this.node, false);
            btn.setPosition(new Vec3(x, y, 0));
            btn.on(Node.EventType.TOUCH_END, () => this.onTapDir(key));
        };
        holdBtn('up', -104, -52);
        holdBtn('down', -104, -68);
        holdBtn('left', -119, -60);
        holdBtn('right', -89, -60);
        const tapBtn = (name: string, x: number, y: number, cb: () => void) => {
            const btn = new Node(name);
            btn.layer = this.node.layer;
            this.node.addChild(btn);
            btn.addComponent(UITransform).setContentSize(14, 14);
            makePanel('kb', 14, 14, x, y, this.node, false);
            btn.setPosition(new Vec3(x, y, 0));
            btn.on(Node.EventType.TOUCH_END, cb);
            makeLabel(name === 'keyA' ? 'A' : 'B', 6, FC.GRAY, btn, 0, 0);
        };
        tapBtn('keyA', 102, -52, () => this.onTapA());
        tapBtn('keyB', 86, -68, () => this.onTapB());
    }

    private onTapDir(key: string): void {
        if (key === 'up') this.moveMenu(-1);
        if (key === 'down') this.moveMenu(1);
    }
    private onTapA(): void { this.confirm(); }
    private onTapB(): void { this.cancelMenu(); }

    /* ================= 输入 ================= */

    private onKeyDown(e: EventKeyboard): void {
        const c = e.keyCode;
        if (this.playing) {
            // 序列等待按键
            if (this.seq[this.seqIdx] && this.seq[this.seqIdx].waitKey) {
                if (c === KeyCode.KEY_J || c === KeyCode.SPACE || c === KeyCode.ENTER || c === KeyCode.KEY_Z) {
                    this.advanceSeq();
                }
            }
            return;
        }
        if (c === KeyCode.ARROW_UP || c === KeyCode.KEY_W) this.moveMenu(-1);
        else if (c === KeyCode.ARROW_DOWN || c === KeyCode.KEY_S) this.moveMenu(1);
        else if (c === KeyCode.KEY_J || c === KeyCode.SPACE || c === KeyCode.ENTER || c === KeyCode.KEY_Z) this.confirm();
        else if (c === KeyCode.KEY_K || c === KeyCode.KEY_X || c === KeyCode.ESCAPE) this.cancelMenu();
    }

    /* ================= 菜单 ================= */

    private buildMainMenu(): void {
        this.clearMenu();
        this.mode = 'main';
        this.menuItems = [
            { text: '攻击', y: 40 },
            { text: '道术', y: 26 },
            { text: '道具', y: 12 },
            { text: '逃跑', y: -2 },
        ];
        const panel = makePanel('menu', 120, 80, 66, 32, this.node, true);
        this.menuNode = panel;
        for (const it of this.menuItems) {
            makeLabel(it.text, 11, FC.WHITE, panel, -44, it.y, 80);
        }
        this.menuIdx = 0;
        this.menuCursor = makeCursor(panel, -52, this.menuItems[0].y);
    }

    private buildListMenu(items: string[], kind: MenuMode): void {
        this.clearMenu();
        this.mode = kind;
        this.menuItems = [];
        const count = items.length;
        const panelH = Math.max(40, count * 14 + 12);
        const panel = makePanel('menu', 132, panelH, 70, 56 - panelH / 2, this.node, true);
        this.menuNode = panel;
        let y = panelH / 2 - 14;
        items.forEach(t => {
            this.menuItems.push({ text: t, y });
            makeLabel(t, 11, FC.WHITE, panel, -52, y, 100);
            y -= 14;
        });
        this.menuIdx = 0;
        this.menuCursor = makeCursor(panel, -62, this.menuItems[0].y);
    }

    private clearMenu(): void {
        if (this.menuNode) this.menuNode.destroy();
        this.menuNode = null;
        this.menuCursor = null;
        this.menuItems = [];
    }

    private moveMenu(delta: number): void {
        if (this.playing || !this.menuItems.length || !this.menuCursor) return;
        this.menuIdx = Math.max(0, Math.min(this.menuItems.length - 1, this.menuIdx + delta));
        this.menuCursor.setPosition(new Vec3(
            this.menuCursor.position.x,
            this.menuItems[this.menuIdx].y, 0,
        ));
        Sound.play('cursor');
    }

    private confirm(): void {
        if (this.playing) return;
        Sound.play('confirm');
        const item = this.menuItems[this.menuIdx];
        if (!item) return;
        if (this.mode === 'main') {
            if (item.text === '攻击') this.pendingTarget = 'attack';
            else if (item.text === '道术') this.pendingTarget = 'skill';
            else if (item.text === '道具') this.pendingTarget = 'item';
            else if (item.text === '逃跑') {
                this.clearMenu();
                this.tryFlee();
                return;
            }
            if (this.pendingTarget === 'skill') {
                const h = Game.save.hero;
                const list: string[] = [];
                for (const k of Object.keys(SKILLS)) {
                    const s = SKILLS[k];
                    if (s.id === 'heal' && !(h.items['清心诀'] || 0)) continue;
                    list.push(`${s.name} MP${s.mp}`);
                }
                this.buildListMenu(list, 'skill');
            } else if (this.pendingTarget === 'item') {
                const h = Game.save.hero;
                const list: string[] = [];
                for (const name of ['馒头', '纸符', '药汤']) {
                    if ((h.items[name] || 0) > 0) list.push(`${name} ×${h.items[name]}`);
                }
                if (!list.length) list.push('（无可用道具）');
                this.buildListMenu(list, 'item');
            } else {
                const alive = this.aliveFoes();
                this.buildListMenu(alive.map(f => f.def.name), 'target');
            }
            return;
        }
        // 子菜单确认
        if (this.mode === 'target') {
            const alive = this.aliveFoes();
            const target = alive[this.menuIdx];
            this.clearMenu();
            if (!target) return;
            this.playerAttack(target);
        } else if (this.mode === 'skill') {
            const h = Game.save.hero;
            const keys = Object.keys(SKILLS).filter(k => !(k === 'heal' && !(h.items['清心诀'] || 0)));
            const skillKey = keys[this.menuIdx];
            const skill = SKILLS[skillKey];
            this.clearMenu();
            if (!skill) return;
            if (Game.battleMp < skill.mp) {
                this.info('灵力不足！');
                this.pendingTarget = '';
                this.playerTurnStart();
                return;
            }
            Game.battleMp -= skill.mp;
            this.castSkill(skill.id);
        } else if (this.mode === 'item') {
            const h = Game.save.hero;
            const names: string[] = [];
            for (const name of ['馒头', '纸符', '药汤']) {
                if ((h.items[name] || 0) > 0) names.push(name);
            }
            const name = names[this.menuIdx];
            this.clearMenu();
            if (!name) {
                this.playerTurnStart();
                return;
            }
            h.items[name] = (h.items[name] || 0) - 1;
            this.useItem(name);
        }
    }

    private cancelMenu(): void {
        if (this.playing) return;
        if (this.mode === 'main') return; // 主菜单不可取消
        Sound.play('cancel');
        this.pendingTarget = '';
        this.buildMainMenu();
    }

    /* ================= 战斗逻辑 ================= */

    private aliveFoes(): Foe[] {
        return this.foes.filter(f => f.alive);
    }

    private playerTurnStart(): void {
        this.phase = 0;
        this.buildMainMenu();
        this.writeStatus();
    }

    /** 玩家普通攻击 */
    private playerAttack(target: Foe): void {
        const h = Game.save.hero;
        const base = h.atk * 2 - target.def.atk * 0; // 我方威力 = 攻x2 - 敌防
        const dmg = Math.max(1, h.atk * 2 - target.def.def + rndInt(-2, 2));
        const seq: SeqAction[] = [
            { msg: `${h.name}的攻击！`, sfx: 'hit' },
            { foeIdx: this.foeIndexOf(target), foeDmg: dmg },
            { msg: `${target.def.name}受到${dmg}点伤害！` },
        ];
        void base;
        this.playSeq(seq, () => this.afterPlayerAction());
    }

    /** 施放道术 */
    private castSkill(id: string): void {
        const h = Game.save.hero;
        const skill = SKILLS[id];
        const seq: SeqAction[] = [];
        seq.push({ msg: `${h.name}施展${skill.name}！`, sfx: id === 'heal' ? 'heal' : 'magic' });
        if (id === 'fire') {
            const alive = this.aliveFoes();
            if (!alive.length) {
                this.playSeq(seq, () => this.afterPlayerAction());
                return;
            }
            const magic = 12 + h.lv * 2 + rndInt(-3, 3);
            const target = alive[0];
            // 单体（第一章）
            const dmg = Math.max(1, magic);
            seq.push({ foeIdx: this.foeIndexOf(target), foeDmg: dmg, sfx: 'magic' });
            seq.push({ msg: `${target.def.name}受到${dmg}点伤害！` });
        } else if (id === 'heal') {
            const heal = 15 + h.lv * 2;
            const real = Math.min(h.maxHp - Game.battleHp, heal);
            Game.battleHp += real;
            seq.push({ heroHeal: real });
            seq.push({ msg: `恢复${real}点体力！` });
        }
        this.playSeq(seq, () => this.afterPlayerAction());
    }

    /** 使用道具 */
    private useItem(name: string): void {
        const h = Game.save.hero;
        const seq: SeqAction[] = [];
        if (name === '馒头') {
            const heal = Math.min(h.maxHp - Game.battleHp, 10);
            Game.battleHp += heal;
            seq.push({ msg: `${h.name}吃下馒头。`, sfx: 'heal' });
            seq.push({ msg: `恢复${heal}点体力！` });
        } else if (name === '药汤') {
            const heal = h.maxHp - Game.battleHp;
            Game.battleHp = h.maxHp;
            seq.push({ msg: `${h.name}饮下药汤。`, sfx: 'heal' });
            seq.push({ msg: `体力完全恢复！（+${heal}）` });
        } else if (name === '纸符') {
            const alive = this.aliveFoes();
            if (!alive.length) {
                this.playSeq(seq, () => this.afterPlayerAction());
                return;
            }
            const target = alive[0];
            let dmg = 9 + rndInt(-2, 2);
            const ghostBonus = target.def.ghost ? '对鬼族效果拔群！' : '';
            if (target.def.ghost) dmg = Math.round(dmg * 1.5);
            seq.push({ msg: `${h.name}祭出纸符！`, sfx: 'magic' });
            seq.push({ foeIdx: this.foeIndexOf(target), foeDmg: dmg });
            seq.push({ msg: `${target.def.name}受到${dmg}点伤害！` + (ghostBonus ? '' : '') });
            if (ghostBonus) seq.push({ msg: ghostBonus });
        } else {
            seq.push({ msg: '（似乎没有效果）' });
        }
        this.playSeq(seq, () => this.afterPlayerAction());
    }

    private tryFlee(): void {
        if (this.isBoss) {
            this.playSeq([{ msg: '此战无法逃离！' }], () => this.playerTurnStart());
            return;
        }
        this.playSeq([{ msg: '蒲宁试图逃走……', sfx: 'flee' }], () => {
            if (Math.random() < 0.5) {
                Sound.play('flee');
                // 逃跑成功：无惩罚直接返回地图（不做阵亡结算）
                App.gotoMap(this.returnMap || Game.save.respawnMap);
            } else {
                this.playSeq([{ msg: '来不及逃跑！' }], () => this.enemyTurn());
            }
        });
    }

    private foeIndexOf(foe: Foe): number {
        return this.foes.indexOf(foe);
    }

    private afterPlayerAction(): void {
        // 检查全灭
        if (!this.aliveFoes().length) {
            this.onWaveCleared();
            return;
        }
        this.enemyTurn();
    }

    /** 一波敌人全灭 */
    private onWaveCleared(): void {
        if (this.isBoss && this.waveIndex === 0) {
            // Boss 转阶段
            this.waveIndex = 1;
            this.playSeq([
                { msg: '画皮人面溃散……', sfx: 'magic' },
                { msg: '但恶鬼尚未消灭！', waitKey: true },
                { msg: '画皮落尽，现出真形！', sfx: 'encounter' },
            ], () => {
                this.spawnPack(1);
                this.writeStatus();
                this.playerTurnStart();
            });
            return;
        }
        this.endBattle(true, this.isBoss);
    }

    /** 敌方回合 */
    private enemyTurn(): void {
        const seq: SeqAction[] = [];
        const h = Game.save.hero;
        for (const foe of this.aliveFoes()) {
            const d = foe.def;
            sequ(seq, { msg: `${d.name}的行动！` });
            // gimmick 判定
            let extra = 1;
            let gimmickMsg = '';
            if (d.gimmick === 'skin' && foe.hp < d.hp * 0.6) {
                const heal = 12;
                foe.hp = Math.min(d.hp, foe.hp + heal);
                gimmickMsg = `${d.name}描画人皮，回复${heal}点体力！`;
                sequ(seq, { msg: gimmickMsg, sfx: 'heal' });
                continue;
            }
            if (d.gimmick === 'roar' && Math.random() < 0.3) {
                extra = 1.6;
                sequ(seq, { msg: `${d.name}发出厉啸！`, sfx: 'hurt' });
            }
            if (d.gimmick === 'drain' && Math.random() < 0.25 && Game.battleHp > 4) {
                const drain = Math.min(6, Game.battleHp - 1);
                Game.battleHp -= drain;
                foe.hp = Math.min(d.hp, foe.hp + drain);
                sequ(seq, { msg: `${d.name}吸食阳气，夺走${drain}点体力！`, sfx: 'hurt', heroDmg: drain });
                continue;
            }
            const dmg = Math.max(1, Math.round((d.atk * 2 - h.def + rndInt(-2, 2)) * extra));
            Game.battleHp -= dmg;
            sequ(seq, { msg: `${h.name}受到${dmg}点伤害！`, sfx: 'hurt', heroDmg: dmg });
        }
        this.playSeq(seq, () => {
            this.writeStatus();
            if (Game.battleHp <= 0) {
                this.onHeroDead();
                return;
            }
            this.playerTurnStart();
        });
    }

    private onHeroDead(): void {
        this.phase = 2;
        Sound.stopBgm();
        this.playSeq([{ msg: '蒲宁力尽了……', sfx: 'hurt', waitKey: true }], () => {
            this.endBattle(false, false);
        });
    }

    /** 结束战斗：赢 → 结算；输/逃 → 回调 */
    private endBattle(win: boolean, _isBoss: boolean): void {
        if (win) {
            // 结算
            const seq: SeqAction[] = [];
            let expSum = 0;
            let goldSum = 0;
            // 两波战利品合计：用 foiled 记录
            const expArr: number[] = [];
            const goldArr: number[] = [];
            for (const f of this.foes) {
                expArr.push(f.def.exp);
                goldArr.push(f.def.gold);
            }
            expSum = expArr.reduce((a, b) => a + b, 0);
            goldSum = goldArr.reduce((a, b) => a + b, 0);
            const h = Game.save.hero;
            h.gold += goldSum;
            seq.push({ msg: `战斗胜利！`, sfx: 'victory' });
            seq.push({ msg: `获得经验${expSum}，文银${goldSum}。` });
            const ups = Game.gainExp(expSum);
            for (const lv of ups) {
                seq.push({ msg: `等级提升到Lv${lv}！`, sfx: 'levelup' });
                seq.push({ msg: `体力灵力完全恢复！` });
            }
            if (this.isBoss) {
                Game.save.progress = 'cleared';
            }
            Game.saveGame();
            seq.push({ waitKey: true });
            this.playSeq(seq, () => {
                App.gotoMap(this.returnMap);
            });
        } else {
            // 失败：复活
            const h = Game.save.hero;
            h.gold = Math.max(0, h.gold - Math.floor(h.gold / 2));
            Game.battleHp = h.maxHp;
            Game.battleMp = h.maxMp;
            Game.saveGame();
            App.gotoMap(Game.save.respawnMap || this.returnMap, undefined, 'dead');
        }
    }

    /* ================= 演出序列 ================= */

    private playSeq(seq: SeqAction[], onEnd: () => void): void {
        this.playing = true;
        this.seq = seq;
        this.seqIdx = 0;
        this.seqEnd = onEnd;
        this.playNext();
    }

    private playNext(): void {
        if (this.seqIdx >= this.seq.length) {
            this.playing = false;
            const cb = this.seqEnd;
            this.seqEnd = null;
            if (cb) cb();
            return;
        }
        const act = this.seq[this.seqIdx];
        if (act.msg) {
            this.info(act.msg);
        }
        if (act.sfx) Sound.play(act.sfx);
        if (act.foeIdx !== undefined && act.foeDmg) {
            const foe = this.foes[act.foeIdx];
            if (foe && foe.alive) {
                foe.hp = Math.max(0, foe.hp - act.foeDmg);
                this.flashFoe(foe);
                if (foe.hp <= 0) {
                    foe.alive = false;
                    foe.node.destroy();
                }
            }
        }
        if (act.heroDmg) {
            this.flashHero();
        }
        if (act.heroHeal) {
            this.flashHero(true);
        }
        this.writeStatus();
        if (act.waitKey) {
            // 等待按键推进
            return;
        }
        this.seqIdx++;
        this.scheduleOnce(() => this.playNext(), this.isBoss ? 0.62 : 0.55);
    }

    private advanceSeq(): void {
        if (!this.playing) return;
        const act = this.seq[this.seqIdx];
        if (act && act.waitKey) {
            this.seqIdx++;
            this.playNext();
        }
    }
    /* ================= 表现 ================= */

    private info(text: string): void {
        if (this.infoLabel) this.infoLabel.string = text;
    }

    private writeStatus(): void {
        const h = Game.save.hero;
        if (!this.statusLabel) return;
        this.statusLabel.string =
            `蒲宁 Lv${h.lv}  HP ${clamp(Game.battleHp, 0, h.maxHp)}/${h.maxHp}  ` +
            `MP ${clamp(Game.battleMp, 0, h.maxMp)}/${h.maxMp}  G ${h.gold}`;
    }

    private flashFoe(foe: Foe): void {
        const spr = foe.sprite;
        let n = 0;
        const timer = setInterval(() => {
            n++;
            if (n > 4) {
                clearInterval(timer);
                spr.color = Color.WHITE;
                return;
            }
            spr.color = n % 2 ? new Color(255, 100, 100, 255) : Color.WHITE;
        }, 70);
    }

    private flashHero(heal = false): void {
        // 我方受伤/治疗：屏幕闪色（黑闪/边框提示）
        const panel = makePanel('flash', 256, 224, 0, 0, this.node, false);
        const g = panel.getComponent(Graphics);
        if (g) {
            g.fillColor = heal ? new Color(0, 0, 0, 0) : new Color(120, 0, 0, 60);
        }
        panel.setSiblingIndex(this.node.children.length - 1 > 0 ? 3 : 0);
        this.scheduleOnce(() => panel.destroy(), 0.2);
    }

    /* ================= 帧循环（状态条闪烁等） ================= */

    protected update(dt: number): void {
        this.flashClock += dt;
        void CFG;
        void expNext;
        void _decorator;
    }
}

/** 序列追加工具 */
function sequ(seq: SeqAction[], act: SeqAction): void {
    seq.push(act);
}
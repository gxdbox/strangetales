/**
 * 地图屏幕：俯视 2D 走图（FC 整格步进）
 * 背景为预渲染整屏 PNG；碰撞、NPC、触发、出口均由数据驱动。
 */
import {
    _decorator, Component, Node, Sprite, SpriteFrame, UITransform, Rect, Vec3, tween, input,
    Input, EventKeyboard, KeyCode,
} from 'cc';
import { CFG, FC } from '../config/GameConfig';
import { loadSpriteFrame } from '../ui/Assets';
import { makePanel, makeLabel, makeCursor, ScreenBase } from '../ui/FCUi';
import { DialogueBox } from '../ui/DialogueBox';
import { MAPS, MapDef, npcStep, triggerStep, entryStep, FOREST_PACKS, StepResult } from '../data/WorldData';
import { TEXT, DialogueLine } from '../data/ChapterText';
import { Game } from '../state/GameState';
import { Sound } from '../audio/SoundManager';
import { App } from '../Boot';

const { ccclass, property } = _decorator;

type Dir = 0 | 1 | 2 | 3; // 0下 1左 2右 3上
const DIRV: [number, number][] = [[0, 1], [-1, 0], [1, 0], [0, -1]];

interface NpcRuntime {
    id: string;
    node: Node;
    x: number;
    y: number;
}

interface MenuItem {
    text: string;
    kind: 'item' | 'save' | 'close';
    id?: string;
    y: number;
}

@ccclass('MapScreen')
export class MapScreen extends ScreenBase {
    @property
    public mapId = 'map_gate';
    @property
    public spawnOverride: [number, number] | null = null;

    private map: MapDef = null as unknown as MapDef;
    private playerNode: Node | null = null;
    private playerSprite: Sprite | null = null;
    private frames: SpriteFrame[] = [];
    private px = 7;
    private py = 7;
    private dir: Dir = 0;
    private moving = false;
    private busy = false;
    private held = new Set<string>();
    private npcs: NpcRuntime[] = [];
    private dlg: DialogueBox | null = null;
    private menuOpen = false;
    private menuPanel: Node | null = null;
    private menuCursor: Node | null = null;
    private menuItems: MenuItem[] = [];
    private menuIdx = 0;
    private stepClock = 0;
    private encounterSteps = CFG.ENCOUNTER_STEPS;
    /** 触屏按键节点（方向键/A/B 及各自底框），对话进行时隐藏 */
    private touchKeys: Node[] = [];
    private touchVisible = true;

    protected onLoad(): void {
        this.loadMap();
    }

    protected onDestroy(): void {
        input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this);
        input.off(Input.EventType.KEY_UP, this.onKeyUp, this);
    }

    /* ================= 初始化 ================= */

    private async loadMap(): Promise<void> {
        this.map = MAPS[this.mapId];
        if (this.spawnOverride) {
            this.px = this.spawnOverride[0];
            this.py = this.spawnOverride[1];
        } else {
            this.px = this.map.spawn[0];
            this.py = this.map.spawn[1];
        }
        input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this);
        input.on(Input.EventType.KEY_UP, this.onKeyUp, this);

        // 背景
        try {
            const sf = await loadSpriteFrame('textures/maps/' + this.map.id);
            const bg = new Node('bg');
            bg.layer = this.node.layer;
            this.node.addChild(bg);
            bg.addComponent(Sprite).spriteFrame = sf;
        } catch (_e) { /* 黑屏兜底 */ }

        // 玩家
        this.playerNode = new Node('player');
        this.playerNode.layer = this.node.layer;
        this.node.addChild(this.playerNode);
        this.playerSprite = this.playerNode.addComponent(Sprite);
        this.playerSprite.sizeMode = Sprite.SizeMode.CUSTOM;
        this.playerNode.addComponent(UITransform).setContentSize(16, 24);
        try {
            const sheet = await loadSpriteFrame('textures/actors/player');
            for (let d = 0; d < 4; d++) {
                this.frames.push(await this.cutPlayerFrame(sheet, d));
            }
            this.playerSprite.spriteFrame = this.frames[0];
        } catch (_e) { /* 缺图兜底 */ }
        this.syncPlayerPos();

        // NPC
        for (const n of this.map.npcs) {
            const node = new Node('npc_' + n.id);
            node.layer = this.node.layer;
            this.node.addChild(node);
            const spr = node.addComponent(Sprite);
            spr.sizeMode = Sprite.SizeMode.CUSTOM;
            node.addComponent(UITransform).setContentSize(16, 24);
            try {
                spr.spriteFrame = await loadSpriteFrame(n.sprite);
            } catch (_e) { /* ignore */ }
            this.placeNode(node, n.x, n.y);
            this.npcs.push({ id: n.id, node, x: n.x, y: n.y });
        }

        // 对话框
        const dlgNode = new Node('dialogue');
        dlgNode.layer = this.node.layer;
        this.node.addChild(dlgNode);
        this.dlg = dlgNode.addComponent(DialogueBox);
        this.dlg.node.active = false;

        this.buildTouchPad();
        Sound.playBgm(this.map.bgm);

        // 按进度播放入口事件
        const p = Game.save.progress;
        if (App.pendingDialogue === 'dead') {
            App.pendingDialogue = null;
            this.busy = true;
            this.dlg!.play(TEXT.dead, () => { this.busy = false; });
        } else if (p === 'intro') {
            this.applyStep(entryStep(p), false);
        } else if (p === 'cleared') {
            this.busy = true;
            this.dlg!.play(TEXT.victory, () => {
                Game.save.progress = 'ending';
                Game.saveGame();
                this.busy = false;
                App.gotoEnding();
            });
        } else if (p === 'ending') {
            App.gotoEnding();
        }
    }

    private async cutPlayerFrame(sheet: SpriteFrame, d: number): Promise<SpriteFrame> {
        const sf = new SpriteFrame();
        sf.texture = (sheet as any).texture;
        sf.rect = new Rect(d * 16, 0, 16, 24);
        return sf;
    }

    /* ================= 渲染 ================= */

    private placeNode(node: Node, tx: number, ty: number): void {
        const x = -128 + 8 + tx * 16;
        const y = 112 - ty * 16 - 12;
        node.setPosition(new Vec3(x, y, 0));
    }

    private syncPlayerPos(): void {
        this.placeNode(this.playerNode!, this.px, this.py);
    }

    /* ================= 输入 ================= */

    private onKeyDown(e: EventKeyboard): void {
        const c = e.keyCode;
        if (this.menuOpen) {
            if (c === KeyCode.ARROW_UP || c === KeyCode.KEY_W) this.menuMove(-1);
            if (c === KeyCode.ARROW_DOWN || c === KeyCode.KEY_S) this.menuMove(1);
            return;
        }
        if (c === KeyCode.ARROW_UP || c === KeyCode.KEY_W) this.held.add('up');
        if (c === KeyCode.ARROW_DOWN || c === KeyCode.KEY_S) this.held.add('down');
        if (c === KeyCode.ARROW_LEFT || c === KeyCode.KEY_A) this.held.add('left');
        if (c === KeyCode.ARROW_RIGHT || c === KeyCode.KEY_D) this.held.add('right');
        if (c === KeyCode.KEY_J || c === KeyCode.SPACE || c === KeyCode.ENTER || c === KeyCode.KEY_Z) {
            this.confirm();
        }
        if (c === KeyCode.KEY_K || c === KeyCode.KEY_X || c === KeyCode.ESCAPE) {
            this.cancel();
        }
    }

    private onKeyUp(e: EventKeyboard): void {
        const c = e.keyCode;
        if (c === KeyCode.ARROW_UP || c === KeyCode.KEY_W) this.held.delete('up');
        if (c === KeyCode.ARROW_DOWN || c === KeyCode.KEY_S) this.held.delete('down');
        if (c === KeyCode.ARROW_LEFT || c === KeyCode.KEY_A) this.held.delete('left');
        if (c === KeyCode.ARROW_RIGHT || c === KeyCode.KEY_D) this.held.delete('right');
    }

    private buildTouchPad(): void {
        const holdBtn = (key: 'up' | 'down' | 'left' | 'right', x: number, y: number) => {
            const btn = new Node('key_' + key);
            btn.layer = this.node.layer;
            this.node.addChild(btn);
            btn.addComponent(UITransform).setContentSize(14, 14);
            const panel = makePanel('kp', 14, 14, x, y, this.node, false);
            this.touchKeys.push(btn, panel);
            btn.setPosition(new Vec3(x, y, 0));
            btn.on(Node.EventType.TOUCH_START, () => this.held.add(key));
            btn.on(Node.EventType.TOUCH_END, () => this.held.delete(key));
            btn.on(Node.EventType.TOUCH_CANCEL, () => this.held.delete(key));
        };
        holdBtn('up', -104, -82);
        holdBtn('down', -104, -98);
        holdBtn('left', -119, -90);
        holdBtn('right', -89, -90);
        const tapBtn = (name: string, x: number, y: number, cb: () => void) => {
            const btn = new Node(name);
            btn.layer = this.node.layer;
            this.node.addChild(btn);
            btn.addComponent(UITransform).setContentSize(14, 14);
            const panel = makePanel('kb', 14, 14, x, y, this.node, false);
            this.touchKeys.push(btn, panel);
            btn.setPosition(new Vec3(x, y, 0));
            btn.on(Node.EventType.TOUCH_END, cb);
            makeLabel(name === 'keyA' ? 'A' : 'B', 6, FC.GRAY, btn, 0, 0);
        };
        tapBtn('keyA', 102, -80, () => this.confirm());
        tapBtn('keyB', 86, -97, () => this.cancel());
    }

    private confirm(): void {
        Sound.resume();
        if (this.dlg && this.dlg.isPlaying()) {
            this.dlg.onConfirm();
            return;
        }
        if (this.menuOpen) {
            this.menuConfirm();
            return;
        }
        this.tryInteract();
    }

    private cancel(): void {
        if (this.menuOpen) {
            this.closeMenu();
            Sound.play('cancel');
            return;
        }
        this.openMenu();
        Sound.play('cursor');
    }

    /* ================= 主循环 ================= */

    protected update(dt: number): void {
        // 对话进行时或菜单打开时隐藏触屏按键，避免黑色按键框露在面板外
        const dlgPlaying = !!(this.dlg && this.dlg.isPlaying());
        const hideKeys = dlgPlaying || this.menuOpen;
        if (this.touchVisible === hideKeys) {
            this.touchVisible = !hideKeys;
            for (const k of this.touchKeys) k.active = this.touchVisible;
        }
        if (this.busy || this.menuOpen || dlgPlaying) return;
        this.stepClock += dt;
        if (this.stepClock < 0.11) return;
        this.stepClock = 0;
        let dx = 0, dy = 0;
        if (this.held.has('up')) dy = -1;
        else if (this.held.has('down')) dy = 1;
        else if (this.held.has('left')) dx = -1;
        else if (this.held.has('right')) dx = 1;
        if (dx !== 0 || dy !== 0) {
            this.dir = dx < 0 ? 1 : dx > 0 ? 2 : dy < 0 ? 3 : 0;
            this.tryStep(dx, dy);
        }
    }

    private walkable(tx: number, ty: number): boolean {
        if (tx < 0 || tx >= CFG.COLS) return false;
        if (ty < 0 || ty >= CFG.ROWS) return false;
        const line = this.map.walkable[ty];
        return !!line && line[tx] !== '#';
    }

    /** 脚部判定：允许悬出地图下缘（即站立于最底一行） */
    private footOk(tx: number, ty: number): boolean {
        if (ty >= CFG.ROWS) return true;
        return this.walkable(tx, ty);
    }

    /** 出口瓦片（门口可踏入，脚部可不受墙阻） */
    private isExit(tx: number, ty: number): boolean {
        return this.map.exits.some(e => e.x === tx && e.y === ty);
    }

    private tryStep(dx: number, dy: number): void {
        if (this.moving) return;
        const nx = this.px + dx;
        const ny = this.py + dy;
        // 角色占地 1 x 1.5 格：头 (nx,ny)，脚 (nx,ny+1)
        if (!this.walkable(nx, ny) || !this.footOk(nx, ny + 1)) {
            // 门口例外：出口瓦片（如东侧门）脚部可悬入墙内
            if (!this.isExit(nx, ny)) return;
        }
        this.px = nx;
        this.py = ny;
        if (this.playerSprite && this.frames.length) {
            this.playerSprite.spriteFrame = this.frames[this.dir];
            // 步频摆动模拟双帧动画
            this.playerNode!.angle = this.dir === 1 ? -2 : this.dir === 2 ? 2 : 0;
        }
        this.moving = true;
        const tx = -128 + 8 + nx * 16;
        const ty = 112 - ny * 16 - 12;
        tween(this.playerNode!)
            .to(0.09, { position: new Vec3(tx, ty, 0) })
            .call(() => {
                this.moving = false;
                this.playerNode!.angle = 0;
                this.afterStep();
            })
            .start();
    }

    private afterStep(): void {
        Sound.play('step');
        // 出口
        for (const ex of this.map.exits) {
            if (ex.x === this.px && ex.y === this.py) {
                this.switchMap(ex.to, ex.tx, ex.ty);
                return;
            }
        }
        // 触发区
        for (const tr of this.map.triggers) {
            if (tr.x === this.px && tr.y === this.py) {
                const step = triggerStep(tr.id, Game.save.progress);
                if (step.key || step.boss) {
                    this.applyStep(step, false);
                    return;
                }
            }
        }
        // 暗雷
        if (this.map.encounter) {
            this.encounterSteps--;
            if (this.encounterSteps <= 0) {
                this.encounterSteps = CFG.ENCOUNTER_STEPS;
                if (Math.random() < CFG.ENCOUNTER_RATE) {
                    Sound.play('encounter');
                    const pack = FOREST_PACKS[Math.floor(Math.random() * FOREST_PACKS.length)];
                    App.gotoBattle([pack], false, this.mapId);
                }
            }
        }
    }

    private switchMap(to: string, tx: number, ty: number): void {
        Game.save.respawnMap = to;
        Game.saveGame();
        App.gotoMap(to, [tx, ty]);
    }

    /* ================= 交互 ================= */

    private tryInteract(): void {
        const [dx, dy] = DIRV[this.dir];
        const fx = this.px + dx;
        const fy = this.py + dy;
        for (const npc of this.npcs) {
            if (npc.x === fx && npc.y === fy) {
                const step = npcStep(npc.id, Game.save.progress);
                if (step.key || step.boss) {
                    this.applyStep(step, false);
                }
                return;
            }
        }
    }

    /** 剧本步骤：对白 → 状态推进 → 事件 */
    private applyStep(step: StepResult, isEntry: boolean): void {
        if (!step.key) {
            if (step.boss) this.startBoss();
            return;
        }
        const lines = TEXT[step.key] as DialogueLine[] | undefined;
        if (!lines) {
            if (step.boss) this.startBoss();
            return;
        }
        this.busy = true;
        this.dlg!.play(lines, () => {
            if (step.next) {
                Game.save.progress = step.next;
                Game.saveGame();
            }
            if (step.skill) {
                Game.save.hero.items[step.skill] = (Game.save.hero.items[step.skill] || 0) + 1;
                Game.saveGame();
            }
            if (step.items) {
                for (const k of Object.keys(step.items)) {
                    Game.save.hero.items[k] = (Game.save.hero.items[k] || 0) + step.items[k];
                }
                Game.saveGame();
            }
            this.busy = false;
            if (step.boss) {
                this.startBoss();
                return;
            }
            if (Game.save.progress === 'ending' && !isEntry) {
                App.gotoEnding();
            }
        });
    }

    private startBoss(): void {
        Game.save.progress = 'revealed';
        Game.saveGame();
        Sound.play('encounter');
        App.gotoBattle([['skin_lady'], ['skin_demon']], true, this.mapId);
    }

    /* ================= B 菜单 ================= */

    private openMenu(): void {
        this.menuOpen = true;
        // 菜单打开时立即隐藏触屏按键（update 里也会兜底，这里避免首帧露出）
        if (this.touchVisible) {
            this.touchVisible = false;
            for (const k of this.touchKeys) k.active = false;
        }
        const h = Game.save.hero;
        // —— 布局常量：两列对齐（左列/右列各自同一 x 起点）、固定行距、组间隔 ——
        const ROW = 14;   // 条目行距
        const GAP = 16;   // 组之间间隔
        const TX = -82;   // 左列 x（面板左侧留边）
        const RX = 28;    // 右列 x（与左列构成两列网格，值起点对齐）
        const CX = -90;   // 光标 x（对齐线左侧 8px）
        // 先算好所有文本行坐标，再按内容决定面板尺寸，保证上下留白均衡
        const rows: { text: string; size: number; color: number[]; x: number; w: number; y: number }[] = [];
        let y = 90;
        const nameY = y;
        // 头部：名字（左）+ 等级（右）
        rows.push({ text: h.name, size: 14, color: FC.YELLOW, x: TX, w: 100, y });
        rows.push({ text: `Lv ${h.lv}`, size: 11, color: FC.WHITE, x: RX, w: 60, y });
        y -= ROW;
        // 经验（左）+ 金币（右）
        rows.push({
            text: `EXP ${h.exp}/${h.lv >= 8 ? '--' : String(10 * h.lv * h.lv)}`,
            size: 11, color: FC.WHITE, x: TX, w: 100, y,
        });
        rows.push({ text: `G ${h.gold}`, size: 11, color: FC.WHITE, x: RX, w: 60, y });
        y -= ROW;
        // 体力（左）+ 灵力（右）
        rows.push({ text: `体力 ${Game.battleHp}/${h.maxHp}`, size: 11, color: FC.WHITE, x: TX, w: 100, y });
        rows.push({ text: `灵力 ${Game.battleMp}/${h.maxMp}`, size: 11, color: FC.WHITE, x: RX, w: 60, y });
        // 道术组
        y -= GAP;
        rows.push({ text: '──道术──', size: 11, color: FC.GRAY, x: TX, w: 180, y });
        y -= ROW;
        const skills = [['火诀', true], ['清心诀', (h.items['清心诀'] || 0) > 0]] as [string, boolean][];
        for (const [name, learned] of skills) {
            rows.push({ text: learned ? name : '？？？', size: 11, color: learned ? FC.WHITE : FC.GRAY, x: TX, w: 170, y });
            y -= ROW;
        }
        // 道具组（含保存/关闭操作项）
        y -= GAP;
        rows.push({ text: '──道具──', size: 11, color: FC.GRAY, x: TX, w: 180, y });
        y -= ROW;
        this.menuItems = [];
        const pushItem = (name: string, kind: MenuItem['kind'], id: string | undefined, yPos: number) => {
            this.menuItems.push({ text: name, kind, id, y: yPos });
            rows.push({ text: name, size: 11, color: FC.WHITE, x: TX, w: 150, y: yPos });
        };
        const order = [['bun', '馒头'], ['talisman', '纸符'], ['soup', '药汤']] as [string, string][];
        for (const [id, name] of order) {
            const cnt = h.items[name] || 0;
            if (cnt > 0) {
                pushItem(`${name} ×${cnt}`, 'item', id, y);
                y -= ROW;
            }
        }
        pushItem('保存进度', 'save', undefined, y);
        y -= ROW;
        pushItem('关闭', 'close', undefined, y);
        // 底部提示行（全角空格保证间距均匀，居中显示，覆盖键盘+触屏）
        const tipY = y - GAP;
        rows.push({ text: 'J确认　K取消　方向键移动　A/B触屏', size: 10, color: FC.GRAY, x: 0, w: 0, y: tipY });
        // 面板高度按内容重算，内容在面板内上下留白均衡（整体仍居中于 (0,0) 附近）
        const PAD = 12;
        const contentTop = nameY + Math.round((14 * 1.25) / 2);    // 名字行上沿
        const contentBottom = tipY - Math.round((10 * 1.25) / 2);  // 提示行下沿
        const panelH = Math.max(140, Math.round(contentTop - contentBottom + PAD * 2));
        const panelY = Math.round((nameY + tipY) / 2);
        const panel = makePanel('menu', 208, panelH, 0, panelY, this.node, true);
        this.menuPanel = panel;
        for (const r of rows) makeLabel(r.text, r.size, r.color, panel, r.x, r.y, r.w);
        this.menuIdx = 0;
        this.menuCursor = makeCursor(panel, CX, this.menuItems[0].y);
    }

    private menuMove(delta: number): void {
        if (!this.menuItems.length || !this.menuCursor) return;
        this.menuIdx = Math.max(0, Math.min(this.menuItems.length - 1, this.menuIdx + delta));
        this.menuCursor.setPosition(new Vec3(-90, this.menuItems[this.menuIdx].y, 0)); // 光标 x 与 openMenu 的 CX=-90 一致
        Sound.play('cursor');
    }

    private menuConfirm(): void {
        const item = this.menuItems[this.menuIdx];
        if (!item) return;
        const h = Game.save.hero;
        if (item.kind === 'save') {
            Game.saveGame();
            this.menuToast('已记录旅程');
        } else if (item.kind === 'close') {
            this.closeMenu();
        } else if (item.kind === 'item') {
            const cnt = h.items[item.id!] || 0;
            if (cnt <= 0) return;
            if (item.id === 'bun') {
                this.useItemInstant('馒头', () => {
                    Game.battleHp = Math.min(h.maxHp, Game.battleHp + 10);
                });
            } else if (item.id === 'soup') {
                this.useItemInstant('药汤', () => {
                    Game.battleHp = h.maxHp;
                });
            } else if (item.id === 'talisman') {
                this.menuToast('符箓须在战斗中使用');
                return;
            }
        }
    }

    private useItemInstant(name: string, effect: () => void): void {
        const h = Game.save.hero;
        effect();
        h.items[name] = (h.items[name] || 0) - 1;
        Game.saveGame();
        Sound.play('heal');
        this.menuToast('体力恢复', () => this.refreshMenu());
    }

    private refreshMenu(): void {
        const reopen = this.menuOpen;
        this.closeMenu();
        if (reopen) this.openMenu();
    }

    /** 显示短暂提示文本 */
    private menuToast(msg: string, onDone?: () => void): void {
        const holder = new Node('toast');
        holder.layer = this.node.layer;
        this.node.addChild(holder);
        const panel = makePanel('tp', 148, 26, 0, 34, holder, true);
        makeLabel(msg, 11, FC.WHITE, panel, 0, 0, 132);
        this.scheduleOnce(() => {
            holder.destroy();
            if (onDone) onDone();
        }, 1.4);
    }

    private closeMenu(): void {
        this.menuOpen = false;
        if (this.menuPanel) {
            this.menuPanel.destroy();
            this.menuPanel = null;
        }
        this.menuCursor = null;
        this.menuItems = [];
        // 菜单关闭且无对话时恢复触屏按键（update 里也会兜底，这里避免下一帧前留空）
        const dlgPlaying = !!(this.dlg && this.dlg.isPlaying());
        if (!this.touchVisible && !dlgPlaying) {
            this.touchVisible = true;
            for (const k of this.touchKeys) k.active = true;
        }
    }
}
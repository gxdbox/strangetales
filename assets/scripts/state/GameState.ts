import { sys } from 'cc';

/** 玩家成长数据 */
export interface HeroData {
    name: string;
    lv: number;
    exp: number;
    maxHp: number;
    maxMp: number;
    atk: number;
    def: number;
    gold: number;
    /** 道具：名称 -> 数量 */
    items: Record<string, number>;
}

/** 存档结构 */
export interface SaveData {
    chapter: number;
    /** 剧情进度点 */
    progress: string;
    /** 重生点地图 */
    respawnMap: string;
    hero: HeroData;
}

const SAVE_KEY = 'strangetales_save_v1';

export function expNext(lv: number): number {
    return 10 * lv * lv;
}

export function hpGrowth(lv: number): number { return 18 + 6 * lv; }
export function mpGrowth(lv: number): number { return 6 + 3 * lv; }
export function atkGrowth(lv: number): number { return 5 + lv; }
export function defGrowth(lv: number): number { return 3 + Math.floor(lv / 2); }

export function makeHero(lv = 1): HeroData {
    return {
        name: '蒲宁',
        lv,
        exp: 0,
        maxHp: hpGrowth(lv),
        maxMp: mpGrowth(lv),
        atk: atkGrowth(lv),
        def: defGrowth(lv),
        gold: 0,
        items: { 馒头: 3 },
    };
}

/** 游戏全局状态（非组件单例） */
class GameState {
    public save: SaveData = {
        chapter: 1,
        progress: 'intro',
        respawnMap: 'map_gate',
        hero: makeHero(1),
    };

    /** 当前战斗后遗留的 hp/mp */
    public battleHp = 20;
    public battleMp = 8;

    public load(): void {
        const raw = sys.localStorage.getItem(SAVE_KEY);
        if (raw) {
            try {
                const d = JSON.parse(raw) as SaveData;
                if (d && d.hero) this.save = d;
            } catch (_e) { /* 存档损坏则忽略 */ }
        }
        this.battleHp = this.save.hero.maxHp;
        this.battleMp = this.save.hero.maxMp;
    }

    public saveGame(): void {
        try {
            sys.localStorage.setItem(SAVE_KEY, JSON.stringify(this.save));
        } catch (_e) { /* 存储不可用时忽略 */ }
    }

    /** 按当前等级全恢复 */
    public restore(): void {
        this.battleHp = this.save.hero.maxHp;
        this.battleMp = this.save.hero.maxMp;
    }

    public reset(): void {
        this.save = {
            chapter: 1,
            progress: 'intro',
            respawnMap: 'map_gate',
            hero: makeHero(1),
        };
        this.restore();
        this.saveGame();
    }

    public hasSave(): boolean {
        return !!sys.localStorage.getItem(SAVE_KEY);
    }

    /** 加经验并处理升级（FC 惯例：升级全恢复） */
    public gainExp(amount: number): number[] {
        const h = this.save.hero;
        h.exp += amount;
        const ups: number[] = [];
        while (h.lv < 8 && h.exp >= expNext(h.lv)) {
            h.exp -= expNext(h.lv);
            h.lv++;
            h.maxHp = hpGrowth(h.lv);
            h.maxMp = mpGrowth(h.lv);
            h.atk = atkGrowth(h.lv);
            h.def = defGrowth(h.lv);
            this.battleHp = h.maxHp;
            this.battleMp = h.maxMp;
            ups.push(h.lv);
        }
        return ups;
    }
}

export const Game = new GameState();
/**
 * 第一章《画皮》世界数据：敌人、道术、道具、地图布局
 * 地图为 16 列 x 14 行瓦片（16px），坐标 (x, y) 左上原点。
 * 碰撞网格由 tools/gen_chapter1.py 统一生成（见 MapGrids.ts），
 * npc / trigger / exit 坐标与美术网格自洽。
 */
import { TEXT } from './ChapterText';
import { WALKABLE } from './MapGrids';

/* ===== 敌人 ===== */
export interface EnemyDef {
    id: string;
    name: string;
    sprite: string;
    hp: number;
    atk: number;
    def: number;
    exp: number;
    gold: number;
    ghost?: boolean;   // 鬼族：受纸符克制
    /** 特殊行为：'drain' 吸血；'roar' 咆哮重击；'skin' 画皮回血 */
    gimmick?: 'drain' | 'roar' | 'skin';
}

export const ENEMIES: Record<string, EnemyDef> = {
    wolf: {
        id: 'wolf', name: '野狼', sprite: 'textures/enemies/wolf',
        hp: 9, atk: 5, def: 1, exp: 7, gold: 3,
    },
    ghost: {
        id: 'ghost', name: '游魂', sprite: 'textures/enemies/ghost',
        hp: 15, atk: 7, def: 2, exp: 12, gold: 5, ghost: true,
        gimmick: 'drain',
    },
    skin_lady: {
        id: 'skin_lady', name: '画皮·人面', sprite: 'textures/enemies/skin_mask',
        hp: 46, atk: 9, def: 3, exp: 45, gold: 30, ghost: true,
        gimmick: 'skin',
    },
    skin_demon: {
        id: 'skin_demon', name: '画皮·真形', sprite: 'textures/enemies/skin_demon',
        hp: 70, atk: 12, def: 4, exp: 85, gold: 60, ghost: true,
        gimmick: 'roar',
    },
};

/** 编队：森林暗雷 */
export const FOREST_PACKS: string[][] = [['wolf'], ['wolf'], ['wolf', 'wolf'], ['ghost']];
/** Boss 编队（人面败后现真形，两波） */
export const BOSS_PACKS: string[][] = [['skin_lady'], ['skin_demon']];

/* ===== 道术 ===== */
export interface SkillDef {
    id: string;
    name: string;
    mp: number;
    kind: 'fire' | 'heal';
    /** 威力描述（按等级成长） */
    power: string;
    desc: string;
}

export const SKILLS: Record<string, SkillDef> = {
    fire: { id: 'fire', name: '火诀', mp: 3, kind: 'fire', power: '12+2lv', desc: '丹火灼身，群邪辟易' },
    heal: { id: 'heal', name: '清心诀', mp: 4, kind: 'heal', power: '15+2lv', desc: '澄心静气，回生养命' },
};

/* ===== 道具 ===== */
export interface ItemDef {
    id: string;
    name: string;
    kind: 'hp' | 'full' | 'death';
    power: string;
    desc: string;
}

export const ITEMS: Record<string, ItemDef> = {
    bun: { id: 'bun', name: '馒头', kind: 'hp', power: '10', desc: '干粮。回复少许体力' },
    soup: { id: 'soup', name: '药汤', kind: 'full', power: 'all', desc: '老方熬制。体力全复' },
    talisman: { id: 'talisman', name: '纸符', kind: 'death', power: '9', desc: '朱砂符箓。对鬼族更痛' },
};

/* ===== 地图 ===== */
export interface MapDef {
    id: string;
    /** 14 行 x 16 列碰撞网格（由 MapGrids.ts 生成） */
    walkable: string[];
    spawn: [number, number];
    bgm: string;
    encounter?: boolean;
    npcs: { id: string; sprite: string; name: string; x: number; y: number }[];
    triggers: { id: string; x: number; y: number; once?: boolean }[];
    /** 踩上传送：x,y 为边缘出口瓦片，到 to 图的 (tx,ty) */
    exits: { x: number; y: number; to: string; tx: number; ty: number }[];
}

export const MAPS: Record<string, MapDef> = {
    map_gate: {
        id: 'map_gate', walkable: WALKABLE.map_gate, spawn: [7, 7], bgm: 'church',
        npcs: [
            { id: 'monk', sprite: 'textures/actors/npc_monk', name: '老僧', x: 12, y: 9 },
        ],
        triggers: [
            { id: 'stone', x: 2, y: 8, once: true },
            { id: 'ghost_flash', x: 13, y: 3, once: true },
        ],
        exits: [
            { x: 7, y: 1, to: 'map_hall', tx: 7, ty: 12 },
            { x: 7, y: 13, to: 'map_forest', tx: 7, ty: 2 },
        ],
    },
    map_hall: {
        id: 'map_hall', walkable: WALKABLE.map_hall, spawn: [7, 12], bgm: 'church',
        npcs: [],
        triggers: [
            { id: 'altar', x: 7, y: 10, once: true },
        ],
        exits: [
            { x: 7, y: 13, to: 'map_gate', tx: 7, ty: 2 },
            { x: 15, y: 6, to: 'map_yard', tx: 1, ty: 6 },
        ],
    },
    map_yard: {
        id: 'map_yard', walkable: WALKABLE.map_yard, spawn: [1, 6], bgm: 'field',
        npcs: [
            { id: 'maiden', sprite: 'textures/actors/npc_maiden', name: '若娘', x: 8, y: 5 },
        ],
        triggers: [
            { id: 'peep', x: 8, y: 3 },
            { id: 'well', x: 13, y: 11, once: true },
        ],
        exits: [
            { x: 0, y: 6, to: 'map_hall', tx: 14, ty: 6 },
        ],
    },
    map_forest: {
        id: 'map_forest', walkable: WALKABLE.map_forest, spawn: [7, 2], bgm: 'field',
        encounter: true,
        npcs: [],
        triggers: [{ id: 'forest_hint', x: 1, y: 2, once: true }],
        exits: [
            { x: 7, y: 0, to: 'map_gate', tx: 7, ty: 12 },
        ],
    },
};

/* ===== 剧情状态机 ===== */

export type Progress = string;

export interface StepResult {
    /** 播放的台词 key */
    key?: string;
    /** 推进后的新进度 */
    next?: string;
    skill?: string;
    items?: Record<string, number>;
    /** 对白结束后进入 Boss 战 */
    boss?: boolean;
}

export function stepText(step: StepResult): void {
    void step;
}

/** NPC 交互（面向该 NPC 按 A） */
export function npcStep(npcId: string, progress: string): StepResult {
    if (npcId === 'monk') {
        if (progress === 'cleared') {
            return { key: 'victory', next: 'ending' };
        }
        if (progress === 'met_m') {
            return { key: 'monk_second', next: 'watch_night' };
        }
        if (progress === 'watch_night' || progress === 'revealed') {
            return { key: 'monk_gone' };
        }
        if (progress === 'ending') return { key: 'victory' };
        return { key: 'monk_first', next: 'warned', skill: 'heal', items: { 纸符: 2 } };
    }
    if (npcId === 'maiden') {
        if (progress === 'cleared') return { key: 'victory', next: 'ending' };
        if (progress === 'watch_night' || progress === 'revealed') {
            return { key: 'peep', next: 'revealed', boss: true };
        }
        if (progress === 'met_m') return { key: 'maiden_second' };
        return { key: 'maiden_first', next: 'met_m', items: { 红罗帕: 1 } };
    }
    return {};
}

/** 机关交互 */
export function triggerStep(id: string, progress: string): StepResult {
    switch (id) {
        case 'stone':
            return { key: 'stone' };
        case 'ghost_flash':
            return { key: 'ghost_flash' };
        case 'altar':
            return { key: 'altar' };
        case 'well':
            return { key: 'well', items: { 药汤: 1 } };
        case 'peep':
            if (progress === 'watch_night') {
                return { key: 'peep', next: 'revealed', boss: true };
            }
            return {};
        case 'forest_hint':
            return { key: 'forest_hint' };
        default:
            return {};
    }
}

/** 进入地图时按进度播放起始对白 */
export function entryStep(progress: string): StepResult {
    if (progress === 'intro') {
        return { key: 'intro', next: 'explore' };
    }
    return {};
}

export { TEXT };
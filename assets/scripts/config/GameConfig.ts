/**
 * 全局游戏配置 —— FC 8-bit 常量
 * 设计分辨率严格遵循 FC：256 x 224，16x16 瓦片（14 行 x 16 列）
 */
export const CFG = {
    SCREEN_W: 256,
    SCREEN_H: 224,
    TILE: 16,
    COLS: 16,
    ROWS: 14,
    /** 玩家精灵：4 向 x 2 帧 */
    ACTOR_W: 16,
    ACTOR_H: 24,
    /** 遇敌步数窗口 */
    ENCOUNTER_STEPS: 14,
    ENCOUNTER_RATE: 0.35,
    FONT: 'PingFang SC',
} as const;

/** FC 经典 52 色调色板常用色（RGB） */
export const FC: Record<string, number[]> = {
    BLACK: [0, 0, 0],
    WHITE: [252, 252, 252],
    RED: [188, 0, 0],
    DEEP_RED: [136, 0, 0],
    ORANGE: [252, 168, 68],
    YELLOW: [252, 252, 84],
    GREEN: [0, 168, 0],
    DEEP_GREEN: [0, 136, 0],
    TEAL: [0, 168, 136],
    BLUE: [0, 0, 188],
    SKY: [0, 168, 252],
    PURPLE: [72, 0, 136],
    GRAY: [136, 136, 136],
    DEEP_GRAY: [60, 60, 60],
    BROWN: [152, 76, 0],
    DEEP_BROWN: [92, 44, 0],
    SKIN: [252, 200, 136],
    DARK_BLUE: [0, 0, 112],
};

/** 通用小工具 */
export function clamp(v: number, a: number, b: number): number {
    return Math.max(a, Math.min(b, v));
}
export function rndInt(a: number, b: number): number {
    return a + Math.floor(Math.random() * (b - a + 1));
}
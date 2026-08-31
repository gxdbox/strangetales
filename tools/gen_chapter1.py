#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
《聊斋志异·画皮》第一章美术资源生成器
输出到 assets/resources/textures/ 并生成 MapGrids.ts（与 TS 走路判定同步）
运行：python3 tools/gen_chapter1.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from paint import (
    Canvas, PAL,
    grass, dark_grass, stone_path, brick_wall, wood_floor,
    roof_tile, wall_top, empty,
    TILE_TREE, TILE_TREE2, TILE_GRAVE, TILE_DOOR, TILE_WELL,
    TILE_ALTAR, TILE_CUSHION, TILE_PILLAR, TILE_LANTERN, TILE_LANTERN2,
    TILE_WINDOW, TILE_MOON_GATE, TILE_STEPS,
)

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                   '..', 'assets', 'resources', 'textures')
OUT = os.path.normpath(OUT)

# ---------- 地图 grid（TS 同步源） ----------
# 可走：'.' 石板 ',' 草 '*' 深草 'D' 门 'S' 台阶；其余为不可走装饰
# 每行必须恰好 16 字符（14 行），与 WorldData.ts 的 npc/trigger/exit 坐标自洽
PASSABLE_SET = {'.', ',', '*', 'D', 'S'}

GATE = [
    '~~~~~~~~~~~~~~~~',   # 0 寺墙顶瓦
    '#######D########',   # 1 山门（D@7 向北入大殿）
    '#..............#',   # 2
    '#..T.......T...#',   # 3 两侧枯树
    '#.,.,.,.,.,.,.,#',   # 4
    '#.,.,.,.,.,.,.,#',   # 5
    '#..............#',   # 6
    '#.......G......#',   # 7 G=残碑（装饰）
    '#.,.,.,.,.,.,.,#',   # 8
    '#.,.,.,.,.,.,.,#',   # 9
    '#.,.,.,.,.,.,.,#',   # 10
    '#.,.,.,.,.,.,.,#',   # 11
    '#..............#',   # 12
    '.,.,.,.,.,.,.,.,',   # 13 南去野道（去暗林）
]

HALL = [
    '================',    # 0 殿顶
    '#..............#',    # 1
    '#..UU.......P..#',    # 2 高窗 + 柱
    '#..............#',    # 3
    '#.P..........P.#',    # 4 东西柱
    '#..............#',    # 5
    '#..............D',    # 6 D@15 东侧门（去偏院）
    '#......AAAA....#',   # 7 供桌
    '#......ACCA....#',   # 8 供桌+蒲团
    '#......AAAA....#',   # 9
    '#..............#',    # 10
    '#.P..........B.#',    # 11 柱+幡
    '#..............#',    # 12
    '#......D.......#',    # 13 D@7 南门（回山门）
]

YARD = [
    '================',    # 0 屋顶
    '#..............#',    # 1
    '#.........L....#',    # 2 L@10 青灯
    '#**************#',    # 3 花丛（可穿行）
    '#**************#',    # 4
    '#****T******T**#',    # 5 花丛+树
    'D..............#',    # 6 D@0 西侧门（回大殿）
    '#..............#',    # 7
    '#.......L......#',    # 8 L@8 灯
    '#.....#........#',    # 9 #@6 石堆（不可走）
    '#..............#',    # 10
    '#.............W#',    # 11 W@14 井（不可走）
    '#..............#',    # 12
    '################',    # 13 南墙
]


def frow(overrides, base='*'):
    """构建 16 列森林行：baseline '*'（深草可走），指定列覆盖"""
    row = [base] * 16
    for col, ch in overrides.items():
        row[col] = ch
    return ''.join(row)


FOREST = [
    '.,.,.,.,.,.,.,.,',                                # 0 北归口（回山门）
    frow({7: '.'}),                                       # 1
    frow({3: 'T', 7: ',', 8: '^', 12: 'T'}),              # 2
    frow({1: '.', 2: ',', 9: 'T', 14: ','}),              # 3
    frow({3: '^', 5: ',', 9: 'T', 12: ','}),              # 4
    frow({2: 'T', 6: ',', 10: ',', 13: ','}),             # 5
    frow({2: ',', 7: 'T', 10: ',', 14: 'T'}),             # 6
    frow({4: ',', 8: ',', 12: ',', 15: 'T'}),             # 7
    frow({3: '^', 7: 'T', 11: ',', 14: ','}),             # 8
    frow({2: ',', 5: ',', 7: 'T', 9: ',', 12: 'T'}),      # 9
    frow({1: ',', 6: ',', 10: '.', 13: ','}),             # 10
    frow({3: ',', 5: 'T', 7: 'T', 9: ',', 11: 'T'}),      # 11
    frow({4: ',', 8: ',', 12: ',', 14: '^'}),             # 12
    frow({2: '^', 4: 'T', 6: ',', 7: 'T', 13: 'T'}),      # 13
]

GRIDS = {
    'map_gate': GATE,
    'map_hall': HALL,
    'map_yard': YARD,
    'map_forest': FOREST,
}


def validate_grids():
    for name, rows in GRIDS.items():
        assert len(rows) == 14, f'{name}: {len(rows)} 行，应为 14'
        for i, r in enumerate(rows):
            assert len(r) == 16, f'{name}[{i}] len={len(r)}: {r!r}'


TILE_FN = {
    '#': brick_wall, '~': wall_top, '=': roof_tile,
    '.': stone_path, ',': grass, '*': dark_grass,
    'T': TILE_TREE, '^': TILE_TREE2, 'G': TILE_GRAVE,
    'D': TILE_DOOR, 'W': TILE_WELL, 'A': TILE_ALTAR,
    'C': TILE_CUSHION, 'P': TILE_PILLAR, 'L': TILE_LANTERN,
    'U': TILE_WINDOW, 'S': TILE_STEPS, 'M': TILE_MOON_GATE,
    'B': TILE_WINDOW,  # 幡用窗色
    'F': [
        '................',
        '................',
        '................',
        '................',
        '......RR........',
        '.....RRRR.......',
        '....RRFFRR......',
        '.....RYYR.......',
        '.....RYYR.......',
        '.....RYYR.......',
        '......RR........',
        '.......r........',
        '......,r........',
        '.....,.r........',
        '................',
        '................',
    ],
} | {}

def draw_map(map_id, grid):
    c = Canvas(16 * 16, 14 * 16)
    for ty, row in enumerate(grid):
        assert len(row) == 16, f'{map_id} row {ty} len={len(row)}'
        for tx, ch in enumerate(row):
            fn = TILE_FN.get(ch)
            if fn:
                tile = fn() if callable(fn) else fn
                c.blit(tile, tx * 16, ty * 16)
            else:
                c.blit(grass(), tx * 16, ty * 16)
    return c


# ============================================================
# 人物 / 敌人点阵
# ============================================================

# 主角：青衫书生 16x24，下/左/上/右
PLAYER_D = [
    '......KKKK......',
    '.....KBBBBK.....',
    '.....KBBBBK.....',
    '.....KBBBBK.....',
    '.....KEEEEK.....',
    '.....EEEEEE.....',
    '....EEEEEEEE....',
    '....EEEEEEEE....',
    '.....EEEEEE.....',
    '....EEEEEEEE....',
    '.....EEEEEE.....',
    '....BBBBBBB.....',
    '...BBBBBBBBB....',
    '..BBBBBBBBBBB...',
    '..BB.BBBB.BBB...',
    '..BB.BBB..BBB...',
    '..BBBBBBBBBBB...',
    '..EB.BBBBBBBE...',
    '..EE........EE..',
    '.BBBBBBBBBBBBB..',
    '.BB.BBBBBBB.BB..',
    '.BB.BBBBBBB.BB..',
    'KKKK........KKK.',
    '................',
]

PLAYER_U = [
    '......KKKK......',
    '.....KBBBBK.....',
    '.....KBBBBK.....',
    '.....KBBBBK.....',
    '.....KBBBBK.....',
    '.....BBBBBB.....',
    '....BBBBBBBB....',
    '...BBBBBBBBBB...',
    '...BBBBBBBBBB...',
    '..BBBBBBBBBBBB..',
    '..BBBBBBBBBBBB..',
    '..BBBBBBBBBBBB..',
    '..BBBBBBBBBBBB..',
    '..BB.BBBBBB.BB..',
    '..BB.BBBBBB.BB..',
    '..BBBBBBBBBBBB..',
    '..EB.BBBBBBBE...',
    '..EE.......EE...',
    '.BBBBBBBBBBBBB..',
    '.BB.BBBBBBB.BB..',
    '.BB.BBBBBBB.BB..',
    'KKKK........KKK.',
    '................',
    '................',
]

PLAYER_L = [
    '......KKKK......',
    '.....KBBBBK.....',
    '.....KBBBBK.....',
    '.....KBBBBK.....',
    '.....KEEEEK.....',
    '.....EEEEEE.....',
    '....EEEEEEE.....',
    '....EEEEEE......',
    '.....EEEEEE.....',
    '....EEEEEEE.....',
    '.....EEEEEE.....',
    '....BBBBBBBB....',
    '...BBBBBBBBBB...',
    '..BBBBBBBBBBBB..',
    '..BB.BBBB.BBB...',
    '..BB.BBB..BBB...',
    '..BBBBBBBBBBB...',
    '..BBBBBBBBBBBB..',
    '..EBBBBBEEEEBB..',
    '..EEEEEEE.EEEE..',
    '.BBBBBBBBBBBBB..',
    '.BBBBBBBBBBBBB..',
    'KKKK........KKK.',
    '................',
]

PLAYER_R = [row[::-1] for row in PLAYER_L]

# 老僧 16x24（O 僧袍 E 头 K 佛珠）
NPC_MONK = [
    '................',
    '......EEEE......',
    '.....EEEEEE.....',
    '.....EEEEEE.....',
    '....EEEEEEEE....',
    '....EE..E..E....',
    '....EE....EE....',
    '.....EEEEEE.....',
    '....OOOOOOOO....',
    '...OOOOOOOOOO...',
    '..OOOOOOOOOOOO..',
    '..OO.OOOO.OOOO..',
    '..OO.OOOO.OOOO..',
    '..OOOOOOOOOOOO..',
    '..EO.OOOO.OOOE..',
    '..EE........EE..',
    '.nOOOOOOOOOOOn..',
    '.OO.OOO.OOO.OO..',
    '.OO.OOO.OOO.OO..',
    '.OO.OOOOOOO.OO..',
    'KKK..........KK.',
    '................',
    '................',
    '................',
]

# 若娘 16x24（K 黑发 E 面 R 红衣）
NPC_MAIDEN = [
    '................',
    '.....KKKKK......',
    '....KKKKKKK.....',
    '....KKKKKKK.....',
    '....KEEEEEK.....',
    '....KEEEEEK.....',
    '.....EEEEE......',
    '.....E.E.E......',
    '.....EEEEE......',
    '.....RRRR.......',
    '....RRRRRRR.....',
    '...RRRRRRRRR....',
    '..RRRRRRRR.RR...',
    '..RRR.RRRR.RR...',
    '..RRR.RRRR.RR...',
    '..RRRRRRRRRRR...',
    '..RRRRRRRRRRR...',
    '...RR.RRRR.RR...',
    '...EE..RR..EE...',
    '..RRRRRRRRRRR...',
    '..RRR.RRRRRRR...',
    '..RRR.RRRR.RR...',
    '..KKK......KK...',
    '................',
]

# 野狼 32x40
WOLF = [
    '............N...................',
    '...........NNN..................',
    '..........NNNNN.................',
    '..........NNNNN.................',
    '.........NNNNNN.................',
    '.........NNNNNNN................',
    '.........NN.NNNN................',
    '.........NN.NNNNN...............',
    '........NNN..NNNNN..............',
    '........NNN..NNNNNN.............',
    '.......NNNN...NNNNN.............',
    '.......NNNN...NNNNNN............',
    '......NNNNN....NNNNN..Y.........',
    '......NNNNN....NNNNNYY..........',
    '.....NNNNNN.....NNNNN...........',
    '.....NNNNNN....nNNNNn...........',
    '....NNNNNN.....NNNNN............',
    '....NNNNNNN...NNNNN.n..........',
    '...NNNNNNNN..NNNNNN............',
    '...NNNNNNNNN.NNNNNN............',
    '..NNNNNNNNN.NNNNNNN....W.......',
    '..NNNNNNNNNNNNNNNNN.WWW........',
    '.NNNNNNNNNNNNNNNNNNN...........',
    '.NNNNNNNNNNNNNNNNNN............',
    '.NNNNNNNNNNNNNNNNN.............',
    '.NNNNNNNNNNNNNNNN..............',
    '.NNNNnnNNNNNNNNN...............',
    '..NNNN.NNNNNNNN................',
    '..NNNN.NNNNNNN.................',
    '..NNNN.NNNNNNN.................',
    '...NNN.NNNNNNN.................',
    '...NNN..NNNNNN.................',
    '...N.........NNN...............',
    '............NNNN...............',
    '...........NNNNN...............',
    '..........NNNNNN...............',
    '.........NNNNN.................',
    '.........NNNN..................',
    '.........NNN...................',
    '........N....',
    '........N.....',
    '........N.....',
    '........N.....',
    '........N....',
    '........N.....',
    '.......N......',
    '.......N......',
    '......N.......',
]

# 游魂 32x40（W/N 雾影）
GHOST = [
    '....................................'[:32],
    '............WWWW....................'[:32],
    '.........WWWWWWWWW..................'[:32],
    '.......WWWWWWWWWWWW.................'[:32],
    '......WWWWnWWWWWWWW.................'[:32],
    '.....WWWWWnWWWWWWWWW................'[:32],
    '....WWWWWWWnWWWWWWWWW...............'[:32],
    '....WWWWWWWWWWWWWWWWW...............'[:32],
    '...WWWWWnWWWWWWnWWWWWW..............'[:32],
    '...WWWWWWWWWWWWWWWWWWW..............'[:32],
    '..WWWWWWWWnWWWWWWWWWWWW.............'[:32],
    '..WWWWnWWWWWWWWWWWWnWWW.............'[:32],
    '..WWWWWWWWWKKKKWWWWWWWW.............'[:32],
    '..WWWWWWWWKnnnnKWWWWWWW.............'[:32],
    '..WWWWWWWKnnnnnnKWWWWWW.............'[:32],
    '..WWWWWWWWKnnnnKWWWWWWW.............'[:32],
    '..WWWWWWWWWKKKKWWWWWWWW.............'[:32],
    '...WWWWnWWWWWWWWWWWWnW..............'[:32],
    '...WWWWWWWWWnWWWWWWWWW..............'[:32],
    '...WWWWWWWWWWnWWWWWWWW..............'[:32],
    '....WWWWWWWWWWWWWWWWW...............'[:32],
    '....WWWWWWWWWnWWWWWWW...............'[:32],
    '....WWWWWWWWWWWWWWWW................'[:32],
    '.....nWWWWWWWWWWWWn..................'[:32],
    '......nWWWWWWWWWn...................'[:32],
    '.......nWWWWWWWn....................'[:32],
    '........nWWWWWn.....................'[:32],
    '.........nWWWn......................'[:32],
    '..........nWn.......................'[:32],
    '...........n........................'[:32],
    '..........NNNN......................'[:32],
    '.........NNNNNN.....................'[:32],
    '.........NNNNN......................'[:32],
    '..........NNN.......................'[:32],
    '..........NNN.......................'[:32],
    '...........N........................'[:32],
    '................................'[:32],
    '................................'[:32],
    '................................'[:32],
    '................................'[:32],
    '................................'[:32],
]

# 画皮·人面 48x48（红衣美人）
SKIN_MASK = [
    '..................KKK...............'[:48],
    '.............KKKKKKKKK.............'[:48],
    '..........KKKKKKKKKKKKKKK..........'[:48],
    '.........KKKKKKKKKKKKKKKKK.........'[:48],
    '........KKKKKKKKKKKKKKKKKKKK.......'[:48],
    '.......KKKKKKKKKKKKKKKKKKKKK.......'[:48],
    '......KKKKKEEEEEEEEEEEEKKKKK.......'[:48],
    '......KKKKEEEEEEEEEEEEEKKKKK.......'[:48],
    '......KKKEEEEEEEEEEEEEEKKKK........'[:48],
    '......KKKEEE..EEEE..EEEKKKK........'[:48],
    '......KKKEEE..EEEE..EEEKKKK........'[:48],
    '......KKKEEEEEEEEEEEEEKKKK.........'[:48],
    '......KKKEEEEEEEEEEEEKKKK..........'[:48],
    '......KKK.EEEKKKKEEEEK.............'[:48],
    '......KKK.EKKK..KKKEK.............'[:48],
    '......KKKKKKK....KKKKK............'[:48],
    '......KKKKKKK..R.R.KKKK...........'[:48],
    '......KKKKKKK..RRR.KKKK...........'[:48],
    '.......KKKKKK..RRR..KKKK..........'[:48],
    '.......KKKKK...RRR...KKK..........'[:48],
    '.......KKKKK..RRRRR..KKK..........'[:48],
    '........KKK...RRRRR..KK...........'[:48],
    '........KKK..RRRRRRR.KK...........'[:48],
    '........KK.QRRRRRRRRQ.KK..........'[:48],
    '.........KKRRRRRRRRRR.KK..........'[:48],
    '......QQQQRQRQQRQQRQRQQQQ.........'[:48],
    '.....QRRRRRRRRRRRRRRRRRRQ.........'[:48],
    '....QRRrRRRRRRRRRRRRRrRRRQ........'[:48],
    '...QRrrRRRRRRRRRRRRRRRrrRRQ.......'[:48],
    '...QRRRRRRR.RRRR..RRRRRRRQ........'[:48],
    '..QRRRRRRR..RRRR..RRRRRRRRQ.......'[:48],
    '..QRRRRRRR..RRRR..RRRRRRRRQ.......'[:48],
    '..QQRRRRRR.RRRR...RRRRRRQQ........'[:48],
    '..EEQQRRRRRRRRR..RRRRRQQEE........'[:48],
    '..EE..QQQRRRRR...RRRQQQ..EE.......'[:48],
    '...KK...RRRRRR..RRRRR...KK........'[:48],
    '...KK...RRRRRR..RRRRR...KK........'[:48],
    '...KK...RRRRRR..RRRRR...KK........'[:48],
    '...KK...RRRRRR..RRRRR...KK........'[:48],
    '...KK...RRRRRR..RRRRR...KK........'[:48],
    '...KK....RRRRR..RRRR....KK........'[:48],
    '............RR..RR................'[:48],
    '............RR..RR................'[:48],
    '...........RR....RR...............'[:48],
    '..........RRR....RRR..............'[:48],
    '.........RRR......RRR.............'[:48],
    '........KKK........KKK............'[:48],
    '................................'[:48],
]

# 画皮·真形 48x48（青面獠牙恶鬼）
SKIN_DEMON = [
    '..........KKKKKKKK.............'[:48],
    '.........KKKKKKKKKKKK..........'[:48],
    '........KKKKKKKKKKKKKKK........'[:48],
    '.......KKKKKKKKKKKKKKKKK.......'[:48],
    '......KKKKKKKKKKKKKKKKKKK......'[:48],
    '.....KKKKKKKKKKKKKKKKKKKKK.....'[:48],
    '.....KKKKKKTTTTTTTTTKKKKKK.....'[:48],
    '....KKKKKTTTTTTTTTTTKKKKKK.....'[:48],
    '....KKKKTTTTTTTTTTTTTKKKKK.....'[:48],
    '....KKKTTTTTTTTTTTTTTTKKKK.....'[:48],
    '....KKKTTFFTTTTTTFFTTTKKKK.....'[:48],
    '....KKKTTFFTTTTTTFFTTTKKKK.....'[:48],
    '....KKKTTTTTKKKKTTTTTTKKKK.....'[:48],
    '....KKKKTTTTTTTTTTTTTKKKK......'[:48],
    '.....KKKKTTTTTTTTTTTKKKK.......'[:48],
    '......KKKKKTTTTTTKTKKKK........'[:48],
    '......KKKKKKKWWKKKKKK..........'[:48],
    '.......KKKKKWWWWWWKKK..........'[:48],
    '.......KKKKWWWWWWWWKK..........'[:48],
    '.......KKKKW.WWWW.WKK..........'[:48],
    '.......KKKKW.WWWW.WKK..........'[:48],
    '.......KKKK.KK..KK.KKK.........'[:48],
    '........KKKKK....KKKK..........'[:48],
    '........KKKKK....KKKK..........'[:48],
    '........KKKK......KKK..........'[:48],
    '........KKKK......KKKK.........'[:48],
    '.........KKK......KKKK.........'[:48],
    '.........KKK..KK..KKKK.........'[:48],
    '........KKKKK.KKK..KKKK........'[:48],
    '........KKKKKKKKK..KKKK........'[:48],
    '.......KKKKKKKKKK..KKKKK.......'[:48],
    '.......KKK.KKKKKK..KKKKK.......'[:48],
    '...EE.QQQ.KKKKKK..KKQQQ.EE.....'[:48],
    '...EE...QQ.KKKK..KKQQ...EE.....'[:48],
    '...KK....QQ.KK..QQ.QQ...KK.....'[:48],
    '...KK.....QQQ..QQQ......KK.....'[:48],
    '...KK......QQQQQQ.......KK.....'[:48],
    '...KK......QQQQQ........KK.....'[:48],
    '...KK......QQQQQ........KK.....'[:48],
    '...KK.......QQQ.........KK.....'[:48],
    '...KK.......QQQ.........KK.....'[:48],
    '...KK........Q..........KK.....'[:48],
    '............QQ..................'[:48],
    '............QQ.................'[:48],
    '...........QQQ.................'[:48],
    '..........QQQQ.................'[:48],
    '..........Q..Q.................'[:48],
    '.........QQ..QQ................'[:48],
]


# ---------- 点阵标题字（线段法） ----------
def hex_lines(ch_lines, scale=1):
    """ch_lines: list of ((x0,y0,x1,y1), ...) → 16x16 点阵"""
    grid_sz = 16 * scale
    rows = [['.'] * 16 for _ in range(16)]
    for (x0, y0, x1, y1) in ch_lines:
        # 直线插值（步进）
        steps = max(abs(x1 - x0), abs(y1 - y0))
        for i in range(steps + 1):
            t = i / steps if steps else 0
            x = round(x0 + (x1 - x0) * t)
            y = round(y0 + (y1 - y0) * t)
            if 0 <= x < 16 and 0 <= y < 16:
                rows[y][x] = 'Y'
    return [''.join(r) for r in rows]

LIAO = [  # 聊（耳 + 卯）
    (1, 2, 1, 13), (1, 2, 7, 2), (1, 8, 6, 8), (1, 13, 7, 13), (7, 2, 7, 13),
    (3, 5, 5, 5), (3, 10, 5, 10), (3, 5, 3, 6),
    (9, 2, 14, 2), (11, 2, 11, 7), (12, 2, 12, 13), (8, 13, 14, 13),
    (9, 7, 10, 7), (11, 8, 11, 13), (14, 2, 14, 5),
]
ZHAI = [  # 斋（亠 + 而）
    (2, 1, 2, 2), (4, 1, 13, 1),
    (3, 4, 12, 4),
    (4, 4, 4, 9), (8, 3, 8, 13), (11, 4, 11, 9),
    (3, 9, 12, 9),
    (4, 10, 4, 12), (11, 10, 11, 12),
    (3, 13, 12, 13),
    (5, 6, 5, 8), (8, 5, 9, 5), (8, 7, 9, 7),
]
ZHI = [  # 志（士 + 心）
    (3, 1, 12, 1), (7, 1, 7, 4), (4, 4, 10, 4),
    (4, 8, 4, 9), (10, 8, 11, 7),
    (7, 8, 7, 13),
    (3, 12, 12, 12), (3, 12, 4, 13), (12, 12, 11, 13),
    (5, 11, 6, 12), (9, 11, 10, 12),
]
YI = [  # 异（巳 + 廾）
    (4, 2, 10, 2), (10, 2, 10, 8), (4, 8, 10, 8), (4, 2, 4, 8),
    (7, 5, 7, 6),
    (3, 10, 12, 10),
    (5, 9, 5, 14), (10, 9, 10, 14),
    (6, 9, 6, 10), (9, 9, 9, 10),
    (3, 10, 4, 9), (12, 10, 11, 9),
]

LOGO_CHARS = [LIAO, ZHAI, ZHI, YI]

# 副题「画皮」12x12 简化
HUAPI = [
    [
        (1, 1, 10, 1), (1, 1, 1, 5), (1, 6, 10, 6), (1, 6, 1, 10), (1, 10, 10, 10),
        (9, 2, 9, 10), (7, 4, 7, 5), (8, 4, 8, 5),
    ],
    [
        (1, 1, 9, 1), (2, 1, 2, 4), (9, 1, 9, 10),
        (2, 6, 8, 6), (2, 6, 2, 9), (2, 9, 8, 9),
        (6, 6, 6, 9), (8, 4, 9, 5),
    ],
]


def render_char(lines, size=16):
    rows = [['.'] * size for _ in range(size)]
    for (x0, y0, x1, y1) in lines:
        steps = max(abs(x1 - x0), abs(y1 - y0))
        for i in range(steps + 1):
            t = i / steps if steps else 0
            x = round(x0 + (x1 - x0) * t)
            y = round(y0 + (y1 - y0) * t)
            if 0 <= x < size and 0 <= y < size:
                rows[y][x] = 'Y'
    return [''.join(r) for r in rows]


def make_logo():
    """聊斋志异 LOGO：4 字 x3 缩放 + 阴影 + 副题「画皮」"""
    c = Canvas(224, 104)
    ch_w = 16
    scale = 3
    total_w = 4 * ch_w * scale + 3 * 4  # 字距 4
    ox = (224 - total_w) // 2
    oy = 8
    for li, lines in enumerate(LOGO_CHARS):
        glyph = render_char(lines, 16)
        cx = ox + li * (ch_w * scale + 4)
        # 阴影（深红，偏移 +2,+2）
        for ry, row in enumerate(glyph):
            for rx, ch in enumerate(row):
                if ch != '.':
                    for sy in range(scale):
                        for sx in range(scale):
                            c.set(cx + rx * scale + sx + 2, oy + ry * scale + sy + 2, 'r')
        # 主体（黄）
        for ry, row in enumerate(glyph):
            for rx, ch in enumerate(row):
                if ch != '.':
                    for sy in range(scale):
                        for sx in range(scale):
                            c.set(cx + rx * scale + sx, oy + ry * scale + sy, 'Y')
    # 副题
    sub_scale = 2
    sub_w = len(HUAPI) * 12 * sub_scale + 2 * 4
    sx0 = (224 - sub_w) // 2
    for li, lines in enumerate(HUAPI):
        glyph = render_char(lines, 12)
        cx = sx0 + li * (12 * sub_scale + 4)
        sy0 = oy + 16 * scale + 6
        for ry, row in enumerate(glyph):
            for rx, ch in enumerate(row):
                if ch != '.':
                    for sy in range(sub_scale):
                        for sx in range(sub_scale):
                            c.set(cx + rx * sub_scale + sx, sy0 + ry * sub_scale + sy, 'W')
    # 装饰线
    c.hline('R', ox - 6, oy + 16 * scale + 3, total_w + 12)
    return c


def make_title_bg():
    """标题背景：荒寺月夜剪影 256x160"""
    c = Canvas(256, 160)
    c.fill('u')
    # 渐变夜空
    for y in range(160):
        ch = 'u' if y < 90 else 'U'
        c.fill(ch, 0, y, 256, y + 1)
    # 月亮
    for dy in range(-14, 15):
        half = int((14 ** 2 - dy ** 2) ** 0.5)
        for dx in range(-half, half + 1):
            c.set(200 + dx, 24 + dy, 'Y' if dx * dx + dy * dy < 150 else 'O')
    # 寺院剪影（黑）
    c.fill('K', 64, 76, 192, 78)   # 殿身横梁
    c.fill('K', 74, 60, 180, 76)   # 屋顶（坡）
    for x in range(74, 180):
        c.set(x, 60, 'K')
    # 屋顶斜线
    for i in range(0, 30):
        c.set(74 + i, 60 + (30 - i) // 2, 'K')
        c.set(179 - i, 60 + (30 - i) // 2, 'K')
    # 塔尖
    c.fill('K', 124, 40, 132, 60)
    c.fill('K', 120, 44, 136, 46)
    # 山门
    c.fill('K', 108, 76, 116, 108)  # 门洞
    for x in range(104, 120, 3):
        c.vline('K', x, 76, 32)
    # 残墙
    for x in range(64, 100, 2):
        c.vline('K', x, 86, 20)
    for x in range(156, 192, 2):
        c.vline('K', x, 84, 22)
    # 前景草影
    for x in range(0, 256, 4):
        c.set(x, 148, 'M')
        c.set(x + 1, 149, 'M')
        c.set(x + 2, 150, 'M')
    for y in range(150, 160):
        c.fill('M', 0, y, 256, y + 1)
    # 灯笼红点
    c.fill('R', 96, 84, 100, 88)
    c.fill('R', 156, 84, 160, 88)
    return c


# ---------- 输出 ----------
def write_ts():
    """生成 MapGrids.ts：美术网格 MAP_GRIDS + 可走字符集 LIVE_SET + 碰撞网格 WALKABLE"""
    order = ['map_gate', 'map_hall', 'map_yard', 'map_forest']
    lines = []
    lines.append('/** 由 tools/gen_chapter1.py 自动生成，禁止手改 */')
    lines.append('/** 地图为 16 列 x 14 行；可走判定见 LIVE_SET，其余为不可走装饰 */')
    lines.append('export const MAP_GRIDS: Record<string, string[]> = {')
    for key in order:
        rows = GRIDS[key]
        lines.append(f'    {key}: [')
        for i, r in enumerate(rows):
            comma = ',' if i < len(rows) - 1 else ''
            lines.append(f'        {chr(39)}{r}{chr(39)}{comma}')
        lines.append('    ],')
    lines.append('};')
    lines.append('')
    lines.append('/** 可走瓦片（其余为不可走装饰） */')
    lines.append('export const LIVE_SET = new Set<string>([' + ', '.join(chr(39) + c + chr(39) for c in sorted(PASSABLE_SET)) + ']);')
    lines.append('')
    lines.append('/** 碰撞网格：\'.\' 可走 \'#\' 不可走（由 LIVE_SET 推导） */')
    lines.append('export const WALKABLE: Record<string, string[]> = {')
    for key in order:
        rows = GRIDS[key]
        lines.append(f'    {key}: [')
        for i, r in enumerate(rows):
            walk = ''.join('.' if ch in PASSABLE_SET else '#' for ch in r)
            comma = ',' if i < len(rows) - 1 else ''
            lines.append(f'        {chr(39)}{walk}{chr(39)}{comma}')
        lines.append('    ],')
    lines.append('};')
    lines.append('')
    path = os.path.normpath(os.path.join(OUT, '..', '..', 'scripts', 'data', 'MapGrids.ts'))
    with open(path, 'w') as f:
        f.write('\n'.join(lines))
    print('wrote', path)


def main():
    validate_grids()
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(os.path.join(OUT, 'maps'), exist_ok=True)
    os.makedirs(os.path.join(OUT, 'actors'), exist_ok=True)
    os.makedirs(os.path.join(OUT, 'enemies'), exist_ok=True)
    os.makedirs(os.path.join(OUT, 'title'), exist_ok=True)

    for key, grid in GRIDS.items():
        c = draw_map(key, grid)
        py = 16 * len(grid)
        if py < 224:
            c.h = 224
            c.px += [['.'] * 256 for _ in range(224 - py)]
        c.save(os.path.join(OUT, 'maps', key + '.png'))

    # 玩家 4 向（64x24 横排）
    pc = Canvas(64, 24)
    for d, spr in enumerate([PLAYER_D, PLAYER_L, PLAYER_U, PLAYER_R]):
        pc.blit(spr, d * 16, 0)
    pc.save(os.path.join(OUT, 'actors', 'player.png'))

    npcs = [('npc_monk', NPC_MONK), ('npc_maiden', NPC_MAIDEN)]
    for name, spr in npcs:
        c = Canvas(16, 24)
        c.blit(spr, 0, 0)
        c.save(os.path.join(OUT, 'actors', name + '.png'))

    foes = [('wolf', WOLF, 32, 40), ('ghost', GHOST, 32, 40),
            ('skin_mask', SKIN_MASK, 48, 48), ('skin_demon', SKIN_DEMON, 48, 48)]
    for name, spr, w, h in foes:
        c = Canvas(w, h)
        c.blit(spr, 0, 0)
        c.save(os.path.join(OUT, 'enemies', name + '.png'))

    logo = make_logo()
    logo.save(os.path.join(OUT, 'title', 'logo.png'))
    tbg = make_title_bg()
    tbg.save(os.path.join(OUT, 'title', 'bg.png'))

    write_ts()
    print('ALL ASSETS DONE')


if __name__ == '__main__':
    main()
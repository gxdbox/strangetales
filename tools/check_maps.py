#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""地图一致性校验：BFS 验证 spawn/触发/出口/NPC 全员可达（与 MapScreen 走法一致）"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gen_chapter1 as G  # noqa: E402

PASS = G.PASSABLE_SET


def walkable(grid, tx, ty):
    """头部（tx,ty）必须在地图内且可走；脚部用 foot_ok 单独判定"""
    if tx < 0 or tx >= 16 or ty < 0 or ty >= 14:
        return False
    return grid[ty][tx] in PASS


def foot_ok(grid, tx, ty):
    """脚部（tx,ty）：ty == 14 视为悬出下缘可走"""
    if ty >= 14:
        return True
    return walkable(grid, tx, ty)


def reach(grid, m, targets):
    """BFS：角色头在 (x,y)，脚在 (x,y+1)；出口瓦片（门）豁免脚部墙体"""
    start = m['spawn']
    exits = set(m['exits'])
    seen = {start}
    q = [start]
    while q:
        x, y = q.pop(0)
        for dx, dy in ((0, 1), (0, -1), (1, 0), (-1, 0)):
            nx, ny = x + dx, y + dy
            if (nx, ny) in seen:
                continue
            if (nx, ny) in exits:
                seen.add((nx, ny))
                q.append((nx, ny))
                continue
            if walkable(grid, nx, ny) and foot_ok(grid, nx, ny + 1):
                seen.add((nx, ny))
                q.append((nx, ny))
    return set(targets) <= seen


MAPS = {
    'map_gate':   dict(spawn=(7, 7),  exits=[(7, 1), (7, 13)],       trig=[(2, 8), (13, 3)],  npcs=[(12, 9)]),
    'map_hall':   dict(spawn=(7, 12), exits=[(7, 13), (15, 6)],      trig=[(7, 10)],           npcs=[]),
    'map_yard':   dict(spawn=(1, 6),  exits=[(0, 6)],                trig=[(8, 3), (13, 11)],  npcs=[(8, 5)]),
    'map_forest': dict(spawn=(7, 2),  exits=[(7, 0)],                trig=[(1, 2)],            npcs=[]),
}
# 各图进出传送到达点（WorldData.ts exits 的 tx,ty）
ARRIVE = {
    'map_hall':   {(7, 12), (1, 6)},
    'map_gate':   {(7, 2), (7, 12)},
    'map_yard':   {(1, 6)},
    'map_forest': {(7, 2)},
}

ok = True
for mid, m in MAPS.items():
    grid = G.GRIDS[mid]
    for (x, y) in m['exits']:
        if not walkable(grid, x, y):
            print(f'[FAIL] {mid} 出口瓦片不可走 ({x},{y})')
            ok = False
    for (x, y) in m['trig']:
        if not walkable(grid, x, y):
            print(f'[FAIL] {mid} 触发瓦片不可走 ({x},{y})')
            ok = False
    for (x, y) in m['npcs']:
        adj = [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)]
        if not any(walkable(grid, a, b) for a, b in adj):
            print(f'[FAIL] {mid} NPC({x},{y}) 四邻均不可走')
            ok = False
    for (x, y) in ARRIVE.get(mid, set()):
        if not walkable(grid, x, y):
            print(f'[FAIL] {mid} 传送到达点不可走 ({x},{y})')
            ok = False
    if reach(grid, m, m['trig'] + m['exits']):
        print(f'[ok] {mid}: spawn{m["spawn"]} -> 触发{m["trig"]} 出口{m["exits"]} 均可达')
    else:
        miss = [t for t in m['trig'] + m['exits'] if not reach(grid, m, [t])]
        print(f'[FAIL] {mid} 不可达: {miss}')
        ok = False

print('ALL OK' if ok else 'HAS FAILURES')
sys.exit(0 if ok else 1)
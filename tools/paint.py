#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
FC 8-bit 像素绘制工具库
纯标准库实现 PNG 编码（zlib + struct），无第三方依赖。

用法：
    canvas = Canvas(w, h)
    canvas.blit(sprite, x, y)     # sprite: row-string 点阵（字符→调色板）
    canvas.fill(ch, x0, y0, x1, y1)
    canvas.save(path)
"""

import struct
import zlib

# ============ FC 风格调色板 ============
# 字符键 -> (r, g, b)
PAL = {
    '.': None,            # 透明
    'K': (0, 0, 0),
    'W': (252, 252, 252),
    'R': (188, 0, 0),
    'r': (136, 0, 0),
    'O': (252, 168, 68),
    'Y': (252, 252, 84),
    'G': (0, 168, 0),
    'g': (0, 136, 0),
    'H': (0, 68, 0),
    'T': (0, 168, 136),
    'B': (0, 0, 188),
    'b': (0, 0, 112),
    'S': (0, 168, 252),
    's': (96, 188, 252),
    'P': (72, 0, 136),
    'p': (184, 108, 252),
    'N': (136, 136, 136),
    'n': (60, 60, 60),
    'D': (152, 76, 0),
    'd': (92, 44, 0),
    'E': (252, 200, 136),
    'e': (216, 152, 84),
    'V': (40, 24, 8),
    'M': (24, 12, 4),
    'U': (16, 28, 52),   # 深夜天空
    'u': (8, 16, 36),
    'F': (252, 124, 0),
    'Q': (188, 88, 0),
}

def parse(ch):
    return PAL.get(ch, PAL['W'])


class Canvas:
    def __init__(self, w, h):
        self.w = w
        self.h = h
        # 每像素存调色板字符，'.' 为透明
        self.px = [['.'] * w for _ in range(h)]

    def set(self, x, y, ch):
        if 0 <= x < self.w and 0 <= y < self.h and ch != '.':
            self.px[y][x] = ch

    def fill(self, ch, x0=0, y0=0, x1=None, y1=None):
        x1 = self.w if x1 is None else x1
        y1 = self.h if y1 is None else y1
        for y in range(y0, y1):
            for x in range(x0, x1):
                self.set(x, y, ch)

    def blit(self, rows, ox, oy, scale=1):
        """rows: list[str]，字符为调色板键；ox,oy 为左上角"""
        for ry, row in enumerate(rows):
            for rx, ch in enumerate(row):
                if ch == '.' or ch == ' ':
                    continue
                for sy in range(scale):
                    for sx in range(scale):
                        self.set(ox + rx * scale + sx, oy + ry * scale + sy, ch)

    def hline(self, ch, x, y, length):
        for i in range(length):
            self.set(x + i, y, ch)

    def vline(self, ch, x, y, length):
        for i in range(length):
            self.set(x, y + i, ch)

    def rect(self, ch, x0, y0, w, h, fill_ch=None):
        for y in range(y0, y0 + h):
            for x in range(x0, x0 + w):
                if x in (x0, x0 + w - 1) or y in (y0, y0 + h - 1):
                    self.set(x, y, ch)
                elif fill_ch:
                    self.set(x, y, fill_ch)

    def save(self, path):
        # PNG 编码：每行前置 filter byte 0
        raw = bytearray()
        for y in range(self.h):
            raw.append(0)
            for x in range(self.w):
                idx = self.px[y][x]
                if idx == '.':
                    raw.extend((0, 0, 0, 0))
                else:
                    r, g, b = parse(idx)
                    raw.extend((r, g, b, 255))

        def chunk(tag, data):
            c = struct.pack('>I', len(data)) + tag + data
            c += struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff)
            return c

        ihdr = struct.pack('>IIBBBBB', self.w, self.h, 8, 6, 0, 0, 0)
        png = b'\x89PNG\r\n\x1a\n'
        png += chunk(b'IHDR', ihdr)
        png += chunk(b'IDAT', zlib.compress(bytes(raw), 9))
        png += chunk(b'IEND', b'')
        with open(path, 'wb') as f:
            f.write(png)
        print('saved', path, f'{self.w}x{self.h}')


# ============ 瓦片工厂（16x16） ============
def make_tile(base_ch, noise_ch, noise_pattern, border_ch=None, border_bits=0):
    """通用噪点瓦片：底 base，噪声点按 8 位 mask 的行/列修饰"""
    rows = []
    for y in range(16):
        line = []
        for x in range(16):
            ch = base_ch
            if noise_pattern:
                # 每像素 hash 轻噪
                hsh = (x * 31 + y * 17) % 7
                if hsh == 0:
                    ch = noise_ch
            if border_bits and (x == 0 or y == 0 or x == 15 or y == 15):
                ch = border_ch
            line.append(ch)
        rows.append(''.join(line))
    return rows


def brick_wall():
    """灰砖寺墙"""
    rows = []
    for y in range(16):
        line = []
        for x in range(16):
            ch = 'N'
            if y % 4 == 0 or y == 15:
                ch = 'n'  # 灰缝
            elif x % 8 == 0:
                ch = 'n'
            elif (x * 3 + y * 7) % 11 == 0:
                ch = 'n'
            line.append(ch)
        rows.append(''.join(line))
    return rows


def grass():
    rows = []
    for y in range(16):
        line = []
        for x in range(16):
            ch = 'H'
            if (x * 13 + y * 7) % 9 == 0:
                ch = 'G'
            elif (x * 5 + y * 11) % 13 == 0:
                ch = 'g'
            line.append(ch)
        rows.append(''.join(line))
    return rows


def stone_path():
    """青石板古道"""
    rows = []
    for y in range(16):
        line = []
        for x in range(16):
            ch = 'N'
            if (x + y) % 8 == 0 or (x * 3 + y) % 12 == 0:
                ch = 'n'
            elif (x * 7 + y * 3) % 14 == 0:
                ch = 'W'
            line.append(ch)
        rows.append(''.join(line))
    return rows


def wood_floor():
    """大殿木地板"""
    rows = []
    for y in range(16):
        line = []
        for x in range(16):
            ch = 'D'
            if y in (0, 15) or x % 4 == 0:
                ch = 'd'
            elif (x * 5 + y) % 9 == 0:
                ch = 'd'
            line.append(ch)
        rows.append(''.join(line))
    return rows


def dark_grass():
    rows = []
    for y in range(16):
        line = []
        for x in range(16):
            ch = 'u'
            if (x * 13 + y * 7) % 9 == 0:
                ch = 'H'
            elif (x * 5 + y * 11) % 13 == 0:
                ch = 'M'
            line.append(ch)
        rows.append(''.join(line))
    return rows


def roof_tile():
    """红瓦顶（横向瓦楞）"""
    rows = []
    for y in range(16):
        line = []
        for x in range(16):
            ch = 'r'
            if y % 4 == 0:
                ch = 'R'
            elif y % 4 == 1 and x % 6 == 3:
                ch = 'Q'
            line.append(ch)
        rows.append(''.join(line))
    return rows


def wall_top():
    """墙顶飞檐（水平条）"""
    rows = []
    for y in range(16):
        line = []
        for x in range(16):
            if y < 3:
                ch = 'r'
                if y == 0:
                    ch = 'R'
            elif y == 3:
                ch = 'W'
            else:
                ch = 'N'
                if x % 8 == 0:
                    ch = 'n'
            line.append(ch)
        rows.append(''.join(line))
    return rows


def empty():
    return ['.' * 16] * 16


# ============ 手工特色瓦片（点阵字符串 16x16） ============

TILE_TREE = [
    '.......rr.......',
    '......rRRR......',
    '......RrrR......',
    '.....rRRRr......',
    '....rRRrRRr.....',
    '....RRRrRR......',
    '.....rRRr.......',
    '......dd........',
    '......dd........',
    '......dd........',
    '......dd........',
    '.....dDDd.......',
    '....d.ddd.......',
    '...d..dd........',
    '..d...dd........',
    '.d....dd........',
]

TILE_TREE2 = [
    '.......KK.......',
    '......KGGK......',
    '.....KGGGGK.....',
    '.....KGGGK......',
    '....KGGGGGK.....',
    '...KGGGGGK......',
    '....KGGGK.......',
    '......dd........',
    '......dd........',
    '.....dDDd.......',
    '.....d..d.......',
    '....d...dd......',
    '...d....dd......',
    '..d.....dd......',
    '..d.....dd......',
    '.dd.....dd......',
]

TILE_GRAVE = [
    '................',
    '................',
    '................',
    '......nnnn......',
    '.....nNNNNn.....',
    '....nN....Nn....',
    '....nN....Nn....',
    '....nN....Nn....',
    '....nN....Nn....',
    '...nnn....nnn...',
    '................',
    '................',
    '..g..........g..',
    '...g........g...',
    '..g.d......d.g..',
    '.gd..........dg.',
]

TILE_DOOR = [
    '.....dDDDDd.....',
    '....dDDDDDDd....',
    '...dDDddDDDDd...',
    '...dDd..dDDDd...',
    '..dDDd..dDDDDd..',
    '..dDDd..dDDDDd..',
    '.dDddddddddDDDd.',
    '.dDDd......dDDd.',
    '.dDDd..YY..dDDd.',
    '.dDDd..YY..dDDd.',
    'dDDddddDDddddDDd',
    'dDDd...dDDd..dDd',
    'dDDd...dDDd..dDd',
    'dddd...dddd..ddd',
    '................',
    '................',
]

TILE_WELL = [
    '...nnnnnnnnn....',
    '..nNNNNNNNNNn...',
    '.nNNNNNNNNNNNn..',
    '.nNNNNNNNNNNNn..',
    '.nNNNNNNNNNNNn..',
    '..nNNNNNNNNNn...',
    '...nnnnnnnnn....',
    '......bbbb......',
    '......BbbB......',
    '......BbbB......',
    '......bbbB......',
    '......bBBb......',
    '......bbbb......',
    '......BbbB......',
    '......bbbb......',
    '.....g....g.....',
]

TILE_ALTAR = [
    '....rrrrrrrr....',
    '...rRRRRRRRRr...',
    '..rRRYYYYYYRRr..',
    '..rRYYYYYYYYRr..',
    '..dRRWWRRWWRRd..',
    '..dRRWWRRWWRRd..',
    '.ddRRRRRRRRRRdd.',
    '.dDDDDDDDDDDDDd.',
    '.dDDDDDDDDDDDDd.',
    '.dDDddddddddDDd.',
    '.dDD.........DDd',
    '.dDD....d...DDd.',
    'ddDDDDDDDDDDDDdd',
    '................',
    '................',
    '................',
]

TILE_CUSHION = [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '......DDDD......',
    '.....DOOOOD.....',
    '....DOOOOOOD....',
    '....DOOOOOOD....',
    '.....DOOOOD.....',
    '......DDDD......',
    '................',
    '................',
    '................',
    '................',
]

TILE_PILLAR = [
    '......P..P......',
    '.....PP..PP.....',
    '....Pdp..pdP....',
    '...PdpP..PpdP...',
    '...PdpP..PpdP...',
    '...PdpP..PpdP...',
    '...PdpP..PpdP...',
    '..WdpP....PpdW..',
    '..WdpP....PpdW..',
    '...PdpP..PpdP...',
    '...PdpP..PpdP...',
    '...PdpP..PpdP...',
    '...PdpP..PpdP...',
    '...PdpP..PpdP...',
    '....Pdp..pdP....',
    '.....PP..PP.....',
]

TILE_LANTERN = [
    '........bb......',
    '.......bssb.....',
    '........bb......',
    '........rr......',
    '.......rRRr.....',
    '.......rYYr.....',
    '......rYYYYr....',
    '......rYYYYr....',
    '......rFYYFr....',
    '......rYYYYr....',
    '......rYYYYr....',
    '.......rYYr.....',
    '.......rYYr.....',
    '........rr......',
    '........nn......',
    '..........n.....',
]

TILE_LANTERN2 = [
    '................',
    '........bb......',
    '.......bssb.....',
    '........bb......',
    '........rr......',
    '.......rRRr.....',
    '.......rYYr.....',
    '......rYYYYr....',
    '......rYYYYr....',
    '.......rYYr.....',
    '.......rYYr.....',
    '........rr......',
    '........nn......',
    '..........n.....',
    '................',
    '................',
]

TILE_WINDOW = [
    '..nnnnnnnnnnnn..',
    '.nNNNNNNNNNNNNn.',
    '.nNWddddddddWNn.',
    '.nNWdYYYYYYdWNn.',
    '.nNWdYYYYYYdWNn.',
    '.nNWdYYYYYYdWNn.',
    '.nNWdYYYYYYdWNn.',
    '.nNWdYYYYYYdWNn.',
    '.nNWdYYYYYYdWNn.',
    '.nNWdYYYYYYdWNn.',
    '.nNWdYYYYYYdWNn.',
    '.nNWddddddddWNn.',
    '.nNWWWWWWWWWWNn.',
    '.nNNNNNNNNNNNNn.',
    '..nnnnnnnnnnnn..',
    '................',
]

TILE_MOON_GATE = [
    '................',
    '................',
    '......rrrr......',
    '....rRrrrrRr....',
    '...rRr....rRr...',
    '..rRrr....rrRr..',
    '..rRr......rRr..',
    '..rRr......rRr..',
    '..rRr......rRr..',
    '..dRr......rRd..',
    '..dRr......rRd..',
    '..dRrr....rrRd..',
    '...dRr....rRd...',
    '....dd....dd....',
    '................',
    '................',
]

TILE_STEPS = [
    '..nnnnnnnnnnnn..',
    '..nNNNNNNNNNNn..',
    '...nNNNNNNNNn...',
    '...nNNNNNNNNn...',
    '....nNNNNNNn....',
    '....nNNNNNNn....',
    '.....nNNNNn.....',
    '.....nNNNNn.....',
    '......nNNn......',
    '......nNNn......',
    '.......nn.......',
    '.......nn.......',
    '................',
    '................',
    '................',
    '................',
]

TILE_TABLE = [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
]


def eight_by_eight_a():
    return grass()
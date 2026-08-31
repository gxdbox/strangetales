/**
 * 资源加载工具：resources 动态加载 + 帧切割
 */
import { resources, SpriteFrame, Texture2D, Rect } from 'cc';

const _cache = new Map<string, SpriteFrame>();

export function loadSpriteFrame(path: string): Promise<SpriteFrame> {
    return new Promise((resolve, reject) => {
        const key = path + '/spriteFrame';
        const hit = _cache.get(key);
        if (hit) {
            resolve(hit);
            return;
        }
        resources.load(key, SpriteFrame, (err, sf) => {
            if (err || !sf) {
                reject(err || new Error('load fail: ' + path));
                return;
            }
            _cache.set(key, sf);
            resolve(sf);
        });
    });
}

/** 从大图中切割子帧（返回新的 SpriteFrame） */
export function cutFrame(src: SpriteFrame, x: number, y: number, w: number, h: number): SpriteFrame {
    const sf = new SpriteFrame();
    sf.texture = src.texture as Texture2D;
    sf.rect = new Rect(x, y, w, h);
    return sf;
}
/**
 * 标题画面：点阵 LOGO + 开始/继续菜单
 */
import {
    _decorator, Component, Node, Sprite, UITransform, Vec3, Label,
    input, Input, EventKeyboard, KeyCode,
} from 'cc';
import { FC } from '../config/GameConfig';
import { loadSpriteFrame } from '../ui/Assets';
import { makePanel, makeLabel, makeCursor, ScreenBase } from '../ui/FCUi';
import { Game } from '../state/GameState';
import { Sound } from '../audio/SoundManager';
import { App } from '../Boot';

const { ccclass } = _decorator;

@ccclass('TitleScreen')
export class TitleScreen extends ScreenBase {
    private cursor: Node | null = null;
    private menuIdx = 0;
    private hasSave = false;
    private started = false;

    protected onLoad(): void {
        input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this);
        Sound.playBgm('title');
        this.build();
    }

    protected onDestroy(): void {
        input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this);
    }

    private async build(): Promise<void> {
        // 黑幕
        makePanel('bg', 256, 224, 0, 0, this.node, false);
        // 荒寺剪影背景
        try {
            const bgf = await loadSpriteFrame('textures/title/bg');
            const bg = new Node('title_bg');
            bg.layer = this.node.layer;
            this.node.addChild(bg);
            bg.addComponent(Sprite).spriteFrame = bgf;
            bg.setPosition(new Vec3(0, 14, 0));
        } catch (_e) { /* 黑底兜底 */ }
        // LOGO
        try {
            const logoF = await loadSpriteFrame('textures/title/logo');
            const logo = new Node('logo');
            logo.layer = this.node.layer;
            this.node.addChild(logo);
            logo.addComponent(Sprite).spriteFrame = logoF;
            logo.setPosition(new Vec3(0, 58, 0));
        } catch (_e) { /* ignore */ }

        this.hasSave = Game.hasSave();
        const menu = new Node('menu');
        menu.layer = this.node.layer;
        this.node.addChild(menu);
        if (this.hasSave) {
            makeLabel('继续旅程', 12, FC.WHITE, menu, 0, -38, 120);
            makeLabel('重新开始', 12, FC.WHITE, menu, 0, -56, 120);
            this.cursor = makeCursor(menu, -44, -38);
            this.blinkCursor();
        } else {
            makeLabel('－新的旅程－', 12, FC.WHITE, menu, 0, -44, 130);
        }
        makeLabel('请按 J/空格 确定　方向键选择', 10, FC.GRAY, menu, 0, -82, 220);
        makeLabel('© 2026 志异绘卷 · FC STYLE RPG', 8, FC.DEEP_GRAY, menu, 0, -104, 220);
    }

    private blinkCursor(): void {
        if (!this.cursor) return;
        this.schedule(() => {
            if (this.cursor) this.cursor.active = !this.cursor.active;
        }, 0.4);
    }

    private onKeyDown(e: EventKeyboard): void {
        const c = e.keyCode;
        if (this.started) return;
        if (!this.hasSave) {
            if (c === KeyCode.KEY_J || c === KeyCode.SPACE || c === KeyCode.ENTER || c === KeyCode.KEY_Z) {
                this.startNew();
            }
            return;
        }
        if (c === KeyCode.ARROW_UP || c === KeyCode.KEY_W) { this.menuIdx = 0; this.syncCursor(); Sound.play('cursor'); }
        if (c === KeyCode.ARROW_DOWN || c === KeyCode.KEY_S) { this.menuIdx = 1; this.syncCursor(); Sound.play('cursor'); }
        if (c === KeyCode.KEY_J || c === KeyCode.SPACE || c === KeyCode.ENTER || c === KeyCode.KEY_Z) {
            if (this.menuIdx === 0) this.continueGame();
            else this.startNew();
        }
    }

    private syncCursor(): void {
        if (this.cursor) {
            this.cursor.active = true;
            this.cursor.setPosition(new Vec3(-44, this.menuIdx === 0 ? -38 : -56, 0));
        }
    }

    private startNew(): void {
        if (this.started) return;
        this.started = true;
        Sound.play('confirm');
        Game.reset();
        App.gotoMap('map_gate');
    }

    private continueGame(): void {
        if (this.started) return;
        this.started = true;
        Sound.play('confirm');
        Game.load();
        Game.restore();
        const progress = Game.save.progress;
        const map = progress === 'cleared' || progress === 'ending' ? 'map_gate' : (Game.save.respawnMap || 'map_gate');
        App.gotoMap(map);
    }
}
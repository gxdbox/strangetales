/**
 * 结局画面：黑幕滚动演出（异史氏曰……）
 */
import {
    _decorator, Component, Node, Vec3, Label, tween, input, Input, EventKeyboard, KeyCode,
} from 'cc';
import { FC } from '../config/GameConfig';
import { makePanel, makeLabel, ScreenBase } from '../ui/FCUi';
import { TEXT } from '../data/ChapterText';
import { Game } from '../state/GameState';
import { Sound } from '../audio/SoundManager';
import { App } from '../Boot';

const { ccclass } = _decorator;

@ccclass('EndingScreen')
export class EndingScreen extends ScreenBase {
    private done = false;

    protected onLoad(): void {
        input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this);
        Sound.stopBgm();
        Sound.playBgm('ending');
        this.build();
    }

    protected onDestroy(): void {
        input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this);
    }

    private build(): void {
        makePanel('bg', 256, 224, 0, 0, this.node, false);
        const scroll = new Node('scroll');
        scroll.layer = this.node.layer;
        this.node.addChild(scroll);
        let y = 10;
        const lines = TEXT.ending;
        for (const l of lines) {
            makeLabel(l.text, 11, l.who === '' ? FC.WHITE : FC.YELLOW, scroll, 0, y, 230, false);
            y -= 16;
        }
        makeLabel('谢谢游玩', 12, FC.YELLOW, scroll, 0, y - 12, 230, false);

        // 滚动动画
        this.scheduleOnce(() => {
            tween(scroll)
                .by(6.5, { position: new Vec3(0, 150, 0) })
                .call(() => { this.showFinish(); })
                .start();
        }, 1.2);
    }

    private showFinish(): void {
        if (this.done) return;
        this.done = true;
        const finish = new Node('finish');
        finish.layer = this.node.layer;
        this.node.addChild(finish);
        makeLabel('－ 第一章 完 －', 12, FC.YELLOW, finish, 0, 0, 200, false);
        makeLabel('按 J 结束旅程', 10, FC.GRAY, finish, 0, -24, 200, false);
    }

    private onKeyDown(e: EventKeyboard): void {
        const c = e.keyCode;
        if (this.done && (c === KeyCode.KEY_J || c === KeyCode.SPACE || c === KeyCode.ENTER || c === KeyCode.KEY_Z)) {
            Sound.play('confirm');
            Game.reset();
            App.gotoTitle();
        }
    }
}
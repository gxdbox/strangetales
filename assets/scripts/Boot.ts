/**
 * 应用入口（场景唯一预置组件）
 * 负责：设计分辨率、音频初始化、屏幕路由（单场景多屏切换）
 */
import {
    _decorator, Component, Node, view, director, ResolutionPolicy,
} from 'cc';
import { CFG } from './config/GameConfig';
import { Game } from './state/GameState';
import { Sound } from './audio/SoundManager';
import { MapScreen } from './screens/MapScreen';
import { BattleScreen } from './screens/BattleScreen';
import { TitleScreen } from './screens/TitleScreen';
import { EndingScreen } from './screens/EndingScreen';

const { ccclass } = _decorator;

/** 屏幕路由（Boot 之外均通过 App 切换屏幕） */
export const App = {
    current: null as Node | null,
    /** 进入地图前待播放的对白 key（如阵亡复活） */
    pendingDialogue: null as string | null,

    clear(): void {
        if (this.current) {
            this.current.destroy();
            this.current = null;
        }
    },

    show(screenClass: typeof Component, props?: Record<string, unknown>): Node {
        this.clear();
        const canvas = director.getScene()!.getChildByName('Canvas');
        const node = new Node('screen_' + screenClass.name);
        node.layer = canvas!.layer;
        // 先非激活挂载，赋值后激活，确保 onLoad 拿到属性
        node.active = false;
        canvas!.addChild(node);
        const comp = node.addComponent(screenClass as any) as any;
        if (props) {
            for (const k of Object.keys(props)) {
                comp[k] = props[k];
            }
        }
        node.active = true;
        this.current = node;
        return node;
    },

    gotoTitle(): void {
        this.show(TitleScreen as any);
    },

    gotoMap(mapId: string, spawn?: [number, number], pendingDialogue?: string): void {
        this.pendingDialogue = pendingDialogue || null;
        this.show(MapScreen as any, {
            mapId,
            spawnOverride: spawn || null,
        });
    },

    gotoBattle(packs: string[][], isBoss: boolean, returnMap: string): void {
        this.show(BattleScreen as any, {
            packs,
            isBoss,
            returnMap,
        });
    },

    gotoEnding(): void {
        this.show(EndingScreen as any);
    },
};

@ccclass('Boot')
export class Boot extends Component {
    protected onLoad(): void {
        // FC 原生分辨率 256x224，SHOW_ALL 保比例留黑边
        view.setDesignResolutionSize(CFG.SCREEN_W, CFG.SCREEN_H, ResolutionPolicy.SHOW_ALL);
        Sound.init();
        // 首次用户手势时恢复音频（浏览器自动播放策略）
        this.node.on(Node.EventType.TOUCH_START, () => Sound.resume(), this);
        Game.load();
        App.gotoTitle();
    }
}
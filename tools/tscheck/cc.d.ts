/**
 * cc 模块类型桩：仅供无 Cocos Creator 环境下做静态类型检查（tools/tscheck 专用）
 * 所有 API 均视为 any，不参与产物编译。
 */
declare module 'cc' {
    export class Component { [key: string]: any; constructor(...args: any[]); }
    export class Node {
        [key: string]: any;
        static EventType: any;
        constructor(...args: any[]);
    }
    export class Label {
        [key: string]: any;
        static Overflow: any;
        static HorizontalAlign: any;
        constructor(...args: any[]);
    }
    export class Sprite {
        [key: string]: any;
        static SizeMode: any;
        constructor(...args: any[]);
    }
    export class SpriteFrame { [key: string]: any; constructor(...args: any[]); }
    export class Texture2D { [key: string]: any; constructor(...args: any[]); }
    export class Rect { [key: string]: any; constructor(...args: any[]); }
    export class Vec3 { [key: string]: any; constructor(...args: any[]); }
    export class Vec2 { [key: string]: any; constructor(...args: any[]); }
    export class Color {
        [key: string]: any;
        static WHITE: any;
        constructor(...args: any[]);
    }
    export class Graphics { [key: string]: any; constructor(...args: any[]); }
    export class UITransform { [key: string]: any; constructor(...args: any[]); }
    export class Tween<T = any> { [key: string]: any; constructor(...args: any[]); }
    export class EventKeyboard { [key: string]: any; constructor(...args: any[]); }
    export const _decorator: any;
    export const view: any;
    export const director: any;
    export const ResolutionPolicy: any;
    export const sys: any;
    export const resources: any;
    export const tween: any;
    export const input: any;
    export const Input: any;
    export const KeyCode: any;
}
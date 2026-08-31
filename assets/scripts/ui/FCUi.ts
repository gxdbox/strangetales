/**
 * FC 风格 UI 工厂：用 Graphics 绘制纯色像素块，用代码拼装界面。
 * 全部 UI 由代码构建（不依赖编辑器场景），保证单场景架构。
 */
import { _decorator, Component, Node, Graphics, Label, UITransform, Color, Vec3 } from 'cc';
import { FC, CFG } from '../config/GameConfig';

const { ccclass } = _decorator;

function hex(c: number[]): string {
    return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
}

export function toColor(c: number[]): Color {
    return new Color(c[0], c[1], c[2], 255);
}

/** 创建纯色矩形节点（Graphics 绘制） */
export function makeRect(name: string, w: number, h: number, color: number[], parent: Node, x = 0, y = 0): Node {
    const node = new Node(name);
    node.layer = parent.layer;
    parent.addChild(node);
    const tf = node.addComponent(UITransform);
    tf.setContentSize(w, h);
    const g = node.addComponent(Graphics);
    g.fillColor = toColor(color);
    g.rect(-w / 2, -h / 2, w, h);
    g.fill();
    node.setPosition(new Vec3(x, y, 0));
    return node;
}

/** DQ 式边框面板：黑底 + 白描边（可选双白线） */
export function makePanel(name: string, w: number, h: number, x: number, y: number, parent: Node, doubleLine = false): Node {
    const panel = new Node(name);
    panel.layer = parent.layer;
    parent.addChild(panel);
    const tf = panel.addComponent(UITransform);
    tf.setContentSize(w, h);
    const g = panel.addComponent(Graphics);
    g.fillColor = toColor(FC.BLACK);
    g.rect(-w / 2, -h / 2, w, h);
    g.fill();
    g.lineWidth = 1;
    g.strokeColor = toColor(FC.WHITE);
    g.stroke();
    if (doubleLine) {
        g.rect(-w / 2 + 2, -h / 2 + 2, w - 4, h - 4);
        g.stroke();
    }
    panel.setPosition(new Vec3(x, y, 0));
    return panel;
}

/** 统一文字样式：系统字体 + 白色，可描边模拟像素感 */
export function makeLabel(
    text: string, size = 12, color = FC.WHITE, parent: Node,
    x = 0, y = 0, w = 0, outline = false,
): Label {
    const node = new Node('label');
    node.layer = parent.layer;
    parent.addChild(node);
    const label = node.addComponent(Label);
    label.string = text;
    label.fontSize = size;
    label.lineHeight = Math.round(size * 1.25);
    label.color = toColor(color);
    label.isBold = true;
    if (outline) {
        // 简易像素描边：底部投影块加黑色偏移
        makeRect('shadow', (w || 4) + 4, (w || 4) + 4, FC.BLACK, parent, x + 1, y - 1).setSiblingIndex(0);
    }
    if (w > 0) {
        node.getComponent(UITransform)!.setContentSize(w, label.lineHeight);
        label.horizontalAlign = Label.HorizontalAlign.LEFT;
        label.overflow = Label.Overflow.NONE;
    }
    node.setPosition(new Vec3(x, y, 0));
    return label;
}

/** 菜单光标：FC 手指箭头（Graphics 画） */
export function makeCursor(parent: Node, x: number, y: number): Node {
    const node = new Node('cursor');
    node.layer = parent.layer;
    parent.addChild(node);
    const g = node.addComponent(Graphics);
    g.fillColor = toColor(FC.WHITE);
    g.moveTo(0, 0);
    g.lineTo(6, 3);
    g.lineTo(0, 6);
    g.close();
    g.fill();
    node.setPosition(new Vec3(x, y, 0));
    return node;
}

/** 屏幕管理基类：每屏一个全屏节点，切换即销毁 */
@ccclass('ScreenBase')
export class ScreenBase extends Component {
    /** 资源缓存：避免重复加载 */
    protected texCache = new Map<string, any>();

    public destroyScreen(): void {
        this.texCache.clear();
        this.node.destroy();
    }
}
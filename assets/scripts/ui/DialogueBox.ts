/**
 * DQ 式对话系统：黑色底框 + 白描边 + 名字窗 + 逐字显示
 */
import { _decorator, Component, Node, Label, Color, Vec3, tween, Tween } from 'cc';
import { FC, CFG } from '../config/GameConfig';
import { makePanel, makeLabel } from '../ui/FCUi';
import { DialogueLine } from '../data/ChapterText';
import { Sound } from '../audio/SoundManager';

const { ccclass } = _decorator;

@ccclass('DialogueBox')
export class DialogueBox extends Component {
    private nameLabel: Label | null = null;
    private textLabel: Label | null = null;
    private arrow: Node | null = null;
    private arrowTween: Tween<Node> | null = null;
    private lines: DialogueLine[] = [];
    private lineIdx = 0;
    private charIdx = 0;
    private typing = false;
    private done: (() => void) | null = null;
    private typingClock = 0;

    /** 输入由外部调用：确认键 */
    public onConfirm(): void {
        if (!this.lines.length) return;
        if (this.typing) {
            // 补全当前行
            this.typing = false;
            this.charIdx = this.curLine().text.length;
            this.textLabel!.string = this.curLine().text;
            this.showArrow();
            return;
        }
        this.lineIdx++;
        Sound.play('cursor');
        if (this.lineIdx >= this.lines.length) {
            this.close(this.done);
            return;
        }
        this.startLine();
    }

    /** 播放一组对白，结束后回调 */
    public play(lines: DialogueLine[], onDone: () => void): void {
        Sound.play('cursor');
        this.lines = lines;
        this.lineIdx = 0;
        this.done = onDone;
        this.node.active = true;
        this.startLine();
    }

    public isPlaying(): boolean {
        return this.node.active && !!this.lines.length;
    }

    private curLine(): DialogueLine {
        return this.lines[this.lineIdx];
    }

    private startLine(): void {
        const line = this.curLine();
        this.charIdx = 0;
        this.typing = true;
        this.hideArrow();
        this.textLabel!.string = '';
        if (this.nameLabel) {
            if (line.who) {
                this.nameLabel.node.active = true;
                this.nameLabel.string = line.who;
            } else {
                this.nameLabel.node.active = false;
            }
        }
        this.typingClock = 0;
    }

    private showArrow(): void {
        if (this.arrow) this.arrow.active = true;
    }
    private hideArrow(): void {
        if (this.arrow) this.arrow.active = false;
    }

    private close(done: (() => void) | null): void {
        this.node.active = false;
        this.lines = [];
        if (done) done();
    }

    protected onLoad(): void {
        this.buildUI();
    }

    private buildUI(): void {
        const root = this.node;
        // 主面板：236 x 60，位于屏幕底部
        const panel = makePanel('dlg', 236, 60, 0, -80, root, true);
        // 名字窗（盖住上边框）
        const nameNode = makePanel('name', 52, 10, -116, -53, root, false);
        this.nameLabel = makeLabel('', 12, FC.WHITE, nameNode, 0, 0);
        this.nameLabel.node.active = false;
        // 正文
        this.textLabel = makeLabel('', 11, FC.WHITE, panel, -110, 6, 218, false);
        this.textLabel.overflow = Label.Overflow.SHRINK;
        // 下箭头
        this.arrow = makePanel('arr', 8, 5, 106, -102, root, false);
    }

    protected update(dt: number): void {
        if (!this.typing) return;
        this.typingClock += dt;
        // 约每 18ms 一个字
        if (this.typingClock >= 0.018) {
            this.typingClock = 0;
            const line = this.curLine();
            this.charIdx = Math.min(this.charIdx + 1, line.text.length);
            this.textLabel!.string = line.text.substring(0, this.charIdx);
            if (this.charIdx >= line.text.length) {
                this.typing = false;
                this.showArrow();
            }
        }
        // 箭头闪烁
        if (this.arrowTween && this.arrow && this.arrow.active) {
            void this.arrowTween;
        }
    }
}

/** 简单持有即可（GC 安全：箭头闪烁用 schedule 麻烦，这里静态闪烁即可） */
function _unused(_v: Vec3, _c: Color, _t: Tween<Node>): void { void _v; void _c; void _t; }
void _unused;
void CFG;
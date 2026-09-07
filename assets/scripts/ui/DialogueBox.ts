/**
 * DQ 式对话系统：黑色底框 + 白描边 + 名字窗 + 逐字显示
 * 正文采用「3 行制」：wrapText 按显示宽度切行（每行 ≤18 汉字），
 * 超过 3 行截断加省略号；逐字填充按切好的多行字符串进行（保留 \n）。
 */
import { _decorator, Component, Node, Label, Color, Vec3, UITransform, tween, Tween } from 'cc';
import { FC, CFG } from '../config/GameConfig';
import { makePanel, makeLabel } from '../ui/FCUi';
import { DialogueLine } from '../data/ChapterText';
import { Sound } from '../audio/SoundManager';

const { ccclass } = _decorator;

/** 每行最多容纳的“汉字单位”（218px 宽 / 11px 字号 ≈ 19，留 1 余量防 SHRINK） */
const MAX_CJK_PER_LINE = 18;
/** 最多显示行数（3 行制） */
const MAX_LINES = 3;

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
    /** 当前行切行后的完整多行文本（含 \n） */
    private wrapped = '';

    /** 输入由外部调用：确认键 */
    public onConfirm(): void {
        if (!this.lines.length) return;
        if (this.typing) {
            // 补全当前行
            this.typing = false;
            this.charIdx = this.wrapped.length;
            this.textLabel!.string = this.wrapped;
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
        this.wrapped = this.wrapText(line.text);
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

    /**
     * 按显示宽度切行（汉字/全角 =1，ASCII ≈0.5），最多 3 行；
     * 超出 3 行则截断并在末尾补省略号。
     */
    private wrapText(text: string): string {
        const lines: string[] = [];
        let cur = '';
        let curW = 0;
        let truncated = false;
        const chW = (ch: string): number => (ch.charCodeAt(0) > 255 ? 1 : 0.5);
        for (const ch of text) {
            if (ch === '\n') {
                if (cur) { lines.push(cur); cur = ''; curW = 0; }
                continue;
            }
            const cw = chW(ch);
            if (curW + cw > MAX_CJK_PER_LINE && cur) {
                lines.push(cur);
                cur = '';
                curW = 0;
                if (lines.length === MAX_LINES) {
                    truncated = true;
                    break;
                }
            }
            cur += ch;
            curW += cw;
        }
        if (cur && !truncated) lines.push(cur);
        let out = lines.slice(0, MAX_LINES).join('\n');
        if (truncated || lines.length > MAX_LINES) out += '…';
        return out;
    }

    protected onLoad(): void {
        this.buildUI();
    }

    private buildUI(): void {
        const root = this.node;
        // 主面板：236 x 74，位于屏幕底部，覆盖 y ≈ -115 ~ -41
        const panel = makePanel('dlg', 236, 74, 0, -78, root, true);
        // 名字窗（盖住上边框，位于面板左上角，避免超出屏幕左缘）
        const nameNode = makePanel('name', 52, 10, -92, -44, root, false);
        this.nameLabel = makeLabel('', 12, FC.WHITE, nameNode, 0, 0);
        this.nameLabel.node.active = false;
        // 正文：3 行制，label 高度容纳 3 行（11px * 1.25 * 3 ≈ 42，设 44）
        this.textLabel = makeLabel('', 11, FC.WHITE, panel, 0, 12, 216, false);
        this.textLabel.node.getComponent(UITransform)!.setContentSize(216, 44);
        this.textLabel.overflow = Label.Overflow.SHRINK;
        // 下箭头（面板内部右下角）
        this.arrow = makePanel('arr', 8, 5, 104, -104, root, false);
    }

    protected update(dt: number): void {
        if (!this.typing) return;
        this.typingClock += dt;
        // 约每 18ms 一个字
        if (this.typingClock >= 0.018) {
            this.typingClock = 0;
            this.charIdx = Math.min(this.charIdx + 1, this.wrapped.length);
            this.textLabel!.string = this.wrapped.substring(0, this.charIdx);
            if (this.charIdx >= this.wrapped.length) {
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

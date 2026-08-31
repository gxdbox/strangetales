/**
 * 第一章《画皮》全部对白文案（原创，忠于聊斋内核）
 * 每行不超过 18 个汉字，适配 FC 256px 对话框（3 行制）
 */
export interface DialogueLine {
    who: string;
    text: string;
}

/** 说话人统一用名，对话框自动加「」前缀效果 */
export const SPEAKS = {
    HERO: '蒲宁',
    MONK: '老僧',
    MAIDEN: '若娘',
    GHOST: '画皮鬼',
    NARRATOR: '',  // 旁白/叙述（无名字框）
} as const;

export const TEXT: Record<string, DialogueLine[]> = {
    /** 开场（标题后，寺门前） */
    intro: [
        { who: SPEAKS.NARRATOR, text: '清光绪年间。书生蒲宁赴乡试不第，' },
        { who: SPEAKS.NARRATOR, text: '归途遇雨，误入荒山深处。' },
        { who: SPEAKS.HERO, text: '好大的雨……前头似有座古寺。' },
        { who: SPEAKS.HERO, text: '兰若寺……且去避避雨吧。' },
    ],
    /** 石碑 */
    stone: [
        { who: SPEAKS.NARRATOR, text: '（残碑半没于荒草）' },
        { who: SPEAKS.NARRATOR, text: '兰若寺。崇祯年间建。久废无僧。' },
        { who: SPEAKS.HERO, text: '崇祯年间……这寺怕不止百年了。' },
    ],
    /** 老僧首遇 */
    monk_first: [
        { who: SPEAKS.MONK, text: '施主留步。此寺不净，入夜常有异响。' },
        { who: SPEAKS.HERO, text: '小生蒲宁，不过避雨，天明便行。' },
        { who: SPEAKS.MONK, text: '老衲行脚至此，专为压住那物。' },
        { who: SPEAKS.MONK, text: '罢。传你一道清心咒，' },
        { who: SPEAKS.MONK, text: '危急时默诵，可保心神不失。' },
        { who: SPEAKS.NARRATOR, text: '（习得道术：清心诀。得到：纸符x2）' },
        { who: SPEAKS.HERO, text: '多谢大师……' },
    ],
    /** 老僧再遇（须先见过若娘） */
    monk_second: [
        { who: SPEAKS.HERO, text: '大师可认得一位叫若娘的姑娘？' },
        { who: SPEAKS.MONK, text: '……！（面色骤变）' },
        { who: SPEAKS.MONK, text: '此寺荒废七年，除你与我，别无活人。' },
        { who: SPEAKS.HERO, text: '怎会！我分明在偏院见过她。' },
        { who: SPEAKS.MONK, text: '不好。你今夜若闻声唤名，' },
        { who: SPEAKS.MONK, text: '切莫睁眼，切莫应声。' },
        { who: SPEAKS.MONK, text: '老衲去山后取剑，天明方归。切记。' },
        { who: SPEAKS.HERO, text: '（难道若娘……不是人么）' },
    ],
    /** 若娘首遇 */
    maiden_first: [
        { who: SPEAKS.MAIDEN, text: '公子是……新来的客么？' },
        { who: SPEAKS.HERO, text: '小生蒲宁，避雨至此。姑娘是……？' },
        { who: SPEAKS.MAIDEN, text: '妾身若娘，亦是借住之人。' },
        { who: SPEAKS.MAIDEN, text: '寺中凄凉，公子若不弃，' },
        { who: SPEAKS.MAIDEN, text: '今夜且来说话，可好？' },
        { who: SPEAKS.HERO, text: '这……夜深露重，恐有不便。' },
        { who: SPEAKS.MAIDEN, text: '（掩口而笑，飘然离去）' },
        { who: SPEAKS.NARRATOR, text: '（地上落下一方红罗帕）' },
        { who: SPEAKS.HERO, text: '姑娘！……她忘了东西。' },
        { who: SPEAKS.NARRATOR, text: '（得到：红罗帕）' },
    ],
    /** 再遇若娘（已见老僧） */
    maiden_second: [
        { who: SPEAKS.MAIDEN, text: '公子当真来了。若娘好生欢喜。' },
        { who: SPEAKS.HERO, text: '……姑娘一人在此，不冷清么？' },
        { who: SPEAKS.MAIDEN, text: '（轻笑）有公子相伴，便不冷清。' },
        { who: SPEAKS.NARRATOR, text: '（夜风穿堂，烛影忽明忽暗）' },
    ],
    /** 偷窥演出（揭画皮） */
    peep: [
        { who: SPEAKS.NARRATOR, text: '是夜。蒲宁惦着老僧之言，' },
        { who: SPEAKS.NARRATOR, text: '蹑足至偏院窗下观望。' },
        { who: SPEAKS.NARRATOR, text: '（烛影中，一美人正对镜梳妆）' },
        { who: SPEAKS.NARRATOR, text: '（忽而起身，自脑后揭下人皮' },
        { who: SPEAKS.NARRATOR, text: '　露出青面獠牙之相！）' },
        { who: SPEAKS.HERO, text: '……！！（毛骨悚然）' },
        { who: SPEAKS.GHOST, text: '既已看见，这身皮囊，留下吧！' },
    ],
    /** 战斗转阶段 */
    boss_phase2: [
        { who: SPEAKS.GHOST, text: '哼……可恨的书生。' },
        { who: SPEAKS.NARRATOR, text: '（画皮落尽，恶鬼现出真形！）' },
    ],
    /** 胜利 */
    victory: [
        { who: SPEAKS.GHOST, text: '不——！七年之功，毁于一旦……' },
        { who: SPEAKS.NARRATOR, text: '（天已破晓。老僧持桃木剑急奔而至）' },
        { who: SPEAKS.MONK, text: '孽障！还不灰飞烟灭！' },
        { who: SPEAKS.NARRATOR, text: '（剑光过处，人皮燃作飞灰）' },
        { who: SPEAKS.MONK, text: '此物以人皮惑人，啖人生气。' },
        { who: SPEAKS.MONK, text: '今除去，此寺可安。你且回吧。' },
        { who: SPEAKS.HERO, text: '晚生……此生不敢忘。' },
    ],
    /** 结局（异史氏曰） */
    ending: [
        { who: SPEAKS.NARRATOR, text: '异史氏曰：' },
        { who: SPEAKS.NARRATOR, text: '人怀鬼心，与鬼披人皮何异。' },
        { who: SPEAKS.NARRATOR, text: '守正忘邪，则虽处妖鬼之侧，' },
        { who: SPEAKS.NARRATOR, text: '亦无可乘之隙也。' },
        { who: SPEAKS.NARRATOR, text: '——第一章 画皮 完——' },
        { who: SPEAKS.NARRATOR, text: '　　　（敬请期待下章）' },
    ],
    /** 力尽 */
    dead: [
        { who: SPEAKS.NARRATOR, text: '（眼前一黑……）' },
        { who: SPEAKS.HERO, text: '……我……难道要死在这里。' },
        { who: SPEAKS.NARRATOR, text: '（不知过了多久，又再醒来时' },
        { who: SPEAKS.NARRATOR, text: '　已躺在寺门外的石阶上）' },
        { who: SPEAKS.MONK, text: '（画外音）痴儿，还不醒来。' },
    ],
    /** 野道场景触发的随想 */
    forest_hint: [
        { who: SPEAKS.HERO, text: '夜路难行……仿佛有什么在暗处。' },
    ],
    /** 水井 */
    well: [
        { who: SPEAKS.NARRATOR, text: '（井中打上一陶罐。药香隐隐）' },
        { who: SPEAKS.NARRATOR, text: '（得到：药汤x1）' },
    ],
    /** 墙头黑影 */
    ghost_flash: [
        { who: SPEAKS.NARRATOR, text: '（墙头一团黑影，倏忽不见）' },
        { who: SPEAKS.HERO, text: '……是猫么。' },
    ],
    /** 供桌 */
    altar: [
        { who: SPEAKS.NARRATOR, text: '（供果腐黑。香火久绝）' },
    ],
    /** 老僧已离寺 */
    monk_gone: [
        { who: SPEAKS.NARRATOR, text: '（老僧已往山后取剑去了）' },
    ],
};
// Chinese word lists for the stance-neutral markers in rhetoric-zh.js, in simplified characters.
// Traditional text is read through a character map (TRAD_ZH) that keeps every index in place.
// Same families and the same rule as lexicon.js: a group named with marker grammar counts,
// disagreement and policy do not. Chinese writes no spaces, so the grammar matches the words
// next to each other and the lists carry the compounds that would otherwise collide.
// Sources and dictionary labels: project-docs/evidence/LEXICON-SOURCES.md.

export const GROUPS_ZH = [
  // 出身、宗教、国籍、地域
  "犹太人", "穆斯林", "回民", "维吾尔人", "维族人", "基督徒", "黑人", "白人", "日本人", "韩国人", "美国人", "印度人", "越南人",
  "菲律宾人", "外国人", "老外", "河南人", "东北人", "上海人", "广东人", "新疆人", "香港人", "港人", "台湾人", "大陆人",
  "内地人", "外地人", "农村人", "农民工",
  // 政治，包括各方互相起的外号
  "共产党", "中共", "国民党", "民进党", "左派", "右派", "自由派", "白左", "小粉红", "五毛", "美分", "美分党", "公知", "台独",
  "港独", "废青", "黑警", "汉奸", "精日", "绿绿", "女拳", "田园女权", "直男癌", "蝈蝻", "国男", "爱国贼", "殖人", "神友",
  // 阶层、角色、身份
  "警察", "城管", "有钱人", "富人", "穷人", "官员", "记者", "女权", "女权主义者", "同性恋", "基佬", "女人", "男人", "女的",
  "男的",
];

// After a group, or "<group>都是一群...". Words with an everyday compound carry a lookahead in
// rhetoric-zh.js (猪肉, 狗粮, 垃圾分类).
export const DEHUMANISE_ZH = ["蟑螂", "曱甴", "老鼠", "耗子", "畜生", "畜牲", "牲口", "禽兽", "狗东西", "走狗", "蝗虫", "寄生虫",
  "人渣", "败类", "病毒", "癌症", "毒瘤", "害虫", "杂种", "蛆", "臭虫", "苍蝇", "猴子", "野兽", "劣等人种", "低等人种", "低等生物",
  "猪狗", "狗杂种", "猪猡"];

// Verbs of physical harm. Expelling, jailing or banning is policy and stays at zero.
export const KILL_ZH = ["杀光", "杀死", "杀掉", "杀了", "杀绝", "屠杀", "屠光", "消灭", "灭了", "灭掉", "干掉", "弄死", "打死",
  "枪毙", "烧死", "绞死", "活埋", "灭绝", "核平", "宰了", "砍死", "毒死", "杀"];
export const DIE_ZH = ["该死", "去死", "死光", "死绝", "死全家", "全家死光", "都该杀", "该杀", "该被杀", "应该死", "应该去死",
  "死了活该", "死有余辜", "该被消灭", "应该被消灭", "应该被杀光", "该枪毙", "都该枪毙"];

export const STEREOTYPE_TRAITS_ZH = ["罪犯", "小偷", "骗子", "强奸犯", "恐怖分子", "卖国贼", "叛徒", "懒鬼", "蠢货", "傻逼", "脑残",
  "低素质", "没素质", "素质低", "素质差", "劣等", "野蛮", "贪婪", "虚伪", "暴力狂", "流氓", "土匪", "强盗", "人贩子", "白眼狼"];

export const CONSPIRACY_ZH = ["境外势力", "颜色革命", "西方反华势力", "反华势力", "美帝阴谋", "犹太阴谋", "犹太资本控制", "共济会",
  "光明会", "深层政府", "新世界秩序", "大外宣", "大翻译运动", "人口替代"];
// Funders named in "paid by ..." accusations, from every direction.
export const PAYMASTERS_ZH = ["美国", "美帝", "中共", "共产党", "党", "台湾", "民进党", "境外", "索罗斯", "西方", "CIA", "日本",
  "大陆", "国安"];

// Recorded as ethnic slurs or as derogatory and offensive (Wiktionary labels). One for each side
// of the strait: 支那 and 台巴子.
export const SLURS_ZH = ["支那", "支那人", "支那猪", "黑鬼", "台巴子", "小日本", "日本鬼子", "洋鬼子", "白皮猪", "娘炮", "大陆蝗虫"];

// Traditional to simplified, one character to one character, for the characters in these lists.
export const TRAD_ZH = "猶犹爾尔國国韓韩東东廣广東东灣湾陸陆農农產产黨党進进紅红獨独廢废漢汉綠绿權权蟈蝈義义貪贪記记員员窮穷錢钱" +
  "戀恋蟲虫豬猪雜杂敗败類类癌癌瘤瘤蒼苍蠅蝇獸兽劣劣種种殺杀滅灭幹干弄弄槍枪斃毙燒烧絞绞埋埋絕绝該该應应須须餘余" +
  "騙骗強强姦奸恐恐賣卖賊贼叛叛懶懒蠢蠢腦脑殘残質质貧贫偽伪暴暴氓氓匪匪盜盗販贩勢势顏颜革革陰阴謀谋資资濟济會会層层" +
  "舊旧秩秩譯译運运動动替替這这們们個个們们麼么對对們们這这邊边裏里裡里說说話话鬧闹臺台灣湾護护們们為为";

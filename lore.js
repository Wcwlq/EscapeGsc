// ============================================================
// lore.js —— 剧情文本（小锦 & 小洛）
// v2.2：加入游戏内触发剧情
// ============================================================
window.Lore = (() => {
  // ============ 每日日记（菜单显示） ============
  const DIARY = [
    { title: "第一天", text: "小洛发烧了。我把她放进铁笼里，因为那是最安全的地方。锁是我亲手扣上的，我说，等哥哥回来。" },
    { title: "火", text: "我回来的时候，院子在烧。钥匙掉了。我掰那根锁，手指头全断了。小洛在里面，隔着栏杆看我，她还在笑。她说，哥哥，不要怕。" },
    { title: "她说", text: "\"哥哥，你要活下去。\" —— 那是她最后一句话。" },
    { title: "之后", text: "我不知道我是怎么活下来的。有时候我觉得，那个从火里爬出来的人不是我。是一个更坏的东西。" },
    { title: "他", text: "他每天晚上都来找我。他长得和我一模一样，但眼睛里全是灰。他说，我们一起下地狱吧。我说不。他就一直追。" },
    { title: "铁笼", text: "我又见到那个铁笼了。还在那儿。我每天做梦都想再进去一次——不是去找她，而是去把那扇门，好好关上。" },
    { title: "刀", text: "小洛有一把小刀，削苹果用的。我把它藏了很久。现在我想把它插进那扇锁里——不是为了打开，是为了关死。" },
    { title: "枪", text: "有把枪。我不太会用。但每次听见他的脚步声，我都会想：如果我也有他要的东西，他是不是就能停下来了。" },
    { title: "30 秒", text: "锁转动的声音，像当年火里那样。我数着——一秒，两秒……小洛说过，撑过去就好。" },
    { title: "天亮之前", text: "如果我进了铁笼，他只能站在外面。一整夜。他不会离开，但他也进不来。这样就好。" }
  ];

  // ============ 开局独白（逃离者视角） ============
  const INTRO_ESCAPER = [
    "又是这里。又是这个院子。",
    "他在追我。他一直都在追我。",
    "我不能停下。小洛让我活下去。",
    "找到枪，找到刀，把那扇锁关上。",
    "只要我进了铁笼，他就进不来。",
    "撑过 30 秒。天亮了就好。"
  ];

  // ============ 开局独白（少帅视角） ============
  const INTRO_MARSHAL = [
    "他又醒了。他又要跑。",
    "我认得这条路——是我当年走过的。",
    "他以为他能跑掉。",
    "可他忘了：我就是他。",
    "他藏进铁笼，我就站外面。",
    "站一整夜。像当年一样。"
  ];

  // ============ 拾取枪的独白 ============
  const PICKUP_GUN_ESCAPER = [
    "一把枪……我不太会用。",
    "但如果他也有怕的东西……",
    "也许他就能停下来。"
  ];
  const PICKUP_GUN_MARSHAL = [
    "他也捡到枪了。",
    "他以为能挡住我？",
    "他连自己都挡不住。"
  ];

  // ============ 拾取刀的独白 ============
  const PICKUP_KNIFE_ESCAPER = [
    "小洛的刀。她削苹果的姿势很好看。",
    "我不是要开锁。",
    "我要把那扇门，关死。"
  ];
  const PICKUP_KNIFE_MARSHAL = [
    "那把小刀……",
    "是我当年藏起来的。",
    "他拿走了。他还记得她。"
  ];

  // ============ 墙上幻象独白（逃离者=怕邪恶少帅） ============
  const WALL_ESCAPER = [
    "那是他……",
    "不，那是……我？",
    "别看他的眼睛。",
    "别变成他。",
    "小洛，帮帮我。",
    "我不想变成那个东西。"
  ];

  // ============ 墙上幻象独白（少帅=怕善良小锦） ============
  const WALL_MARSHAL = [
    "他还在笑。",
    "他为什么还在笑？",
    "火里那个人也是这么笑的。",
    "别笑了……求你了。",
    "是我害了他。",
    "我不配看那张脸。"
  ];

  // ============ 撑 30 秒倒计时独白（每 5 秒） ============
  const COUNTDOWN_ESCAPER = [
    "1 秒……2 秒……",
    "像那年火里一样。",
    "小洛说，撑过去就好。",
    "他在敲铁笼。别理他。",
    "快到了，快到了。",
    "天快亮了。"
  ];
  const COUNTDOWN_MARSHAL = [
    "他在里面数数。",
    "他每次都数。",
    "他知道我在外面。",
    "他不想看我。",
    "他恨我。",
    "我也恨我自己。"
  ];

  // ============ 地图上的日记碎片（拾取全屏显示） ============
  const FRAGMENTS = [
    { title: "碎片 · 一", text: "院子最里头有一棵槐树。小洛在树下睡午觉，头发上落满了花。" },
    { title: "碎片 · 二", text: "她怕黑。所以我把铁笼里的灯留着，一直留着。" },
    { title: "碎片 · 三", text: "她学写字，第一个会写的字是「哥」。" },
    { title: "碎片 · 四", text: "她生日那天想要一把刀。我没买。现在想想，买就好了。" },
    { title: "碎片 · 五", text: "火起来的时候，我在两条街外。我跑回来了。我跑得很快。" },
    { title: "碎片 · 六", text: "后来警察问我，钥匙呢。我说丢了。其实它一直在我口袋里。" },
    { title: "碎片 · 七", text: "我不敢看铁笼。可我又每天都想回去看。" },
    { title: "碎片 · 八", text: "小洛最喜欢的歌，是一首很老的童谣。我不敢听。" },
    { title: "碎片 · 九", text: "我对医生说，我没事。他说你分裂了。我说那正好，一半的我还在陪她。" },
    { title: "碎片 · 十", text: "如果人生能重来，我还是会锁那扇门。但我会先把钥匙吞下去。" }
  ];

  const MENU_QUOTE = "——“哥哥，你要活下去。”";

  const ENDING_ESCAPER_WIN = {
    kicker: "你赢了",
    title: "天亮之前",
    text: "你钻进铁笼，反手锁上。少帅在栏杆外站了一整夜。\n天亮了。他没走。但他进不来。\n\n小洛，我做到了。"
  };
  const ENDING_ESCAPER_LOSE = {
    kicker: "游戏结束",
    title: "他抓到你了",
    text: "黑暗里传来熟悉的笑声。\n——是我自己的声音。\n他说：别怕，哥哥。我们一起去找她。"
  };
  const ENDING_MARSHAL_WIN = {
    kicker: "抓住了",
    title: "今晚，你赢了",
    text: "你把那个还在笑的自己按在墙上。\n他终于不笑了。\n\n可是你为什么还在哭？"
  };
  const ENDING_MARSHAL_LOSE = {
    kicker: "逃脱了",
    title: "他跑了",
    text: "他钻进铁笼，反手锁上。栏杆外你站了一整夜。\n你进不去。\n\n——小洛，你看，他还是那么会躲。"
  };

  // ============ 工具函数 ============
  function getDailyDiary(dateStr) {
    const d = new Date(dateStr + "T00:00:00");
    const dayNum = Math.floor(d.getTime() / 86400000);
    const idx = ((dayNum % DIARY.length) + DIARY.length) % DIARY.length;
    return DIARY[idx];
  }
  function getAllDiaries() { return DIARY.slice(); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  return {
    DIARY, MENU_QUOTE,
    ENDING_ESCAPER_WIN, ENDING_ESCAPER_LOSE,
    ENDING_MARSHAL_WIN, ENDING_MARSHAL_LOSE,
    INTRO_ESCAPER, INTRO_MARSHAL,
    PICKUP_GUN_ESCAPER, PICKUP_GUN_MARSHAL,
    PICKUP_KNIFE_ESCAPER, PICKUP_KNIFE_MARSHAL,
    WALL_ESCAPER, WALL_MARSHAL,
    COUNTDOWN_ESCAPER, COUNTDOWN_MARSHAL,
    FRAGMENTS,
    getDailyDiary, getAllDiaries, pick
  };
})();
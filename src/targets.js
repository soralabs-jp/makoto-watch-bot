const targets = {
  makoto: {
    siteType: "m-surprise",
    profileUrl: "https://m-surprise.com/profile/?id=4967",
    rankingUrl: "https://m-surprise.com/ranking/",
    diaryUrl: "https://diary.m-surprise.com/category/no-75-%e3%81%be%e3%81%93%e3%81%a8/",
    diaryCategoryKeywords: ["No.75", "まこと"],
    rankingTargetCastNo: 75,
    discordUsername: "まことちゃん通知",
    lifeLogExport: true,
    notify: {
      schedule: true,
      profile: true,
      photos: true,
      diary: true,
      ranking: true,
    },
  },
  miki: {
    siteType: "hyakka",
    profileUrl: "https://hyakka-ryouran.jp/profile/?id=5045",
    rankingUrl: "",
    diaryUrl: "",
    diaryCategoryKeywords: ["No.80", "みき"],
    rankingTargetCastNo: null,
    discordUsername: "みきちゃん通知",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
      "(KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36",
    lifeLogExport: false,
    notify: {
      schedule: true,
      profile: true,
      photos: true,
      diary: false,
      ranking: false,
    },
  },
};

module.exports = { targets };

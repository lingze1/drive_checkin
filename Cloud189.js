require("dotenv").config();
const log4js = require("log4js");
const recording = require("log4js/lib/appenders/recording");
const superagent = require("superagent");
const { CloudClient } = require("cloud189-sdk");
const env = require("./env");

log4js.configure({
  appenders: {
    vcr: { type: "recording" },
    out: {
      type: "console",
      layout: {
        type: "pattern",
        pattern: "\u001b[32m%d{yyyy-MM-dd hh:mm:ss}\u001b[0m - %m"
      }
    }
  },
  categories: { default: { appenders: ["vcr", "out"], level: "info" } }
});

const logger = log4js.getLogger();

const mask = (s, start, end) => s.split("").fill("*", start, end).join("");

const doTask = async (cloudClient) => {
  const result = [];
  const signPromises1 = [];
  let getSpace = [`${firstSpace}签到个人云获得(M)`];
  
  if (env.private_only_first == false || i / 2 % 20 == 0) {
    for (let m = 0; m < private_threadx; m++) {
      signPromises1.push((async () => {
        try {
          const res1 = await cloudClient.userSign();
          if (!res1.isSign) {
            getSpace.push(` ${res1.netdiskBonus}`);
          }
        } catch (e) {
          getSpace.push(` 0`);
        }
      })());
    }
    await Promise.all(signPromises1);
    if (getSpace.length == 1) getSpace.push(" 0");
    result.push(getSpace.join(""));
  }

  const signPromises2 = [];
  getSpace = [`${firstSpace}签到家庭云获得(M)`];
  const { familyInfoResp } = await cloudClient.getFamilyList();
  if (familyInfoResp) {
    const family = familyInfoResp.find((f) => f.familyId == familyID) || familyInfoResp[0];
    //result.push(`${firstSpace}开始签到家庭云 ID: ${family.familyId}`);
    for (let m = 0; m < family_threadx; m++) {
      signPromises2.push((async () => {
        try {
          const res = await cloudClient.familyUserSign(family.familyId);
          if (!res.signStatus) {
            getSpace.push(` ${res.bonusSpace}`);
          }
        } catch (e) {
          getSpace.push(` 0`);
        }
      })());
    }

    await Promise.all(signPromises2);
    if (getSpace.length == 1) getSpace.push(" 0");
    result.push(getSpace.join(""));
  }
  return result;
};

const pushTelegramBot = (title, desp) => {
  if (!(telegramBotToken && telegramBotId)) {
    return;
  }
  const data = {
    chat_id: telegramBotId,
    text: `${title}\n\n${desp}`,
  };
  superagent
    .post(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`)
    .send(data)
    .timeout(3000)
    .end((err, res) => {
      if (err) {
        logger.error(`TelegramBot推送失败:${JSON.stringify(err)}`);
        return;
      }
      const json = JSON.parse(res.text);
      if (!json.ok) {
        logger.error(`TelegramBot推送失败:${JSON.stringify(json)}`);
      } else {
        logger.info("TelegramBot推送成功");
      }
    });
};

const pushWxPusher = (title, desp) => {
  if (!(WX_PUSHER_APP_TOKEN && WX_PUSHER_UID)) {
    return;
  }
  const data = {
    appToken: WX_PUSHER_APP_TOKEN,
    contentType: 1,
    summary: title,
    content: desp,
    uids: [WX_PUSHER_UID],
  };
  superagent
    .post("https://wxpusher.zjiecode.com/api/send/message")
    .send(data)
    .timeout(3000)
    .end((err, res) => {
      if (err) {
        logger.error(`wxPusher推送失败:${JSON.stringify(err)}`);
        return;
      }
      const json = JSON.parse(res.text);
      if (json.data[0].code !== 1000) {
        logger.error(`wxPusher推送失败:${JSON.stringify(json)}`);
      } else {
        logger.info("wxPusher推送成功");
      }
    });
};

const push = (title, desp) => {
  pushWxPusher(title, desp)
  pushTelegramBot(title, desp)
}

let firstSpace = "  ";
let familyID;

let accounts = env.tyys
let familyIDs = env.FAMILY_ID.trim().split(/[\n ]+/);

let WX_PUSHER_UID = env.WX_PUSHER_UID
let WX_PUSHER_APP_TOKEN = env.WX_PUSHER_APP_TOKEN

let telegramBotToken = env.TELEGRAM_BOT_TOKEN
let telegramBotId = env.TELEGRAM_CHAT_ID

let private_threadx = env.private_threadx; //进程数
let family_threadx = env.family_threadx; //进程数

let i = 0;

const main = async () => {
  accounts = accounts.trim().split(/[\n ]+/);

  let userName0, password0, familyCapacitySize;
  let initialCloudCapacity, initialFamilyCapacity;
  let finalCloudCapacity, finalFamilyCapacity;

  for (i = 0; i < accounts.length; i += 2) {
    let n = parseInt(i / 2 / 20);
    familyID = familyIDs[n];
    const [userName, password] = accounts.slice(i, i + 2);
    if (!userName || !password) continue;

    const userNameInfo = mask(userName, 3, 7);

    //const tasks = [];
    //tasks.push((async () => {
    try {
      const cloudClient = new CloudClient(userName, password);

      logger.log(`${i / 2 + 1}. 🆔 ${userNameInfo} 开始执行`);
      await cloudClient.login();
      const { cloudCapacityInfo: cloudCapacityInfo0, familyCapacityInfo: familyCapacityInfo0 } = await cloudClient.getUserSizeInfo();
      
      if (i === 0) {
        initialCloudCapacity = cloudCapacityInfo0.totalSize;
        initialFamilyCapacity = familyCapacityInfo0.totalSize;      
      }

      const result = await doTask(cloudClient, env.FAMILY_ID);
      
      if (i / 2 % 20 == 0) {
        userName0 = userName;
        password0 = password;
        familyCapacitySize = familyCapacityInfo0.totalSize;
      }
      const { cloudCapacityInfo, familyCapacityInfo } = await cloudClient.getUserSizeInfo();
      result.forEach((r) => logger.log(r));

      //logger.log(`${firstSpace}实际：个人容量+ ${(cloudCapacityInfo.totalSize - cloudCapacityInfo0.totalSize) / 1024 / 1024}M, 家庭容量+ ${(familyCapacityInfo.totalSize - familyCapacityInfo0.totalSize) / 1024 / 1024}M`);
      //logger.log(`${firstSpace}个人总容量：${(cloudCapacityInfo.totalSize / 1024 / 1024 / 1024).toFixed(2)}G, 家庭总容量：${(familyCapacityInfo.totalSize / 1024 / 1024 / 1024).toFixed(2)}G`);

      if (i === 0) {
        finalCloudCapacity = cloudCapacityInfo.totalSize;
        finalFamilyCapacity = familyCapacityInfo.totalSize;
      }
    } catch (e) {
      logger.error(e);
      if (e.code === "ETIMEDOUT") throw e;
    } finally {
      logger.log("");
    }

    
  }

  // 输出第1个账号的容量变化
  if (userName0 && password0) {
    const cloudClient = new CloudClient(userName0, password0);
    await cloudClient.login();
    const { cloudCapacityInfo: finalCloudCapacityInfo, familyCapacityInfo: finalFamilyCapacityInfo } = await cloudClient.getUserSizeInfo();

    const cloudCapacityChange = finalCloudCapacityInfo.totalSize - initialCloudCapacity;
    const familyCapacityChange = finalFamilyCapacityInfo.totalSize - initialFamilyCapacity;
    logger.log(`══════════容量汇总══════════\n`);
    logger.log(`╔══╗`);
    logger.log(`║账号║${mask(userName0,3,7)}`);     
    logger.log(`╠══╣`);
    logger.log(`║昨日║个人: ${(initialCloudCapacity / 1024 / 1024 / 1024).toFixed(2)}G , 家庭: ${(initialFamilyCapacity / 1024 / 1024 / 1024).toFixed(2)}G`);
    logger.log(`╠══╣`);
    logger.log(`║今日║个人: ${(finalCloudCapacityInfo.totalSize / 1024 / 1024 / 1024).toFixed(2)}G , 家庭: ${(finalFamilyCapacityInfo.totalSize / 1024 / 1024 / 1024).toFixed(2)}G`);
    logger.log(`╚══╝`);
    logger.log(`📊今日增长: 个人📈${cloudCapacityChange / 1024 / 1024}M ,家庭📈: ${familyCapacityChange / 1024 / 1024}M`);
  }
};

(async () => {
  try {
    await main();
  } finally {
    logger.log("\n\n");
    const events = recording.replay();
    const content = events.map((e) => `${e.data.join("")}`).join("  \n");
    push("天翼云盘自动签到任务", content);
    recording.erase();
  }
})();
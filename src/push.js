const superagent = require("superagent");
const { logger } = require("./logger");

let WX_PUSHER_UID = process.env.WX_PUSHER_UID;
let WX_PUSHER_APP_TOKEN = process.env.WX_PUSHER_APP_TOKEN;

let telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
let telegramBotId = process.env.TELEGRAM_CHAT_ID;

// 添加 Pushplus 的配置信息
let PUSH_PLUS_TOKEN = process.env.PUSH_PLUS_TOKEN;
// 添加 Pushplus 群组编码配置
let PUSHPLUS_TOPIC = process.env.PUSHPLUS_TOPIC;

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
    .type("form")
    .send(data)
    .timeout(3000)
    .then((res) => {
      if (res.body?.ok) {
        logger.info("TelegramBot推送成功");
      } else {
        logger.error(`TelegramBot推送失败:${JSON.stringify(res.body)}`);
      }
    })
    .catch((err) => {
      logger.error(`TelegramBot推送失败:${JSON.stringify(err)}`);
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

// 修改 Pushplus 的推送函数，添加群组发送配置
const pushPushplus = (title, desp) => {
  if (!PUSH_PLUS_TOKEN) {
    return;
  }
  const data = {
    token: PUSH_PLUS_TOKEN,
    title: title,
    content: desp,
  };
  // 如果配置了群组编码，则添加到数据中
  if (PUSHPLUS_TOPIC) {
    data.topic = PUSHPLUS_TOPIC;
  }
  superagent
    .post("https://www.pushplus.plus/send")
    .send(data)
    .timeout(3000)
    .end((err, res) => {
      if (err) {
        logger.error(`Pushplus推送失败:${JSON.stringify(err)}`);
        return;
      }
      const json = JSON.parse(res.text);
      if (json.code !== 200) {
        logger.error(`Pushplus推送失败:${JSON.stringify(json)}`);
      } else {
        logger.info("Pushplus推送成功");
      }
    });
};

const push = (title, desp) => {
  pushWxPusher(title, desp);
  pushTelegramBot(title, desp);
  // 调用 Pushplus 的推送函数
  pushPushplus(title, desp);
};

exports.push = push;    

// ── Render 무료 구동용 웹서버 ──
const http = require('http');
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Level Event Bot is running!');
}).listen(process.env.PORT || 3000, () => {
  console.log('Web server is alive!');
});
// ────────────────────────────────

const { Client, GatewayIntentBits } = require('discord.js');

// ⚙️ [설정] 구글 웹앱 URL 및 디스코드 ID
const GOOGLE_SHEET_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbz-HJFhJlyCXRbNb_anWNbelum5-_BR3zM2bDgP_s_2DBHp7kglxSxPBYoaMt3mONhR/exec";
const LV20_ROLE_ID = "1565563606546784386";
const EVENT_CHANNEL_ID = "1565563858326917170";

// 경험치 및 쿨다운 관리
const userXp = new Map();     // userId -> { xp: number, level: number }
const xpCooldown = new Map(); // userId -> timestamp

// 구글 스프레드시트로 채팅 데이터 전송
async function saveEventToGoogleSheet(userId, username, content) {
  try {
    await fetch(GOOGLE_SHEET_WEBAPP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: userId,
        username: username,
        content: content
      })
    });
    console.log(`[시트 기록 완료] ${username}: ${content}`);
  } catch (err) {
    console.error("구글 시트 전송 실패:", err);
  }
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

client.on('ready', () => {
  console.log(`✅ [레벨 이벤트 봇] 로그인 성공: ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  // 봇이 작성한 글이나 DM은 무시
  if (message.author.bot || !message.guild) return;

  const userId = message.author.id;

  // 1. 레벨 20 인증 채널에 유저가 채팅을 치면 구글 시트에 자동 적재
  if (message.channel.id === EVENT_CHANNEL_ID) {
    await saveEventToGoogleSheet(userId, message.author.username, message.content);
    await message.react('✅'); // 성공 표시로 체크 이모지 반응
    return;
  }

  // 2. 현재 내 레벨/경험치 확인 명령어
  if (message.content === '!레벨') {
    const data = userXp.get(userId) || { xp: 0, level: 0 };
    return message.reply(`📊 **${message.author.username}**님의 현재 레벨: **Lv.${data.level}** (경험치: ${data.xp}/20)`);
  }

  // 3. 채팅 경험치 지급 (도배 방지용 3초 쿨다운)
  const now = Date.now();
  if (xpCooldown.has(userId) && now - xpCooldown.get(userId) < 3000) {
    return;
  }
  xpCooldown.set(userId, now);

  // 경험치 추가 (채팅 1회당 1레벨 상승, 총 20회 시 20레벨 달성)
  let userData = userXp.get(userId) || { xp: 0, level: 0 };
  userData.xp += 1;
  userData.level = userData.xp;
  userXp.set(userId, userData);

  // 4. 레벨 20 도달 시 자동으로 역할 지급
  if (userData.level === 20) {
    try {
      const member = await message.guild.members.fetch(userId);
      await member.roles.add(LV20_ROLE_ID);
      message.reply(`🎉 축하합니다! **Lv.20**에 도달하여 <#${EVENT_CHANNEL_ID}> 채널 입장 권한을 획득하셨습니다!`);
    } catch (err) {
      console.error("역할 지급 실패 (디스코드 서버 설정에서 봇의 역할 순위를 Lv.20 역할보다 위로 올려주세요):", err);
    }
  }
});

// 봇 로그인 토큰
client.login(process.env.DISCORD_TOKEN);
const form = document.querySelector("#chatForm");
const input = document.querySelector("#messageInput");
const sendButton = document.querySelector("#sendButton");
const messagesEl = document.querySelector("#messages");
const welcome = document.querySelector("#welcome");
const chat = document.querySelector("#chat");
const resetButton = document.querySelector("#resetButton");
const composerWrap = document.querySelector("#composerWrap");
const duoSetup = document.querySelector("#duoSetup");
const duoGame = document.querySelector("#duoGame");
const duoForm = document.querySelector("#duoForm");
const playerOneInput = document.querySelector("#playerOne");
const playerTwoInput = document.querySelector("#playerTwo");
const duoQuestion = document.querySelector("#duoQuestion");
const turnBadge = document.querySelector("#turnBadge");
const roundLabel = document.querySelector("#roundLabel");
const levelLabel = document.querySelector("#levelLabel");
const nextQuestion = document.querySelector("#nextQuestion");
const skipQuestion = document.querySelector("#skipQuestion");
let messages = [];
let busy = false;
let duoPlayers = [];
let duoRound = 0;

const duoQuestions = [
  { level: "گرم‌شدن", text: "این روزها چه چیز کوچکی سریع حالت را خوب می‌کند؟" },
  { level: "گرم‌شدن", text: "اگر همین الان آزاد بودی، دوست داشتی کجا بروی؟" },
  { level: "گرم‌شدن", text: "فیلم، غذا یا آهنگی که همیشه می‌توانی تکرارش کنی چیست؟" },
  { level: "شناخت بیشتر", text: "یک ویژگی در آدم‌ها که فوراً تحسینت را جلب می‌کند چیست؟" },
  { level: "شناخت بیشتر", text: "آخرین باری که به خودت افتخار کردی چه زمانی بود؟" },
  { level: "شناخت بیشتر", text: "وقتی روز بدی داری، ترجیح می‌دهی تنها باشی یا کسی کنارت باشد؟" },
  { level: "کمی عمیق‌تر", text: "چه چیزی هست که دوست داری دیگران زودتر درباره‌ات بفهمند؟" },
  { level: "کمی عمیق‌تر", text: "در یک رابطه یا دوستی، چه چیزی به تو احساس امنیت می‌دهد؟" },
  { level: "کمی عمیق‌تر", text: "چه رؤیایی داری که هنوز زیاد درباره‌اش حرف نزده‌ای؟" },
  { level: "باهم", text: "فکر می‌کنی در چه چیزی می‌توانید مکمل خوبی برای هم باشید؟" },
  { level: "باهم", text: "یک تجربه که دوست داری روزی با هم امتحان کنید چیست؟" },
  { level: "باهم", text: "از گفت‌وگوی امروز چه چیز تازه‌ای درباره طرف مقابل فهمیدی؟" },
];

function resizeInput() {
  input.style.height = "auto";
  input.style.height = `${Math.min(input.scrollHeight, 130)}px`;
}

function setMode(mode) {
  document.querySelectorAll("[data-mode]").forEach((button) => button.classList.toggle("active", button.dataset.mode === mode));
  if (mode === "duo") {
    welcome.hidden = true;
    messagesEl.hidden = true;
    duoSetup.hidden = false;
    duoGame.hidden = true;
    composerWrap.hidden = true;
    playerOneInput.focus();
  } else {
    welcome.hidden = false;
    messagesEl.hidden = false;
    duoSetup.hidden = true;
    duoGame.hidden = true;
    composerWrap.hidden = false;
  }
}

function renderDuoQuestion() {
  const item = duoQuestions[duoRound % duoQuestions.length];
  const player = duoPlayers[duoRound % 2];
  roundLabel.textContent = `سؤال ${duoRound + 1} از ${duoQuestions.length}`;
  levelLabel.textContent = item.level;
  turnBadge.textContent = `نوبت ${player}`;
  duoQuestion.textContent = item.text;
}

function addMessage(role, content) {
  const row = document.createElement("div");
  row.className = `message ${role}`;
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = content;
  if (role === "assistant") {
    const avatar = document.createElement("span");
    avatar.className = "avatar";
    avatar.textContent = "چ";
    row.append(avatar);
  }
  row.append(bubble);
  messagesEl.append(row);
  chat.scrollTo({ top: chat.scrollHeight, behavior: "smooth" });
  return row;
}

function showTyping() {
  const row = document.createElement("div");
  row.className = "message assistant typing";
  row.innerHTML = '<span class="avatar">چ</span><div class="bubble"><i></i><i></i><i></i></div>';
  messagesEl.append(row);
  chat.scrollTo({ top: chat.scrollHeight, behavior: "smooth" });
  return row;
}

function fallback(text) {
  const choices = text.split(/\s+(?:یا|و|vs\.?|مقابل)\s+/i).map((item) => item.trim()).filter(Boolean);
  if (choices.length === 2) {
    const pick = choices[crypto.getRandomValues(new Uint8Array(1))[0] % 2];
    return `انتخاب من: ${pick} 🎯\nفعلاً ارتباط هوشمند قطع است، پس این انتخاب را شانسی اما قاطع انجام دادم.`;
  }
  const isMovie = /فیلم|سریال|ژانر|سینما/.test(text);
  return isMovie
    ? "فعلاً ارتباطم با بخش هوشمند قطع شده 🎬 ولی انتخاب شانسی من برای امشب: یک کمدی سبک. چند دقیقه دیگه دوباره ازم بپرس تا دقیق‌تر انتخاب کنیم."
    : "فعلاً ارتباطم با بخش هوشمند قطع شده 🍽️ ولی انتخاب شانسی من: یک غذای ساده و گرم که کمتر از نیم‌ساعت آماده شود. چند دقیقه دیگه دوباره امتحان کن.";
}

async function sendMessage(text) {
  if (busy || !text.trim()) return;
  busy = true;
  sendButton.disabled = true;
  welcome.hidden = true;
  addMessage("user", text.trim());
  messages.push({ role: "user", content: text.trim() });
  input.value = "";
  resizeInput();
  const typing = showTyping();

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: messages.slice(-10) }),
    });
    const data = await response.json();
    if (!response.ok || typeof data.reply !== "string") throw new Error(data.error || "Request failed");
    typing.remove();
    addMessage("assistant", data.reply);
    messages.push({ role: "assistant", content: data.reply });
  } catch {
    typing.remove();
    const reply = fallback(text);
    addMessage("assistant", reply);
    messages.push({ role: "assistant", content: reply });
  } finally {
    busy = false;
    sendButton.disabled = false;
    input.focus();
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  sendMessage(input.value);
});
input.addEventListener("input", resizeInput);
input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});
document.querySelectorAll("[data-prompt]").forEach((button) => {
  button.addEventListener("click", () => sendMessage(button.dataset.prompt));
});
document.querySelectorAll("[data-mode]").forEach((button) => {
  button.addEventListener("click", () => setMode(button.dataset.mode));
});
duoForm.addEventListener("submit", (event) => {
  event.preventDefault();
  duoPlayers = [playerOneInput.value.trim(), playerTwoInput.value.trim()];
  if (duoPlayers.some((name) => !name)) return;
  duoRound = 0;
  duoSetup.hidden = true;
  duoGame.hidden = false;
  renderDuoQuestion();
});
nextQuestion.addEventListener("click", () => {
  duoRound = (duoRound + 1) % duoQuestions.length;
  renderDuoQuestion();
});
skipQuestion.addEventListener("click", () => {
  duoRound = (duoRound + 2) % duoQuestions.length;
  renderDuoQuestion();
});
resetButton.addEventListener("click", () => {
  messages = [];
  messagesEl.replaceChildren();
  welcome.hidden = false;
  messagesEl.hidden = false;
  duoSetup.hidden = true;
  duoGame.hidden = true;
  composerWrap.hidden = false;
  input.value = "";
  resizeInput();
  input.focus();
});

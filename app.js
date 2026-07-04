const form = document.querySelector("#chatForm");
const input = document.querySelector("#messageInput");
const sendButton = document.querySelector("#sendButton");
const messagesEl = document.querySelector("#messages");
const welcome = document.querySelector("#welcome");
const chat = document.querySelector("#chat");
const resetButton = document.querySelector("#resetButton");
let messages = [];
let busy = false;

function resizeInput() {
  input.style.height = "auto";
  input.style.height = `${Math.min(input.scrollHeight, 130)}px`;
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
resetButton.addEventListener("click", () => {
  messages = [];
  messagesEl.replaceChildren();
  welcome.hidden = false;
  input.value = "";
  resizeInput();
  input.focus();
});

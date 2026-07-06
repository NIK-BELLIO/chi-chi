const $ = (selector) => document.querySelector(selector);
const labels = {
  friendship: "دوستی", romantic: "عاطفی", both: "هردو",
  profile_created: "پروفایل ساخته شد", tastes_saved: "سلیقه ثبت شد",
  matches_viewed: "هم‌سلیقه‌ها دیده شد", introduction_sent: "درخواست آشنایی",
  mutual_match: "مچ دوطرفه", profile_blocked: "بلاک", profile_reported: "گزارش",
  chat_answered: "پاسخ هوشمند",
};

let token = sessionStorage.getItem("chichi_admin_token") || "";
const number = (value) => new Intl.NumberFormat("fa-IR").format(Number(value || 0));

function rowsToMap(rows, key = "event_type") {
  return Object.fromEntries((rows || []).map((row) => [row[key], Number(row.count)]));
}

function metric(label, value, note) {
  return `<article class="stat"><span>${label}</span><strong>${number(value)}</strong><span>${note}</span></article>`;
}

function bars(rows) {
  const byDay = new Map(rows.map((row) => [row.day, Number(row.count)]));
  const days = Array.from({ length: 14 }, (_, offset) => {
    const date = new Date(); date.setDate(date.getDate() - (13 - offset));
    return date.toISOString().slice(0, 10);
  });
  const max = Math.max(1, ...days.map((day) => byDay.get(day) || 0));
  return days.map((day) => {
    const count = byDay.get(day) || 0;
    return `<div class="bar-wrap"><div class="bar" data-count="${number(count)}" style="height:${Math.max(3, count / max * 100)}%"></div><small>${new Date(day).toLocaleDateString("fa-IR", { day: "numeric", month: "short" })}</small></div>`;
  }).join("");
}

function progressRows(items) {
  const max = Math.max(1, ...items.map((item) => item.value));
  return items.map((item) => `<div class="metric-row"><span>${item.label}</span><div class="track"><i style="width:${item.value / max * 100}%"></i></div><b>${number(item.value)}</b></div>`).join("");
}

function render(data) {
  const eventMap = rowsToMap(data.events);
  const introMap = rowsToMap(data.introductions, "status");
  const totalTastes = (data.tasteSummary || []).reduce((sum, row) => sum + Number(row.count), 0);
  $("#stats").innerHTML = [
    metric("کل کاربران", data.overview.total_users, `+${number(data.overview.new_7d)} این هفته`),
    metric("پاسخ‌های هوشمند", eventMap.chat_answered, "۳۰ روز اخیر"),
    metric("سلیقه‌های ثبت‌شده", totalTastes, "فیلم و غذا"),
    metric("مچ دوطرفه", eventMap.mutual_match || introMap.accepted, "آشنایی با رضایت دوطرف"),
  ].join("");
  $("#dailyChart").innerHTML = bars(data.daily || []);
  $("#funnel").innerHTML = progressRows([
    { label: "ساخت پروفایل", value: eventMap.profile_created || Number(data.overview.total_users) },
    { label: "ثبت سلیقه", value: eventMap.tastes_saved || 0 },
    { label: "دیدن پیشنهاد", value: eventMap.matches_viewed || 0 },
    { label: "درخواست", value: eventMap.introduction_sent || 0 },
    { label: "مچ دوطرفه", value: eventMap.mutual_match || 0 },
  ]);
  $("#intents").innerHTML = progressRows((data.intents || []).map((row) => ({ label: labels[row.intent] || row.intent, value: Number(row.count) })));
  const tastes = { movie: [], food: [] };
  (data.popularTastes || []).forEach((item) => tastes[item.kind]?.push(item));
  $("#popular").innerHTML = [["movie", "🎬 فیلم"], ["food", "🍜 غذا"]].map(([kind, title]) => `<div class="popular-group"><h3>${title}</h3><div class="chips">${tastes[kind].slice(0, 8).map((item) => `<span class="chip">${item.item} · ${number(item.count)}</span>`).join("") || "هنوز داده‌ای نیست"}</div></div>`).join("");
  $("#events").innerHTML = (data.events || []).map((item) => `<div class="event"><span>${labels[item.event_type] || item.event_type}</span><b>${number(item.count)}</b></div>`).join("") || '<div class="empty">رویدادی ثبت نشده است.</div>';
  const reports = data.recentReports || [];
  $("#safetyBadge").textContent = `${number(data.safety.reports)} گزارش · ${number(data.safety.blocks)} بلاک`;
  $("#reports").innerHTML = reports.length ? `<table><thead><tr><th>گزارش‌دهنده</th><th>کاربر گزارش‌شده</th><th>دلیل</th><th>زمان</th></tr></thead><tbody>${reports.map((report) => `<tr><td>${report.reporter || "حذف‌شده"}</td><td>${report.reported || "حذف‌شده"}</td><td>${report.reason}</td><td>${new Date(report.created_at + "Z").toLocaleString("fa-IR")}</td></tr>`).join("")}</tbody></table>` : '<div class="empty">عالیه؛ هنوز گزارشی ثبت نشده است.</div>';
  $("#updatedAt").textContent = `آخرین به‌روزرسانی ${new Date(data.generatedAt).toLocaleTimeString("fa-IR")}`;
}

async function load() {
  $("#refresh").disabled = true;
  const response = await fetch("/api/admin/stats", { headers: { Authorization: `Bearer ${token}` } });
  const data = await response.json();
  $("#refresh").disabled = false;
  if (!response.ok) throw new Error(data.error || "خطا در خواندن داشبورد");
  render(data); $("#login").hidden = true; $("#dashboard").hidden = false;
}

$("#loginForm").addEventListener("submit", async (event) => {
  event.preventDefault(); token = $("#token").value.trim(); $("#loginError").textContent = "در حال بررسی…";
  try { await load(); sessionStorage.setItem("chichi_admin_token", token); $("#loginError").textContent = ""; }
  catch (error) { $("#loginError").textContent = error.message; }
});
$("#refresh").addEventListener("click", () => load().catch((error) => alert(error.message)));
$("#logout").addEventListener("click", () => { sessionStorage.removeItem("chichi_admin_token"); location.reload(); });
if (token) load().catch(() => sessionStorage.removeItem("chichi_admin_token"));

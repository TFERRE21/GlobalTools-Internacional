#!/usr/bin/env node
"use strict";

// Publishes at most one organic post per UTC day and follows a small number of relevant accounts.
// Credentials are supplied only through environment variables; never log them.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const root = path.resolve(__dirname, "..");
const queuePath = path.join(root, "marketing", "queue.json");
const statePath = path.join(process.env.GLOBALTOOLS_DATA_DIR || path.join(root, "data"), "bluesky-state.json");
const lockPath = statePath + ".lock";
// Normalize common dashboard copy/paste formatting without exposing credentials.
const handle = String(process.env.BLUESKY_HANDLE || "").trim().replace(/^@/, "");
const password = String(process.env.BLUESKY_APP_PASSWORD || "").trim();
const service = (process.env.BLUESKY_SERVICE || "https://bsky.social").replace(/\/$/, "");

function fail(message) {
  console.error("[bluesky-publisher] " + message);
  process.exit(1);
}
function graphemes(value) {
  return Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(value)).length;
}
function fitPost(title, summary, url) {
  const suffix = "\n\n" + url;
  let text = title + "\n\n" + summary + suffix;
  if (graphemes(text) <= 300) return text;
  const available = 300 - graphemes(title + suffix) - 2;
  const parts = Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(summary));
  let shortened = parts.slice(0, Math.max(0, available - 1)).map(p => p.segment).join("").trimEnd();
  if (shortened && shortened.length < summary.length) shortened += "…";
  text = title + "\n\n" + shortened + suffix;
  if (graphemes(text) > 300) text = title.slice(0, 100) + suffix;
  return text;
}
async function api(pathname, body, token) {
  const response = await fetch(service + "/xrpc/" + pathname, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) },
    body: JSON.stringify(body)
  });
  const raw = await response.text();
  let data = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch {}
  if (!response.ok) throw new Error(pathname + " returned HTTP " + response.status + ": " + (data.message || raw.slice(0, 300)));
  return data;
}

const AUTO_FOLLOW = process.env.BLUESKY_AUTO_FOLLOW === "true";
const MAX_FOLLOWS_PER_DAY = Math.min(3, Math.max(0, Number(process.env.BLUESKY_MAX_FOLLOWS_PER_DAY) || 2));
const DISCOVERY_TERMS = ["SaaS small business", "online tools productivity", "Bitcoin crypto", "AI technology startup"];
async function discoverActors(term, accessJwt) {
  const url = new URL(service + "/xrpc/app.bsky.actor.searchActors");
  url.searchParams.set("q", term);
  url.searchParams.set("limit", "15");
  const response = await fetch(url, { headers: { Authorization: "Bearer " + accessJwt } });
  if (!response.ok) throw new Error("Bluesky actor search returned HTTP " + response.status);
  const data = await response.json();
  return Array.isArray(data.actors) ? data.actors : [];
}
async function followRelevantActors(session, state, day) {
  if (!AUTO_FOLLOW || MAX_FOLLOWS_PER_DAY === 0) return;
  const followed = new Set(Array.isArray(state.followedDids) ? state.followedDids : []);
  const todayCount = state.followDate === day ? Number(state.followsToday || 0) : 0;
  let remaining = Math.max(0, MAX_FOLLOWS_PER_DAY - todayCount);
  if (!remaining) return;
  const ownDid = session.did;
  const seen = new Set();
  for (const term of DISCOVERY_TERMS) {
    if (!remaining) break;
    let actors = [];
    try { actors = await discoverActors(term, session.accessJwt); }
    catch (error) { console.warn("[bluesky-publisher] profile discovery skipped:", error.message); continue; }
    for (const actor of actors) {
      if (!remaining) break;
      if (!actor?.did || actor.did === ownDid || followed.has(actor.did) || seen.has(actor.did)) continue;
      seen.add(actor.did);
      const profileText = [actor.handle, actor.displayName, actor.description].join(" ").toLowerCase();
      const relevant = /(saas|software|startup|technology|tech|bitcoin|crypto|blockchain|ai |artificial intelligence|productivity|online tools|small business|fintech)/i.test(profileText);
      if (!relevant) continue;
      try {
        await api("com.atproto.repo.createRecord", {
          repo: ownDid,
          collection: "app.bsky.graph.follow",
          record: { $type: "app.bsky.graph.follow", subject: actor.did, createdAt: new Date().toISOString() }
        }, session.accessJwt);
        followed.add(actor.did);
        remaining--;
        state.followedDids = Array.from(followed);
        state.followDate = day;
        state.followsToday = todayCount + (MAX_FOLLOWS_PER_DAY - remaining - todayCount);
        console.log("[bluesky-publisher] followed relevant profile: " + actor.handle);
      } catch (error) {
        console.warn("[bluesky-publisher] could not follow " + actor.handle + ":", error.message);
      }
    }
  }
}

function xml(value) {
  return String(value || "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"}[ch]));
}
function wrapText(value, max = 34, lines = 2) {
  const words = String(value || "").split(/\\s+/);
  const out = [];
  let line = "";
  for (const word of words) {
    const next = line ? line + " " + word : word;
    if (next.length > max && line) { out.push(line); line = word; }
    else line = next;
    if (out.length === lines) break;
  }
  if (line && out.length < lines) out.push(line);
  return out;
}
async function createCampaignImage(item, summary, session) {
  const sharp = require("sharp");
  const host = (() => { try { return new URL(item.url).hostname.replace(/^www\\./, ""); } catch { return "globaltoolsnow.com"; } })();
  const campaign = String(item.campaign || "").toLowerCase();
  const palettes = [
    { match: /calc|percent|average|date|word|character/, color: "#38bdf8", label: "CALCULATORS & ONLINE TOOLS" },
    { match: /daymoney|cash|finance|freelancer|business|oolivo/, color: "#34d399", label: "FINANCE & DIGITAL BUSINESS" },
    { match: /versos|music/, color: "#c084fc", label: "MUSIC & LYRICS" },
    { match: /biblia|conecta/, color: "#fbbf24", label: "BIBLE & DEVOTIONAL STUDY" },
    { match: /cripto|bitcoin|crypto/, color: "#f59e0b", label: "CRYPTO & MARKET TOOLS" }
  ];
  const theme = palettes.find(p => p.match.test(campaign)) || { color: "#39e58c", label: "DIGITAL INNOVATION" };
  // Stable per campaign/day: retries keep the same asset, while each new daily post gets a distinct composition.
  const visualKey = [new Date().toISOString(), campaign, item.title || "", crypto.randomBytes(16).toString("hex")].join("|");
  let visualSeed = 0;
  for (const ch of visualKey) visualSeed = (visualSeed * 31 + ch.charCodeAt(0)) >>> 0;
  const variant = visualSeed % 8;
  const accentX = 850 + (visualSeed % 220);
  const accentY = 245 + (Math.floor(visualSeed / 7) % 170);
  const visualDecor = variant === 0
    ? `<g fill="none" stroke="${theme.color}" opacity=".42"><circle cx="${accentX}" cy="${accentY}" r="78" stroke-width="3"/><circle cx="${accentX}" cy="${accentY}" r="125" stroke-width="2"/><circle cx="${accentX}" cy="${accentY}" r="172" stroke-width="1"/><path d="M${accentX-190} ${accentY}h380 M${accentX} ${accentY-190}v380" stroke-width="2"/></g>`
    : variant === 1
    ? `<g fill="${theme.color}" opacity=".28">${Array.from({length: 42}, (_,i) => '<circle cx="' + (790+(i%7)*52) + '" cy="' + (155+Math.floor(i/7)*52) + '" r="' + (3+(i%3)*2) + '"/>').join("")}</g><path d="M820 500L1160 160" stroke="${theme.color}" stroke-width="3" opacity=".45"/>`
    : variant === 2
    ? `<g fill="none" stroke="${theme.color}" opacity=".38" stroke-width="3"><path d="M820 160h300v300H820z"/><path d="M855 195h230v230H855z"/><path d="M890 230h160v160H890z"/></g><circle cx="${accentX}" cy="${accentY}" r="54" fill="${theme.color}" opacity=".18"/>`
    : `<g fill="${theme.color}" opacity=".2"><path d="M810 500L980 150h48L858 500z"/><path d="M910 500l170-350h48L958 500z"/><path d="M1010 500l140-290v100l-92 190z"/></g>`;
  const titleLines = wrapText(item.title || "Discover smarter digital tools", 30, 2);
  const summaryLines = wrapText(summary, 46, 2);
  const titleSvg = titleLines.map((line, i) => '<text x="78" y="' + (270 + i * 68) + '" fill="#ffffff" font-size="54" font-weight="800">' + xml(line) + '</text>').join("");
  const summarySvg = summaryLines.map((line, i) => '<text x="82" y="' + (430 + i * 38) + '" fill="#cbd5e1" font-size="25">' + xml(line) + '</text>').join("");
  const svg = `<svg width="1200" height="675" viewBox="0 0 1200 675" xmlns="http://www.w3.org/2000/svg">
  <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#071827"/><stop offset="1" stop-color="#102f3c"/></linearGradient><radialGradient id="glow"><stop stop-color="${theme.color}" stop-opacity=".32"/><stop offset="1" stop-color="${theme.color}" stop-opacity="0"/></radialGradient></defs>
  <rect width="1200" height="675" rx="34" fill="url(#bg)"/><circle cx="1030" cy="130" r="390" fill="url(#glow)"/>
  <path d="M0 560 Q360 ${430+(visualSeed%80)} 720 580 T1200 500 V675 H0Z" fill="${theme.color}" opacity=".10"/>
  ${visualDecor}
  <circle cx="${accentX}" cy="${accentY}" r="58" fill="${theme.color}" opacity=".18"/><text x="${accentX}" y="${accentY+22}" text-anchor="middle" font-family="Arial" font-size="64" font-weight="bold" fill="#fff">G</text>
  <rect x="78" y="72" width="12" height="52" rx="6" fill="${theme.color}"/><text x="112" y="110" font-family="Arial" font-size="31" font-weight="700" fill="#fff">GlobalTools</text><text x="315" y="110" font-family="Arial" font-size="25" fill="${theme.color}">DIGITAL INNOVATION</text>
  <text x="82" y="205" font-family="Arial" font-size="19" letter-spacing="4" font-weight="700" fill="${theme.color}">${xml(theme.label)}</text>
  ${titleSvg}${summarySvg}
  <rect x="78" y="548" width="1044" height="2" fill="#ffffff" opacity=".16"/><text x="82" y="602" font-family="Arial" font-size="25" font-weight="700" fill="#ffffff">${xml(host)}</text><text x="1118" y="602" text-anchor="end" font-family="Arial" font-size="18" fill="${theme.color}">EXPLORE MORE  ↗</text>
  </svg>`;
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  const response = await fetch(service + "/xrpc/com.atproto.repo.uploadBlob", {
    method: "POST",
    headers: { Authorization: "Bearer " + session.accessJwt, "Content-Type": "image/png" },
    body: png
  });
  const raw = await response.text();
  let data = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch {}
  if (!response.ok || !data.blob) throw new Error("image upload failed: HTTP " + response.status + " " + (data.message || raw.slice(0, 200)));
  return data.blob;
}


const NEWS_FEEDS = [
  { category: "technology", url: "https://feeds.bbci.co.uk/news/technology/rss.xml" },
  { category: "world", url: "https://feeds.bbci.co.uk/news/world/rss.xml" },
  { category: "business", url: "https://feeds.bbci.co.uk/news/business/rss.xml" },
  { category: "science", url: "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml" }
];
function decodeXml(value) {
  return String(value || "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ").trim();
}
function xmlTag(block, tag) {
  const match = block.match(new RegExp("<" + tag + "(?:\\s[^>]*)?>([\\s\\S]*?)</" + tag + ">", "i"));
  return match ? decodeXml(match[1]) : "";
}
async function fetchWorldNews(state) {
  const seen = new Set(Array.isArray(state.seenNewsLinks) ? state.seenNewsLinks : []);
  for (const feed of NEWS_FEEDS) {
    try {
      const response = await fetch(feed.url, { headers: { "User-Agent": "GlobalToolsNewsBot/1.0" }, signal: AbortSignal.timeout(12000) });
      if (!response.ok) { console.warn("[bluesky-publisher] news feed HTTP " + response.status + ": " + feed.category); continue; }
      const xmlText = await response.text();
      const blocks = xmlText.match(/<item(?:\s[^>]*)?>[\s\S]*?<\/item>/gi) || [];
      for (const block of blocks) {
        const title = xmlTag(block, "title");
        const link = xmlTag(block, "link");
        const description = xmlTag(block, "description");
        const pubDate = xmlTag(block, "pubDate");
        const timestamp = Date.parse(pubDate);
        if (!title || !/^https?:\/\//i.test(link) || seen.has(link)) continue;
        if (!Number.isFinite(timestamp) || Date.now() - timestamp > 48 * 60 * 60 * 1000 || timestamp > Date.now() + 5 * 60 * 1000) continue;
        const text = (title + " " + description).toLowerCase();
        let site = { name: "GlobalTools", url: "https://globaltoolsnow.com/" };
        if (/bitcoin|crypto|blockchain|digital asset/.test(text)) site = { name: "CriptoProBot", url: "https://criptoprobot.com.br/" };
        else if (/inflation|economy|interest rate|bank|finance|business|market|company/.test(text)) site = { name: "DayMoney", url: "https://daymoney.com.br/" };
        else if (/music|singer|album|concert|song/.test(text)) site = { name: "Versos Musicais", url: "https://versosmusicais.com.br/" };
        else if (/bible|religion|faith/.test(text)) site = { name: "Conecta Bíblia", url: "https://conectabiblia.com.br/" };
        else if (/calculator|math|percentage/.test(text)) site = { name: "CalcWorld", url: "https://calcworld.com.br/" };
        const host = new URL(link).hostname.replace(/^www\./, "");
        return { campaign: "world-news-" + feed.category, title, summary: description || title, url: link, source: host, relatedSite: site, news: true };
      }
    } catch (error) {
      console.warn("[bluesky-publisher] news feed unavailable (" + feed.category + "): " + error.message);
    }
  }
  return null;
}

async function main() {
  if (!handle || !password) fail("Missing BLUESKY_HANDLE or BLUESKY_APP_PASSWORD repository secrets.");
  if (!fs.existsSync(queuePath)) fail("marketing/queue.json does not exist.");
  const queue = JSON.parse(fs.readFileSync(queuePath, "utf8"));
  const now = new Date();
  const day = now.toISOString().slice(0, 10);
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  try {
    const lock = fs.openSync(lockPath, "wx");
    fs.writeFileSync(lock, JSON.stringify({ pid: process.pid, startedAt: now.toISOString() }));
    fs.closeSync(lock);
  } catch (error) {
    if (error.code === "EEXIST") {
      try {
        const age = Date.now() - fs.statSync(lockPath).mtimeMs;
        if (age > 15 * 60 * 1000) { fs.unlinkSync(lockPath); fs.writeFileSync(lockPath, JSON.stringify({ pid: process.pid, startedAt: now.toISOString() }), { flag: "wx" }); }
        else { console.log("[bluesky-publisher] another publisher is active; skipping overlapping run."); return; }
      } catch { console.log("[bluesky-publisher] publisher lock is active; skipping overlapping run."); return; }
    } else throw error;
  }
  const state = fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, "utf8")) : {};
  console.log("[bluesky-publisher] authenticating handle " + handle);
  const session = await api("com.atproto.server.createSession", { identifier: handle, password });
  if (!session.did || !session.accessJwt) fail("Bluesky session response did not include DID/access token.");
  await followRelevantActors(session, state, day);
  const alreadyPublishedToday = state.lastPublishedDate === day;
  const publishedToday = alreadyPublishedToday ? Number(state.dailyPostCount || 1) : 0;
  const isExtraTestDay = day === "2026-11-06";
  const dailyLimit = isExtraTestDay ? 2 : 1;
  if (publishedToday >= dailyLimit) {
    fs.mkdirSync(path.dirname(statePath), { recursive: true });
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2) + "\n");
    try { fs.unlinkSync(lockPath); } catch {}
    console.log("[bluesky-publisher] daily limit reached (" + publishedToday + "/" + dailyLimit + "); skipping post.");
    return;
  }

  const itemEn = (queue.posts || []).find(p => p.locale === "en" && p.channel === "bluesky") || (queue.posts || []).find(p => p.locale === "en");
  if (!itemEn) fail("English campaign draft not found.");
  function extractSummary(draft) {
    const normalize = value => String(value || "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
    const title = normalize(draft.title);
    const paragraphs = String(draft.text || "").split(/\n\s*\n/).map(s => s.trim()).filter(Boolean);
    const candidate = paragraphs.find(s => normalize(s) !== title && !normalize(s).startsWith(title) && !s.startsWith("#") && !/^https?:\\/\\//i.test(s));
    return candidate || "Discover practical tools and useful resources for everyday tasks.";
  }
  const isSecondTestPost = isExtraTestDay && publishedToday === 1;
  let item = isSecondTestPost ? {
    campaign: "daymoney-extra-test",
    title: "Take control of your money with DayMoney",
    url: "https://daymoney.com.br/",
    locale: "en"
  } : itemEn;
  let summary = isSecondTestPost
    ? "Track income, expenses and your budget with a practical personal finance platform."
    : extractSummary(itemEn);
  let postTitle = item.title;
  let postSummary = summary;
  let postUrl = item.url;
  let isNews = false;
  if (isSecondTestPost) console.log("[bluesky-publisher] one-time second test post selected: DayMoney.");
  const dayNumber = Math.floor(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) / 86400000);
  if (dayNumber % 3 === 0) {
    const news = await fetchWorldNews(state);
    if (news) {
      item = { ...news, title: news.title, campaign: news.campaign };
      summary = news.summary;
      postTitle = "WORLD NEWS: " + news.title;
      postSummary = news.summary.slice(0, 160);
      postUrl = news.url;
      isNews = true;
      console.log("[bluesky-publisher] selected news from " + news.source + " linked to " + news.relatedSite.name);
    } else {
      console.log("[bluesky-publisher] no fresh news found; using regular campaign.");
    }
  }
  const postText = fitPost(postTitle, postSummary, postUrl);
  let embed;
  try {
    const imageItem = isNews ? { ...item, title: item.title, campaign: item.campaign, url: item.relatedSite.url } : item;
    const blob = await createCampaignImage(imageItem, summary, session);
    embed = { $type: "app.bsky.embed.images", images: [{ alt: (isNews ? "World news illustration: " : "GlobalTools campaign: ") + item.title + ". " + summary, image: blob, aspectRatio: { width: 1200, height: 675 } }] };
    console.log("[bluesky-publisher] " + (isNews ? "news" : "campaign") + " image created and uploaded for " + item.campaign);
  } catch (error) {
    console.warn("[bluesky-publisher] campaign image unavailable; publishing text only:", error.message);
  }
  const record = await api("com.atproto.repo.createRecord", {
    repo: session.did,
    collection: "app.bsky.feed.post",
    record: { $type: "app.bsky.feed.post", text: postText, createdAt: now.toISOString(), ...(embed ? { embed } : {}) }
  }, session.accessJwt);
  const nextState = {
    lastPublishedDate: day,
    dailyPostCount: publishedToday + 1,
    locale: "en",
    campaign: item.campaign,
    uri: record.uri,
    cid: record.cid,
    publishedAt: now.toISOString(),
    text: postText,
    followedDids: state.followedDids || [],
    followDate: state.followDate || null,
    followsToday: state.followsToday || 0,
    seenNewsLinks: isNews ? Array.from(new Set([...(state.seenNewsLinks || []), item.url])).slice(-200) : (state.seenNewsLinks || [])
  };
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, JSON.stringify(nextState, null, 2) + "\n");
  console.log("[bluesky-publisher] published " + (isNews ? "news" : "en") + " post (" + (publishedToday + 1) + "/" + dailyLimit + " today): " + record.uri);
}
main().catch(error => fail(error.message));

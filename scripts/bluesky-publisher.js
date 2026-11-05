#!/usr/bin/env node
"use strict";

// Publishes at most one organic post per UTC day and follows a small number of relevant accounts.
// Credentials are supplied only through environment variables; never log them.
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const queuePath = path.join(root, "marketing", "queue.json");
const statePath = path.join(process.env.GLOBALTOOLS_DATA_DIR || path.join(root, "data"), "bluesky-state.json");
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
async function discoverActors(term) {
  const url = new URL(service + "/xrpc/app.bsky.actor.searchActors");
  url.searchParams.set("q", term);
  url.searchParams.set("limit", "15");
  const response = await fetch(url);
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
    try { actors = await discoverActors(term); }
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
async function main() {
  if (!handle || !password) fail("Missing BLUESKY_HANDLE or BLUESKY_APP_PASSWORD repository secrets.");
  if (!fs.existsSync(queuePath)) fail("marketing/queue.json does not exist.");
  const queue = JSON.parse(fs.readFileSync(queuePath, "utf8"));
  const now = new Date();
  const day = now.toISOString().slice(0, 10);
  const state = fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, "utf8")) : {};
  console.log("[bluesky-publisher] authenticating handle " + handle);
  const session = await api("com.atproto.server.createSession", { identifier: handle, password });
  if (!session.did || !session.accessJwt) fail("Bluesky session response did not include DID/access token.");
  await followRelevantActors(session, state, day);
  if (state.lastPublishedDate === day) {
    fs.mkdirSync(path.dirname(statePath), { recursive: true });
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2) + "\\n");
    console.log("[bluesky-publisher] already published today; skipping post.");
    return;
  }
  const locales = ["en", "pt", "es"];
  const dayNumber = Math.floor(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) / 86400000);
  const locale = locales[((dayNumber % locales.length) + locales.length) % locales.length];
  const item = (queue.posts || []).find(p => p.locale === locale && p.channel === "bluesky") || (queue.posts || []).find(p => p.locale === locale);
  if (!item) fail("No marketing draft found for locale " + locale + ".");
  const paragraphs = String(item.text || "").split(/\n\n/).map(s => s.trim()).filter(Boolean);
  const summary = paragraphs.find(s => s !== item.title && !s.startsWith("#") && !/^https?:\/\//i.test(s) && !/^(Open|Try|See|Explore|Use|View|Abrir|Testar|Conheça|Ver|Usar|Conoce|Prueba|Explora)/i.test(s)) || item.title;
  const postText = fitPost(item.title, summary, item.url);
  const record = await api("com.atproto.repo.createRecord", {
    repo: session.did,
    collection: "app.bsky.feed.post",
    record: { $type: "app.bsky.feed.post", text: postText, createdAt: now.toISOString() }
  }, session.accessJwt);
  const nextState = {
    lastPublishedDate: day,
    locale,
    campaign: item.campaign,
    uri: record.uri,
    cid: record.cid,
    publishedAt: now.toISOString(),
    text: postText,
    followedDids: state.followedDids || [],
    followDate: state.followDate || null,
    followsToday: state.followsToday || 0
  };
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, JSON.stringify(nextState, null, 2) + "\n");
  console.log("[bluesky-publisher] published " + locale + " post: " + record.uri);
}
main().catch(error => fail(error.message));

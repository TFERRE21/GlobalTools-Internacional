#!/usr/bin/env node
"use strict";

// Publishes at most one organic post per UTC day to the authenticated Bluesky account.
// Credentials are supplied only through GitHub Actions secrets.
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const queuePath = path.join(root, "marketing", "queue.json");
const statePath = path.join(root, "marketing", "bluesky-state.json");
const handle = process.env.BLUESKY_HANDLE;
const password = process.env.BLUESKY_APP_PASSWORD;
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
async function main() {
  if (!handle || !password) fail("Missing BLUESKY_HANDLE or BLUESKY_APP_PASSWORD repository secrets.");
  if (!fs.existsSync(queuePath)) fail("marketing/queue.json does not exist.");
  const queue = JSON.parse(fs.readFileSync(queuePath, "utf8"));
  const now = new Date();
  const day = now.toISOString().slice(0, 10);
  const state = fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, "utf8")) : {};
  if (state.lastPublishedDate === day) {
    console.log("[bluesky-publisher] already published today; skipping.");
    return;
  }
  const locales = ["en", "pt", "es"];
  const dayNumber = Math.floor(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) / 86400000);
  const locale = locales[((dayNumber % locales.length) + locales.length) % locales.length];
  const item = (queue.posts || []).find(p => p.locale === locale && p.channel === "linkedin") || (queue.posts || []).find(p => p.locale === locale);
  if (!item) fail("No marketing draft found for locale " + locale + ".");
  const paragraphs = String(item.text || "").split(/\n\n/).map(s => s.trim()).filter(Boolean);
  const summary = paragraphs.find(s => s !== item.title && !s.startsWith("#") && !/^https?:\/\//i.test(s) && !/^(Open|Try|See|Explore|Use|View|Abrir|Testar|Conheça|Ver|Usar|Conoce|Prueba|Explora)/i.test(s)) || item.title;
  const postText = fitPost(item.title, summary, item.url);
  const session = await api("com.atproto.server.createSession", { identifier: handle, password });
  if (!session.did || !session.accessJwt) fail("Bluesky session response did not include DID/access token.");
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
    text: postText
  };
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, JSON.stringify(nextState, null, 2) + "\n");
  console.log("[bluesky-publisher] published " + locale + " post: " + record.uri);
}
main().catch(error => fail(error.message));

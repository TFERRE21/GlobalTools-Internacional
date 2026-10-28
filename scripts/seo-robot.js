#!/usr/bin/env node
"use strict";

// GlobalTools SEO research robot: discovers search phrases and refreshes sitemap
// from existing HTML files only. It does not generate pages or modify application code.
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");
const SITE = (process.env.PUBLIC_SITE_URL || "https://globaltoolsnow.com").replace(/\/$/, "");
const DATA_DIR = process.env.SEO_DATA_DIR || path.join(ROOT, "seo-data");
const KEYWORDS_FILE = path.join(DATA_DIR, "keyword-opportunities.json");
const STATE_FILE = path.join(DATA_DIR, "robot-state.json");
const SEEDS = [
  "free online tools", "online PDF converter", "Word to PDF online", "PDF to Word converter",
  "compress PDF online", "merge PDF files", "JPG to PDF converter", "PDF to JPG converter",
  "online word counter", "image compressor online", "free business finance tools",
  "small business finance dashboard", "cash flow planner spreadsheet", "freelancer business toolkit",
  "how to calculate profit margin", "business budget template", "invoice template spreadsheet",
  "personal finance calculator", "online unit converter", "percentage calculator",
  "calculadora online grátis", "converter PDF para Word online", "compactar PDF online",
  "unir arquivos PDF", "contador de palavras online", "comprimir imagens online",
  "herramientas online gratis", "convertidor PDF a Word", "convertisseur PDF Word",
  "outils en ligne gratuits"
];

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); }
  catch (e) { if (e.code !== "ENOENT") console.warn("[seo-robot] read warning:", e.message); return fallback; }
}
function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + "\n");
  fs.renameSync(tmp, file);
}
function normalize(s) { return String(s || "").replace(/\s+/g, " ").trim().toLocaleLowerCase(); }

async function suggestions(query) {
  const endpoint = "https://suggestqueries.google.com/complete/search?client=firefox&hl=en&q=" + encodeURIComponent(query);
  const response = await fetch(endpoint, {
    headers: { "user-agent": "GlobalToolsSEORobot/1.0" },
    signal: AbortSignal.timeout(12000)
  });
  if (!response.ok) throw new Error("Google suggestions HTTP " + response.status);
  const data = await response.json();
  return Array.isArray(data[1]) ? data[1].filter(x => typeof x === "string" && x.trim()).slice(0, 15) : [];
}
function collectHtml(dir, relative) {
  if (!fs.existsSync(dir)) return [];
  let files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || ["node_modules", "seo-data", "data", "scripts"].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    const rel = path.posix.join(relative || "", entry.name);
    if (entry.isDirectory()) files = files.concat(collectHtml(full, rel));
    else if (entry.isFile() && entry.name.toLowerCase().endsWith(".html")) files.push(rel);
  }
  return files;
}
function writeSitemap() {
  const sitemapPath = path.join(ROOT, "sitemap.xml");
  const urls = new Set();
  if (fs.existsSync(sitemapPath)) {
    const previous = fs.readFileSync(sitemapPath, "utf8");
    for (const match of previous.matchAll(/<loc>(https:\/\/globaltoolsnow\.com[^<]+)<\/loc>/g)) {
      const url = match[1];
      let pathname;
      try { pathname = new URL(url).pathname; } catch { continue; }
      if (!(pathname.endsWith("/") || pathname.endsWith(".html"))) continue;
      let relative = "";
      try { relative = decodeURIComponent(pathname.replace(/^\//, "")); } catch { continue; }
      if (!relative || pathname.endsWith("/")) relative = path.posix.join(relative, "index.html");
      const target = path.resolve(ROOT, relative);
      if (target.startsWith(ROOT + path.sep) && fs.existsSync(target) && fs.statSync(target).isFile()) urls.add(url);
    }
  }
  for (const file of collectHtml(ROOT, "")) {
    if (file === "404.html" || file.endsWith("/404.html")) continue;
    let url = SITE + "/" + file;
    if (file === "index.html") url = SITE + "/";
    else if (file.endsWith("/index.html")) url = SITE + "/" + file.slice(0, -"index.html".length);
    if (url.endsWith(".html") || url.endsWith("/")) urls.add(url);
  }
  const sorted = Array.from(urls).sort();
  const day = new Date().toISOString().slice(0, 10);
  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    sorted.map(url => "  <url><loc>" + url + "</loc><lastmod>" + day + "</lastmod></url>").join("\n") +
    "\n</urlset>\n";
  fs.writeFileSync(sitemapPath, xml);
  const robotsPath = path.join(ROOT, "robots.txt");
  const existing = fs.existsSync(robotsPath) ? fs.readFileSync(robotsPath, "utf8") : "User-agent: *\nAllow: /\n";
  const withoutSitemap = existing.split(/\r?\n/).filter(line => !/^\s*Sitemap:/i.test(line));
  withoutSitemap.push("Sitemap: " + SITE + "/sitemap.xml");
  fs.writeFileSync(robotsPath, withoutSitemap.join("\n").replace(/\n*$/, "\n"));
  return sorted.length;
}
async function main() {
  const catalog = readJson(KEYWORDS_FILE, { site: SITE, updatedAt: null, keywords: [] });
  if (!Array.isArray(catalog.keywords)) catalog.keywords = [];
  const map = new Map(catalog.keywords.map(item => [normalize(item.keyword), item]));
  const state = readJson(STATE_FILE, { seedIndex: 0, totalRuns: 0, lastRunAt: null, lastError: null });
  const index = Number.isInteger(state.seedIndex) ? state.seedIndex % SEEDS.length : 0;
  const seed = SEEDS[index];
  const now = new Date().toISOString();
  let phrases = [], lastError = null;
  try { phrases = await suggestions(seed); }
  catch (e) { lastError = e.message; console.warn("[seo-robot] suggestions unavailable:", e.message); }
  let added = 0;
  for (const phrase of [seed, ...phrases]) {
    const key = normalize(phrase);
    if (!key || key.length > 180) continue;
    if (map.has(key)) {
      const item = map.get(key);
      item.lastSeenAt = now;
      item.occurrences = (item.occurrences || 1) + 1;
    } else {
      map.set(key, { keyword: phrase, firstSeenAt: now, lastSeenAt: now, occurrences: 1, source: phrase === seed ? "seed" : "google-autocomplete", topic: seed });
      added++;
    }
  }
  catalog.site = SITE;
  catalog.updatedAt = now;
  catalog.keywords = Array.from(map.values()).sort((a, b) => a.keyword.localeCompare(b.keyword));
  writeJson(KEYWORDS_FILE, catalog);
  const sitemapUrlCount = writeSitemap();
  const next = {
    seedIndex: (index + 1) % SEEDS.length, totalRuns: (state.totalRuns || 0) + 1,
    lastRunAt: now, lastError, lastSeed: seed, keywordCount: catalog.keywords.length,
    newKeywordsThisRun: added, suggestionCount: phrases.length, sitemapUrlCount
  };
  writeJson(STATE_FILE, next);
  console.log("[seo-robot] success", JSON.stringify(next));
}
main().catch(error => { console.error("[seo-robot] fatal", error); process.exitCode = 1; });

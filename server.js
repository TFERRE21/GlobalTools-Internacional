const http = require("http");
const https = require("https");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const port = process.env.PORT || 3000;

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
};

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
  if (urlPath === "/") urlPath = "/index.html";

  const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
  const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
  const PRODUCT_CATALOG = {
    "small-business-finance-dashboard": {
      priceId: process.env.STRIPE_PRICE_DASHBOARD || "price_1UPvTOCCSBhBJictDs7UwBww",
      file: "GlobalTools-Small-Business-Finance-Dashboard-PRO.xlsx",
      success: "small-business-finance-dashboard-success.html",
      name: "Small Business Finance Dashboard"
    },
    "cash-flow-planner": {
      priceId: process.env.STRIPE_PRICE_CASHFLOW || "price_1UPvTZCCSBhBJictOMm0VRGq",
      file: "GlobalTools-Cash-Flow-Planner-PRO.xlsx",
      success: "cash-flow-planner-success.html",
      name: "Cash Flow Planner"
    },
    "freelancer-business-kit": {
      priceId: process.env.STRIPE_PRICE_FREELANCER || "price_1UPvTbCCSBhBJictHhQCrOaf",
      file: "GlobalTools-Freelancer-Business-Kit-PRO.xlsx",
      success: "freelancer-business-kit-success.html",
      name: "Freelancer Business Kit"
    }
  };
  const PUBLIC_SITE_URL = (process.env.PUBLIC_SITE_URL || "https://globaltoolsnow.com").replace(/\/$/, "");

  function stripeRequest(method, stripePath, body, callback) {
    if (!STRIPE_SECRET_KEY) return callback(new Error("STRIPE_SECRET_KEY is not configured"));
    const data = body ? Buffer.from(body) : null;
    const req = https.request({
      hostname: "api.stripe.com",
      path: stripePath,
      method,
      headers: {
        "Authorization": "Bearer " + STRIPE_SECRET_KEY,
        "Content-Type": "application/x-www-form-urlencoded",
        ...(data ? {"Content-Length": data.length} : {})
      }
    }, response => {
      let raw = "";
      response.setEncoding("utf8");
      response.on("data", chunk => raw += chunk);
      response.on("end", () => {
        let json = null;
        try { json = JSON.parse(raw); } catch {}
        if (response.statusCode < 200 || response.statusCode >= 300) {
          return callback(new Error((json && json.error && json.error.message) || raw || ("Stripe HTTP " + response.statusCode)));
        }
        callback(null, json);
      });
    });
    req.on("error", callback);
    if (data) req.write(data);
    req.end();
  }

  function readBody(req, callback) {
    let raw = "";
    req.on("data", chunk => {
      raw += chunk;
      if (Buffer.byteLength(raw) > 1024 * 1024) req.destroy();
    });
    req.on("end", () => callback(null, raw));
    req.on("error", callback);
  }

  function siteUrl(req) {
    return PUBLIC_SITE_URL || ("https://" + (req.headers.host || "localhost"));
  }

  // Serve host-aware SEO files so the VPS does not publish the reserved .example domain.
  if (urlPath === "/robots.txt") {
    const base = siteUrl(req);
    res.writeHead(200, {"Content-Type":"text/plain; charset=utf-8","Cache-Control":"no-cache"});
    return res.end("User-agent: *\nAllow: /\nSitemap: " + base + "/sitemap.xml\n");
  }

  if (urlPath === "/sitemap.xml") {
    const base = siteUrl(req).replace(/&/g, "&amp;");
    const pages = [
      "/", "/store.html", "/sobre.html", "/contato.html", "/suporte.html",
      "/privacy.html", "/terms.html", "/refund.html",
      "/products/small-business-finance-dashboard.html",
      "/products/cash-flow-planner.html",
      "/products/freelancer-business-kit.html"
    ];
    try {
      const appSource = fs.readFileSync(path.join(root, "app.js"), "utf8");
      const slugs = Array.from(appSource.matchAll(/\{slug:"([^"]+)",name:/g), match => match[1]);
      slugs.forEach(slug => pages.push("/tools/" + slug + ".html"));
    } catch (err) {
      console.error("[GlobalTools sitemap]", err.message);
    }
    const urls = Array.from(new Set(pages)).map(page => "<url><loc>" + base + page + "</loc></url>").join("");
    const xml = '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + urls + "</urlset>";
    res.writeHead(200, {"Content-Type":"application/xml; charset=utf-8","Cache-Control":"no-cache"});
    return res.end(xml);
  }

  function formEncode(value) {
    return encodeURIComponent(value).replace(/%20/g, "+");
  }

  function verifyStripeSignature(rawBody, signature) {
    if (!STRIPE_WEBHOOK_SECRET || !signature) return false;
    const parts = String(signature).split(",").reduce((acc, part) => {
      const [key, value] = part.split("=", 2);
      if (key && value) acc[key] = acc[key] || [];
      if (key && value) acc[key].push(value);
      return acc;
    }, {});
    const timestamp = parts.t && parts.t[0];
    const signatures = parts.v1 || [];
    if (!timestamp || !signatures.length) return false;
    if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
    const signed = timestamp + "." + rawBody;
    const expected = crypto.createHmac("sha256", STRIPE_WEBHOOK_SECRET).update(signed).digest("hex");
    return signatures.some(sig => {
      try { return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig)); }
      catch { return false; }
    });
  }

  if (urlPath === "/api/support/chat" && req.method === "POST") {
    return readBody(req, async (bodyErr, rawBody) => {
      let payload = {};
      try { payload = rawBody ? JSON.parse(rawBody) : {}; } catch {}
      const message = String(payload.message || "").trim().slice(0, 1000);
      const messages = Array.isArray(payload.messages) ? payload.messages.slice(-12).map(m => ({
        role: m && m.role === "assistant" ? "assistant" : "user",
        content: String((m && m.content) || "").slice(0, 1200)
      })) : [];
      if (!message) {
        res.writeHead(400, {"Content-Type":"application/json; charset=utf-8"});
        return res.end(JSON.stringify({error:"Message is required."}));
      }
      const fallback = () => {
        const q = message.toLowerCase();
        if (q.includes("compr") || q.includes("buy") || q.includes("produto") || q.includes("purchase")) return "You can open the Store and choose a product. Checkout is handled securely by Stripe. After confirmed payment, the PRO Excel download is available on the success page.";
        if (q.includes("download") || q.includes("baix") || q.includes("arquivo")) return "If you already paid and the download failed, open a support ticket and include the product name and the email used at checkout. Never send card details.";
        if (q.includes("pagamento") || q.includes("payment") || q.includes("stripe")) return "Payments are processed by Stripe. GlobalTools does not receive or store your full card number. If payment was completed but the product was not delivered, open a support ticket.";
        if (q.includes("ferramenta") || q.includes("tool") || q.includes("erro") || q.includes("problem")) return "Tell me the name of the tool, what you were trying to do, your browser and what happened. You can also open a support ticket for follow-up.";
        return "I can help with GlobalTools tools, purchases, payments and digital product downloads. If you need a person to follow up, use “Open a support ticket”.";
      };
      if (!process.env.OPENAI_API_KEY) {
        res.writeHead(200, {"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"});
        return res.end(JSON.stringify({ok:true,resposta:fallback()}));
      }
      const inputMessages = [
        {role:"system",content:"You are the GlobalTools customer support assistant. Answer in the user's language. Be concise, friendly and practical. Help with free tools, digital products, Stripe checkout, Excel downloads and support tickets. Never ask for or request card numbers, passwords, API keys or other secrets. If a problem requires human follow-up, tell the user to open a support ticket. Do not invent refunds, purchases, account data or technical actions."},
        ...messages,
        {role:"user",content:message}
      ];
      const body = JSON.stringify({model:process.env.OPENAI_MODEL || "gpt-4o-mini",messages:inputMessages,temperature:0.2,max_tokens:350});
      const aiReq=https.request({hostname:"api.openai.com",path:"/v1/chat/completions",method:"POST",headers:{"Authorization":"Bearer "+process.env.OPENAI_API_KEY,"Content-Type":"application/json","Content-Length":Buffer.byteLength(body)}},aiRes=>{
        let raw="";aiRes.on("data",x=>raw+=x);aiRes.on("end",()=>{
          try{const j=JSON.parse(raw);const text=j&&j.choices&&j.choices[0]&&j.choices[0].message&&j.choices[0].message.content;if(aiRes.statusCode>=200&&aiRes.statusCode<300&&text){res.writeHead(200,{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"});return res.end(JSON.stringify({ok:true,resposta:text.trim()}));}}catch{}
          res.writeHead(200,{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"});res.end(JSON.stringify({ok:true,resposta:fallback()}));
        });
      });
      aiReq.on("error",()=>{res.writeHead(200,{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"});res.end(JSON.stringify({ok:true,resposta:fallback()}));});
      aiReq.write(body);aiReq.end();
    });
  }

  if (urlPath === "/api/support/ticket" && req.method === "POST") {
    return readBody(req, (bodyErr, rawBody) => {
      if (bodyErr) {
        res.writeHead(400, {"Content-Type":"application/json; charset=utf-8", "Cache-Control":"no-store"});
        return res.end(JSON.stringify({ok:false,error:"Could not read the request."}));
      }
      let payload = {};
      try { payload = rawBody ? JSON.parse(rawBody) : {}; } catch {}
      const name=String(payload.name||"").trim().slice(0,120);
      const email=String(payload.email||"").trim().slice(0,180);
      const priority=String(payload.priority||"normal").trim().slice(0,20);
      const message=String(payload.message||"").trim().slice(0,3000);
      const page=String(payload.page||"").slice(0,500);
      const honeypot=String(payload.company||"").trim();
      if (honeypot) {
        res.writeHead(400, {"Content-Type":"application/json; charset=utf-8", "Cache-Control":"no-store"});
        return res.end(JSON.stringify({ok:false,error:"Invalid submission."}));
      }
      if(!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !message){
        res.writeHead(400,{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"});
        return res.end(JSON.stringify({ok:false,error:"Name, a valid email and a message are required."}));
      }
      const ticketId="GT-"+Date.now().toString(36).toUpperCase()+"-"+crypto.randomBytes(2).toString("hex").toUpperCase();
      const dir=process.env.GLOBALTOOLS_DATA_DIR || process.env.DATA_DIR || path.join(root,"data");
      const ticketFile=path.join(dir,"support-tickets.json");
      try{
        fs.mkdirSync(dir,{recursive:true});
        let tickets=[];
        if(fs.existsSync(ticketFile)){
          const existing=JSON.parse(fs.readFileSync(ticketFile,"utf8"));
          if(Array.isArray(existing)) tickets=existing;
        }
        tickets.push({ticketId,createdAt:new Date().toISOString(),status:"open",name,email,priority,message,page});
        fs.writeFileSync(ticketFile,JSON.stringify(tickets,null,2),"utf8");
      }catch(e){
        console.error("[support] ticket storage error",e.message);
        res.writeHead(500,{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"});
        return res.end(JSON.stringify({ok:false,error:"We could not save your message. Please try again later."}));
      }
      console.log("[support] ticket received",ticketId,priority);
      res.writeHead(200,{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"});
      res.end(JSON.stringify({ok:true,ticketId}));
    });
  }

  if (urlPath === "/api/create-checkout-session" && req.method === "POST") {
    return readBody(req, (bodyErr, rawBody) => {
      let payload = {};
      try { payload = rawBody ? JSON.parse(rawBody) : {}; } catch {}
      const slug = String(payload.product_slug || "small-business-finance-dashboard");
      const product = PRODUCT_CATALOG[slug];
      if (!product) {
        res.writeHead(400, {"Content-Type":"application/json; charset=utf-8"});
        return res.end(JSON.stringify({error:"Unknown product."}));
      }
      const success = siteUrl(req) + "/account-success.html?session_id={CHECKOUT_SESSION_ID}";
      const cancel = siteUrl(req) + "/products/" + slug + ".html?checkout=cancelled";
      const body = [
        "mode=payment",
        "locale=en-US",
        "line_items[0][price]=" + formEncode(product.priceId),
        "line_items[0][quantity]=1",
        "success_url=" + formEncode(success),
        "cancel_url=" + formEncode(cancel),
        "metadata[product_slug]=" + formEncode(slug)
      ].join("&");
      return stripeRequest("POST", "/v1/checkout/sessions", body, (err, session) => {
        if (err) {
          res.writeHead(500, {"Content-Type":"application/json; charset=utf-8"});
          return res.end(JSON.stringify({error:"Unable to start checkout.", detail:err.message}));
        }
        res.writeHead(200, {"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"});
        res.end(JSON.stringify({url:session.url}));
      });
    });
  }

  if (urlPath === "/api/download-finance" && req.method === "GET") {
    const query = new URL(req.url, "http://" + (req.headers.host || "localhost")).searchParams;
    const sessionId = query.get("session_id");
    if (!sessionId || !/^cs_[A-Za-z0-9_]+$/.test(sessionId)) {
      res.writeHead(400, {"Content-Type":"text/plain; charset=utf-8"});
      return res.end("Invalid checkout session.");
    }
    return stripeRequest("GET", "/v1/checkout/sessions/" + encodeURIComponent(sessionId), null, (err, session) => {
      const slug = session && session.metadata && session.metadata.product_slug;
      const product = slug && PRODUCT_CATALOG[slug];
      const valid = !err && session && session.payment_status === "paid" && !!product;
      if (!valid) {
        res.writeHead(403, {"Content-Type":"text/plain; charset=utf-8","Cache-Control":"no-store"});
        return res.end("Payment not confirmed.");
      }
      const filePath = path.join(root, "products", product.file);
      if (!fs.existsSync(filePath)) {
        res.writeHead(503, {"Content-Type":"text/plain; charset=utf-8","Cache-Control":"no-store"});
        return res.end("The PRO workbook is still being prepared. Please try again in a moment.");
      }
      const data = fs.readFileSync(filePath);
      res.writeHead(200, {
        "Content-Type":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition":"attachment; filename=\"" + product.file + "\"",
        "Content-Length":data.length,
        "Cache-Control":"private, no-store"
      });
      res.end(data);
    });
  }

  if (urlPath === "/api/stripe-webhook" && req.method === "POST") {
    return readBody(req, (bodyErr, rawBody) => {
      if (bodyErr || !verifyStripeSignature(rawBody, req.headers["stripe-signature"])) {
        res.writeHead(400, {"Content-Type":"text/plain; charset=utf-8"});
        return res.end("Invalid Stripe webhook signature.");
      }
      let event;
      try { event = JSON.parse(rawBody); } catch {
        res.writeHead(400, {"Content-Type":"text/plain; charset=utf-8"});
        return res.end("Invalid JSON.");
      }
      if (event.type === "checkout.session.completed") {
        const session = event.data && event.data.object;
        console.log("[stripe] checkout.session.completed", session && session.id, session && session.payment_status, session && session.metadata && session.metadata.product_slug);
      }
      res.writeHead(200, {"Content-Type":"application/json; charset=utf-8"});
      res.end(JSON.stringify({received:true}));
    });
  }
  if (urlPath === "/ads.txt" || urlPath === "/ads.txt/") {
    const adsFile = path.join(root, "ads.txt");
    let body;
    try {
      body = fs.readFileSync(adsFile, "utf8");
    } catch (err) {
      console.error("[GlobalTools ads.txt] Cannot read ads.txt:", err.message);
      res.writeHead(500, {"Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store"});
      return res.end("ads.txt is not available.");
    }
    if (!body.endsWith("\n")) body += "\n";
    res.writeHead(200, {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Length": Buffer.byteLength(body),
      "Cache-Control": "public, max-age=300",
      "X-Content-Type-Options": "nosniff",
      "Access-Control-Allow-Origin": "*"
    });
    return res.end(body);
  }

  // Accept clean URLs without .html and redirect them to the canonical .html URL.
  // This prevents 404s when users or search tools omit the file extension.
  const cleanToolMatch = urlPath.match(/^\/tools\/([a-z0-9-]+)\/?$/i);
  if (cleanToolMatch) {
    const target = "/tools/" + cleanToolMatch[1] + ".html";
    res.writeHead(301, {"Location": target, "Cache-Control": "no-cache"});
    return res.end();
  }
  if (urlPath === "/privacy" || urlPath === "/privacy/") {
    res.writeHead(301, {"Location": "/privacy.html", "Cache-Control": "no-cache"});
    return res.end();
  }
  if (urlPath === "/sobre" || urlPath === "/sobre/") { res.writeHead(301, {"Location": "/sobre.html", "Cache-Control": "no-cache"}); return res.end(); }
  if (urlPath === "/contato" || urlPath === "/contato/") { res.writeHead(301, {"Location": "/contato.html", "Cache-Control": "no-cache"}); return res.end(); }
  if (urlPath === "/terms" || urlPath === "/terms/") {
    res.writeHead(301, {"Location": "/terms.html", "Cache-Control": "no-cache"});
    return res.end();
  }


  // Server-side tool pages: useful explanatory content is rendered in the HTML
  // so users and search engines do not depend on client-side JavaScript.
  const toolMatch = urlPath.match(/^\/tools\/([a-z0-9-]+)\.html$/i);
  if (toolMatch) {
    const slug = toolMatch[1];
    const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
    const match = app.match(new RegExp('\\{slug:"'+slug+'",name:"([^"]+)",desc:"([^"]+)"'));
    if (match) {
      const name = match[1], desc = match[2];
      const safe = v => String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
      const allTools = [...app.matchAll(/\{slug:"([^"]+)",name:"([^"]+)",desc:"([^"]+)",cat:"([^"]+)"\}/g)].map(m => ({slug:m[1],name:m[2],desc:m[3],cat:m[4]}));
      const current = allTools.find(t => t.slug === slug) || {slug,name,desc,cat:"tools"};
      const related = allTools.filter(t => t.slug !== slug && t.cat === current.cat).slice(0,6);
      const relatedHtml = related.map(t => '<a class="related-tool" href="/tools/'+t.slug+'.html"><strong>'+safe(t.name)+'</strong><span>'+safe(t.desc)+'</span></a>').join('');

      const groups = {
        text:["This tool helps you inspect, clean or transform text for a specific task.","Paste or type a short sample into the input field.","Review the options and confirm the desired output.","Run the tool and copy or download the result.","Line breaks, whitespace, punctuation and the language of the input can affect the result."],
        developer:["This developer utility helps with a common data or code task, such as formatting, validation, encoding or transformation.","Paste a small sample of code or data into the input field.","Run the tool and compare the result with the original sample.","Review the output before using it in a live application.","Never paste private keys, production credentials, passwords or access tokens into a tool unless you fully understand the processing path."],
        pdf:["This PDF utility is designed for a particular document workflow, such as converting, organizing or inspecting PDF files.","Choose compatible PDF files and review any available instructions.","Start with a small, non-sensitive sample to check the output.","Open the generated file and confirm that the result is complete and readable.","Scanned pages, complex layouts, embedded fonts, images and encryption can affect what a browser-based conversion can preserve."],
        documents:["This document utility helps convert or organize office documents and structured data.","Choose a supported document or enter the requested data.","Check the supported file types and the output format.","Run the conversion and open the result to verify it before sharing.","Complex formatting, charts, formulas, macros and embedded objects may not be preserved by lightweight browser conversions."],
        image:["This image utility helps convert, inspect, resize or compress image files.","Select a supported image and review the available settings.","Try a copy of the original file when quality matters.","Run the operation and check the dimensions, format and output quality.","Lossy compression and format conversion can change visual quality, transparency or metadata."],
        generators:["This generator creates a result from the values or options you provide.","Set the requested options or enter a short prompt.","Generate a result and review it before using it.","Copy or download the result if it meets your needs.","Generated values are not a substitute for professional review where correctness, privacy or security matters."],
        converters:["This converter changes a value or file from one supported format to another.","Enter a value or choose a supported source file.","Confirm the intended output format and any formatting assumptions.","Run the conversion and compare the result with the original.","Conversions can depend on encoding, locale, date formats, precision and features supported by the source and target formats."],
        calculators:["This calculator performs a defined mathematical operation using the values you enter.","Enter the requested values using the indicated units and separators.","Check the formula, units and assumptions used by the calculation.","Run the calculation and review the result before relying on it.","For financial, legal, tax or other consequential decisions, verify the result with an appropriately qualified source."],
        "date-time":["This date and time utility calculates or interprets dates, times, intervals or timestamps.","Enter the requested date or time in the indicated format.","Check the timezone and the format expected by the tool.","Run the calculation and compare the result with your intended timezone or calendar.","Timezone rules, daylight-saving changes and differences between date formats can affect results."],
        security:["This utility performs a security-related operation such as analysis, hashing, encoding or decoding.","Use sample or non-sensitive data whenever possible.","Run the operation and read the result carefully.","Confirm the meaning and limitations of the output before making a security decision.","Decoding or analyzing data does not by itself verify authenticity, trustworthiness or security."]
      };

      const special = {
        "word-counter":["The Word Counter reports word, character, sentence and paragraph counts for text you provide.","Paste a paragraph to compare the word count with the character count, including and excluding spaces.","Counts can vary slightly for hyphenated words, abbreviations and languages that do not separate words with spaces."],
        "character-counter":["The Character Counter measures total characters and characters without whitespace.","Paste a draft to see how many characters it uses before submitting it to a form or platform.","Different services can count line endings, emoji and Unicode characters differently, so compare with the destination platform when strict limits apply."],
        "word-to-pdf":["Convert a supported Word document into a downloadable PDF directly in your browser.","Choose a DOCX file, run the conversion and open the PDF that is generated.","This lightweight conversion extracts document text and creates a simple PDF; it does not guarantee that the original page layout, images, tables or advanced formatting will be preserved."],
        "pdf-to-word":["Extract text from a PDF and package the result in an editable Word DOCX file.","Choose a text-based PDF and download the generated DOCX file after conversion.","The tool focuses on extracting readable text. Columns, page layout, images and tables may not match the original, and scanned PDFs may require OCR."],
        "word-to-text":["Extract text from a compatible Word document for reuse or review.","Choose a DOCX file and run the tool to view the extracted text.","The result removes most visual formatting and may not include content stored only in images or unsupported embedded objects."],
        "compress-pdf":["This tool re-saves a PDF using a browser-based PDF library. It is a lightweight optimization attempt, not a guarantee of smaller files.","Compare the downloaded PDF size with the original. Image-heavy PDFs may remain almost the same size.","The current method does not downsample images or perform full raster-based compression, so some files may not get smaller. Keep the original if file size or visual quality is critical."],
        "merge-pdf":["Combine two or more PDF files into a single PDF in the order you select them.","Choose at least two PDF files, run the tool and open the merged document to check page order.","The tool copies pages without redesigning them. Password-protected, damaged or unusually complex PDFs may fail to load."],
        "split-pdf":["Split a PDF into separate one-page PDF files delivered in a ZIP archive.","Select a PDF, run the operation and extract the ZIP to access each page separately.","The current tool creates one output PDF per page rather than letting you select arbitrary page ranges."],
        "jpg-to-pdf":["Turn a supported image file into a PDF document for printing or sharing.","Choose a JPG or another supported image, run the conversion and inspect the page dimensions.","Image-to-PDF conversion places the image on a PDF page; it does not perform OCR or make text within a picture editable."],
        "pdf-to-jpg":["Render PDF pages as JPG images for preview, sharing or use in other documents.","Choose a PDF and download the image output produced by the tool.","Text can become less crisp at low rendering resolutions, and large multi-page PDFs may require more browser memory."],
        "excel-to-pdf":["Prepare spreadsheet data as a PDF-style document for sharing or printing.","Choose a supported spreadsheet and review the generated output before sending it.","Spreadsheet conversion may not preserve formulas, charts, print areas, page breaks or complex formatting exactly as desktop Excel does."],
        "json-formatter":["Validate JSON syntax and format the data with readable indentation.","Paste a JSON object or array and run the formatter to see structured output.","The tool validates JSON syntax; it does not validate your data against a business schema or API contract."],
        "base64-encoder":["Encode text as Base64 for systems that require this representation.","Paste the text you want to encode and run the operation.","Base64 is an encoding format, not encryption. Do not use it to protect passwords or confidential data."],
        "base64-decoder":["Decode a valid Base64 string into text when the content uses a compatible text encoding.","Paste a Base64 string and run the decoder to inspect the output.","Binary data, malformed input or a different character encoding may not produce readable text. Decoding does not make data safe."],
        "image-compressor":["Reduce an image file's size by re-encoding it in the browser with the available image settings.","Choose an image, adjust the quality if an option is available and compare the output with the original.","Compression quality depends on the file format and image content. Keep the original and inspect small text, transparency and image details."],
        "qr-code-generator":["Create a QR code from text or a URL so another device can scan it.","Enter a complete URL such as https://globaltoolsnow.com/ or a short text message and generate the code.","The QR image is generated through an external QR service. Do not include passwords, private data, payment details or confidential URLs in the content."],
        "percentage-calculator":["Calculate a percentage of a value using the standard formula: value × percentage ÷ 100.","For example, 15% of 200 is 30 because 200 × 15 ÷ 100 = 30.","Make sure you know which value is the base and whether you need a percentage amount, a percentage change or a final value after a change."],
        "discount-calculator":["Calculate a discount amount and the resulting price from an original price and a discount rate.","For example, a 15% discount on $200 is $30, giving a before-tax price of $170.","Taxes, shipping, coupons and store rules may change the amount charged at checkout."],
        "age-calculator":["Calculate age in completed years from a date of birth and the current date on your device.","If a person was born on 10 December and today is 1 October of the same numbered year, their birthday has not occurred yet for that year.","Official, legal or medical contexts can use specific date-counting rules; verify those requirements when relevant."],
        "password-generator":["Generate a random password using a mixture of letters, numbers and symbols supported by the tool.","Generate a password, review its length and use a different password for each service.","Store generated passwords in a trusted password manager and enable multi-factor authentication where possible."],
        "jwt-decoder":["Display the header and payload sections of a JSON Web Token for inspection.","Paste a test JWT and review the decoded header and claims.","Decoding does not verify a signature or prove that a token is valid. Never paste a live access token or secret token into an untrusted environment."],
        "hash-generator":["Calculate a SHA-256 hash from the text entered in the tool.","Enter a sample phrase and compare its hexadecimal digest with another SHA-256 implementation.","A hash is not reversible encryption and SHA-256 alone is not an appropriate password-storage scheme."],
      };
      const g=groups[current.cat]||["This tool provides a focused utility for a common digital task.","Enter the requested information or select a supported file.","Run the operation and review the result.","Copy or download the output if it meets your needs.","Output can depend on browser support, input format, library behavior or external services."];
      const sp=special[slug];
      const purpose=sp?sp[0]:g[0], example=sp?sp[1]:"Start with a short, non-sensitive sample to check the result before processing important content.", notes=sp?sp[2]:g[4];
      const steps = [g[1],g[2],g[3]].map((x,i)=>'<li>'+safe(x)+'</li>').join('');
      const faq=[
         ["What is "+name+"?",desc+" This online tool helps you complete the task without installing separate software."],
         ["How do I use "+name+"?","Enter the requested data or select a supported file, run the tool, and check the result before using it."],
         ["Do I need to create an account?","No. The core GlobalTools tools are designed to work without an account."],
         ["Is my data uploaded to the server?","When local processing is supported, the task runs in your browser. Some tools load external libraries or send the input needed for an external service; review the tool-specific notes before submitting sensitive data."]
       ];
      const faqHtml=faq.map(x=>'<div><h3>'+safe(x[0])+'</h3><p>'+safe(x[1])+'</p></div>').join('');
      const faqSchema=JSON.stringify({"@context":"https://schema.org","@type":"FAQPage","mainEntity":faq.map(x=>({"@type":"Question","name":x[0],"acceptedAnswer":{"@type":"Answer","text":x[1]}}))}).replace(/</g,'\\u003c');
      const appSchema=JSON.stringify({"@context":"https://schema.org","@type":"WebApplication","name":name+" — GlobalTools","applicationCategory":"UtilitiesApplication","operatingSystem":"Web Browser","description":desc,"url":siteUrl(req)+"/tools/"+slug+".html","isAccessibleForFree":true,"publisher":{"@type":"Organization","name":"GlobalTools","url":siteUrl(req)+"/"},"offers":{"@type":"Offer","price":"0","priceCurrency":"USD"}}).replace(/</g,'\\u003c');
      const pageUrl=siteUrl(req)+"/tools/"+slug+".html";
      const html=[
        '<!doctype html><html lang="en-US"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">',
        '<title>'+safe(name)+' — Free Online Tool | GlobalTools</title>',
        '<meta name="description" content="'+safe(desc)+' Learn how to use the tool, review examples, and understand its limitations with GlobalTools.">',
        '<meta name="robots" content="index,follow"><link rel="canonical" href="'+pageUrl+'">',
        '<meta property="og:type" content="website"><meta property="og:title" content="'+safe(name)+' — GlobalTools"><meta property="og:description" content="'+safe(desc)+'"><meta property="og:url" content="'+pageUrl+'"><meta property="og:site_name" content="GlobalTools"><meta name="twitter:card" content="summary">',
        '<script type="application/ld+json">'+appSchema+'</script><script type="application/ld+json">'+faqSchema+'</script>',
        '<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6472882150880001" crossorigin="anonymous"></script>',
        '<script async src="https://www.googletagmanager.com/gtag/js?id=G-061NQ52GBQ"></script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag("js",new Date());gtag("config","G-061NQ52GBQ");</script>',
        '<link rel="stylesheet" href="/styles.css?v=20261013-03"><script defer src="/app.js?v=20261013-03"></script><!-- Google Ads tag --><script async src="https://www.googletagmanager.com/gtag/js?id=AW-17240722145"></script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag("js",new Date());gtag("config","AW-17240722145");</script></head>',
        '<body><header class="site-header"><a class="brand" href="/"><span class="brand-mark">G</span>GlobalTools</a><nav class="main-nav"><a href="/">Tools</a><a href="/#categories">Categories</a><a href="/sobre.html">About</a><a href="/contato.html">Contact</a><a href="/privacy.html">Privacy</a><label class="language-switcher"><span>🌐</span><select id="languageSelect"><option value="en" selected>English</option><option value="pt">Português</option><option value="es">Español</option><option value="fr">Français</option></select></label></nav></header>',
        '<main class="tool-page"><div class="breadcrumbs"><a href="/">Home</a> / '+safe(name)+'</div><section class="tool-hero"><div class="tool-kicker">GLOBALTOOLS • ONLINE TOOL</div><h1>'+safe(name)+'</h1><p class="intro">'+safe(desc)+'</p></section>',
        '<div class="tool-workspace"><div id="tool" class="tool-box"><div id="dropZone" class="upload-visual file-upload-visual"><div class="upload-icon">↥</div><h2>Select files</h2><p>or drag and drop files here</p></div><textarea id="input" aria-label="'+safe(name)+'" placeholder="Enter or paste your data..."></textarea><button id="action" class="btn primary-action">Run tool</button><div id="result" class="result">Your result will appear here.</div></div>',
        '<aside class="tool-side"><div class="side-card"><strong>Private when possible</strong><p>Processing happens in your browser whenever the technology allows.</p></div><div class="side-card"><strong>Free to use</strong><p>The core tools do not require an account.</p></div><div class="side-card"><strong>Clear guidance</strong><p>Review examples and limitations before using the result for an important task.</p></div></aside></div>',
        '<section class="info"><h2>About '+safe(name)+'</h2><p>'+safe(purpose)+'</p><h2>How to use</h2><ol>'+steps+'</ol><h2>Practical example</h2><p>'+safe(example)+'</p><h2>Limitations and precautions</h2><p>'+safe(notes)+'</p><h2>Frequently asked questions</h2><div class="faq">'+faqHtml+'</div>',
        related.length?'<h2>Related tools</h2><div class="related-tools">'+relatedHtml+'</div>':'',
        '<h2>Privacy and processing</h2><p>GlobalTools prioritizes in-browser processing whenever technically possible. For details about cookies, advertising, analytics and external services, read our <a href="/privacy.html">Privacy Policy</a>. For questions or bug reports, use the <a href="/contato.html">contact page</a>.</p></section></main>',
        '<footer class="site-footer"><div><div class="brand"><span class="brand-mark">G</span>GlobalTools</div><p>Free online tools for everyone.</p></div><div class="footer-links"><a href="/sobre.html">About</a><a href="/contato.html">Contact</a><a href="/privacy.html">Privacy</a><a href="/terms.html">Terms</a></div></footer><script src="/support.js?v=20261013-03"></script></body></html>'
      ].join('');
      res.writeHead(200, {"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-cache, no-store, must-revalidate"});
      return res.end(html);
    }
  }

  const filePath = path.join(root, urlPath);
  if (!filePath.startsWith(root) || !fs.existsSync(filePath)) {
    res.writeHead(404, {"Content-Type": "text/plain; charset=utf-8"});
    return res.end("Not found");
  }

  const stat = fs.statSync(filePath);
  if (stat.isDirectory()) urlPath += "/index.html";

  const finalPath = path.join(root, urlPath);
  if (!fs.existsSync(finalPath)) {
    res.writeHead(404, {"Content-Type": "text/plain; charset=utf-8"});
    return res.end("Not found");
  }

  const ext = path.extname(finalPath).toLowerCase();
  if (ext === ".html") {
    let html = fs.readFileSync(finalPath, "utf8");
    html = html.replaceAll("G-DM7CKZRD30", "G-061NQ52GBQ");
    html = html.replaceAll("https://globaltools-international.example", siteUrl(req));
    const noAdsPage = urlPath === "/login.html" ||
      urlPath === "/account.html" ||
      urlPath === "/account-success.html" ||
      /\/products\/[^/]+-success\.html$/i.test(urlPath);
    if (noAdsPage) {
      html = html.replace(/<script\b[^>]*src=["']https:\/\/pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js[^"']*["'][^>]*>\s*<\/script>/gi, "");
      if (!/<meta\s+name=["']robots["'][^>]*noindex/i.test(html)) {
        html = html.replace(/<head>/i, '<head><meta name="robots" content="noindex,nofollow">');
      }
    } else if (!html.includes("pagead2.googlesyndication.com/pagead/js/adsbygoogle.js")) {
      html = html.replace(/<head>/i, '<head><script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6472882150880001" crossorigin="anonymous"></script>');
    }
    html = html.replace(/\/styles\.css\?v=[^"'\\s]+/g, "/styles.css?v=20261013-03")
      .replace(/\/app\.js\?v=[^"'\\s]+/g, "/app.js?v=20261013-03")
      .replace(/\/language\.js\?v=[^"'\\s]+/g, "/language.js?v=20261013-03")
      .replace(/\/support\.js\?v=[^"'\\s]+/g, "/support.js?v=20261013-03");
    if (!html.includes("G-061NQ52GBQ")) html = html.replace(/<head>/i, `<head><script async src="https://www.googletagmanager.com/gtag/js?id=G-061NQ52GBQ"></script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag("js",new Date());gtag("config","G-061NQ52GBQ");</script>`);
    if (!html.includes("/language.js")) html = html.replace(/<\/head>/i, `<script defer src="/language.js?v=20261013-03"></script></head>`);
    if (!html.includes("/support.js")) html = html.replace(/<\/body>/i, `<script defer src="/support.js?v=20261013-03"></script></body>`);
    res.writeHead(200, {"Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache, no-store, must-revalidate"});
    return res.end(html);
  }
  res.writeHead(200, {
    "Content-Type": types[ext] || "application/octet-stream",
    "Cache-Control": ext === ".html" || ext === ".js" || ext === ".css" ? "no-cache, no-store, must-revalidate" : "public, max-age=86400"
  });
  fs.createReadStream(finalPath).pipe(res);
});

server.listen(port, "0.0.0.0", () => {
  console.log("GlobalTools running on port " + port);
});

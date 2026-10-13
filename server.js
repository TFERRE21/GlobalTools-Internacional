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

const LOCALIZED_TOOL_COPY = {"pt":{"word-to-pdf":{"name":"Word para PDF","desc":"Converta documentos DOCX do Word em arquivos PDF simples para compartilhar ou imprimir.","purpose":"Esta ferramenta extrai o texto de um documento DOCX e cria um PDF básico diretamente no navegador.","example":"Selecione um arquivo DOCX com texto simples, execute a conversão e abra o PDF baixado para conferir o resultado.","notes":"Esta versão prioriza o texto. Não garante preservar imagens, tabelas, colunas, cabeçalhos ou a formatação avançada do documento original."},"pdf-to-word":{"name":"PDF para Word","desc":"Extraia texto de um PDF e gere um documento Word editável no formato DOCX.","purpose":"A ferramenta extrai o texto legível de um PDF e o organiza em um arquivo DOCX que pode ser editado no Word.","example":"Escolha um PDF com texto selecionável, execute a conversão e abra o DOCX para revisar o texto extraído.","notes":"O resultado prioriza o texto, não a reprodução exata do layout. Colunas, imagens, tabelas e formatação complexa podem mudar. PDFs digitalizados podem depender de OCR."},"compress-pdf":{"name":"Comprimir PDF","desc":"Tente reduzir o tamanho de um PDF usando uma otimização simples no navegador.","purpose":"A ferramenta salva novamente o PDF usando uma biblioteca JavaScript. É uma tentativa leve de otimização, não uma promessa de compressão.","example":"Compare o tamanho do arquivo original com o arquivo baixado e confira se a qualidade das páginas continua adequada.","notes":"O método atual não reduz a resolução de imagens nem executa compressão avançada. Alguns arquivos podem ficar do mesmo tamanho ou maiores."},"merge-pdf":{"name":"Juntar PDFs","desc":"Combine dois ou mais arquivos PDF em um único documento, mantendo a ordem dos arquivos selecionados.","purpose":"A ferramenta copia as páginas dos PDFs escolhidos para um novo documento.","example":"Selecione dois PDFs, coloque-os na ordem desejada, execute a ferramenta e confira a sequência das páginas.","notes":"Arquivos protegidos por senha, danificados ou com recursos incomuns podem não ser processados. As páginas são combinadas sem redesenhar o conteúdo."},"jpg-to-pdf":{"name":"JPG para PDF","desc":"Transforme uma imagem JPG ou compatível em um documento PDF para compartilhar ou imprimir.","purpose":"A ferramenta coloca uma imagem selecionada em uma página de PDF.","example":"Escolha uma imagem, gere o PDF e confira as dimensões da página antes de imprimir ou enviar.","notes":"A conversão não reconhece texto dentro da imagem e não cria conteúdo editável. Verifique orientação, dimensões e qualidade do arquivo final."},"pdf-to-jpg":{"name":"PDF para JPG","desc":"Converta páginas de um PDF em imagens JPG para visualizar e compartilhar.","purpose":"A ferramenta renderiza páginas do PDF como imagens que podem ser baixadas.","example":"Selecione um PDF e abra a imagem gerada para conferir a resolução e a legibilidade do conteúdo.","notes":"Textos podem perder nitidez em resoluções baixas. PDFs grandes ou com muitas páginas podem consumir bastante memória do navegador."},"word-counter":{"name":"Contador de palavras","desc":"Conte palavras, caracteres, frases e parágrafos de um texto diretamente no navegador.","purpose":"O contador apresenta medidas básicas do texto, incluindo caracteres com e sem espaços.","example":"Cole um parágrafo e compare a contagem de palavras com o total de caracteres antes de enviar um texto a uma plataforma.","notes":"Plataformas diferentes podem contar emojis, quebras de linha, abreviações e palavras com hífen de maneiras diferentes."},"image-compressor":{"name":"Compressor de imagens","desc":"Reduza o tamanho de arquivos de imagem no navegador para facilitar o envio e o compartilhamento.","purpose":"A ferramenta reprocessa uma imagem para tentar diminuir o tamanho do arquivo.","example":"Selecione uma cópia da imagem original, gere a versão comprimida e compare o tamanho e a qualidade visual.","notes":"O resultado depende do formato e do conteúdo da imagem. Confira transparência, textos pequenos e detalhes antes de substituir o original."}},"es":{"word-to-pdf":{"name":"Word a PDF","desc":"Convierte documentos DOCX de Word en archivos PDF sencillos para compartir o imprimir.","purpose":"Esta herramienta extrae el texto de un documento DOCX y crea un PDF básico directamente en el navegador.","example":"Selecciona un archivo DOCX con texto sencillo, ejecuta la conversión y abre el PDF descargado para revisar el resultado.","notes":"Esta versión prioriza el texto. No garantiza conservar imágenes, tablas, columnas, encabezados ni el formato avanzado del documento original."},"pdf-to-word":{"name":"PDF a Word","desc":"Extrae texto de un PDF y genera un documento Word editable en formato DOCX.","purpose":"La herramienta extrae el texto legible de un PDF y lo organiza en un archivo DOCX editable en Word.","example":"Elige un PDF con texto seleccionable, ejecuta la conversión y abre el DOCX para revisar el texto extraído.","notes":"El resultado prioriza el texto, no la reproducción exacta del diseño. Las columnas, imágenes, tablas y el formato complejo pueden cambiar. Los PDF escaneados pueden necesitar OCR."},"compress-pdf":{"name":"Comprimir PDF","desc":"Intenta reducir el tamaño de un PDF mediante una optimización sencilla en el navegador.","purpose":"La herramienta vuelve a guardar el PDF mediante una biblioteca JavaScript. Es un intento de optimización ligera, no una promesa de compresión.","example":"Compara el tamaño del archivo original con el archivo descargado y comprueba que la calidad de las páginas siga siendo adecuada.","notes":"El método actual no reduce la resolución de las imágenes ni aplica compresión avanzada. Algunos archivos pueden quedar igual o incluso aumentar de tamaño."},"merge-pdf":{"name":"Unir PDF","desc":"Combina dos o más archivos PDF en un solo documento, respetando el orden de los archivos seleccionados.","purpose":"La herramienta copia las páginas de los PDF elegidos en un documento nuevo.","example":"Selecciona dos PDF, colócalos en el orden deseado, ejecuta la herramienta y revisa la secuencia de páginas.","notes":"Los archivos protegidos con contraseña, dañados o con funciones poco comunes pueden no procesarse. Las páginas se combinan sin rediseñar su contenido."},"jpg-to-pdf":{"name":"JPG a PDF","desc":"Convierte una imagen JPG o compatible en un documento PDF para compartir o imprimir.","purpose":"La herramienta coloca una imagen seleccionada en una página PDF.","example":"Elige una imagen, genera el PDF y revisa las dimensiones de la página antes de imprimirlo o enviarlo.","notes":"La conversión no reconoce texto dentro de la imagen ni crea texto editable. Revisa la orientación, las dimensiones y la calidad del archivo final."},"pdf-to-jpg":{"name":"PDF a JPG","desc":"Convierte páginas de un PDF en imágenes JPG para verlas y compartirlas.","purpose":"La herramienta renderiza páginas del PDF como imágenes descargables.","example":"Selecciona un PDF y abre la imagen generada para revisar la resolución y la legibilidad del contenido.","notes":"El texto puede perder nitidez con resoluciones bajas. Los PDF grandes o con muchas páginas pueden consumir mucha memoria del navegador."},"word-counter":{"name":"Contador de palabras","desc":"Cuenta palabras, caracteres, frases y párrafos de un texto directamente en el navegador.","purpose":"El contador muestra medidas básicas del texto, incluidos los caracteres con y sin espacios.","example":"Pega un párrafo y compara el número de palabras con el total de caracteres antes de enviar el texto a una plataforma.","notes":"Las plataformas pueden contar emojis, saltos de línea, abreviaturas y palabras con guion de forma diferente."},"image-compressor":{"name":"Compresor de imágenes","desc":"Reduce el tamaño de archivos de imagen en el navegador para facilitar su envío y uso compartido.","purpose":"La herramienta vuelve a procesar una imagen para intentar reducir el tamaño del archivo.","example":"Selecciona una copia de la imagen original, genera la versión comprimida y compara el tamaño y la calidad visual.","notes":"El resultado depende del formato y del contenido de la imagen. Revisa la transparencia, el texto pequeño y los detalles antes de sustituir el original."}},"fr":{"word-to-pdf":{"name":"Word en PDF","desc":"Convertissez des documents Word DOCX en fichiers PDF simples à partager ou à imprimer.","purpose":"Cet outil extrait le texte d'un document DOCX et crée un PDF de base directement dans le navigateur.","example":"Sélectionnez un fichier DOCX contenant du texte simple, lancez la conversion et ouvrez le PDF téléchargé pour vérifier le résultat.","notes":"Cette version privilégie le texte. Elle ne garantit pas la conservation des images, tableaux, colonnes, en-têtes ou mises en forme avancées du document d'origine."},"pdf-to-word":{"name":"PDF en Word","desc":"Extrayez le texte d'un PDF et créez un document Word modifiable au format DOCX.","purpose":"L'outil extrait le texte lisible d'un PDF et l'organise dans un fichier DOCX modifiable dans Word.","example":"Choisissez un PDF dont le texte peut être sélectionné, lancez la conversion et ouvrez le DOCX pour vérifier le texte extrait.","notes":"Le résultat privilégie le texte, pas la reproduction exacte de la mise en page. Les colonnes, images, tableaux et mises en forme complexes peuvent changer. Les PDF numérisés peuvent nécessiter un OCR."},"compress-pdf":{"name":"Compresser un PDF","desc":"Essayez de réduire la taille d'un PDF grâce à une optimisation simple dans le navigateur.","purpose":"L'outil enregistre à nouveau le PDF à l'aide d'une bibliothèque JavaScript. Il s'agit d'une tentative d'optimisation légère, pas d'une garantie de compression.","example":"Comparez la taille du fichier d'origine à celle du fichier téléchargé et vérifiez que la qualité des pages reste suffisante.","notes":"La méthode actuelle ne réduit pas la résolution des images et n'effectue pas de compression avancée. Certains fichiers peuvent rester de la même taille ou devenir plus volumineux."},"merge-pdf":{"name":"Fusionner des PDF","desc":"Combinez plusieurs fichiers PDF en un seul document, dans l'ordre des fichiers sélectionnés.","purpose":"L'outil copie les pages des PDF choisis dans un nouveau document.","example":"Sélectionnez deux PDF, placez-les dans l'ordre souhaité, lancez l'outil et vérifiez l'ordre des pages.","notes":"Les fichiers protégés par mot de passe, endommagés ou utilisant des fonctionnalités inhabituelles peuvent échouer. Les pages sont combinées sans redessiner leur contenu."},"jpg-to-pdf":{"name":"JPG en PDF","desc":"Transformez une image JPG ou compatible en document PDF à partager ou à imprimer.","purpose":"L'outil place une image sélectionnée sur une page PDF.","example":"Choisissez une image, créez le PDF et vérifiez les dimensions de la page avant de l'imprimer ou de l'envoyer.","notes":"La conversion ne reconnaît pas le texte présent dans l'image et ne rend pas ce texte modifiable. Vérifiez l'orientation, les dimensions et la qualité du fichier final."},"pdf-to-jpg":{"name":"PDF en JPG","desc":"Convertissez les pages d'un PDF en images JPG pour les consulter et les partager.","purpose":"L'outil transforme les pages du PDF en images téléchargeables.","example":"Sélectionnez un PDF et ouvrez l'image générée pour vérifier la résolution et la lisibilité du contenu.","notes":"Le texte peut perdre en netteté à faible résolution. Les PDF volumineux ou comportant de nombreuses pages peuvent consommer beaucoup de mémoire dans le navigateur."},"word-counter":{"name":"Compteur de mots","desc":"Comptez les mots, caractères, phrases et paragraphes d'un texte directement dans le navigateur.","purpose":"Le compteur affiche des mesures de base du texte, y compris le nombre de caractères avec et sans espaces.","example":"Collez un paragraphe et comparez le nombre de mots au nombre total de caractères avant de soumettre le texte à une plateforme.","notes":"Les plateformes peuvent compter différemment les emojis, les sauts de ligne, les abréviations et les mots composés."},"image-compressor":{"name":"Compresseur d'images","desc":"Réduisez la taille des fichiers image dans le navigateur pour faciliter leur envoi et leur partage.","purpose":"L'outil traite à nouveau une image pour tenter de réduire la taille du fichier.","example":"Sélectionnez une copie de l'image originale, créez la version compressée et comparez la taille et la qualité visuelle.","notes":"Le résultat dépend du format et du contenu de l'image. Vérifiez la transparence, les petits textes et les détails avant de remplacer l'original."}}};
const LOCALIZED_TOOL_SLUGS = Object.keys(LOCALIZED_TOOL_COPY.pt);
const LOCALIZED_UI = {"pt":{"htmlLang":"pt-BR","languageName":"Português","home":"Início","categories":"Ferramentas","about":"Sobre","contact":"Contato","privacy":"Privacidade","terms":"Termos","kicker":"GLOBALTOOLS • FERRAMENTA ONLINE","selectFiles":"Selecionar arquivos","dropHint":"ou arraste e solte os arquivos aqui","enterData":"Digite ou cole seus dados...","run":"Executar ferramenta","result":"O resultado aparecerá aqui.","privateTitle":"Privado quando possível","privateText":"O processamento acontece no navegador sempre que a tecnologia permite.","freeTitle":"Grátis para usar","freeText":"As ferramentas principais não exigem cadastro.","guidanceTitle":"Orientações claras","guidanceText":"Confira exemplos e limitações antes de usar o resultado em uma tarefa importante.","aboutTool":"Sobre esta ferramenta","howTo":"Como usar","example":"Exemplo prático","limitations":"Limitações e cuidados","faq":"Perguntas frequentes","processing":"Privacidade e processamento","steps":["Escolha um arquivo compatível ou informe os dados solicitados.","Revise as opções e confirme o formato desejado.","Execute a ferramenta e confira o resultado antes de baixar."],"faqWhat":"O que é {name}?","faqWhatText":"{desc} A ferramenta funciona online, sem exigir a instalação de um programa separado.","faqHow":"Como usar {name}?","faqHowText":"Informe os dados ou selecione um arquivo compatível, execute a ferramenta e confira o resultado.","faqAccount":"Preciso criar uma conta?","faqAccountText":"Não. As ferramentas principais do GlobalTools foram projetadas para uso sem conta.","faqData":"Meus arquivos são enviados ao servidor?","faqDataText":"Quando o processamento local é compatível, a tarefa é executada no navegador. Algumas ferramentas carregam bibliotecas externas ou enviam os dados necessários a um serviço externo; leia as observações específicas antes de enviar dados sensíveis.","privacyText":"Para detalhes sobre cookies, publicidade, análise de uso e serviços externos, leia a Política de Privacidade.","related":"Ferramentas relacionadas","toolsAnchor":"/pt/#ferramentas","processingIntro":"O GlobalTools prioriza o processamento no navegador sempre que a tecnologia permite.","footerText":"Ferramentas online gratuitas para tarefas do dia a dia."},"es":{"htmlLang":"es","languageName":"Español","home":"Inicio","categories":"Herramientas","about":"Acerca de","contact":"Contacto","privacy":"Privacidad","terms":"Términos","kicker":"GLOBALTOOLS • HERRAMIENTA ONLINE","selectFiles":"Seleccionar archivos","dropHint":"o arrastra y suelta los archivos aquí","enterData":"Introduce o pega tus datos...","run":"Ejecutar herramienta","result":"El resultado aparecerá aquí.","privateTitle":"Privado cuando es posible","privateText":"El procesamiento ocurre en el navegador siempre que la tecnología lo permite.","freeTitle":"Gratis","freeText":"Las herramientas principales no requieren una cuenta.","guidanceTitle":"Instrucciones claras","guidanceText":"Revisa los ejemplos y las limitaciones antes de utilizar el resultado en una tarea importante.","aboutTool":"Acerca de esta herramienta","howTo":"Cómo usarla","example":"Ejemplo práctico","limitations":"Limitaciones y precauciones","faq":"Preguntas frecuentes","processing":"Privacidad y procesamiento","steps":["Selecciona un archivo compatible o introduce los datos solicitados.","Revisa las opciones y confirma el formato deseado.","Ejecuta la herramienta y comprueba el resultado antes de descargarlo."],"faqWhat":"¿Qué es {name}?","faqWhatText":"{desc} La herramienta funciona en línea sin necesidad de instalar un programa independiente.","faqHow":"¿Cómo se usa {name}?","faqHowText":"Introduce los datos o selecciona un archivo compatible, ejecuta la herramienta y revisa el resultado.","faqAccount":"¿Necesito crear una cuenta?","faqAccountText":"No. Las herramientas principales de GlobalTools están diseñadas para utilizarse sin cuenta.","faqData":"¿Se suben mis archivos al servidor?","faqDataText":"Cuando el procesamiento local es compatible, la tarea se realiza en el navegador. Algunas herramientas cargan bibliotecas externas o envían los datos necesarios a un servicio externo; revisa las notas específicas antes de enviar datos sensibles.","privacyText":"Para más información sobre cookies, publicidad, analítica y servicios externos, consulta la Política de privacidad.","related":"Herramientas relacionadas","toolsAnchor":"/es/#herramientas","processingIntro":"GlobalTools prioriza el procesamiento en el navegador siempre que la tecnología lo permite.","footerText":"Herramientas online gratuitas para las tareas cotidianas."},"fr":{"htmlLang":"fr","languageName":"Français","home":"Accueil","categories":"Outils","about":"À propos","contact":"Contact","privacy":"Confidentialité","terms":"Conditions","kicker":"GLOBALTOOLS • OUTIL EN LIGNE","selectFiles":"Choisir les fichiers","dropHint":"ou glissez-déposez vos fichiers ici","enterData":"Saisissez ou collez vos données...","run":"Exécuter l’outil","result":"Le résultat apparaîtra ici.","privateTitle":"Privé lorsque possible","privateText":"Le traitement s'effectue dans le navigateur lorsque la technologie le permet.","freeTitle":"Gratuit","freeText":"Les outils principaux ne nécessitent pas de compte.","guidanceTitle":"Instructions claires","guidanceText":"Consultez les exemples et les limites avant d'utiliser le résultat pour une tâche importante.","aboutTool":"À propos de cet outil","howTo":"Comment l'utiliser","example":"Exemple pratique","limitations":"Limites et précautions","faq":"Questions fréquentes","processing":"Confidentialité et traitement","steps":["Choisissez un fichier compatible ou saisissez les données demandées.","Vérifiez les options et le format de sortie souhaité.","Lancez l'outil et contrôlez le résultat avant de le télécharger."],"faqWhat":"Qu'est-ce que {name} ?","faqWhatText":"{desc} Cet outil fonctionne en ligne sans installation d'un logiciel séparé.","faqHow":"Comment utiliser {name} ?","faqHowText":"Saisissez les données ou choisissez un fichier compatible, lancez l'outil et vérifiez le résultat.","faqAccount":"Dois-je créer un compte ?","faqAccountText":"Non. Les principaux outils GlobalTools sont conçus pour être utilisés sans compte.","faqData":"Mes fichiers sont-ils envoyés au serveur ?","faqDataText":"Lorsque le traitement local est pris en charge, la tâche s'exécute dans le navigateur. Certains outils chargent des bibliothèques externes ou transmettent les données nécessaires à un service externe ; consultez les notes de l'outil avant d'envoyer des données sensibles.","privacyText":"Pour en savoir plus sur les cookies, la publicité, l'analyse et les services externes, consultez la politique de confidentialité.","related":"Outils associés","toolsAnchor":"/fr/#outils","processingIntro":"GlobalTools privilégie le traitement dans le navigateur lorsque la technologie le permet.","footerText":"Des outils en ligne gratuits pour les tâches du quotidien."}};

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
  const localizedToolRequest = urlPath.match(/^\/(pt|es|fr)\/tools\/([a-z0-9-]+)\.html$/i);
  const requestedToolLocale = localizedToolRequest ? localizedToolRequest[1].toLowerCase() : "en";
  if (urlPath === "/") urlPath = "/index.html";
  if (localizedToolRequest) urlPath = "/tools/" + localizedToolRequest[2] + ".html";

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
      "/products/freelancer-business-kit.html",
      "/pt/", "/es/", "/fr/"
    ];
    try {
      const appSource = fs.readFileSync(path.join(root, "app.js"), "utf8");
      const slugs = Array.from(appSource.matchAll(/\{slug:"([^"]+)",name:/g), match => match[1]);
      slugs.forEach(slug => pages.push("/tools/" + slug + ".html"));
      LOCALIZED_TOOL_SLUGS.forEach(slug => {
        ["pt","es","fr"].forEach(locale => pages.push("/" + locale + "/tools/" + slug + ".html"));
      });
    } catch (err) {
      console.error("[GlobalTools sitemap]", err.message);
    }
    const localizedAlternates = new Map();
    const addAlternates = paths => {
      const map = {};
      paths.forEach(([hreflang, page]) => { map[hreflang] = page; });
      paths.forEach(([, page]) => localizedAlternates.set(page, map));
    };
    addAlternates([["en","/"],["pt-BR","/pt/"],["es","/es/"],["fr","/fr/"]]);
    LOCALIZED_TOOL_SLUGS.forEach(slug => addAlternates([
      ["en","/tools/" + slug + ".html"],
      ["pt-BR","/pt/tools/" + slug + ".html"],
      ["es","/es/tools/" + slug + ".html"],
      ["fr","/fr/tools/" + slug + ".html"]
    ]));

    const urls = Array.from(new Set(pages)).map(page => {
      const loc = base + page;
      const alternates = localizedAlternates.get(page);
      const links = alternates ? Object.entries({...alternates, "x-default": alternates.en})
        .map(([lang, altPath]) => '<xhtml:link rel="alternate" hreflang="' + lang + '" href="' + base + altPath + '"/>').join("") : "";
      return "<url><loc>" + loc + "</loc>" + links + "</url>";
    }).join("");
    const xml = '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">' + urls + "</urlset>";
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
    const locale = requestedToolLocale;
    const localizedTool = LOCALIZED_TOOL_COPY[locale] && LOCALIZED_TOOL_COPY[locale][slug];
    if (locale !== "en" && !localizedTool) {
      res.writeHead(404, {"Content-Type":"text/plain; charset=utf-8"});
      return res.end("Localized version not available.");
    }
    const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
    const match = app.match(new RegExp('\\{slug:"'+slug+'",name:"([^"]+)",desc:"([^"]+)"'));
    if (match) {
      const name = localizedTool ? localizedTool.name : match[1];
      const desc = localizedTool ? localizedTool.desc : match[2];
      const ui = LOCALIZED_UI[locale] || null;
      const safe = v => String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
      const allTools = [...app.matchAll(/\{slug:"([^"]+)",name:"([^"]+)",desc:"([^"]+)",cat:"([^"]+)"\}/g)].map(m => ({slug:m[1],name:m[2],desc:m[3],cat:m[4]}));
      const current = allTools.find(t => t.slug === slug) || {slug,name,desc,cat:"tools"};
      const localizedUrlFor = toolSlug => locale !== "en" && LOCALIZED_TOOL_COPY[locale] && LOCALIZED_TOOL_COPY[locale][toolSlug]
        ? "/" + locale + "/tools/" + toolSlug + ".html"
        : "/tools/" + toolSlug + ".html";
      const relatedCandidates = allTools.filter(t => t.slug !== slug && t.cat === current.cat);
      const related = locale === "en"
        ? relatedCandidates.slice(0,6)
        : relatedCandidates.filter(t => !!(LOCALIZED_TOOL_COPY[locale] && LOCALIZED_TOOL_COPY[locale][t.slug])).slice(0,6);
      const relatedHtml = related.map(t => {
        const translated = locale !== "en" && LOCALIZED_TOOL_COPY[locale] && LOCALIZED_TOOL_COPY[locale][t.slug];
        const relatedName = translated ? translated.name : t.name;
        const relatedDesc = translated ? translated.desc : t.desc;
        return '<a class="related-tool" href="'+localizedUrlFor(t.slug)+'"><strong>'+safe(relatedName)+'</strong><span>'+safe(relatedDesc)+'</span></a>';
      }).join('');
      const localePrefix = locale === "en" ? "" : "/" + locale;
      const localToolPath = localePrefix + "/tools/" + slug + ".html";
      const pageUrl = siteUrl(req) + localToolPath;
      const alternateLinks = LOCALIZED_TOOL_SLUGS.includes(slug)
        ? [["en","/tools/"+slug+".html"],["pt-BR","/pt/tools/"+slug+".html"],["es","/es/tools/"+slug+".html"],["fr","/fr/tools/"+slug+".html"],["x-default","/tools/"+slug+".html"]]
          .map(([lang,route]) => '<link rel="alternate" hreflang="'+lang+'" href="'+siteUrl(req)+route+'">').join("")
        : "";
      const htmlLang = ui ? ui.htmlLang : "en-US";
      const pageTitle = ui ? name + " | GlobalTools" : name + " — Free Online Tool | GlobalTools";
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
      const purpose=localizedTool ? localizedTool.purpose : (sp ? sp[0] : g[0]);
      const example=localizedTool ? localizedTool.example : (sp ? sp[1] : "Start with a short, non-sensitive sample to check the result before processing important content.");
      const notes=localizedTool ? localizedTool.notes : (sp ? sp[2] : g[4]);
      const steps = (ui ? ui.steps : [g[1],g[2],g[3]]).map(x=>'<li>'+safe(x)+'</li>').join('');
      const fillFaq = template => template.replace(/\{name\}/g,name).replace(/\{desc\}/g,desc);
      const faq = ui ? [
        [fillFaq(ui.faqWhat),fillFaq(ui.faqWhatText)],
        [fillFaq(ui.faqHow),fillFaq(ui.faqHowText)],
        [ui.faqAccount,ui.faqAccountText],
        [ui.faqData,ui.faqDataText]
      ] : [
        ["What is "+name+"?",desc+" This online tool helps you complete the task without installing separate software."],
        ["How do I use "+name+"?","Enter the requested data or select a supported file, run the tool, and check the result before using it."],
        ["Do I need to create an account?","No. The core GlobalTools tools are designed to work without an account."],
        ["Is my data uploaded to the server?","When local processing is supported, the task runs in your browser. Some tools load external libraries or send the input needed for an external service; review the tool-specific notes before submitting sensitive data."]
      ];
      const faqHtml=faq.map(x=>'<div><h3>'+safe(x[0])+'</h3><p>'+safe(x[1])+'</p></div>').join('');
      const faqSchema=JSON.stringify({"@context":"https://schema.org","@type":"FAQPage","inLanguage":locale==="pt"?"pt-BR":locale,"mainEntity":faq.map(x=>({"@type":"Question","name":x[0],"acceptedAnswer":{"@type":"Answer","text":x[1]}}))}).replace(/</g,'\\u003c');
      const appSchema=JSON.stringify({"@context":"https://schema.org","@type":"WebApplication","name":name+" — GlobalTools","applicationCategory":"UtilitiesApplication","operatingSystem":"Web Browser","description":desc,"url":pageUrl,"inLanguage":locale==="pt"?"pt-BR":locale,"isAccessibleForFree":true,"publisher":{"@type":"Organization","name":"GlobalTools","url":siteUrl(req)+"/"},"offers":{"@type":"Offer","price":"0","priceCurrency":"USD"}}).replace(/</g,'\\u003c');
      const metaDescription = ui ? desc + " " + purpose : desc + " Learn how to use the tool, review examples, and understand its limitations with GlobalTools.";
      const languageLinks = [["en","English","/tools/"+slug+".html"],["pt-BR","Português","/pt/tools/"+slug+".html"],["es","Español","/es/tools/"+slug+".html"],["fr","Français","/fr/tools/"+slug+".html"]]
        .filter(([lang]) => lang === "en" || !!LOCALIZED_TOOL_COPY[lang==="pt-BR"?"pt":lang]?.[slug])
        .map(([lang,label,href]) => '<a href="'+href+'" hreflang="'+lang+'">'+label+'</a>').join(' · ');
      const homePath = locale === "en" ? "/" : "/" + locale + "/";
      const toolsAnchor = ui ? ui.toolsAnchor : "/#categories";
      const contactHint = locale === "pt" ? "Para perguntas ou problemas, use o " : locale === "es" ? "Para preguntas o problemas, utiliza la página de " : locale === "fr" ? "Pour toute question ou tout problème, utilisez la page de " : "For questions or bug reports, use the ";
      const html=[
        '<!doctype html><html lang="'+htmlLang+'"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">',
        '<title>'+safe(pageTitle)+'</title>',
        '<meta name="description" content="'+safe(metaDescription)+'">',
        '<meta name="robots" content="index,follow"><link rel="canonical" href="'+pageUrl+'">'+alternateLinks,
        '<meta property="og:type" content="website"><meta property="og:title" content="'+safe(pageTitle)+'"><meta property="og:description" content="'+safe(metaDescription)+'"><meta property="og:url" content="'+pageUrl+'"><meta property="og:site_name" content="GlobalTools"><meta name="twitter:card" content="summary">',
        '<script type="application/ld+json">'+appSchema+'</script><script type="application/ld+json">'+faqSchema+'</script>',
        '<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6472882150880001" crossorigin="anonymous"></script>',
        '<script async src="https://www.googletagmanager.com/gtag/js?id=G-061NQ52GBQ"></script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag("js",new Date());gtag("config","G-061NQ52GBQ");</script>',
        '<link rel="stylesheet" href="/styles.css?v=20261013-03"><script>try{localStorage.setItem("globaltools-international-language-v1",'+JSON.stringify(locale)+')}catch(e){}</script><script defer src="/app.js?v=20261013-03"></script><!-- Google Ads tag --><script async src="https://www.googletagmanager.com/gtag/js?id=AW-17240722145"></script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag("js",new Date());gtag("config","AW-17240722145");</script></head>',
        '<body><select id="languageSelect" hidden aria-hidden="true"><option value="en">English</option><option value="pt">Português</option><option value="es">Español</option><option value="fr">Français</option></select><header class="site-header"><a class="brand" href="'+homePath+'"><span class="brand-mark">G</span>GlobalTools</a><nav class="main-nav"><a href="'+homePath+'">'+(ui?ui.home:"Tools")+'</a><a href="'+toolsAnchor+'">'+(ui?ui.categories:"Categories")+'</a><a href="/sobre.html">'+(ui?ui.about:"About")+'</a><a href="/contato.html">'+(ui?ui.contact:"Contact")+'</a><a href="/privacy.html">'+(ui?ui.privacy:"Privacy")+'</a></nav><div class="language-links">'+languageLinks+'</div></header>',
        '<main class="tool-page"><div class="breadcrumbs"><a href="'+homePath+'">'+(ui?ui.home:"Home")+'</a> / '+safe(name)+'</div><section class="tool-hero"><div class="tool-kicker">'+(ui?ui.kicker:"GLOBALTOOLS • ONLINE TOOL")+'</div><h1>'+safe(name)+'</h1><p class="intro">'+safe(desc)+'</p></section>',
        '<div class="tool-workspace"><div id="tool" class="tool-box"><div id="dropZone" class="upload-visual file-upload-visual"><div class="upload-icon">↥</div><h2>'+(ui?ui.selectFiles:"Select files")+'</h2><p>'+(ui?ui.dropHint:"or drag and drop files here")+'</p></div><textarea id="input" aria-label="'+safe(name)+'" placeholder="'+(ui?ui.enterData:"Enter or paste your data...")+'"></textarea><button id="action" class="btn primary-action">'+(ui?ui.run:"Run tool")+'</button><div id="result" class="result">'+(ui?ui.result:"Your result will appear here.")+'</div></div>',
        '<aside class="tool-side"><div class="side-card"><strong>'+(ui?ui.privateTitle:"Private when possible")+'</strong><p>'+(ui?ui.privateText:"Processing happens in your browser whenever the technology allows.")+'</p></div><div class="side-card"><strong>'+(ui?ui.freeTitle:"Free to use")+'</strong><p>'+(ui?ui.freeText:"The core tools do not require an account.")+'</p></div><div class="side-card"><strong>'+(ui?ui.guidanceTitle:"Clear guidance")+'</strong><p>'+(ui?ui.guidanceText:"Review examples and limitations before using the result for an important task.")+'</p></div></aside></div>',
        '<section class="info"><h2>'+(ui?ui.aboutTool:"About")+' '+safe(name)+'</h2><p>'+safe(purpose)+'</p><h2>'+(ui?ui.howTo:"How to use")+'</h2><ol>'+steps+'</ol><h2>'+(ui?ui.example:"Practical example")+'</h2><p>'+safe(example)+'</p><h2>'+(ui?ui.limitations:"Limitations and precautions")+'</h2><p>'+safe(notes)+'</p><h2>'+(ui?ui.faq:"Frequently asked questions")+'</h2><div class="faq">'+faqHtml+'</div>',
        related.length?'<h2>'+(ui?ui.related:"Related tools")+'</h2><div class="related-tools">'+relatedHtml+'</div>':'',
        '<h2>'+(ui?ui.processing:"Privacy and processing")+'</h2><p>'+(ui?ui.processingIntro:"GlobalTools prioritizes in-browser processing whenever technically possible.")+' '+(ui?ui.privacyText:'For details about cookies, advertising, analytics and external services, read our')+' <a href="/privacy.html">'+(ui?ui.privacy:"Privacy Policy")+'</a>. '+contactHint+'<a href="/contato.html">'+(ui?ui.contact:"contact page")+'</a>.</p></section></main>',
        '<footer class="site-footer"><div><div class="brand"><span class="brand-mark">G</span>GlobalTools</div><p>'+(ui?ui.footerText:"Free online tools for everyone.")+'</p></div><div class="footer-links"><a href="/sobre.html">'+(ui?ui.about:"About")+'</a><a href="/contato.html">'+(ui?ui.contact:"Contact")+'</a><a href="/privacy.html">'+(ui?ui.privacy:"Privacy")+'</a><a href="/terms.html">'+(ui?ui.terms:"Terms")+'</a></div><div class="language-links">'+languageLinks+'</div></footer><script src="/support.js?v=20261013-03"></script></body></html>'
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
    if (!/^\/(pt|es|fr)\//i.test(urlPath) && !html.includes("/language.js")) html = html.replace(/<\/head>/i, `<script defer src="/language.js?v=20261013-03"></script></head>`);
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

#!/usr/bin/env python3
"""Rewrite the landing section of the 4 lang JSON files with proper UTF-8 encoding."""
import json
import os

LANGS_DIR = r"C:\Users\dorel\workspace\robible\public\lang"

translations = {
    "ro": {
        "skip_to_content": "Sari la conținut",
        "meta": {
            "title": "Biblia care nu te urmărește. 4 limbi. Fără reclame.",
            "description": "RoBible este o aplicație web gratuită pentru citit, căutat și studiat Biblia. Fără trackere, fără reclame, fără cookie-uri de marketing. În română, spaniolă, engleză și chineză."
        },
        "hero": {
            "eyebrow": "Biblia online — gratuită, fără reclame",
            "title": "Scriptura pe care o poți avea încredere. Și în telefon.",
            "lede": "66 de cărți. 31.102 versete. 4 limbi. Căutare inteligentă, comparare de versiuni, note sincronizate — totul fără reclame, fără trackere, fără abonament.",
            "cta_primary": "Începe să citești",
            "cta_secondary": "Încearcă demo",
            "lang_label": "Alege limba",
            "scroll": "Derulează în jos"
        },
        "demo": {
            "eyebrow": "Demo live",
            "hint": "Scrie o referință (ex: rom 3 5) și apasă Enter — te ducem direct la verset, cu evidențiere verde.",
            "placeholder": "rom 3 5, 1 ioan 2 6, geneza 1:1…",
            "button": "Caută",
            "aria": "Căutare de referință în direct",
            "no_results": "Niciun rezultat. Încearcă alt format (ex: rom 3 5, 1co 13 4, fapte 2 38).",
            "error": "A apărut o eroare. Încearcă din nou.",
            "open": "Deschide versetul →"
        },
        "stats": {
            "label": "Cifrele proiectului",
            "languages": "Limbi",
            "books": "Cărți",
            "verses": "Versete",
            "free": "Preț",
            "free_value": "Gratuit"
        },
        "features": {
            "eyebrow": "Ce face RoBible",
            "title": "Funcții gândite pentru studiu serios — și citit comod.",
            "f1": {
                "title": "Căutare prin referință, nu prin indice",
                "text": "Scrii 'rom 3 5' sau '1 ioan 2 6' sau 'geneza 1:1' și ajungi direct. Funcționează și cu diacritice, și cu greșeli de tastare.",
                "example": "rom 3 5 → Romani 3:5"
            },
            "f2": {
                "title": "Caută în text, nu doar în citate",
                "text": "Caută cuvinte, expresii sau combinații. Poți căuta în toată Biblia, într-un testament sau într-o singură carte.",
                "example": "„frică de Dumnezeu\" → 74 rezultate"
            },
            "f3": {
                "title": "Compară versiuni, verset cu verset",
                "text": "Vezi același pasaj în două traduceri, în paralel. Util pentru studiu aprofundat sau pentru predare.",
                "example": "VDC vs RVL — Ioan 3:16"
            },
            "f4": {
                "title": "Note și favorite în cloud",
                "text": "Scrie note pe versete, grupează-le pe teme, salvează favorite. Totul se sincronizează între dispozitive, gratuit, fără card.",
                "example": "Notița ta pe Ioan 3:16 — pe telefon, tabletă, laptop."
            }
        },
        "why": {
            "eyebrow": "De ce RoBible",
            "title": "Pentru că o Biblie nu ar trebui să fie un produs.",
            "lede": "Nu vrem banii tăi, nu vrem atenția ta, nu vrem datele tale. Vrem doar să citești Scriptura fără obstacole.",
            "w1": {
                "title": "Fără trackere. Fără reclame. Fără cookie-uri de marketing.",
                "text": "Nici Google Analytics, nici Facebook Pixel, nici reclame sponsorizate. Citești, atât."
            },
            "w2": {
                "title": "Funcționează offline (PWA).",
                "text": "Instalează aplicația pe telefon. Se descarcă o dată, apoi merge fără internet. Perfect pentru călătorii, predici, retreaturi."
            },
            "w3": {
                "title": "4 limbi din prima ziua: ro, es, en, zh.",
                "text": "Nu am adăugat limbi pentru marketing. Le adăugăm pentru că fiecare merită Scriptura în limba sa."
            },
            "w4": {
                "title": "Cod deschis. Fără surprize.",
                "text": "Codul e pe GitHub. Dacă nu-ți place o decizie, o poți schimba. Sau poți găsi pe cineva care o face."
            }
        },
        "audience": {
            "eyebrow": "Pentru cine",
            "title": "Fiecare cititor, în felul lui.",
            "p1": {
                "title": "Studiu individual",
                "text": "Citești, cauți, notezi. Fără distragere, fără cont obligatoriu, fără reclame între versete.",
                "cta": "Deschide Biblia"
            },
            "p2": {
                "title": "Predare și studiu în grup",
                "text": "Compară traduceri, ia notițe pe teme, pregătește lecții fără să te lupți cu interfața.",
                "cta": "Compară versiuni"
            },
            "p3": {
                "title": "Doar curiozitate",
                "text": "Vrei să cauți un citat pe care l-ai auzit la radio. N-ai nevoie de cont. Scrii și găsești.",
                "cta": "Caută un verset"
            }
        },
        "compare": {
            "eyebrow": "Comparație onestă",
            "title": "Ce avem. Ce nu avem. Fără promisiuni.",
            "lede": "Nu pretindem că suntem perfecți. Iată ce oferim — și ce nu — față de aplicațiile biblice obișnuite.",
            "feature": "Funcție",
            "others": "Alte aplicații",
            "yes": "Da",
            "no": "Nu",
            "mixed": "Uneori",
            "row1": "Fără trackere și reclame",
            "row2": "Note sincronizate gratuit",
            "row3": "Funcționează offline",
            "row4": "Cod deschis",
            "row5": "Subscripție premium obligatorie"
        },
        "faq": {
            "eyebrow": "Întrebări frecvente",
            "title": "Ce n-ai găsit în altă parte",
            "q1": "Chiar este gratuit?",
            "a1": "Da, complet. Fără reclame, fără abonament, fără card. Proiectul e susținut prin muncă benevolă și donații opționale.",
            "q2": "Datele mele sunt în siguranță?",
            "a2": "Notițele și favoritele sunt stocate criptat la Cloudflare. Nu vindem și nu partajăm nimic. Poți șterge contul oricând.",
            "q3": "Funcționează pe telefon?",
            "a3": "Da. E o aplicație web progresivă (PWA) — o instalezi din browser și arată ca o aplicație nativă. Merge pe iOS, Android, orice tabletă sau laptop.",
            "q4": "De unde vin traducerile?",
            "a4": "Versiunea română: Biblia Cornilescu (VDC). Versiunea spaniolă: Reina Valera (RVL). Sunt traduceri în domeniul public sau cu permisiune.",
            "q5": "Pot să contribui?",
            "a5": "Da — corecturi, traduceri noi, funcții. Codul e pe GitHub. Și rugăciunile contează."
        },
        "final": {
            "title": "Hai să citești.",
            "text": "Fără cont. Fără aplicații de descărcat. Doar Scriptura, în limba ta, pe orice ecran.",
            "cta": "Deschide Biblia"
        },
        "footer": {
            "tagline": "O Biblie simplă, pentru toată lumea.",
            "nav_aria": "Linkuri de subsol",
            "bible": "Biblia",
            "compare": "Comparare",
            "index": "Indice tematic",
            "sitemap": "Sitemap",
            "github": "GitHub"
        }
    },
    "es": {
        "skip_to_content": "Saltar al contenido",
        "meta": {
            "title": "La Biblia que no te rastrea. 4 idiomas. Sin anuncios.",
            "description": "RoBible es una app web gratuita para leer, buscar y estudiar la Biblia. Sin rastreadores, sin anuncios, sin cookies de marketing. En rumano, español, inglés y chino."
        },
        "hero": {
            "eyebrow": "Biblia en línea — gratis, sin anuncios",
            "title": "Las Escrituras en las que puedes confiar. Y en tu bolsillo.",
            "lede": "66 libros. 31.102 versículos. 4 idiomas. Búsqueda inteligente, comparación de versiones, notas sincronizadas — todo sin anuncios, sin rastreadores, sin suscripción.",
            "cta_primary": "Empezar a leer",
            "cta_secondary": "Probar demo",
            "lang_label": "Elige idioma",
            "scroll": "Desplázate hacia abajo"
        },
        "demo": {
            "eyebrow": "Demo en vivo",
            "hint": "Escribe una referencia (ej: rom 3 5) y pulsa Enter — te llevamos al versículo, con resaltado verde.",
            "placeholder": "rom 3 5, 1 juan 2 6, génesis 1:1…",
            "button": "Buscar",
            "aria": "Búsqueda de referencia en vivo",
            "no_results": "Sin resultados. Prueba otro formato (ej: rom 3 5, 1co 13 4, hechos 2 38).",
            "error": "Algo salió mal. Inténtalo de nuevo.",
            "open": "Abrir versículo →"
        },
        "stats": {
            "label": "Cifras del proyecto",
            "languages": "Idiomas",
            "books": "Libros",
            "verses": "Versículos",
            "free": "Precio",
            "free_value": "Gratis"
        },
        "features": {
            "eyebrow": "Qué hace RoBible",
            "title": "Funciones pensadas para estudio serio — y lectura cómoda.",
            "f1": {
                "title": "Búsqueda por referencia, no por índice",
                "text": "Escribes 'rom 3 5' o '1 juan 2 6' o 'génesis 1:1' y llegas directo. Funciona con diacríticos y con errores tipográficos.",
                "example": "rom 3 5 → Romanos 3:5"
            },
            "f2": {
                "title": "Busca en el texto, no solo en citas",
                "text": "Busca palabras, frases o combinaciones. Puedes buscar en toda la Biblia, en un testamento o en un solo libro.",
                "example": "„temor de Dios\" → 74 resultados"
            },
            "f3": {
                "title": "Compara versiones, versículo a versículo",
                "text": "Mira el mismo pasaje en dos traducciones, en paralelo. Útil para estudio profundo o para enseñar.",
                "example": "RVR vs NVI — Juan 3:16"
            },
            "f4": {
                "title": "Notas y favoritos en la nube",
                "text": "Escribe notas sobre versículos, agrúpalas por temas, guarda favoritos. Todo se sincroniza entre dispositivos, gratis, sin tarjeta.",
                "example": "Tu nota en Juan 3:16 — en móvil, tablet, portátil."
            }
        },
        "why": {
            "eyebrow": "Por qué RoBible",
            "title": "Porque una Biblia no debería ser un producto.",
            "lede": "No queremos tu dinero, ni tu atención, ni tus datos. Solo queremos que leas las Escrituras sin obstáculos.",
            "w1": {
                "title": "Sin rastreadores. Sin anuncios. Sin cookies de marketing.",
                "text": "Ni Google Analytics, ni Facebook Pixel, ni anuncios patrocinados. Lees, ya está."
            },
            "w2": {
                "title": "Funciona offline (PWA).",
                "text": "Instala la app en el móvil. Se descarga una vez, luego funciona sin internet. Perfecto para viajes, sermones, retiros."
            },
            "w3": {
                "title": "4 idiomas desde el día uno: ro, es, en, zh.",
                "text": "No añadimos idiomas por marketing. Los añadimos porque cada uno merece las Escrituras en su lengua."
            },
            "w4": {
                "title": "Código abierto. Sin sorpresas.",
                "text": "El código está en GitHub. Si no te gusta una decisión, puedes cambiarla. O encontrar a alguien que lo haga."
            }
        },
        "audience": {
            "eyebrow": "Para quién",
            "title": "Cada lector, a su manera.",
            "p1": {
                "title": "Estudio individual",
                "text": "Lees, buscas, tomas notas. Sin distracciones, sin cuenta obligatoria, sin anuncios entre versículos.",
                "cta": "Abrir la Biblia"
            },
            "p2": {
                "title": "Enseñanza y estudio en grupo",
                "text": "Compara traducciones, anota por temas, prepara lecciones sin pelearte con la interfaz.",
                "cta": "Comparar versiones"
            },
            "p3": {
                "title": "Solo curiosidad",
                "text": "Quieres buscar una cita que escuchaste en la radio. No necesitas cuenta. Escribes y encuentras.",
                "cta": "Buscar un versículo"
            }
        },
        "compare": {
            "eyebrow": "Comparación honesta",
            "title": "Lo que tenemos. Lo que no. Sin promesas.",
            "lede": "No pretendemos ser perfectos. Aquí va lo que ofrecemos — y lo que no — frente a las apps bíblicas habituales.",
            "feature": "Característica",
            "others": "Otras apps",
            "yes": "Sí",
            "no": "No",
            "mixed": "A veces",
            "row1": "Sin rastreadores ni anuncios",
            "row2": "Notas sincronizadas gratis",
            "row3": "Funciona offline",
            "row4": "Código abierto",
            "row5": "Suscripción premium obligatoria"
        },
        "faq": {
            "eyebrow": "Preguntas frecuentes",
            "title": "Lo que no encontraste en otros sitios",
            "q1": "¿Es realmente gratis?",
            "a1": "Sí, por completo. Sin anuncios, sin suscripción, sin tarjeta. El proyecto se sostiene con trabajo voluntario y donaciones opcionales.",
            "q2": "¿Están seguros mis datos?",
            "a2": "Las notas y favoritos se guardan cifrados en Cloudflare. No vendemos ni compartimos nada. Puedes borrar tu cuenta en cualquier momento.",
            "q3": "¿Funciona en el móvil?",
            "a3": "Sí. Es una aplicación web progresiva (PWA) — la instalas desde el navegador y se ve como una app nativa. Funciona en iOS, Android, cualquier tablet o portátil.",
            "q4": "¿De dónde vienen las traducciones?",
            "a4": "Versión en rumano: Biblia Cornilescu (VDC). Versión en español: Reina Valera (RVL). Son traducciones de dominio público o con permiso.",
            "q5": "¿Puedo contribuir?",
            "a5": "Sí — correcciones, nuevas traducciones, funciones. El código está en GitHub. Y las oraciones cuentan."
        },
        "final": {
            "title": "Vamos a leer.",
            "text": "Sin cuenta. Sin apps que descargar. Solo las Escrituras, en tu idioma, en cualquier pantalla.",
            "cta": "Abrir la Biblia"
        },
        "footer": {
            "tagline": "Una Biblia sencilla, para todos.",
            "nav_aria": "Enlaces del pie",
            "bible": "Biblia",
            "compare": "Comparar",
            "index": "Índice temático",
            "sitemap": "Mapa del sitio",
            "github": "GitHub"
        }
    },
    "en": {
        "skip_to_content": "Skip to content",
        "meta": {
            "title": "The Bible that does not track you. 4 languages. No ads.",
            "description": "RoBible is a free web app for reading, searching and studying the Bible. No trackers, no ads, no marketing cookies. In Romanian, Spanish, English and Chinese."
        },
        "hero": {
            "eyebrow": "Online Bible — free, no ads",
            "title": "Scripture you can trust. And in your pocket.",
            "lede": "66 books. 31,102 verses. 4 languages. Smart search, version comparison, synced notes — all without ads, trackers, or subscriptions.",
            "cta_primary": "Start reading",
            "cta_secondary": "Try demo",
            "lang_label": "Choose language",
            "scroll": "Scroll down"
        },
        "demo": {
            "eyebrow": "Live demo",
            "hint": "Type a reference (e.g. rom 3 5) and press Enter — we take you to the verse, highlighted in green.",
            "placeholder": "rom 3 5, 1 john 2 6, genesis 1:1…",
            "button": "Search",
            "aria": "Live reference search",
            "no_results": "No results. Try another format (e.g. rom 3 5, 1co 13 4, acts 2 38).",
            "error": "Something went wrong. Try again.",
            "open": "Open verse →"
        },
        "stats": {
            "label": "Project numbers",
            "languages": "Languages",
            "books": "Books",
            "verses": "Verses",
            "free": "Price",
            "free_value": "Free"
        },
        "features": {
            "eyebrow": "What RoBible does",
            "title": "Features built for serious study — and comfortable reading.",
            "f1": {
                "title": "Reference search, not index lookup",
                "text": "Type 'rom 3 5' or '1 john 2 6' or 'genesis 1:1' and you arrive directly. Diacritics and typos are handled.",
                "example": "rom 3 5 → Romans 3:5"
            },
            "f2": {
                "title": "Search the text, not just quotes",
                "text": "Search words, phrases, or combinations. You can search the whole Bible, a single testament, or one book.",
                "example": "“fear of God” → 74 results"
            },
            "f3": {
                "title": "Compare versions, verse by verse",
                "text": "See the same passage in two translations, side by side. Useful for deep study or teaching.",
                "example": "ESV vs NIV — John 3:16"
            },
            "f4": {
                "title": "Notes and favorites in the cloud",
                "text": "Write notes on verses, group them by topic, save favorites. Everything syncs across devices, free, no card.",
                "example": "Your note on John 3:16 — on phone, tablet, laptop."
            }
        },
        "why": {
            "eyebrow": "Why RoBible",
            "title": "Because a Bible should not be a product.",
            "lede": "We don't want your money, your attention, or your data. We just want you to read Scripture without obstacles.",
            "w1": {
                "title": "No trackers. No ads. No marketing cookies.",
                "text": "No Google Analytics, no Facebook Pixel, no sponsored content. You read, that's it."
            },
            "w2": {
                "title": "Works offline (PWA).",
                "text": "Install the app on your phone. It downloads once, then works without internet. Perfect for travel, sermons, retreats."
            },
            "w3": {
                "title": "4 languages from day one: ro, es, en, zh.",
                "text": "We don't add languages for marketing. We add them because everyone deserves Scripture in their own tongue."
            },
            "w4": {
                "title": "Open source. No surprises.",
                "text": "The code is on GitHub. If you don't like a decision, you can change it. Or find someone who will."
            }
        },
        "audience": {
            "eyebrow": "For whom",
            "title": "Every reader, their own way.",
            "p1": {
                "title": "Individual study",
                "text": "You read, search, take notes. No distraction, no mandatory account, no ads between verses.",
                "cta": "Open the Bible"
            },
            "p2": {
                "title": "Teaching and group study",
                "text": "Compare translations, take notes by topic, prepare lessons without fighting the interface.",
                "cta": "Compare versions"
            },
            "p3": {
                "title": "Just curiosity",
                "text": "You want to find a quote you heard on the radio. You don't need an account. You type and find.",
                "cta": "Find a verse"
            }
        },
        "compare": {
            "eyebrow": "Honest comparison",
            "title": "What we have. What we don't. No promises.",
            "lede": "We don't claim to be perfect. Here is what we offer — and what we don't — against typical Bible apps.",
            "feature": "Feature",
            "others": "Other apps",
            "yes": "Yes",
            "no": "No",
            "mixed": "Sometimes",
            "row1": "No trackers or ads",
            "row2": "Notes synced free",
            "row3": "Works offline",
            "row4": "Open source",
            "row5": "Premium subscription required"
        },
        "faq": {
            "eyebrow": "FAQ",
            "title": "What you did not find elsewhere",
            "q1": "Is it really free?",
            "a1": "Yes, completely. No ads, no subscription, no card. The project is sustained by volunteer work and optional donations.",
            "q2": "Is my data safe?",
            "a2": "Notes and favorites are stored encrypted at Cloudflare. We do not sell or share anything. You can delete your account anytime.",
            "q3": "Does it work on mobile?",
            "a3": "Yes. It is a progressive web app (PWA) — you install it from the browser and it behaves like a native app. Works on iOS, Android, any tablet or laptop.",
            "q4": "Where do the translations come from?",
            "a4": "Romanian version: Biblia Cornilescu (VDC). Spanish version: Reina Valera (RVL). These are public-domain translations or used with permission.",
            "q5": "Can I contribute?",
            "a5": "Yes — corrections, new translations, features. The code is on GitHub. And prayers count."
        },
        "final": {
            "title": "Let's read.",
            "text": "No account. No app to download. Just Scripture, in your language, on any screen.",
            "cta": "Open the Bible"
        },
        "footer": {
            "tagline": "A simple Bible, for everyone.",
            "nav_aria": "Footer links",
            "bible": "Bible",
            "compare": "Compare",
            "index": "Topic index",
            "sitemap": "Sitemap",
            "github": "GitHub"
        }
    },
    "zh": {
        "skip_to_content": "跳到主要内容",
        "meta": {
            "title": "不追踪你的圣经。四种语言。无广告。",
            "description": "RoBible 是一个免费的网络应用,用于阅读、搜索和学习圣经。无追踪器,无广告,无营销 cookie。支持罗马尼亚语、西班牙语、英语和中文。"
        },
        "hero": {
            "eyebrow": "在线圣经 — 免费,无广告",
            "title": "可信的经文。装进口袋。",
            "lede": "66 卷书。31,102 节经文。4 种语言。智能搜索、版本对比、同步笔记 — 全部无广告、无追踪器、无订阅。",
            "cta_primary": "开始阅读",
            "cta_secondary": "试用演示",
            "lang_label": "选择语言",
            "scroll": "向下滚动"
        },
        "demo": {
            "eyebrow": "实时演示",
            "hint": "输入经文引用(例如 约 3:16)并按回车 — 我们会带您到该节经文,以绿色高亮显示。",
            "placeholder": "约 3:16, 创世记 1:1, 罗马书 8 28…",
            "button": "搜索",
            "aria": "实时经文引用搜索",
            "no_results": "无结果。请尝试其他格式(例如 约 3:16, 罗 8 28)。",
            "error": "出错了。请重试。",
            "open": "打开经文 →"
        },
        "stats": {
            "label": "项目数据",
            "languages": "语言",
            "books": "书卷",
            "verses": "经文",
            "free": "价格",
            "free_value": "免费"
        },
        "features": {
            "eyebrow": "RoBible 的功能",
            "title": "为深度学习和舒适阅读而设计。",
            "f1": {
                "title": "经文引用搜索,不是索引查找",
                "text": "输入 '约 3:16' 或 '罗 8:28' 或 '创 1:1' 直接到达。支持变音符号和拼写错误。",
                "example": "约 3 16 → 约翰福音 3:16"
            },
            "f2": {
                "title": "搜索全文,不只是引文",
                "text": "搜索单词、短语或组合。可以搜索整本圣经、单个约或一本书。",
                "example": "“敬畏神” → 74 个结果"
            },
            "f3": {
                "title": "逐节对比版本",
                "text": "并排查看同一段经文的两个译本。用于深入研究或教导。",
                "example": "和合本 vs 新译本 — 约翰福音 3:16"
            },
            "f4": {
                "title": "云端笔记和收藏",
                "text": "为经文写笔记,按主题分组,保存收藏。一切在设备间同步,免费,无需信用卡。",
                "example": "你在约翰福音 3:16 的笔记 — 在手机、平板、笔记本上。"
            }
        },
        "why": {
            "eyebrow": "为什么选择 RoBible",
            "title": "因为圣经不应该是产品。",
            "lede": "我们不要你的钱、你的注意力或你的数据。我们只想让你无障碍地阅读经文。",
            "w1": {
                "title": "无追踪器。无广告。无营销 cookie。",
                "text": "没有 Google Analytics,没有 Facebook Pixel,没有赞助内容。你读,就这样。"
            },
            "w2": {
                "title": "离线工作 (PWA)。",
                "text": "在手机上安装应用。下载一次,然后无网络也能用。非常适合旅行、讲道、避静。"
            },
            "w3": {
                "title": "从第一天起就有 4 种语言:ro、es、en、zh。",
                "text": "我们添加语言不是为了营销。我们添加它们是因为每个人都应该用自己的语言读经文。"
            },
            "w4": {
                "title": "开源。没有意外。",
                "text": "代码在 GitHub 上。如果你不喜欢某个决定,你可以改。或者找人改。"
            }
        },
        "audience": {
            "eyebrow": "给谁用",
            "title": "每个读者,各自的方式。",
            "p1": {
                "title": "个人学习",
                "text": "读、搜索、记笔记。无干扰、无强制账户、节间无广告。",
                "cta": "打开圣经"
            },
            "p2": {
                "title": "教学和小组学习",
                "text": "对比译本、按主题记笔记、准备课程,不被界面困扰。",
                "cta": "对比版本"
            },
            "p3": {
                "title": "只是好奇",
                "text": "你想找在广播里听到的一段引文。无需账户。输入即找到。",
                "cta": "查找经文"
            }
        },
        "compare": {
            "eyebrow": "诚实的对比",
            "title": "我们有的。我们没有的。不做承诺。",
            "lede": "我们不声称完美。这是我们提供的 — 以及不提供的 — 与典型圣经应用相比。",
            "feature": "功能",
            "others": "其他应用",
            "yes": "是",
            "no": "否",
            "mixed": "有时",
            "row1": "无追踪器或广告",
            "row2": "笔记免费同步",
            "row3": "离线工作",
            "row4": "开源",
            "row5": "必须付费订阅"
        },
        "faq": {
            "eyebrow": "常见问题",
            "title": "你在其他地方找不到的",
            "q1": "真的免费吗?",
            "a1": "是的,完全免费。无广告、无订阅、无信用卡。该项目由志愿者工作和可选的捐赠支持。",
            "q2": "我的数据安全吗?",
            "a2": "笔记和收藏在 Cloudflare 上加密存储。我们不出售或分享任何内容。你可以随时删除账户。",
            "q3": "手机上能用吗?",
            "a3": "可以。它是一个渐进式网络应用 (PWA) — 你从浏览器安装它,它就像原生应用一样运行。适用于 iOS、Android、任何平板电脑或笔记本电脑。",
            "q4": "译本从哪里来?",
            "a4": "中文版:和合本。这些是公共领域的译本或经许可使用。",
            "q5": "我可以贡献吗?",
            "a5": "可以 — 更正、新译本、新功能。代码在 GitHub 上。祈祷也算。"
        },
        "final": {
            "title": "让我们一起读吧。",
            "text": "无需账户。无需下载应用。只有经文,用你的语言,在任何屏幕上。",
            "cta": "打开圣经"
        },
        "footer": {
            "tagline": "一本简单的圣经,给每个人。",
            "nav_aria": "页脚链接",
            "bible": "圣经",
            "compare": "对比",
            "index": "主题索引",
            "sitemap": "网站地图",
            "github": "GitHub"
        }
    }
}


def main():
    for lang_code, landing_data in translations.items():
        path = os.path.join(LANGS_DIR, f"{lang_code}.json")
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)

        # Replace landing section
        data["landing"] = landing_data

        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        print(f"Updated {path}")


if __name__ == "__main__":
    main()

// Dictar en vez de teclear.
//
// Envuelve `SpeechRecognition`, la API de reconocimiento del navegador. Todo
// ocurre fuera de RoBible: no hay servidor propio, ni se guarda el audio, ni se
// manda nada a nuestro backend.
//
// ── Lo que hay que decirle al usuario ───────────────────────────────────────
//
// **En Chrome y Edge de escritorio el audio viaja a los servidores de Google**
// para reconocerlo. Es como está implementada la API en ese navegador, no una
// decisión nuestra, pero la landing de RoBible promete «la Biblia que no te
// sigue» y una excepción callada a eso sería justo lo que no se puede hacer.
// Por eso el aviso va en la interfaz, al lado del botón, y no enterrado en una
// política. En Android e iOS el reconocimiento es del propio sistema.
//
// ── Soporte ─────────────────────────────────────────────────────────────────
//
// Chrome, Edge y Android: sí. Safari (macOS/iOS): sí, con permiso cada vez.
// Firefox: no lo implementa. Donde no hay soporte, el botón **no se pinta** —
// un control que no puede funcionar es peor que no tenerlo (mismo criterio que
// la tarjeta de notificaciones del perfil).

const Reconocedor =
  typeof window !== 'undefined'
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null;

/** ¿Este navegador sabe dictar? */
export const soportado = () => !!Reconocedor;

/**
 * ¿La política de permisos del propio sitio deja usar el micrófono?
 *
 * Existe por un fallo real: `netlify.toml` mandaba `Permissions-Policy:
 * microphone=()`, y la lista vacía no significa «restringido» sino *ningún
 * origen, ni siquiera el propio*. Con eso el navegador no pide permiso — lo
 * deniega en el acto—, y el mensaje que veía el usuario era «el micrófono está
 * bloqueado en el navegador»: culpaba a su navegador de algo que hacía nuestra
 * propia cabecera.
 *
 * `featurePolicy` no es estándar y sólo está en Chromium; cuando no existe se
 * responde `true` y ya lo dirá `getUserMedia`. Aquí no se busca certeza, se
 * busca poder dar el mensaje correcto cuando se puede.
 */
export const politicaPermiteMicrofono = () => {
  try {
    const fp = typeof document !== 'undefined' ? document.featurePolicy : null;
    if (!fp?.allowsFeature) return true;
    return fp.allowsFeature('microphone');
  } catch {
    return true;
  }
};

/**
 * Pide permiso de micrófono de forma explícita.
 *
 * `SpeechRecognition.start()` debería pedirlo solo, y en Chrome lo hace — pero
 * no en todos los navegadores ni en todas las versiones, y cuando no lo hace el
 * botón se queda quieto sin decir nada: ni escucha, ni falla, ni pregunta. Con
 * `getUserMedia` el diálogo del navegador sale siempre y, sobre todo, la
 * respuesta se puede leer.
 *
 * El micro se suelta inmediatamente: aquí sólo interesa la respuesta al
 * permiso, no el audio. Dejar la pista abierta encendería el indicador de
 * grabación del sistema para nada.
 *
 * @returns {Promise<'ok'|'denegado'|'sin-microfono'|'sin-api'>}
 */
export const pedirPermiso = async () => {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return 'sin-api';
  // Si la política del sitio lo prohíbe, `getUserMedia` va a fallar igual pero
  // con `NotAllowedError`, que es indistinguible de «el usuario ha dicho que
  // no». Se comprueba antes para poder decir la verdad.
  if (!politicaPermiteMicrofono()) return 'bloqueado-por-el-sitio';
  try {
    const pista = await navigator.mediaDevices.getUserMedia({ audio: true });
    pista.getTracks().forEach((t) => t.stop());
    return 'ok';
  } catch (e) {
    if (e?.name === 'NotAllowedError' || e?.name === 'SecurityError') return 'denegado';
    if (e?.name === 'NotFoundError' || e?.name === 'DevicesNotFoundError') return 'sin-microfono';
    return 'denegado';
  }
};

/**
 * ¿Es Brave?
 *
 * Importa porque **Brave desactiva el reconocimiento de voz a propósito**: por
 * privacidad, quita el acceso al servicio de Google que hay detrás de esta API.
 * El objeto `webkitSpeechRecognition` sigue existiendo —por compatibilidad—,
 * así que `soportado()` dice que sí y luego no pasa absolutamente nada: el
 * botón no escucha, no pide permiso y no da error.
 *
 * Es asíncrono porque así lo expone Brave (`navigator.brave.isBrave()`).
 */
export const esBrave = async () => {
  try {
    return typeof navigator !== 'undefined' && !!(await navigator.brave?.isBrave?.());
  } catch {
    return false;
  }
};

/**
 * En Chrome de escritorio el audio sale a un servidor de Google; en el móvil lo
 * resuelve el sistema operativo. Sirve para decidir si hace falta el aviso.
 *
 * No hay forma de preguntarlo a la API, así que se deduce del navegador: el
 * prefijo `webkit` en un escritorio que no es Safari significa Chrome o Edge.
 */
export const usaServidorExterno = () => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent.toLowerCase();
  const movil = /android|iphone|ipad|ipod/.test(ua);
  if (movil) return false;
  const safari = /safari/.test(ua) && !/chrome|chromium|edg/.test(ua);
  return !safari;
};

/** El locale de reconocimiento que le toca a cada versión bíblica. */
export const localeDeReconocimiento = (locale) => {
  const base = String(locale || 'ro').slice(0, 2).toLowerCase();
  return { ro: 'ro-RO', es: 'es-ES', en: 'en-US', zh: 'zh-CN' }[base] || 'ro-RO';
};

/**
 * Arranca una sesión de dictado.
 *
 * Devuelve un objeto con `parar()`. El ciclo de vida es de una sola frase:
 * `continuous = false`, así que el reconocedor se apaga solo en cuanto detecta
 * que has terminado de hablar. Es lo que se quiere aquí — se dicta una
 * referencia, no se transcribe un sermón — y además evita dejar el micrófono
 * abierto si alguien se olvida del botón.
 *
 * `interimResults` está encendido para poder ir enseñando lo que se entiende
 * mientras se habla: sin eso, el campo se queda quieto varios segundos y parece
 * que no funciona.
 *
 * @param {object} opciones
 * @param {string} opciones.locale          'ro-RO', 'es-ES'…
 * @param {(texto: string, final: boolean) => void} opciones.alEscuchar
 * @param {(codigo: string) => void} [opciones.alFallar]
 * @param {() => void} [opciones.alTerminar]
 */
export function dictar({ locale = 'ro-RO', alEscuchar, alFallar, alTerminar, topeMs = 15000 } = {}) {
  if (!Reconocedor) {
    alFallar?.('not_supported');
    return { parar: () => {} };
  }

  const rec = new Reconocedor();
  rec.lang = locale;
  rec.continuous = false;
  rec.interimResults = true;
  // Una sola alternativa: quedarse con la mejor y no complicar la interfaz con
  // una lista de «quizá quisiste decir».
  rec.maxAlternatives = 1;

  let parado = false;

  /**
   * Tope duro de escucha.
   *
   * `continuous = false` debería apagar el reconocedor en cuanto detecta que
   * has terminado de hablar, y normalmente lo hace. Pero no siempre: con ruido
   * de sala —que es justo donde se va a usar esto— el detector de silencio no
   * llega a dispararse y la sesión se queda abierta indefinidamente. Un
   * micrófono abierto que nadie sabe que está abierto no es aceptable, así que
   * aquí se corta pase lo que pase.
   *
   * Quince segundos: de sobra para decir «primul Samuel douăzeci opt» varias
   * veces, y poco para quedarse escuchando la reunión entera.
   */
  let temporizador = setTimeout(() => {
    parado = true;
    try { rec.stop(); } catch { /* ya estaba parado */ }
  }, topeMs);

  const limpiarTemporizador = () => {
    clearTimeout(temporizador);
    temporizador = null;
  };

  rec.onresult = (evento) => {
    // Se concatenan todos los tramos: Chrome va troceando la frase y quedarse
    // sólo con el último daba «șaisprezece» en vez de «Ioan trei șaisprezece».
    let texto = '';
    let final = false;
    for (let i = evento.resultIndex; i < evento.results.length; i += 1) {
      texto += evento.results[i][0].transcript;
      if (evento.results[i].isFinal) final = true;
    }
    alEscuchar?.(texto.trim(), final);

    // Con la frase ya cerrada no hay nada más que escuchar. Se para aquí en vez
    // de esperar a que el reconocedor lo decida: en algunos navegadores tarda
    // varios segundos más, y durante ese rato el indicador de grabación sigue
    // encendido sin motivo.
    if (final) {
      parado = true;
      limpiarTemporizador();
      try { rec.stop(); } catch { /* ya estaba parado */ }
    }
  };

  rec.onerror = (evento) => {
    // `aborted` es lo que emite el propio `stop()`: no es un fallo y avisar de
    // él enseñaría un error cada vez que el usuario suelta el botón.
    if (evento.error === 'aborted' && parado) return;
    // Los códigos importan porque piden respuestas distintas del usuario:
    // `not-allowed` es dar permiso, `service-not-allowed` es cambiar de
    // navegador (Brave), `network` es tener conexión. Un único «no te he
    // entendido» para los tres deja a la gente probando otra vez para nada.
    alFallar?.(evento.error || 'unknown');
  };

  rec.onend = () => {
    limpiarTemporizador();
    alTerminar?.();
  };

  try {
    rec.start();
  } catch {
    // `start()` lanza si ya había una sesión viva. Se trata como fin, no como
    // error: el usuario ha pulsado dos veces y con una basta.
    alTerminar?.();
  }

  return {
    parar: () => {
      parado = true;
      limpiarTemporizador();
      try { rec.stop(); } catch { /* ya estaba parado */ }
    },
  };
}

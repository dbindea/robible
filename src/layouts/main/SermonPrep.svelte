<script>
  /**
   * Preparación guiada de una predicación.
   *
   * Siete pasos en vez de un formulario gigante: TEXT → OBSERVARE → CONTEXT →
   * IDEE → STRUCTURĂ → DEZVOLTARE → FINALIZARE. Se puede retroceder y saltar
   * cualquier pregunta; **nada es obligatorio**. La aplicación acompaña, no
   * examina.
   *
   * Principio del módulo: RoBible NO escribe la predicación. Todo lo que se ve
   * aquí lo teclea el predicador; lo único que genera la aplicación es la
   * schiță, y a partir de la estructura que él mismo ha escrito.
   *
   * Guardado automático: se escribe en el dispositivo al instante y se sube con
   * retardo. Sin botón de guardar; sólo un «Salvat» discreto.
   */
  import { onDestroy, onMount, tick } from 'svelte';
  import { _ } from '../../services/i18n.service';
  import { sermonsStore } from '../../store/sermonsStore';
  import { setSermonPublic, buildPublicSermonUrl } from '../../services/sermons.service';
  import { USE_BACKEND } from '../../config.js';
  import { buildSnapshot } from '../../services/sermon-pulpit.service';
  import Icon from '../../components/Icon.svelte';
  import Ajutor from '../../components/Ajutor.svelte';
  import Recapitulare from '../../components/Recapitulare.svelte';
  import Notite from '../../components/Notite.svelte';
  import Sugestii from '../../components/Sugestii.svelte';
  import SeriesPicker from '../../components/SeriesPicker.svelte';
  import Modal from '../../components/Modal.svelte';
  import TextoFormateado from '../../components/TextoFormateado.svelte';
  import { searchReferences } from '../../services/referenceSearch.service';
  import {
    STEPS,
    alternarMarca as envolverEnMarca,
    collectReferences,
    emptyContent,
    generateOutline,
    insertarCita,
    movePoint,
    newPoint,
    newSubpoint,
    normalizeContent,
    normalizeOutline,
    mergeOutline,
    clavesATexto,
    textoAClaves,
    quitarMarcas,
    sermonWordCount,
    estimatedMinutes,
    stepCompletion,
  } from '../../services/sermon-content.service';

  export let bible = [];
  export let map = {};
  export let sermonId = '';

  let sermon = null;
  let content = emptyContent();
  let cargando = true;
  let paso = 'text';
  let estadoGuardado = ''; // '' | 'guardando' | 'guardado'
  let guardadoTimer;
  let etiquetaTimer;
  // ¿Hay un guardado del retardo todavía en el aire? Sólo mientras esto sea
  // `true` tiene sentido que «Actualizează» suba algo antes de pedir el
  // detalle — ver el comentario de `actualizarDesdeServidor`.
  let guardadoEnElAire = false;

  // Vista final y schiță
  let vista = 'prep'; // 'prep' | 'final' | 'outline'
  let outline = null;

  // ── Marcado de palabras para la schiță ──────────────────────────────────
  //
  // Se guarda la referencia a cada textarea para poder leer qué hay
  // seleccionado y devolver el cursor a su sitio después de marcar. Sin eso el
  // cursor salta al final del campo en cada marca, que al escribir es
  // insufrible.
  let areas = {};
  let seleccion = {}; // clave del campo → true si hay algo seleccionado

  const refrescarSeleccion = (puntoId, campo) => {
    const el = areas[`${puntoId}:${campo}`];
    seleccion = { ...seleccion, [`${puntoId}:${campo}`]: !!el && el.selectionStart !== el.selectionEnd };
  };

  const marcarSeleccion = async (puntoId, campo) => {
    const el = areas[`${puntoId}:${campo}`];
    if (!el) return;
    const d = desarrolloDe(puntoId);
    const r = envolverEnMarca(d[campo] || '', el.selectionStart, el.selectionEnd);
    d[campo] = r.texto;
    content = content; // Svelte no ve la mutación dentro del objeto anidado.
    guardarContenido();
    // El valor no está en el DOM hasta que Svelte repinta; sin esperar, la
    // selección se restauraría sobre el texto viejo.
    await tick();
    el.focus();
    el.setSelectionRange(r.desde, r.hasta);
    refrescarSeleccion(puntoId, campo);
  };

  // ── Referencias a otros pasajes ─────────────────────────────────────────
  //
  // El mismo buscador sirve para dos cosas, según `modoBuscador`:
  //   - 'ref'  → añade la referencia al pie del punto (lo de siempre).
  //   - 'cita' → inserta el versículo ENTERO dentro de un textarea, en el
  //              cursor. Es la diferencia entre citar un pasaje y leerlo
  //              en voz alta en mitad de la explicación.
  let buscadorAbierto = false;
  let modoBuscador = 'ref';
  let puntoDeLaRef = '';
  let campoDeLaCita = '';
  let consultaRef = '';
  let sugerenciasRef = [];

  const abrirBuscadorRefs = (puntoId) => {
    modoBuscador = 'ref';
    puntoDeLaRef = puntoId;
    consultaRef = '';
    sugerenciasRef = [];
    buscadorAbierto = true;
  };

  /**
   * Abre el mismo buscador para insertar el versículo entero en un textarea.
   * `clave` identifica el campo: `"<id>:<campo>"` para un punto o subpunto
   * (p. ej. `"p_1:explain"`, `"s_2:text"`), o el nombre a secas para un campo
   * de nivel superior (`"intro"`, `"conclusion"`) — ver `leerCampoTexto`.
   */
  const abrirInsertarCita = (clave) => {
    modoBuscador = 'cita';
    campoDeLaCita = clave;
    consultaRef = '';
    sugerenciasRef = [];
    buscadorAbierto = true;
  };

  const buscarRef = () => {
    sugerenciasRef = consultaRef.trim() ? searchReferences(consultaRef, map, 5) : [];
  };

  /** Lee o escribe un campo de texto libre, sea del desarrollo (con `:`) o de
   *  nivel superior (`intro`/`conclusion`). Un único punto de acceso para que
   *  `insertarCitaEnCampo` no tenga que saber de antemano dónde vive cada uno. */
  const leerCampoTexto = (clave) =>
    clave.includes(':') ? (desarrolloDe(clave.split(':')[0])[clave.split(':')[1]] || '') : (content[clave] || '');

  const escribirCampoTexto = (clave, valor) => {
    if (clave.includes(':')) {
      const [id, campo] = clave.split(':');
      desarrolloDe(id)[campo] = valor;
    } else {
      content[clave] = valor;
    }
  };

  /**
   * Guarda la referencia **con su texto ya resuelto**.
   *
   * Es lo que permite que el Modo Amvon la abra sin conexión: allí no se
   * resuelve nada contra la Biblia, se lee lo que quedó guardado (ver
   * `sermon-pulpit.service.js`).
   */
  const añadirRef = (m) => {
    if (!m || !Number.isInteger(m.book) || !m.chapter || !m.verse) return;
    const label = `${map[m.book] || ''} ${m.chapter}:${m.verse}`.trim();
    const texto = bible?.[m.book]?.[m.chapter - 1]?.[m.verse - 1] || '';

    if (modoBuscador === 'cita') {
      insertarCitaEnCampo(campoDeLaCita, { label, text: texto });
    } else {
      const d = desarrolloDe(puntoDeLaRef);
      d.refs = d.refs || [];
      if (!d.refs.some((r) => r.label === label)) {
        d.refs = [...d.refs, { book: m.book, chapter: m.chapter, verse: m.verse, label, text: texto }];
      }
      content = content;
      guardarContenido();
    }
    buscadorAbierto = false;
  };

  /** Inserta la cita en el cursor del textarea que la pidió, y deja el foco
   *  y el cursor justo después de lo insertado — es lo siguiente que hay que
   *  tocar, y sin esto habría que ir a buscar el campo a mano. */
  const insertarCitaEnCampo = async (clave, ref) => {
    const el = areas[clave];
    const actual = leerCampoTexto(clave);
    const desde = el ? el.selectionStart : actual.length;
    const hasta = el ? el.selectionEnd : desde;
    const r = insertarCita(actual, desde, hasta, ref);
    escribirCampoTexto(clave, r.texto);
    content = content;
    guardarContenido();
    await tick();
    if (el) {
      el.focus();
      el.setSelectionRange(r.cursor, r.cursor);
    }
  };

  // ── Impresión ───────────────────────────────────────────────────────────
  //
  // Por si el móvil falla delante de la congregación. La orientación la decide
  // la vista: el documento en retrato, porque es texto seguido, y la schiță en
  // apaisado a dos columnas, para doblarla por la mitad y llevarla en la Biblia.
  //
  // El navegador hace todo el trabajo: no hay generador de PDF ni librería. Se
  // imprime desde el diálogo del sistema, que en cualquier navegador de hoy
  // permite «Guardar como PDF».
  let generandoPdf = false;

  const etiquetasPdf = () => ({
    explain: $_('app.sermons.dev_explain').toUpperCase(),
    illustrate: $_('app.sermons.dev_illustrate').toUpperCase(),
    apply: $_('app.sermons.dev_apply').toUpperCase(),
    intro: $_('app.sermons.intro').toUpperCase(),
    conclusion: $_('app.sermons.conclusion').toUpperCase(),
    refs: $_('app.sermons.refs_title').toUpperCase(),
    idea: $_('app.sermons.idea_central').toUpperCase(),
    application: $_('app.sermons.outline_application').toUpperCase(),
  });

  const descargarPdf = async (cual) => {
    generandoPdf = true;
    try {
      const datos = { title: sermon?.title || '', reference: referencia };
      const { descargarPredica, descargarSchita } = await import('../../services/sermon-pdf.service.js');
      if (cual === 'schita') await descargarSchita(datos, outline, etiquetasPdf());
      else await descargarPredica(datos, content, etiquetasPdf());
    } finally {
      generandoPdf = false;
    }
  };

  // ── Publicar en internet ────────────────────────────────────────────────
  //
  // A diferencia del resto del módulo, esto NO es local-first: publicar es dar
  // de alta una URL que va a leer gente de fuera, y eso sólo tiene sentido si el
  // servidor lo confirma. Sin conexión no se puede, y decirlo es más honesto que
  // dejar al predicador con un enlace que no existe.
  let publicando = false;
  let avisoPublicar = '';
  let avisoPublicarTimer;

  const avisar = (mensaje) => {
    avisoPublicar = mensaje;
    clearTimeout(avisoPublicarTimer);
    avisoPublicarTimer = setTimeout(() => { avisoPublicar = ''; }, 2800);
  };

  $: enlacePublico = sermon?.isPublic && sermon?.publicSlug ? buildPublicSermonUrl(sermon.publicSlug) : '';

  const alternarPublicacion = async () => {
    if (!sermon || publicando) return;
    // Publicar una predicación sin puntos daría una página en blanco a quien
    // abra el enlace, que es justo el contenido fino que no conviene indexar.
    if (!sermon.isPublic && !content.structure.length) {
      avisar($_('app.sermons.share.needs_points'));
      return;
    }
    publicando = true;
    try {
      const res = await setSermonPublic(sermonId, !sermon.isPublic);
      if (res.ok) {
        sermon = res.sermon || sermon;
        avisar(sermon.isPublic ? $_('app.sermons.share.published') : $_('app.sermons.share.unpublished'));
      } else {
        avisar($_(res.error));
      }
    } finally {
      publicando = false;
    }
  };

  const copiarEnlace = async () => {
    if (!enlacePublico) return;
    try {
      await navigator.clipboard.writeText(enlacePublico);
      avisar($_('app.topics.share.copied'));
    } catch {
      avisar($_('app.topics.share.copy_failed'));
    }
  };

  const quitarRef = (puntoId, ref) => {
    const d = desarrolloDe(puntoId);
    d.refs = (d.refs || []).filter((r) => r.label !== ref.label);
    content = content;
    guardarContenido();
  };

  $: pasoIndex = STEPS.indexOf(paso);
  $: completado = stepCompletion(content);
  $: palabras = sermonWordCount(content);
  $: minutos = estimatedMinutes(palabras);

  // La perícopa, resuelta desde la Biblia del cliente. No viaja por la API: el
  // texto ya está en el dispositivo y así la preparación funciona sin conexión.
  $: pericopa = sermon
    ? Array.from(
        { length: (sermon.verseEnd || sermon.verseStart) - sermon.verseStart + 1 },
        (_, i) => ({
          numero: sermon.verseStart + i,
          texto: bible[sermon.book]?.[sermon.chapter - 1]?.[sermon.verseStart + i - 1] || '',
        }),
      ).filter((v) => v.texto)
    : [];

  $: referencia = sermon
    ? `${map[sermon.book] || ''} ${sermon.chapter}:${sermon.verseStart}${
        sermon.verseEnd && sermon.verseEnd !== sermon.verseStart ? `-${sermon.verseEnd}` : ''
      }`
    : '';

  // Contexto: los versículos de antes y de después, para leerlos sin salir.
  $: contextoAntes = sermon ? textoDeRango(sermon.book, sermon.chapter, Math.max(1, sermon.verseStart - 4), sermon.verseStart - 1) : [];
  $: contextoDespues = sermon ? textoDeRango(sermon.book, sermon.chapter, (sermon.verseEnd || sermon.verseStart) + 1, (sermon.verseEnd || sermon.verseStart) + 4) : [];

  function textoDeRango(book, chapter, desde, hasta) {
    if (desde > hasta) return [];
    const cap = bible[book]?.[chapter - 1] || [];
    const out = [];
    for (let v = desde; v <= hasta && v <= cap.length; v++) {
      if (cap[v - 1]) out.push({ numero: v, texto: cap[v - 1] });
    }
    return out;
  }

  // ── Guardado automático ───────────────────────────────────────────────────
  //
  // El retardo es para no mandar una petición por tecla. Lo local, en cambio,
  // se escribe de inmediato dentro de `sermonsStore.update`: si el navegador se
  // cierra a mitad de frase, lo escrito ya está a salvo en el dispositivo.
  const RETARDO_MS = 1200;

  const guardar = (cambios) => {
    estadoGuardado = 'guardando';
    guardadoEnElAire = true;
    clearTimeout(guardadoTimer);
    guardadoTimer = setTimeout(async () => {
      await sermonsStore.update(sermonId, cambios);
      guardadoEnElAire = false;
      estadoGuardado = 'guardado';
      clearTimeout(etiquetaTimer);
      etiquetaTimer = setTimeout(() => { estadoGuardado = ''; }, 2000);
    }, RETARDO_MS);
  };

  const guardarContenido = () => {
    content = { ...content };
    guardar({ content: JSON.stringify(content) });
  };

  // Guardado inmediato, sin esperar al retardo. Se usa al salir de la pantalla,
  // al cambiar de paso y antes de un refresco manual: son los momentos en que
  // dejar algo a medias significa perderlo.
  //
  // Manda `outline` SIEMPRE que exista, no sólo cuando se está mirando la
  // schiță: `guardarSchita` comparte el mismo `guardadoTimer` que el
  // contenido, así que cambiar de paso o salir a mitad del retardo de la
  // schiță cancelaba su temporizador sin haber llegado a mandar el cambio —
  // se perdía entero, y ni siquiera quedaba en el dispositivo, porque a
  // diferencia del contenido, el `outline` no se escribe en ningún sitio
  // hasta que el propio guardado lo hace. Mandarlo de más aquí no hace daño:
  // si no cambió, el PATCH escribe lo mismo que ya había.
  const guardarYa = async () => {
    clearTimeout(guardadoTimer);
    guardadoEnElAire = false;
    const cambios = { content: JSON.stringify(content) };
    if (outline) cambios.outline = JSON.stringify(outline);
    await sermonsStore.update(sermonId, cambios);
  };

  const irAPaso = async (siguiente) => {
    await guardarYa();
    paso = siguiente;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ── Marcas sobre el texto ─────────────────────────────────────────────────
  const alternarMarca = (numero, palabra) => {
    const clave = `${numero}|${palabra}`;
    const existe = content.marks.find((m) => `${m.verse}|${m.word}` === clave);
    content.marks = existe
      ? content.marks.filter((m) => `${m.verse}|${m.word}` !== clave)
      : [...content.marks, { verse: numero, word: palabra }];
    guardarContenido();
  };

  const estaMarcada = (numero, palabra) =>
    content.marks.some((m) => m.verse === numero && m.word === palabra);

  // Se parte por espacios conservando la puntuación pegada, para que al marcar
  // «stâncă.» y «stâncă» no se traten como dos palabras distintas.
  const palabrasDe = (texto) => texto.split(/(\s+)/).filter((t) => t.trim());
  const limpia = (p) => p.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');

  // ── Estructura ────────────────────────────────────────────────────────────
  const añadirPunto = () => {
    content.structure = [...content.structure, newPoint()];
    guardarContenido();
  };

  const borrarPunto = (id) => {
    const punto = content.structure.find((p) => p.id === id);
    content.structure = content.structure.filter((p) => p.id !== id);
    // El desarrollo huérfano se va con su punto —y con sus subpuntos, que
    // guardan el suyo en el mismo mapa—: si no, el JSON crece con trozos que
    // ya no se ven en ninguna pantalla.
    const fuera = new Set([id, ...(punto?.subpoints || []).map((s) => s.id)]);
    content.development = Object.fromEntries(
      Object.entries(content.development).filter(([clave]) => !fuera.has(clave)),
    );
    guardarContenido();
  };

  const mover = (index, delta) => {
    content.structure = movePoint(content.structure, index, delta);
    guardarContenido();
  };

  // ── Título editable en línea ──────────────────────────────────────────────
  //
  // El título se decide antes de escribir nada y casi siempre cambia: se empieza
  // con «Suferința» y se acaba con «De ce ne mirăm de încercare?». Estaba fijo
  // desde la creación, así que la única forma de corregirlo era duplicar la
  // predicación entera.
  //
  // Se edita aquí y no en la lista porque es donde se está trabajando; en la
  // lista el título es una fila de un listado y un campo suelto invitaría a
  // tocarlo sin querer al buscar.
  let editandoTitulo = false;
  let borradorTitulo = '';
  let inputTitulo;
  let avisoTitulo = '';

  const editarTitulo = async () => {
    borradorTitulo = sermon?.title || '';
    editandoTitulo = true;
    await tick();
    inputTitulo?.focus();
    inputTitulo?.select();
  };

  /**
   * Guarda el título si tiene algo; si está vacío, deja lo que había.
   *
   * **No atrapa el foco.** Insistir con `focus()` hasta que escriba algo es lo
   * que pide un campo obligatorio, y también es la forma más rápida de dejar a
   * alguien encerrado en un input del que no sabe salir. Se recupera el título
   * anterior y se explica por qué; las predicaciones nuevas ya no pueden nacer
   * sin título, así que el caso vacío sólo lo alcanzan las de antes de esto.
   */
  const guardarTitulo = async () => {
    // Salir del modo edición quita el <input> del DOM, y al quitarlo el
    // navegador dispara su `blur` — que vuelve a entrar aquí. Sin esta guarda,
    // Escape cancelaba y acto seguido el blur guardaba justo el borrador que se
    // acababa de descartar, así que cancelar no cancelaba nada. También evita
    // que Enter guarde dos veces.
    if (!editandoTitulo) return;

    const limpio = borradorTitulo.trim();
    editandoTitulo = false;

    if (!limpio) {
      avisoTitulo = $_('app.sermons.title_required');
      return;
    }
    avisoTitulo = '';
    if (limpio === (sermon.title || '')) return;

    // `sermon` se cargó una vez en onMount y no se refresca (ver el comentario
    // de `crearSchita`): hay que actualizar la copia local o la cabecera
    // seguiría enseñando el título viejo hasta recargar.
    sermon = { ...sermon, title: limpio };
    await sermonsStore.update(sermonId, { title: limpio });
  };

  const cancelarTitulo = () => {
    editandoTitulo = false;
    avisoTitulo = '';
  };

  const teclaTitulo = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      guardarTitulo();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelarTitulo();
    }
  };

  // ── Propoziția de tranziție ───────────────────────────────────────────────
  let areaTransicion;

  /**
   * Mete la plantilla elegida en el campo de la transición.
   *
   * **Nunca pisa lo escrito**: si ya hay algo, la plantilla se añade en una
   * línea nueva. Un molde que borrase la frase que el predicador acaba de
   * formular convertiría un botón de ayuda en una trampa, y encima sin deshacer.
   * Con el campo vacío —el caso normal— simplemente lo rellena.
   */
  const usarSugerencia = async (plantilla) => {
    const actual = (content.transition || '').trim();
    content.transition = actual ? `${actual}\n${plantilla}` : plantilla;
    guardarContenido();
    // El cursor al final del molde, listo para terminar la frase: es lo
    // siguiente que hay que hacer, y sin esto hay que ir a buscar el campo.
    await tick();
    if (areaTransicion) {
      areaTransicion.focus();
      const fin = areaTransicion.value.length;
      areaTransicion.setSelectionRange(fin, fin);
    }
  };

  const añadirSubpunto = (punto) => {
    punto.subpoints = [...(punto.subpoints || []), newSubpoint()];
    guardarContenido();
  };

  const borrarSubpunto = (punto, subId) => {
    punto.subpoints = punto.subpoints.filter((s) => s.id !== subId);
    const { [subId]: _fuera, ...resto } = content.development;
    content.development = resto;
    guardarContenido();
  };

  // El desarrollo de un punto y el de un subpunto viven en el MISMO mapa —los
  // ids no chocan— pero tienen forma distinta: tres casillas el punto, un solo
  // texto seguido el subpunto. Se distinguen por el prefijo que les ponen
  // `newPoint` y `newSubpoint`, y por eso marcar y añadir referencias funciona
  // igual en los dos sin una segunda versión de cada manejador. Ver el
  // comentario de `development` en `sermon-content.service.js`.
  const desarrolloDe = (id) => {
    if (!content.development[id]) {
      content.development[id] = String(id).startsWith('s_')
        ? { text: '', refs: [] }
        : { explain: '', illustrate: '', apply: '', refs: [] };
    }
    return content.development[id];
  };

  // ── Finalizar ─────────────────────────────────────────────────────────────
  const verFinal = async () => {
    await guardarYa();
    vista = 'final';
    avisar($_('app.sermons.sermon_finished'));
    window.scrollTo({ top: 0 });
  };

  // ── La schiță, editada como listas de texto ─────────────────────────────
  //
  // El array de claves de cada punto se edita en un `textarea`, una idea por
  // línea. El texto es estado propio y se vuelca al array en cada pulsación,
  // pero **no al revés**: derivar el texto del array mientras se escribe
  // reordenaría el valor bajo el cursor —una línea vacía a media frase
  // desaparece al parsear— y el cursor saltaría al final en cada tecla.
  // Sólo se sincroniza al abrir o al regenerar, que es cuando el array cambia
  // por debajo.
  let textoClaves = {}; // id de punto → texto del textarea
  let textoIntro = '';

  const sincronizarTextos = () => {
    const nuevos = {};
    (outline?.points || []).forEach((p, i) => {
      nuevos[p.id || i] = clavesATexto(p.keywords);
    });
    textoClaves = nuevos;
    textoIntro = clavesATexto(outline?.intro);
  };

  const crearSchita = async () => {
    // Se genera una sola vez desde la estructura ya escrita. No se regenera
    // sola después: pisaría los retoques que el predicador haga a mano.
    //
    // Se mira `outline`, la schiță que tiene el componente, y NO
    // `sermon.outline`. `sermon` se carga una vez en onMount y no se vuelve a
    // refrescar, así que su schiță es la del momento de abrir la pantalla:
    // leyéndola aquí, entrar a la schiță, editarla, volver a la predicación y
    // pulsar «Creează schița» otra vez tiraba en silencio todo lo escrito en
    // esta sesión. Es el mismo fallo que tenía el botón de regenerar.
    const vacia = !outline?.points?.length && !outline?.idea;
    if (vacia) {
      outline = generateOutline(content);
      await sermonsStore.update(sermonId, { outline: JSON.stringify(outline) });
      // Sólo al generar: los textos de las listas ya están sincronizados desde
      // onMount, y volver a derivarlos reformatearía lo que se esté escribiendo.
      sincronizarTextos();
    }
    vista = 'outline';
    avisar($_(vacia ? 'app.sermons.outline_created' : 'app.sermons.outline_opened'));
    window.scrollTo({ top: 0 });
  };

  // ── Regenerar sin perder lo escrito a mano ──────────────────────────────
  //
  // La schiță generada es un punto de partida: se reescribe a mano casi
  // siempre. Antes este botón la rehacía entera, así que pulsarlo sin querer
  // —está al lado de «Tipărește schița»— costaba el trabajo de una tarde.
  //
  // Ahora funde: respeta lo que ha escrito el predicador, refresca lo que no
  // tocó y trae los puntos nuevos de la estructura. Ver `mergeOutline`.
  //
  // `schitaAnterior` no caduca con el aviso a propósito: el aviso dura tres
  // segundos y darse cuenta de que la fusión no era lo que uno quería lleva
  // más. Se queda hasta que se deshace o se sale de la schiță.
  let schitaAnterior = null;

  const resumenDeFusion = (r) => {
    // «etiqueta: N» en vez de frases: el rumano necesitaría singular y plural
    // para cada una de las cuatro, y ese par ya se ha escrito mal dos veces.
    const partes = [];
    const añadir = (clave, n) => { if (n) partes.push(`${$_(`app.sermons.${clave}`)}: ${n}`); };
    añadir('merge_new', r.nuevos);
    añadir('merge_kept', r.conservados);
    añadir('merge_updated', r.actualizados);
    añadir('merge_removed', r.eliminados);
    return partes.length ? partes.join(' · ') : $_('app.sermons.merge_none');
  };

  const regenerarSchita = async () => {
    const previa = JSON.parse(JSON.stringify(outline));
    const { outline: fundida, resumen } = mergeOutline(outline, generateOutline(content));
    outline = fundida;
    sincronizarTextos();
    await sermonsStore.update(sermonId, { outline: JSON.stringify(outline) });
    schitaAnterior = previa;
    avisar(resumenDeFusion(resumen));
  };

  const deshacerRegeneracion = async () => {
    if (!schitaAnterior) return;
    outline = normalizeOutline(schitaAnterior);
    schitaAnterior = null;
    sincronizarTextos();
    await sermonsStore.update(sermonId, { outline: JSON.stringify(outline) });
    avisar($_('app.sermons.outline_reverted'));
  };

  // ── Serie / tema ────────────────────────────────────────────────────────
  //
  // Se guarda al instante y no con retardo: ahora se elige una etiqueta de una
  // lista, que es un gesto único, no una tecla detrás de otra. El debounce
  // existía para no mandar una petición por letra mientras se escribía.
  let serie = '';

  const elegirSerie = async (nuevo) => {
    serie = nuevo;
    estadoGuardado = 'guardando';
    await sermonsStore.update(sermonId, { series: serie.trim() || null });
    estadoGuardado = 'guardado';
    clearTimeout(etiquetaTimer);
    etiquetaTimer = setTimeout(() => { estadoGuardado = ''; }, 2000);
  };

  const guardarSchita = () => {
    estadoGuardado = 'guardando';
    guardadoEnElAire = true;
    clearTimeout(guardadoTimer);
    guardadoTimer = setTimeout(async () => {
      await sermonsStore.update(sermonId, { outline: JSON.stringify(outline) });
      guardadoEnElAire = false;
      estadoGuardado = 'guardado';
      clearTimeout(etiquetaTimer);
      etiquetaTimer = setTimeout(() => { estadoGuardado = ''; }, 2000);
    }, RETARDO_MS);
  };

  /**
   * Marca la predicación como preparada y deja TODO listo en el dispositivo.
   *
   * Sin descarga manual, como pide la especificación: el predicador pulsa un
   * botón y a partir de ahí el Modo Amvon funciona aunque no haya red. Se
   * guardan la schiță, la perícopa y el texto de cada referencia citada.
   */
  const marcarPreparada = async () => {
    await guardarYa();

    // Si aún no hay schiță, se genera ahora: entrar al púlpito sin ella dejaría
    // al predicador con una pantalla vacía.
    let schita = normalizeOutline(sermon?.outline);
    if (!schita.points.length && !schita.idea) {
      schita = generateOutline(content);
      await sermonsStore.update(sermonId, { outline: JSON.stringify(schita) });
    }

    const snapshot = buildSnapshot({
      sermon: { id: sermonId, title: sermon.title, reference: referencia },
      outline: schita,
      pericope: pericopa,
      references: collectReferences(content),
      resolveVerse: (book, chapter, verse) => bible[book]?.[chapter - 1]?.[verse - 1] || '',
    });

    await sermonsStore.update(sermonId, { status: 'ready' });
    sermon = sermonsStore.get(sermonId);
    // El aviso es distinto si la instantánea no se pudo escribir (cuota llena):
    // decirle que está listo para predicar sin conexión sería mentirle.
    avisoPreparada = snapshot ? $_('app.pulpit.ready_offline') : $_('app.pulpit.ready_no_offline');
  };

  let avisoPreparada = '';

  const irAlPulpito = () => {
    window.history.pushState(null, '', `/predicile-mele/${encodeURIComponent(sermonId)}/amvon`);
    window.dispatchEvent(new CustomEvent('robibile:navigate'));
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const volverALista = () => {
    window.history.pushState(null, '', '/predicile-mele');
    // La errata `robibile` es la del resto del proyecto (CLAUDE.md, trampa 1).
    window.dispatchEvent(new CustomEvent('robibile:navigate'));
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  onMount(async () => {
    // Antes de leer, se sincroniza la cabecera con el servidor: si otro
    // dispositivo cambió esta predicación, el contenido cacheado en éste se
    // marca obsoleto y `load` lo vuelve a descargar entero (ver el comentario
    // de `syncFromServer`). Sin este await, en un enlace directo —recargar la
    // página— esta llamada podía ganarle a la sincronización que dispara el
    // arranque de la aplicación y leer la copia vieja de todos modos: es
    // justo el fallo de «ni haciendo refresh se ve lo del otro dispositivo».
    await sermonsStore.sync();
    sermon = await sermonsStore.load(sermonId);
    content = normalizeContent(sermon?.content);
    outline = normalizeOutline(sermon?.outline);
    serie = sermon?.series || '';
    sincronizarTextos();
    cargando = false;
  });

  // ── Actualizar manualmente desde el servidor ────────────────────────────
  //
  // La sincronización automática (al volver a la pestaña, al abrir esta
  // pantalla) es silenciosa y no toca lo que ya está en el editor: por
  // diseño, para no pisar una edición en curso. Este botón es lo contrario,
  // a petición explícita — «tráeme ahora lo último, aunque esté editando».
  //
  // **Sólo sube lo local si `guardadoEnElAire` es cierto** — es decir, si hay un
  // guardado del retardo todavía en el aire, de algo tecleado en el último
  // segundo y pico. Subirlo SIEMPRE, sin mirar si hacía falta, fue un fallo
  // real que sólo salió al probarlo: con el contenido ya sincronizado (nada
  // pendiente), pulsar «Actualizează» reenviaba la copia de este dispositivo
  // al servidor ANTES de pedir nada — y esa copia, aunque igual a la última
  // vez que se guardó aquí, es más VIEJA que la que acaba de escribir el otro
  // dispositivo. El resultado era pisar justo el cambio que se venía a buscar,
  // con el propio botón que promete traerlo.
  let actualizando = false;

  const actualizarDesdeServidor = async () => {
    if (actualizando) return;
    actualizando = true;
    try {
      if (guardadoEnElAire) await guardarYa();
      const res = await sermonsStore.refreshOne(sermonId);
      if (res.ok) {
        sermon = res.sermon;
        content = normalizeContent(sermon.content);
        outline = normalizeOutline(sermon.outline);
        serie = sermon.series || '';
        sincronizarTextos();
        avisar($_('app.sermons.refresh_ok'));
      } else if (res.reason === 'pending') {
        avisar($_('app.sermons.refresh_pending'));
      } else if (res.reason === 'offline') {
        avisar($_('app.sermons.refresh_offline'));
      } else {
        avisar($_('app.sermons.refresh_failed'));
      }
    } finally {
      actualizando = false;
    }
  };

  onDestroy(() => {
    clearTimeout(guardadoTimer);
    clearTimeout(etiquetaTimer);
    // Al salir se guarda sin esperar: el usuario puede estar navegando fuera
    // justo después de teclear. Manda también `outline` si existe, por lo
    // mismo que `guardarYa` — el mismo timer compartido significa que salir a
    // media edición de la schiță podía perderla del todo, no sólo del
    // servidor: no llega a escribirse en ningún sitio hasta que el guardado
    // la manda.
    if (sermonId && !cargando) {
      const cambios = { content: JSON.stringify(content) };
      if (outline) cambios.outline = JSON.stringify(outline);
      sermonsStore.update(sermonId, cambios);
    }
  });
</script>

<section class="prep">
  {#if cargando}
    <p class="prep__estado" role="status">{$_('app.loading')}</p>
  {:else if !sermon}
    <div class="prep__estado">
      <p>{$_('auth.errors.sermon_not_found')}</p>
      <button type="button" class="prep__cta" on:click={volverALista}>{$_('app.sermons.title')}</button>
    </div>
  {:else}
    <!-- Cabecera común a las tres vistas -->
    <header class="prep__cabecera">
      <button type="button" class="prep__volver" on:click={volverALista}>
        <Icon name="arrow-left" />
        <span>{$_('app.sermons.title')}</span>
      </button>
      <div class="prep__cabecera-derecha">
        <!-- Al ghid, en pestaña nueva: es contenido para leer con calma, no
             para interrumpir la preparación. -->
        <a class="prep__guia" href="/ghid-predicare" target="_blank" rel="noopener">
          {$_('app.sermons.guide_link')}
          <Icon name="external" size="0.75rem" />
        </a>
        <!-- Sin sentido para una predicación creada sin conexión: nunca ha
             llegado al servidor, así que no hay de dónde actualizarla. -->
        {#if USE_BACKEND && !sermonId.startsWith('local_')}
          <button type="button" class="prep__actualizar" disabled={actualizando} on:click={actualizarDesdeServidor}>
            {actualizando ? $_('app.sermons.refresh_working') : $_('app.sermons.refresh')}
          </button>
        {/if}
        <div class="prep__guardado" aria-live="polite">
          {#if estadoGuardado === 'guardando'}
            <span class="prep__guardado-texto">{$_('app.sermons.saving')}</span>
          {:else if estadoGuardado === 'guardado'}
            <span class="prep__guardado-texto prep__guardado-texto--ok">{$_('app.sermons.saved')}</span>
          {/if}
        </div>
      </div>
    </header>

    <!-- El <h1> se queda como <h1>: dentro va el botón o el campo, según se
         esté leyendo o editando. Convertir el propio encabezado en un botón
         habría dejado la pantalla sin título de nivel 1. -->
    <h1 class="prep__titulo">
      {#if editandoTitulo}
        <input
          spellcheck="false"
          type="text"
          class="prep__titulo-campo"
          maxlength="120"
          bind:this={inputTitulo}
          bind:value={borradorTitulo}
          on:keydown={teclaTitulo}
          on:blur={guardarTitulo}
          aria-label={$_('app.sermons.field_title')}
        />
      {:else}
        <button type="button" class="prep__titulo-boton" on:click={editarTitulo} title={$_('app.sermons.rename')}>
          <span>{sermon.title || $_('app.sermons.untitled')}</span>
          <Icon name="pencil" />
        </button>
      {/if}
    </h1>
    {#if avisoTitulo}
      <p class="prep__titulo-aviso" role="alert">{avisoTitulo}</p>
    {/if}
    <!-- El tipo al lado del pasaje: la guía y los avisos cambian según cuál
         sea, y hasta ahora sólo se veía en la lista, antes de entrar. -->
    <p class="prep__ref">
      {referencia}
      {#if sermon.type}
        <span aria-hidden="true">·</span>
        <span class="prep__tipo">{$_(`app.sermons.type_${sermon.type}`)}</span>
      {/if}
    </p>

    <!-- Dónde estoy. Las tres vistas se parecen bastante —título, referencia y
         bloques— y sin esto, después de pulsar «Creează schița», no había forma
         de saber si lo que se veía era la predicación o la schiță. -->
    <p class="prep__vista">
      {vista === 'prep'
        ? $_('app.sermons.view_prep')
        : vista === 'final'
          ? $_('app.sermons.view_final')
          : $_('app.sermons.view_outline')}
    </p>

    <!-- Un solo aviso para las tres vistas. Antes vivía dentro del bloque de la
         predicación final, así que publicar o regenerar desde la schiță no
         decía nada y parecía que el botón no hacía nada. -->
    {#if avisoPublicar}
      <p class="prep__aviso no-imprimir" role="status">{avisoPublicar}</p>
    {/if}

    {#if vista === 'prep'}
      <!-- ── Línea de progreso ────────────────────────────────────────── -->
      <nav class="pasos" aria-label={$_('app.sermons.steps_label')}>
        {#each STEPS as s, i (s)}
          <button
            type="button"
            class="pasos__paso"
            class:pasos__paso--activo={paso === s}
            class:pasos__paso--hecho={completado[s]}
            aria-current={paso === s ? 'step' : undefined}
            title={$_(`app.sermons.step_${s}`)}
            on:click={() => irAPaso(s)}
          >
            <span class="pasos__num">{i + 1}</span>
            <span class="pasos__nombre">{$_(`app.sermons.step_${s}`)}</span>
          </button>
        {/each}
      </nav>
      <!-- En móvil los pasos son sólo números —siete nombres no caben sin
           scroll horizontal— así que el nombre del paso actual va debajo. -->
      <p class="pasos__actual">
        {$_('app.sermons.step_of', { current: pasoIndex + 1, total: STEPS.length })} · {$_(`app.sermons.step_${paso}`)}
      </p>

      <!-- ── TEXT ─────────────────────────────────────────────────────── -->
      {#if paso === 'text'}
        <div class="bloque">
          <h2>{$_('app.sermons.step_text')}</h2>
          <Ajutor paso="text" tip={sermon?.type} />
          <p class="bloque__ayuda">{$_('app.sermons.text_help')}</p>
          <div class="texto">
            {#each pericopa as v (v.numero)}
              <p class="texto__verso">
                <span class="texto__num">{v.numero}</span>
                {#each palabrasDe(v.texto) as palabra, i (`${v.numero}-${i}`)}
                  <button
                    type="button"
                    class="texto__palabra"
                    class:texto__palabra--marcada={estaMarcada(v.numero, limpia(palabra))}
                    on:click={() => alternarMarca(v.numero, limpia(palabra))}
                  >{palabra}</button>
                {/each}
              </p>
            {/each}
          </div>
          {#if content.marks.length}
            <p class="bloque__marcadas">
              {$_('app.sermons.marked_count', { count: content.marks.length })}
            </p>
          {/if}

          <!-- La hoja en blanco. Va al final del paso, después del texto: se
               apunta MIENTRAS se lee la perícopa, no antes de haberla leído.
               Ocupa casi la pantalla a propósito — un campo de cinco líneas
               invita a escribir cinco líneas, y aquí se quiere lo contrario. -->
          <label class="campo campo--notas">
            <span>{$_('app.sermons.notes')}</span>
            <small class="campo__pista">{$_('app.sermons.notes_help')}</small>
            <textarea
              spellcheck="false"
              class="campo__hoja"
              placeholder={$_('app.sermons.notes_placeholder')}
              bind:value={content.notes}
              on:input={guardarContenido}
            ></textarea>
          </label>
        </div>

      <!-- ── OBSERVARE ────────────────────────────────────────────────── -->
      {:else if paso === 'observation'}
        <div class="bloque">
          <h2>{$_('app.sermons.step_observation')}</h2>
          <Ajutor paso="observation" tip={sermon?.type} />
          <Notite notes={content.notes} />
          <p class="bloque__ayuda">{$_('app.sermons.optional_help')}</p>
          {#each ['repeats', 'contrasts', 'actions', 'tension', 'truth'] as clave (clave)}
            <label class="campo">
              <span>{$_(`app.sermons.obs_${clave}`)}</span>
              <textarea spellcheck="false" rows="5" bind:value={content.observation[clave]} on:input={guardarContenido}></textarea>
            </label>
          {/each}
        </div>

      <!-- ── CONTEXT ──────────────────────────────────────────────────── -->
      {:else if paso === 'context'}
        <div class="bloque">
          <h2>{$_('app.sermons.step_context')}</h2>
          <Ajutor paso="context" tip={sermon?.type} />
          <Notite notes={content.notes} />

          {#if contextoAntes.length}
            <details class="contexto">
              <summary>{$_('app.sermons.context_before')}</summary>
              {#each contextoAntes as v (v.numero)}
                <p class="contexto__verso"><span class="texto__num">{v.numero}</span>{v.texto}</p>
              {/each}
            </details>
          {/if}
          {#if contextoDespues.length}
            <details class="contexto">
              <summary>{$_('app.sermons.context_after')}</summary>
              {#each contextoDespues as v (v.numero)}
                <p class="contexto__verso"><span class="texto__num">{v.numero}</span>{v.texto}</p>
              {/each}
            </details>
          {/if}

          {#each ['before', 'after', 'historical'] as clave (clave)}
            <label class="campo">
              <span>{$_(`app.sermons.ctx_${clave}`)}</span>
              <textarea spellcheck="false" rows="5" bind:value={content.context[clave]} on:input={guardarContenido}></textarea>
            </label>
          {/each}
        </div>

      <!-- ── IDEE ─────────────────────────────────────────────────────────
           El orden de los campos es el del curso: primero lo que el texto dijo
           entonces, después lo que Dios quiere cambiar hoy, y sólo con esos dos
           delante se formula la idea homilética. Invertirlo lleva a escribir
           primero la frase bonita y buscarle el respaldo bíblico después. -->
      {:else if paso === 'idea'}
        <div class="bloque">
          <h2>{$_('app.sermons.step_idea')}</h2>
          <Ajutor paso="idea" tip={sermon?.type} />
          <Notite notes={content.notes} />
          <label class="campo">
            <span>{$_('app.sermons.idea_exegetical')}</span>
            <small class="campo__pista">{$_('app.sermons.idea_exegetical_help')}</small>
            <textarea spellcheck="false" rows="3" bind:value={content.idea.exegetical} on:input={guardarContenido}></textarea>
          </label>
          <label class="campo">
            <span>{$_('app.sermons.idea_purpose')}</span>
            <small class="campo__pista">{$_('app.sermons.idea_purpose_help')}</small>
            <textarea spellcheck="false" rows="5" bind:value={content.idea.purpose} on:input={guardarContenido}></textarea>
          </label>
          <label class="campo">
            <span>{$_('app.sermons.idea_central')}</span>
            <small class="campo__pista">{$_('app.sermons.idea_central_help')}</small>
            <textarea spellcheck="false" rows="3" bind:value={content.idea.central} on:input={guardarContenido}></textarea>
          </label>
          <label class="campo">
            <span>{$_('app.sermons.idea_question')}</span>
            <small class="campo__pista">{$_('app.sermons.idea_question_help')}</small>
            <textarea spellcheck="false" rows="2" bind:value={content.idea.question} on:input={guardarContenido}></textarea>
          </label>
        </div>

      <!-- ── STRUCTURA ────────────────────────────────────────────────── -->
      {:else if paso === 'structure'}
        <div class="bloque">
          <h2>{$_('app.sermons.step_structure')}</h2>
          <Ajutor paso="structure" tip={sermon?.type} />
          <Recapitulare {content} paso="structure" {referencia} />
          <Notite notes={content.notes} />
          <p class="bloque__ayuda">{$_('app.sermons.structure_help')}</p>

          <!-- La transición va ANTES de los puntos: es la frase con la que se
               entra en ellos, y escribirla obliga a decidir cuántas divisiones
               hay y cómo se llaman en plural — que es medio trabajo del paso. -->
          <div class="campo">
            <span>{$_('app.sermons.transition')}</span>
            <small class="campo__pista">{$_('app.sermons.transition_help')}</small>
            <Sugestii onElegir={usarSugerencia} />
            <textarea
              spellcheck="false"
              rows="3"
              bind:this={areaTransicion}
              bind:value={content.transition}
              on:input={guardarContenido}
            ></textarea>
          </div>

          {#each content.structure as punto, i (punto.id)}
            <div class="punto">
              <div class="punto__cabecera">
                <span class="punto__num">{i + 1}</span>
                <input spellcheck="false"
                  type="text"
                  class="punto__titulo"
                  bind:value={punto.title}
                  on:input={guardarContenido}
                  placeholder={$_('app.sermons.point_placeholder')}
                />
                <div class="punto__mover">
                  <button type="button" on:click={() => mover(i, -1)} disabled={i === 0} aria-label={$_('app.sermons.move_up')}>↑</button>
                  <button type="button" on:click={() => mover(i, 1)} disabled={i === content.structure.length - 1} aria-label={$_('app.sermons.move_down')}>↓</button>
                  <button type="button" class="punto__borrar" on:click={() => borrarPunto(punto.id)} aria-label={$_('app.sermons.delete')}>✕</button>
                </div>
              </div>

              {#each punto.subpoints || [] as sub, j (sub.id)}
                <div class="subpunto">
                  <span class="subpunto__num">{i + 1}.{j + 1}</span>
                  <input spellcheck="false" type="text" bind:value={sub.title} on:input={guardarContenido} placeholder={$_('app.sermons.subpoint_placeholder')} />
                  <button type="button" class="punto__borrar" on:click={() => borrarSubpunto(punto, sub.id)} aria-label={$_('app.sermons.delete')}>✕</button>
                </div>
              {/each}

              <!-- Sólo dos niveles: no hay «añadir subpunto» dentro de un subpunto -->
              <button type="button" class="punto__añadir-sub" on:click={() => añadirSubpunto(punto)}>
                + {$_('app.sermons.add_subpoint')}
              </button>
            </div>
          {/each}

          <button type="button" class="bloque__añadir" on:click={añadirPunto}>
            + {$_('app.sermons.add_point')}
          </button>
        </div>

      <!-- ── DEZVOLTARE ───────────────────────────────────────────────── -->
      {:else if paso === 'development'}
        <div class="bloque">
          <h2>{$_('app.sermons.step_development')}</h2>
          <Ajutor paso="development" tip={sermon?.type} />
          <Recapitulare {content} paso="development" {referencia} />
          <Notite notes={content.notes} />
          {#if !content.structure.length}
            <p class="bloque__ayuda">{$_('app.sermons.development_needs_structure')}</p>
            <button type="button" class="bloque__añadir" on:click={() => irAPaso('structure')}>
              {$_('app.sermons.step_structure')}
            </button>
          {:else}
            {#each content.structure as punto, i (punto.id)}
              {@const d = desarrolloDe(punto.id)}
              <div class="punto">
                <!-- Cabecera de sólo lectura: sin asteriscos. El campo donde
                     se marcan sigue siendo el input del paso Structură. -->
                <h3 class="punto__nombre">
                  {i + 1}. {quitarMarcas(punto.title) || $_('app.sermons.point_placeholder')}
                </h3>

                <!-- Los subpuntos van PRIMERO, justo después del título: son
                     la división analítica del punto — de ahí sale lo que
                     luego se explica, ilustra y aplica como un conjunto. Antes
                     iban después de las tres casillas, y se leía como si la
                     predicación volviera atrás a subdividir algo que ya se
                     había cerrado. -->
                {#each punto.subpoints || [] as sub, j (sub.id)}
                  {@const ds = desarrolloDe(sub.id)}
                  <div class="subdesarrollo">
                    <h4 class="subdesarrollo__nombre">
                      {i + 1}.{j + 1} {quitarMarcas(sub.title) || $_('app.sermons.subpoint_placeholder')}
                    </h4>
                    <div class="campo">
                      <div class="campo__cabecera">
                        <span>{$_('app.sermons.dev_subpoint')}</span>
                        <div class="campo__acciones">
                          <button
                            type="button"
                            class="campo__marcar"
                            on:click={() => abrirInsertarCita(`${sub.id}:text`)}
                            title={$_('app.sermons.insert_verse_help')}
                          >
                            <Icon name="book-open" size="0.85rem" />
                            {$_('app.sermons.insert_verse')}
                          </button>
                          <button
                            type="button"
                            class="campo__marcar"
                            disabled={!seleccion[`${sub.id}:text`]}
                            on:click={() => marcarSeleccion(sub.id, 'text')}
                            title={$_('app.sermons.mark_help')}
                          >
                            <Icon name="highlight" size="0.85rem" />
                            {$_('app.sermons.mark_keyword')}
                          </button>
                        </div>
                      </div>
                      <textarea spellcheck="false"
                        rows="5"
                        bind:this={areas[`${sub.id}:text`]}
                        bind:value={ds.text}
                        on:input={guardarContenido}
                        on:select={() => refrescarSeleccion(sub.id, 'text')}
                        on:keyup={() => refrescarSeleccion(sub.id, 'text')}
                        on:mouseup={() => refrescarSeleccion(sub.id, 'text')}
                      ></textarea>
                    </div>

                    <div class="refs">
                      <span class="refs__titulo">{$_('app.sermons.refs_title')}</span>
                      {#if (ds.refs || []).length}
                        <ul class="refs__lista">
                          {#each ds.refs as ref (ref.label)}
                            <li>
                              <span class="refs__cita">{ref.label}</span>
                              <button
                                type="button"
                                class="refs__quitar"
                                aria-label={$_('app.sermons.refs_remove')}
                                on:click={() => quitarRef(sub.id, ref)}
                              >
                                <Icon name="close" size="0.7rem" />
                              </button>
                            </li>
                          {/each}
                        </ul>
                      {/if}
                      <button type="button" class="refs__añadir" on:click={() => abrirBuscadorRefs(sub.id)}>
                        + {$_('app.sermons.refs_add')}
                      </button>
                    </div>
                  </div>
                {/each}

                <!-- Explicar y aplicar son obligatorios en el curso; ilustrar
                     es opcional. Antes no se distinguía nada en pantalla y
                     había que saberlo de memoria. -->
                {#each ['explain', 'illustrate', 'apply'] as campo (campo)}
                  <div class="campo">
                    <div class="campo__cabecera">
                      <span>
                        {$_(`app.sermons.dev_${campo}`)}
                        <em class="campo__marca" class:campo__marca--opcional={campo === 'illustrate'}>
                          {campo === 'illustrate' ? $_('app.sermons.optional') : $_('app.sermons.required')}
                        </em>
                      </span>
                      <div class="campo__acciones">
                        <button
                          type="button"
                          class="campo__marcar"
                          on:click={() => abrirInsertarCita(`${punto.id}:${campo}`)}
                          title={$_('app.sermons.insert_verse_help')}
                        >
                          <Icon name="book-open" size="0.85rem" />
                          {$_('app.sermons.insert_verse')}
                        </button>
                        <!-- Marca lo seleccionado para que salga en la schiță. Se
                             deshabilita si no hay nada seleccionado, que es la
                             forma más corta de explicar que hay que elegir antes. -->
                        <button
                          type="button"
                          class="campo__marcar"
                          disabled={!seleccion[`${punto.id}:${campo}`]}
                          on:click={() => marcarSeleccion(punto.id, campo)}
                          title={$_('app.sermons.mark_help')}
                        >
                          <Icon name="highlight" size="0.85rem" />
                          {$_('app.sermons.mark_keyword')}
                        </button>
                      </div>
                    </div>
                    <textarea spellcheck="false"
                      rows="6"
                      bind:this={areas[`${punto.id}:${campo}`]}
                      bind:value={d[campo]}
                      on:input={guardarContenido}
                      on:select={() => refrescarSeleccion(punto.id, campo)}
                      on:keyup={() => refrescarSeleccion(punto.id, campo)}
                      on:mouseup={() => refrescarSeleccion(punto.id, campo)}
                    ></textarea>
                  </div>
                {/each}

                <!-- Referencias a otros pasajes: en la schiță se ve sólo la
                     cita; en el púlpito, el texto entero. -->
                <div class="refs">
                  <span class="refs__titulo">{$_('app.sermons.refs_title')}</span>
                  {#if (d.refs || []).length}
                    <ul class="refs__lista">
                      {#each d.refs as ref (ref.label)}
                        <li>
                          <span class="refs__cita">{ref.label}</span>
                          <button
                            type="button"
                            class="refs__quitar"
                            aria-label={$_('app.sermons.refs_remove')}
                            on:click={() => quitarRef(punto.id, ref)}
                          >
                            <Icon name="close" size="0.7rem" />
                          </button>
                        </li>
                      {/each}
                    </ul>
                  {:else}
                    <p class="refs__vacio">{$_('app.sermons.refs_empty')}</p>
                  {/if}
                  <button type="button" class="refs__añadir" on:click={() => abrirBuscadorRefs(punto.id)}>
                    + {$_('app.sermons.refs_add')}
                  </button>
                </div>
              </div>
            {/each}
          {/if}
        </div>

      <!-- ── INTRODUCERE ──────────────────────────────────────────────── -->
      {:else if paso === 'intro'}
        <div class="bloque">
          <h2>{$_('app.sermons.step_intro')}</h2>
          <Ajutor paso="intro" tip={sermon?.type} />
          <Recapitulare {content} paso="intro" {referencia} />
          <Notite notes={content.notes} />
          <div class="campo">
            <div class="campo__cabecera">
              <span>{$_('app.sermons.intro')}</span>
              <button
                type="button"
                class="campo__marcar"
                on:click={() => abrirInsertarCita('intro')}
                title={$_('app.sermons.insert_verse_help')}
              >
                <Icon name="book-open" size="0.85rem" />
                {$_('app.sermons.insert_verse')}
              </button>
            </div>
            <small class="campo__pista">{$_('app.sermons.intro_help')}</small>
            <textarea spellcheck="false"
              rows="8"
              bind:this={areas['intro']}
              bind:value={content.intro}
              on:input={guardarContenido}
            ></textarea>
          </div>
        </div>

      <!-- ── FINALIZARE ───────────────────────────────────────────────── -->
      {:else if paso === 'final'}
        <div class="bloque">
          <h2>{$_('app.sermons.step_final')}</h2>
          <Ajutor paso="final" tip={sermon?.type} />
          <Recapitulare {content} paso="final" {referencia} />
          <Notite notes={content.notes} />
          <div class="campo">
            <div class="campo__cabecera">
              <span>{$_('app.sermons.conclusion')}</span>
              <button
                type="button"
                class="campo__marcar"
                on:click={() => abrirInsertarCita('conclusion')}
                title={$_('app.sermons.insert_verse_help')}
              >
                <Icon name="book-open" size="0.85rem" />
                {$_('app.sermons.insert_verse')}
              </button>
            </div>
            <small class="campo__pista">{$_('app.sermons.conclusion_help')}</small>
            <textarea spellcheck="false"
              rows="8"
              bind:this={areas['conclusion']}
              bind:value={content.conclusion}
              on:input={guardarContenido}
            ></textarea>
          </div>

          <!-- La serie NO va en `content_json`: es una columna de la tabla,
               porque el listado público filtra por ella y filtrar por dentro de
               un JSON obligaría a cargar todas las predicaciones enteras.
               No es un <label> porque no envuelve un solo campo: el selector
               son etiquetas y un botón, y un `for` implícito no sabría a cuál
               apuntar. -->
          <div class="campo">
            <span>{$_('app.sermons.series')}</span>
            <small class="campo__pista">{$_('app.sermons.series_help')}</small>
            <SeriesPicker value={serie} onChange={elegirSerie} />
          </div>
          <button type="button" class="prep__cta" on:click={verFinal}>
            {$_('app.sermons.finish')}
          </button>
        </div>
      {/if}

      <!-- Navegación entre pasos -->
      <div class="prep__nav">
        <button type="button" disabled={pasoIndex === 0} on:click={() => irAPaso(STEPS[pasoIndex - 1])}>
          ← {$_('app.sermons.previous_step')}
        </button>
        <button type="button" disabled={pasoIndex === STEPS.length - 1} on:click={() => irAPaso(STEPS[pasoIndex + 1])}>
          {$_('app.sermons.next_step')} →
        </button>
      </div>

    <!-- ── PREDICA FINALĂ ─────────────────────────────────────────────── -->
    {:else if vista === 'final'}
      <article class="documento">
        <p class="documento__meta">
          {$_('app.sermons.word_count', { count: palabras })} · {$_('app.sermons.minutes', { count: minutos })}
        </p>

        {#if content.intro.trim()}
          <h2>{$_('app.sermons.intro')}</h2>
          <p class="documento__parrafo"><TextoFormateado texto={content.intro} /></p>
        {/if}

        <!-- Sin encabezado propio y en su sitio: la transición no es una
             sección de la predicación, es la frase con la que se sale de la
             introducción y se entra en el primer punto. -->
        {#if content.transition.trim()}
          <p class="documento__parrafo documento__parrafo--transicion"><TextoFormateado texto={content.transition} /></p>
        {/if}

        {#each content.structure as punto, i (punto.id)}
          {@const d = content.development[punto.id] || {}}
          <!-- El documento es la predicación en limpio: se lee y se imprime,
               así que va sin la sintaxis de marcado —salvo lo que el propio
               formato del marcado da a entender: negrita para lo destacado,
               cursiva para una cita en línea, ver `TextoFormateado`. -->
          <h2>{i + 1}. {quitarMarcas(punto.title) || $_('app.sermons.point_placeholder')}</h2>
          <!-- El subpunto va justo después del título, antes de explicar,
               ilustrar y aplicar: es su división analítica, no una vuelta
               atrás después de haber cerrado el punto. Mismo orden que en
               DEZVOLTARE y en el PDF. -->
          {#each punto.subpoints || [] as sub, j (sub.id)}
            {@const ds = content.development[sub.id] || {}}
            <h3>{i + 1}.{j + 1} {quitarMarcas(sub.title)}</h3>
            {#if ds.text}<p class="documento__parrafo"><TextoFormateado texto={ds.text} /></p>{/if}
          {/each}
          {#if d.explain}<p class="documento__parrafo"><TextoFormateado texto={d.explain} /></p>{/if}
          {#if d.illustrate}<p class="documento__parrafo documento__parrafo--ilustra"><TextoFormateado texto={d.illustrate} /></p>{/if}
          {#if d.apply}<p class="documento__parrafo"><TextoFormateado texto={d.apply} /></p>{/if}
        {/each}

        {#if content.conclusion.trim()}
          <h2>{$_('app.sermons.conclusion')}</h2>
          <p class="documento__parrafo"><TextoFormateado texto={content.conclusion} /></p>
        {/if}
      </article>

      <div class="prep__acciones no-imprimir">
        <button type="button" on:click={() => (vista = 'prep')}>{$_('app.sermons.edit')}</button>
        <button type="button" on:click={crearSchita}>{$_('app.sermons.create_outline')}</button>
        <button type="button" disabled={generandoPdf} on:click={() => descargarPdf('predica')}>
          {generandoPdf ? $_('app.sermons.pdf_working') : $_('app.sermons.print_sermon')}
        </button>
        <button type="button" disabled={publicando} on:click={alternarPublicacion}>
          {sermon?.isPublic ? $_('app.sermons.share.unpublish') : $_('app.sermons.share.publish')}
        </button>
        <button type="button" class="prep__cta" on:click={marcarPreparada}>
          {$_('app.sermons.mark_ready')}
        </button>
      </div>

      {#if enlacePublico}
        <div class="publicada no-imprimir">
          <p class="publicada__titulo">{$_('app.sermons.share.is_public')}</p>
          <div class="publicada__fila">
            <input spellcheck="false" type="text" readonly value={enlacePublico} on:focus={(e) => e.target.select()} />
            <button type="button" on:click={copiarEnlace}>{$_('app.topics.share.copy_link')}</button>
          </div>
          <p class="publicada__pista">{$_('app.sermons.share.public_hint')}</p>
        </div>
      {/if}

      {#if avisoPreparada}
        <div class="prep__listo" role="status">
          <p>{avisoPreparada}</p>
          <button type="button" class="prep__cta" on:click={irAlPulpito}>
            {$_('app.pulpit.mode')}
          </button>
        </div>
      {/if}

    <!-- ── SCHIȚA ─────────────────────────────────────────────────────── -->
    {:else if vista === 'outline' && outline}
      <div class="bloque">
        <h2>{$_('app.sermons.outline')}</h2>
        <p class="bloque__ayuda">{$_('app.sermons.outline_help')}</p>

        <label class="campo">
          <span>{$_('app.sermons.idea_central')}</span>
          <textarea spellcheck="false" rows="2" bind:value={outline.idea} on:input={guardarSchita}></textarea>
        </label>

        <label class="campo">
          <span>{$_('app.sermons.outline_intro')}</span>
          <small class="campo__pista">{$_('app.sermons.outline_lines_help')}</small>
          <textarea spellcheck="false"
            class="campo__lista"
            rows="3"
            bind:value={textoIntro}
            on:input={() => { outline.intro = textoAClaves(textoIntro); guardarSchita(); }}
          ></textarea>
        </label>

        <!-- La transición sí va entera en la schiță, al contrario que el resto:
             es la única frase que se dice tal cual está escrita. -->
        <label class="campo">
          <span>{$_('app.sermons.transition')}</span>
          <textarea spellcheck="false" rows="2" bind:value={outline.transition} on:input={guardarSchita}></textarea>
        </label>

        {#each outline.points as p, i (p.id || i)}
          <div class="punto">
            <textarea spellcheck="false" class="punto__titulo-area" rows="2" bind:value={p.title} on:input={guardarSchita}></textarea>
            <label class="campo">
              <span>{$_('app.sermons.outline_keywords')}</span>
              <!-- Una idea por línea. El texto del `textarea` es estado propio
                   (`textoClaves`) y no se vuelve a derivar del array mientras se
                   escribe: si se derivara, borrar un guion reordenaría el valor
                   bajo el cursor y saltaría al final en cada tecla. -->
              <textarea spellcheck="false"
                class="campo__lista"
                rows="4"
                bind:value={textoClaves[p.id || i]}
                on:input={() => { p.keywords = textoAClaves(textoClaves[p.id || i]); guardarSchita(); }}
              ></textarea>
            </label>
          </div>
        {/each}

        <label class="campo">
          <span>{$_('app.sermons.outline_application')}</span>
          <textarea spellcheck="false" rows="3" bind:value={outline.application} on:input={guardarSchita}></textarea>
        </label>
        <label class="campo">
          <span>{$_('app.sermons.conclusion')}</span>
          <textarea spellcheck="false" rows="3" bind:value={outline.conclusion} on:input={guardarSchita}></textarea>
        </label>
      </div>

      <div class="prep__acciones no-imprimir">
        <button type="button" on:click={() => (vista = 'final')}>← {$_('app.sermons.back_to_sermon')}</button>
        <button type="button" on:click={regenerarSchita}>{$_('app.sermons.regenerate_outline')}</button>
        <!-- Sólo aparece después de regenerar, y se queda hasta que se usa o
             se sale: darse cuenta de que la fusión no era lo que uno quería
             lleva más de los tres segundos que dura el aviso. -->
        {#if schitaAnterior}
          <button type="button" class="prep__deshacer" on:click={deshacerRegeneracion}>
            {$_('app.sermons.undo_regenerate')}
          </button>
        {/if}
        <button type="button" disabled={generandoPdf} on:click={() => descargarPdf('schita')}>
          {generandoPdf ? $_('app.sermons.pdf_working') : $_('app.sermons.print_outline')}
        </button>
      </div>

      <!-- Cómo imprimirla. Sin esto, una schiță larga sale a doble cara en el
           orden equivocado y el cuadernillo queda desordenado al doblarlo. -->
      <p class="prep__pista-impresion no-imprimir">{$_('app.sermons.print_outline_hint')}</p>
    {/if}
  {/if}
</section>

<!-- Buscador de referencias. Reutiliza `searchReferences`, el mismo que el
     buscador de la Biblia: escribiendo «ioan 3 16» salen las sugerencias.
     Sirve para dos cosas —añadir una referencia al pie, o insertar el
     versículo entero en el cursor—, según `modoBuscador`; sólo cambia el
     título y qué hace `añadirRef` al elegir uno. -->
<Modal
  open={buscadorAbierto}
  title={modoBuscador === 'cita' ? $_('app.sermons.insert_verse') : $_('app.sermons.refs_add')}
  eyebrow={$_('app.sermons.refs_title')}
  size="sm"
  fitContent
  onClose={() => (buscadorAbierto = false)}
>
  <label class="campo">
    <span>{$_('app.sermons.refs_search')}</span>
    <input spellcheck="false"
      type="text"
      bind:value={consultaRef}
      on:input={buscarRef}
      placeholder={$_('app.sidebar.form.reference_placeholder')}
    />
  </label>

  {#if sugerenciasRef.length}
    <ul class="sugerencias">
      {#each sugerenciasRef as m (`${m.book}:${m.chapter}:${m.verse}`)}
        <li>
          <button type="button" on:click={() => añadirRef(m)}>
            <span class="sugerencias__cita">{map[m.book]} {m.chapter}{m.verse ? `:${m.verse}` : ''}</span>
            {#if m.verse}
              <span class="sugerencias__texto">{bible?.[m.book]?.[m.chapter - 1]?.[m.verse - 1] || ''}</span>
            {/if}
          </button>
        </li>
      {/each}
    </ul>
  {:else if consultaRef.trim()}
    <p class="bloque__ayuda">{$_('app.sermons.refs_none')}</p>
  {/if}
</Modal>

<style lang="scss">
  .prep {
    // 46rem → 69rem, un 50% más. Preparar una predicación es escribir mucho
    // rato seguido, y con la columna estrecha el texto se siente ahogado entre
    // los márgenes. En pantallas pequeñas manda el ancho disponible, así que el
    // cambio sólo se nota donde hay sitio.
    max-width: 69rem;
    margin: 0 auto;
    padding: clamp(0.5rem, 2vw, 1.5rem) 0 4rem;
  }

  // ── Impresión ───────────────────────────────────────────
  //
  // El documento en retrato y la schiță en apaisado a dos columnas. Las páginas
  // con nombre (`@page retrato` / `@page apaisado`) están en global.css; aquí
  // sólo se dice qué elemento va en cuál y cómo se compone cada uno.
  @media print {
    .prep {
      max-width: none;
      padding: 0;
    }

    .documento {
      page: retrato;
      font-size: 11.5pt;
      line-height: 1.5;
    }

    // Un punto no debería empezar al final de una hoja y seguir en la siguiente.
    .documento :global(h3) {
      break-after: avoid;
      break-inside: avoid;
    }

    .documento :global(p) {
      orphans: 3;
      widows: 3;
    }

    // La schiță: dos columnas sobre A4 apaisado. Cada columna es la mitad de la
    // hoja, así que al doblar por el medio queda un cuadernillo A5 que cabe
    // dentro de la Biblia.
    .bloque {
      page: apaisado;
      columns: 2;
      column-gap: 18mm;
      // La línea del doblez, para saber por dónde va sin medir.
      column-rule: 1px dashed #bbbbbb;
    }

    // Un punto entero no se parte entre columnas: en el atril, medio punto en
    // cada mitad es peor que dejar hueco.
    .bloque :global(.schita-punto),
    .bloque :global(.campo) {
      break-inside: avoid;
    }
  }

  // ── Publicación ─────────────────────────────────────────
  .publicada {
    margin-top: 1rem;
    padding: 0.85rem 1rem;
    border: 1px solid var(--color-line-accent);
    border-radius: var(--radius-md);
    background: var(--wash-accent);
  }

  .publicada__titulo {
    margin: 0 0 0.5rem;
    color: var(--color-accent-ink);
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: var(--letter-spacing-eyebrow);
  }

  .publicada__fila {
    display: flex;
    gap: 0.5rem;

    input {
      flex: 1;
      min-width: 0;
      padding: 0.45rem 0.6rem;
      border: 1px solid var(--color-line);
      border-radius: var(--radius-sm);
      background: var(--color-field);
      color: var(--color-ink);
      font-size: 0.85rem;
    }

    button {
      flex: 0 0 auto;
      padding: 0.45rem 0.9rem;
      border: 1px solid var(--color-accent-solid);
      border-radius: var(--radius-sm);
      background: var(--color-accent-solid);
      color: var(--color-on-primary);
      font-weight: 700;
      cursor: pointer;
    }
  }

  .publicada__pista {
    margin: 0.5rem 0 0;
    color: var(--color-ink-soft);
    font-size: 0.78rem;
    line-height: 1.4;
  }

  // ── Marcar palabras para la schiță ──────────────────────
  .campo__cabecera {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    // Envuelve en pantallas estrechas: con dos botones a la derecha (insertar
    // cita + marcar) y una etiqueta larga a la izquierda, a 360px no cabían
    // en una sola fila sin desbordar.
    flex-wrap: wrap;
  }

  // Distingue lo obligatorio de lo opcional en DEZVOLTARE, tal como lo dice
  // el propio curso: explicar y aplicar son obligatorios, ilustrar no.
  .campo__marca {
    margin-left: 0.4rem;
    color: var(--color-accent-ink);
    font-size: 0.68rem;
    font-style: normal;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.02em;

    &--opcional {
      color: var(--color-ink-soft);
      font-weight: 500;
      text-transform: none;
    }
  }

  .campo__acciones {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .campo__marcar {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.2rem 0.55rem;
    border: 1px solid var(--color-line-accent);
    border-radius: var(--radius-pill);
    background: var(--wash-accent);
    color: var(--color-accent-ink);
    font-size: 0.72rem;
    font-weight: 700;
    cursor: pointer;
    transition: var(--transition);

    &:hover:not(:disabled) {
      border-color: var(--color-accent);
      background: var(--wash-accent-strong);
    }

    // Sin selección no hay nada que marcar: apagado en vez de escondido, para
    // que el botón enseñe que existe antes de hacer falta.
    &:disabled {
      opacity: 0.45;
      cursor: default;
    }
  }

  // ── Referencias a otros pasajes ─────────────────────────
  .refs {
    margin-top: 0.75rem;
    padding: 0.65rem 0.8rem;
    border: 1px dashed var(--color-line-strong);
    border-radius: var(--radius-md);
    background: var(--wash-subtle);
  }

  .refs__titulo {
    display: block;
    margin-bottom: 0.4rem;
    color: var(--color-ink-soft);
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: var(--letter-spacing-eyebrow);
  }

  .refs__vacio {
    margin: 0 0 0.5rem;
    color: var(--color-ink-soft);
    font-size: 0.82rem;
  }

  .refs__lista {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    margin: 0 0 0.5rem;
    padding: 0;
    list-style: none;

    li {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      padding: 0.2rem 0.3rem 0.2rem 0.6rem;
      border: 1px solid var(--color-line-accent);
      border-radius: var(--radius-pill);
      background: var(--color-surface-raised);
    }
  }

  .refs__cita {
    color: var(--color-accent-ink);
    font-size: 0.8rem;
    font-weight: 700;
  }

  .refs__quitar {
    display: grid;
    place-items: center;
    width: 1.15rem;
    height: 1.15rem;
    border: 0;
    border-radius: var(--radius-pill);
    background: transparent;
    color: var(--color-ink-soft);
    cursor: pointer;

    &:hover { background: var(--wash-hover); color: var(--color-danger); }
  }

  .refs__añadir {
    padding: 0.3rem 0.7rem;
    border: 1px solid var(--color-line-accent);
    border-radius: var(--radius-pill);
    background: transparent;
    color: var(--color-accent-ink);
    font-size: 0.78rem;
    font-weight: 700;
    cursor: pointer;

    &:hover { background: var(--wash-accent); }
  }

  // ── Sugerencias del buscador ────────────────────────────
  .sugerencias {
    display: grid;
    gap: 0.3rem;
    margin: 0.6rem 0 0;
    padding: 0;
    list-style: none;

    button {
      display: grid;
      gap: 0.15rem;
      width: 100%;
      padding: 0.5rem 0.65rem;
      border: 1px solid var(--color-line);
      border-radius: var(--radius-md);
      background: var(--color-surface-raised);
      text-align: left;
      cursor: pointer;
      transition: var(--transition);

      &:hover, &:focus-visible {
        border-color: var(--color-accent);
        background: var(--wash-accent);
      }
    }
  }

  .sugerencias__cita {
    color: var(--color-accent-ink);
    font-size: 0.85rem;
    font-weight: 700;
  }

  .sugerencias__texto {
    color: var(--color-ink-soft);
    font-size: 0.8rem;
    line-height: 1.4;
    // Dos líneas bastan para reconocer el versículo sin que la lista crezca.
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .prep__estado {
    display: grid;
    gap: 0.75rem;
    justify-items: center;
    padding: 3rem 1rem;
    text-align: center;
    color: var(--color-ink-soft);
  }

  .prep__cabecera {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .prep__cabecera-derecha {
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }

  .prep__guia {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    color: var(--color-link);
    font-size: var(--font-size-tiny);
    font-weight: 600;
    text-decoration: none;
    white-space: nowrap;

    &:hover { text-decoration: underline; }
  }

  .prep__actualizar {
    padding: 0.3rem 0.6rem;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-pill);
    background: transparent;
    color: var(--color-ink-soft);
    font-size: var(--font-size-tiny);
    font-weight: 600;
    cursor: pointer;
    transition: var(--transition);
    white-space: nowrap;

    &:hover:not(:disabled) { border-color: var(--color-accent); color: var(--color-accent); }
    &:disabled { opacity: 0.6; cursor: not-allowed; }
  }

  .prep__volver {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.35rem 0.6rem;
    border: 0;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--color-link);
    font-size: var(--font-size-small);
    font-weight: 600;
    cursor: pointer;

    &:hover { text-decoration: underline; }
  }

  // Indicador de guardado: discreto a propósito. Confirma sin pedir nada.
  .prep__guardado { min-height: 1.2rem; }

  .prep__guardado-texto {
    font-size: var(--font-size-tiny);
    color: var(--color-ink-soft);

    &--ok { color: var(--color-success); font-weight: 600; }
  }

  .prep__titulo {
    margin: 0;
    font-size: var(--font-size-h3);
  }

  /* El título se lee como un título y se edita como un campo. El botón no
     parece un botón hasta que se le acerca el ratón —el lápiz sí está siempre,
     que es lo que dice que esto se puede tocar—: un encabezado con marco y
     fondo dejaría de leerse como el nombre de la predicación. */
  .prep__titulo-boton {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    max-width: 100%;
    margin: -0.15rem -0.4rem;
    padding: 0.15rem 0.4rem;
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
    background: transparent;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: text;
    transition: var(--transition);
    --icon-size: 0.75em;

    > span { min-width: 0; }

    /* El lápiz apagado hasta que se pasa por encima: presente para quien lo
       busca, callado para quien está leyendo. */
    :global(svg) {
      flex: 0 0 auto;
      color: var(--color-ink-soft);
      opacity: 0.5;
      transition: var(--transition);
    }

    &:hover,
    &:focus-visible {
      border-color: var(--color-line);
      background: var(--color-surface-sunken);

      :global(svg) { color: var(--color-accent); opacity: 1; }
    }

    &:focus-visible {
      outline: none;
      border-color: var(--color-accent);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-accent) 18%, transparent);
    }
  }

  .prep__titulo-campo {
    width: 100%;
    margin: -0.15rem 0;
    padding: 0.15rem 0.4rem;
    border: 1px solid var(--color-accent);
    border-radius: var(--radius-sm);
    background: var(--color-surface);
    color: var(--color-ink);
    /* `font: inherit` sobre el <h1>: el campo tiene el mismo cuerpo y peso que
       el título, así que al pulsar no salta nada de sitio. */
    font: inherit;

    &:focus-visible {
      outline: none;
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-accent) 18%, transparent);
    }
  }

  .prep__titulo-aviso {
    margin: 0.35rem 0 0;
    color: var(--color-accent-ink);
    font-size: var(--font-size-small);
    font-weight: 600;
  }

  .prep__ref {
    margin: 0.1rem 0 1rem;
    font-size: var(--font-size-small);
    font-weight: 600;
    color: var(--color-link);
  }

  .prep__tipo {
    color: var(--color-ink-soft);
    font-weight: 600;
  }

  // ── Línea de pasos ────────────────────────────────────────────────────────
  // Se desliza en horizontal: con siete pasos, partirlos en varias filas en
  // móvil haría perder de vista dónde está uno.
  /* Siete pasos sin scroll horizontal.
     En móvil son siete casillas de un séptimo de ancho con el número dentro y
     el nombre debajo, fuera de la fila. En pantalla ancha vuelven a ser
     pastillas con nombre, pero con `wrap`: si no caben pasan a una segunda
     línea en vez de esconderse detrás de un scroll que nadie descubre. */
  .pasos {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 0.3rem;
    margin-bottom: 0.4rem;
  }

  .pasos__actual {
    margin: 0 0 1rem;
    color: var(--color-ink-soft);
    font-size: var(--font-size-tiny);
    font-weight: 600;
  }

  .pasos__nombre { display: none; }

  @media (min-width: 48rem) {
    .pasos {
      display: flex;
      flex-wrap: wrap;
      gap: 0.35rem;
      margin-bottom: 1rem;
    }
    .pasos__nombre { display: inline; }
    .pasos__actual { display: none; }
  }

  .pasos__paso {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
    min-width: 0;
    flex: 0 0 auto;
    padding: 0.35rem 0.5rem;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-pill);
    background: transparent;
    color: var(--color-ink-soft);
    font-size: var(--font-size-tiny);
    font-weight: 600;
    cursor: pointer;
    transition: var(--transition);

    &--hecho {
      border-color: color-mix(in srgb, var(--color-success) 45%, transparent);
      color: var(--color-success);
    }

    &--activo {
      border-color: var(--color-accent);
      background: color-mix(in srgb, var(--color-accent) 12%, transparent);
      color: var(--color-accent);
    }

    &:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }
  }

  .prep__vista {
    margin: 0 0 0.75rem;
    color: var(--color-accent-ink);
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: var(--letter-spacing-eyebrow);
  }

  .prep__aviso {
    margin: 0 0 0.9rem;
    padding: 0.55rem 0.8rem;
    border: 1px solid var(--color-line-accent);
    border-radius: var(--radius-md);
    background: var(--wash-accent);
    color: var(--color-accent-ink);
    font-size: var(--font-size-small);
    font-weight: 600;
  }

  .pasos__num {
    display: grid;
    place-items: center;
    width: 1.15rem;
    height: 1.15rem;
    border-radius: var(--radius-pill);
    background: color-mix(in srgb, currentcolor 16%, transparent);
    font-size: 0.65rem;
  }

  // ── Bloques de paso ───────────────────────────────────────────────────────
  .bloque {
    display: grid;
    gap: 0.85rem;
    padding: 1rem;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-lg);
    background: var(--color-surface);

    h2 { margin: 0; font-size: var(--font-size-h3); }
    h3 { margin: 0; font-size: var(--font-size-body); }
  }

  .bloque__ayuda {
    margin: 0;
    font-size: var(--font-size-small);
    color: var(--color-ink-soft);
  }

  .bloque__marcadas {
    margin: 0;
    font-size: var(--font-size-tiny);
    font-weight: 600;
    color: var(--color-accent);
  }

  .bloque__añadir,
  .punto__añadir-sub {
    justify-self: start;
    padding: 0.4rem 0.85rem;
    border: 1px dashed var(--color-line);
    border-radius: var(--radius-pill);
    background: transparent;
    color: var(--color-ink-soft);
    font-size: var(--font-size-small);
    font-weight: 600;
    cursor: pointer;

    &:hover { border-color: var(--color-accent); color: var(--color-accent); }
  }

  .campo {
    display: grid;
    gap: 0.25rem;
    font-size: var(--font-size-small);

    > span { font-weight: 600; color: var(--color-ink); }

    textarea,
    input {
      width: 100%;
      padding: 0.5rem 0.65rem;
      border: 1px solid var(--color-line);
      border-radius: var(--radius-sm);
      background: var(--color-surface);
      color: var(--color-ink);
      font: inherit;
      font-size: var(--font-size-small);
      line-height: 1.5;
      resize: vertical;

      &:focus-visible {
        outline: none;
        border-color: var(--color-accent);
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-accent) 18%, transparent);
      }
    }
  }

  /* La hoja de notas del paso TEXT: casi la pantalla entera.
     El tamaño ES la instrucción. Con las cinco filas del resto de campos el
     predicador escribe cinco líneas y pasa de paso; aquí se quiere que vuelque
     todo lo que se le ocurra, y una hoja grande y vacía lo pide sola.
     `dvh` y no `vh` porque en el móvil el teclado se come la ventana y con `vh`
     el campo se queda por debajo, con el cursor escondido detrás de las teclas.
     El `clamp` acota los dos extremos: en un portátil apaisado 60 dvh son cuatro
     dedos de alto, y en un monitor vertical serían dos palmos. */
  .campo--notas .campo__hoja {
    min-height: clamp(16rem, 65dvh, 48rem);
  }

  /* Las listas de la schiță: una idea por línea, con su guion. Sin ajuste
     automático de línea la lista se lee como lista y no como párrafo, que es
     justo lo que hay que ver de reojo desde el atril. */
  .campo__lista {
    white-space: pre;
    overflow-x: auto;
    font-variant-numeric: tabular-nums;
  }

  /* El título del punto en la schiță es un textarea y no un input: en la
     pantalla de un móvil un título de ocho palabras no cabe en una línea, y
     con un input hay que ir moviendo el cursor a ciegas para releerlo. */
  .punto__titulo-area {
    width: 100%;
    padding: 0.5rem 0.65rem;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-sm);
    background: var(--color-surface);
    color: var(--color-ink-strong);
    font: inherit;
    font-weight: 700;
    line-height: 1.35;
    resize: vertical;

    &:focus-visible {
      outline: none;
      border-color: var(--color-accent);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-accent) 18%, transparent);
    }
  }

  .campo__pista {
    font-size: var(--font-size-tiny);
    color: var(--color-ink-soft);
  }

  // ── Texto marcable ────────────────────────────────────────────────────────
  .texto {
    max-height: 22rem;
    overflow-y: auto;
    padding: 0.75rem;
    border-left: 3px solid var(--color-accent);
    border-radius: var(--radius-sm);
    background: var(--color-surface-sunken);
  }

  .texto__verso { margin: 0 0 0.5rem; line-height: 1.75; }

  .texto__num {
    margin-right: 0.3rem;
    font-size: var(--font-size-tiny);
    font-weight: 700;
    color: var(--color-link);
  }

  // Cada palabra es un botón. Sin fondo ni borde para que el texto siga
  // leyéndose como texto y no como una fila de controles.
  .texto__palabra {
    padding: 0 0.1rem;
    border: 0;
    border-radius: 0.2rem;
    background: transparent;
    color: inherit;
    font: inherit;
    cursor: pointer;

    &:hover { background: color-mix(in srgb, var(--color-accent) 14%, transparent); }

    &--marcada {
      background: color-mix(in srgb, var(--color-marked-favorite) 32%, transparent);
      font-weight: 700;
    }

    &:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 1px; }
  }

  .contexto {
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-sm);
    background: var(--color-surface-sunken);

    summary {
      font-size: var(--font-size-small);
      font-weight: 600;
      color: var(--color-accent);
      cursor: pointer;
    }
  }

  .contexto__verso {
    margin: 0.4rem 0 0;
    font-size: var(--font-size-small);
    line-height: 1.6;
  }

  // ── Puntos ────────────────────────────────────────────────────────────────
  .punto {
    display: grid;
    gap: 0.5rem;
    padding: 0.75rem;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-md);
    background: var(--color-surface-sunken);
  }

  // El desarrollo de un subpunto, dentro del de su punto. El filete lateral es
  // lo que dice de un vistazo que esto cuelga del punto y no es otro punto: en
  // DEZVOLTARE hay una tarjeta por punto y sin la marca de jerarquía los
  // subpuntos se leían como puntos sueltos.
  //
  // **No se llama `.subpunto`**: ese nombre ya es del paso Structură, que es una
  // fila `flex` con `button { width: 1.6rem }`. Reutilizarlo ponía este bloque
  // en horizontal y estrujaba «Marchează» y «+ Referință» a 1,6 rem, con el
  // texto saliendo en vertical, una letra por línea.
  .subdesarrollo {
    display: grid;
    gap: 0.5rem;
    margin-left: 0.15rem;
    padding-left: 0.7rem;
    border-left: 2px solid var(--color-line-strong);
  }

  .subdesarrollo__nombre {
    margin: 0;
    color: var(--color-ink-soft);
    font-size: var(--font-size-small);
    font-weight: 700;
  }

  // Envuelve a propósito. En una pantalla de 360 px la fila —número, campo de
  // título y los tres botones— pedía 328 px donde caben 290, y el sobrante se
  // convertía en scroll horizontal de TODA la página. Con `wrap` y un ancho
  // mínimo para el campo, los botones bajan a su propia línea en vez de
  // empujar.
  .punto__cabecera {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem;
  }

  .punto__num,
  .subpunto__num {
    flex: 0 0 auto;
    font-size: var(--font-size-small);
    font-weight: 700;
    color: var(--color-accent);
  }

  .punto__titulo {
    // 11rem de base: por debajo de eso el campo no se lee, así que en vez de
    // seguir encogiendo manda a los botones a la línea siguiente.
    flex: 1 1 11rem;
    min-width: 0;
    padding: 0.4rem 0.6rem;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-sm);
    background: var(--color-surface);
    color: var(--color-ink);
    font: inherit;
    font-size: var(--font-size-small);
    font-weight: 600;
  }

  .punto__nombre { color: var(--color-ink); }

  .punto__mover {
    display: flex;
    gap: 0.15rem;

    button {
      width: 2rem;
      height: 2rem;
      border: 1px solid var(--color-line);
      border-radius: var(--radius-sm);
      background: var(--color-surface);
      color: var(--color-ink-soft);
      cursor: pointer;

      &:disabled { opacity: 0.35; cursor: not-allowed; }
      &:hover:not(:disabled) { border-color: var(--color-accent); color: var(--color-accent); }
    }
  }

  .punto__borrar:hover:not(:disabled) {
    border-color: var(--color-marked-favorite) !important;
    color: var(--color-marked-favorite) !important;
  }

  .subpunto {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding-left: 1rem;

    input {
      flex: 1 1 auto;
      min-width: 0;
      padding: 0.35rem 0.55rem;
      border: 1px solid var(--color-line);
      border-radius: var(--radius-sm);
      background: var(--color-surface);
      color: var(--color-ink);
      font: inherit;
      font-size: var(--font-size-small);
    }

    button {
      width: 1.6rem;
      height: 1.6rem;
      border: 1px solid var(--color-line);
      border-radius: var(--radius-sm);
      background: var(--color-surface);
      color: var(--color-ink-soft);
      cursor: pointer;
    }
  }

  // ── Navegación y acciones ─────────────────────────────────────────────────
  //
  // OJO: `.prep__nav` y `.prep__acciones` comparten regla, y esa coma es fácil
  // de romper. Al insertar una regla nueva justo antes de `.prep__acciones {`
  // se cuela entre las dos y se lleva el `.prep__nav,` consigo: la barra de
  // «Înapoi / Continuă» se queda entonces sin ningún estilo y sus botones
  // salen con la pinta que trae el navegador de fábrica. Ya pasó una vez. Si
  // añades algo aquí, ponlo DESPUÉS del bloque, no antes.
  .prep__pista-impresion {
    margin: 0.6rem 0 0;
    color: var(--color-ink-soft);
    font-size: 0.78rem;
    line-height: 1.4;
    text-align: right;
  }

  .prep__nav,
  .prep__acciones {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    justify-content: space-between;
    margin-top: 1rem;

    button {
      padding: 0.5rem 1rem;
      border: 1px solid var(--color-line);
      border-radius: var(--radius-pill);
      background: transparent;
      color: var(--color-ink);
      font-size: var(--font-size-small);
      font-weight: 600;
      cursor: pointer;
      transition: var(--transition);

      &:disabled { opacity: 0.35; cursor: not-allowed; }
      &:hover:not(:disabled) { border-color: var(--color-accent); color: var(--color-accent); }
    }
  }

  .prep__acciones { justify-content: flex-end; }

  /* Después del bloque de arriba y anidado bajo `.prep__acciones`, para ganarle
     en especificidad a su regla `button` sin recurrir a !important: tres clases
     contra dos clases y un elemento. */
  .prep__acciones .prep__deshacer {
    border-color: var(--color-line-accent);
    background: var(--wash-accent);
    color: var(--color-accent-ink);
    font-weight: 700;
  }

  .prep__listo {
    display: grid;
    gap: 0.75rem;
    justify-items: center;
    margin-top: 1rem;
    padding: 1rem;
    border: 1px solid color-mix(in srgb, var(--color-success) 40%, transparent);
    border-radius: var(--radius-md);
    background: color-mix(in srgb, var(--color-success) 8%, transparent);
    text-align: center;

    p { margin: 0; font-size: var(--font-size-small); color: var(--color-ink); }
  }

  .prep__cta {
    justify-self: start;
    padding: 0.55rem 1.2rem;
    border: 1px solid var(--color-accent) !important;
    border-radius: var(--radius-pill);
    background: var(--color-accent-solid) !important;
    color: var(--color-on-primary) !important;
    font-size: var(--font-size-small);
    font-weight: 700;
    cursor: pointer;

    &:hover { background: var(--color-accent-hover) !important; }
  }

  // ── Documento final ───────────────────────────────────────────────────────
  .documento {
    padding: 1.25rem;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-lg);
    background: var(--color-surface);
    line-height: var(--line-height-body);

    h2 {
      margin: 1.25rem 0 0.4rem;
      font-size: var(--font-size-h3);

      &:first-of-type { margin-top: 0; }
    }

    h3 {
      margin: 0.75rem 0 0.3rem;
      font-size: var(--font-size-body);
      color: var(--color-ink-soft);
    }
  }

  .documento__meta {
    margin: 0 0 1rem;
    font-size: var(--font-size-tiny);
    color: var(--color-ink-soft);
  }

  .documento__parrafo {
    margin: 0 0 0.6rem;
    white-space: pre-wrap;
    color: var(--color-ink);

    /* La transición se lee de un vistazo entre la introducción y el primer
       punto: media tinta y un filete de acento, sin llegar a ser un titular.
       No lleva cursiva — es texto que se dice tal cual, no una acotación. */
    &--transicion {
      padding-left: 0.75rem;
      border-left: 2px solid var(--color-accent);
      color: var(--color-ink-strong);
      font-weight: 600;
    }

    // La ilustración se distingue del resto sin gritar: es material de apoyo.
    &--ilustra {
      padding-left: 0.75rem;
      border-left: 2px solid var(--color-line);
      color: var(--color-ink-soft);
      font-style: italic;
    }
  }
</style>

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
  import { buildSnapshot } from '../../services/sermon-pulpit.service';
  import Icon from '../../components/Icon.svelte';
  import Ajutor from '../../components/Ajutor.svelte';
  import Modal from '../../components/Modal.svelte';
  import { searchReferences } from '../../services/referenceSearch.service';
  import {
    STEPS,
    alternarMarca as envolverEnMarca,
    collectReferences,
    emptyContent,
    generateOutline,
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
  let buscadorAbierto = false;
  let puntoDeLaRef = '';
  let consultaRef = '';
  let sugerenciasRef = [];

  const abrirBuscadorRefs = (puntoId) => {
    puntoDeLaRef = puntoId;
    consultaRef = '';
    sugerenciasRef = [];
    buscadorAbierto = true;
  };

  const buscarRef = () => {
    sugerenciasRef = consultaRef.trim() ? searchReferences(consultaRef, map, 5) : [];
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
    const d = desarrolloDe(puntoDeLaRef);
    d.refs = d.refs || [];
    const label = `${map[m.book] || ''} ${m.chapter}:${m.verse}`.trim();
    if (!d.refs.some((r) => r.label === label)) {
      d.refs = [...d.refs, {
        book: m.book,
        chapter: m.chapter,
        verse: m.verse,
        label,
        text: bible?.[m.book]?.[m.chapter - 1]?.[m.verse - 1] || '',
      }];
    }
    content = content;
    guardarContenido();
    buscadorAbierto = false;
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
    clearTimeout(guardadoTimer);
    guardadoTimer = setTimeout(async () => {
      await sermonsStore.update(sermonId, cambios);
      estadoGuardado = 'guardado';
      clearTimeout(etiquetaTimer);
      etiquetaTimer = setTimeout(() => { estadoGuardado = ''; }, 2000);
    }, RETARDO_MS);
  };

  const guardarContenido = () => {
    content = { ...content };
    guardar({ content: JSON.stringify(content) });
  };

  // Guardado inmediato, sin esperar al retardo. Se usa al salir de la pantalla
  // y al cambiar de paso: son los momentos en que se puede perder lo tecleado.
  const guardarYa = async () => {
    clearTimeout(guardadoTimer);
    await sermonsStore.update(sermonId, { content: JSON.stringify(content) });
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
    content.structure = content.structure.filter((p) => p.id !== id);
    // El desarrollo huérfano se va con su punto: si no, el JSON crece con
    // trozos que ya no se ven en ninguna pantalla.
    const { [id]: _fuera, ...resto } = content.development;
    content.development = resto;
    guardarContenido();
  };

  const mover = (index, delta) => {
    content.structure = movePoint(content.structure, index, delta);
    guardarContenido();
  };

  const añadirSubpunto = (punto) => {
    punto.subpoints = [...(punto.subpoints || []), newSubpoint()];
    guardarContenido();
  };

  const borrarSubpunto = (punto, subId) => {
    punto.subpoints = punto.subpoints.filter((s) => s.id !== subId);
    guardarContenido();
  };

  const desarrolloDe = (id) => {
    if (!content.development[id]) {
      content.development[id] = { explain: '', illustrate: '', apply: '', refs: [] };
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
  // Timer propio y no el de `guardarContenido`: son dos peticiones distintas
  // —una escribe `content_json`, la otra la columna `series`— y compartiendo
  // temporizador cada tecla en un campo cancelaría el guardado pendiente del
  // otro.
  let serie = '';
  let serieTimer;

  const guardarSerie = () => {
    estadoGuardado = 'guardando';
    clearTimeout(serieTimer);
    serieTimer = setTimeout(async () => {
      await sermonsStore.update(sermonId, { series: serie.trim() || null });
      estadoGuardado = 'guardado';
      clearTimeout(etiquetaTimer);
      etiquetaTimer = setTimeout(() => { estadoGuardado = ''; }, 2000);
    }, RETARDO_MS);
  };

  const guardarSchita = () => {
    estadoGuardado = 'guardando';
    clearTimeout(guardadoTimer);
    guardadoTimer = setTimeout(async () => {
      await sermonsStore.update(sermonId, { outline: JSON.stringify(outline) });
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
    sermon = await sermonsStore.load(sermonId);
    content = normalizeContent(sermon?.content);
    outline = normalizeOutline(sermon?.outline);
    serie = sermon?.series || '';
    sincronizarTextos();
    cargando = false;
  });

  onDestroy(() => {
    clearTimeout(guardadoTimer);
    clearTimeout(etiquetaTimer);
    clearTimeout(serieTimer);
    // Al salir se guarda sin esperar: el usuario puede estar navegando fuera
    // justo después de teclear.
    if (sermonId && !cargando) {
      sermonsStore.update(sermonId, { content: JSON.stringify(content) });
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
      <div class="prep__guardado" aria-live="polite">
        {#if estadoGuardado === 'guardando'}
          <span class="prep__guardado-texto">{$_('app.sermons.saving')}</span>
        {:else if estadoGuardado === 'guardado'}
          <span class="prep__guardado-texto prep__guardado-texto--ok">{$_('app.sermons.saved')}</span>
        {/if}
      </div>
    </header>

    <h1 class="prep__titulo">{sermon.title || $_('app.sermons.untitled')}</h1>
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
        </div>

      <!-- ── OBSERVARE ────────────────────────────────────────────────── -->
      {:else if paso === 'observation'}
        <div class="bloque">
          <h2>{$_('app.sermons.step_observation')}</h2>
          <Ajutor paso="observation" tip={sermon?.type} />
          <p class="bloque__ayuda">{$_('app.sermons.optional_help')}</p>
          {#each ['repeats', 'contrasts', 'actions', 'tension', 'truth'] as clave (clave)}
            <label class="campo">
              <span>{$_(`app.sermons.obs_${clave}`)}</span>
              <textarea rows="5" bind:value={content.observation[clave]} on:input={guardarContenido}></textarea>
            </label>
          {/each}
        </div>

      <!-- ── CONTEXT ──────────────────────────────────────────────────── -->
      {:else if paso === 'context'}
        <div class="bloque">
          <h2>{$_('app.sermons.step_context')}</h2>
          <Ajutor paso="context" tip={sermon?.type} />

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
              <textarea rows="5" bind:value={content.context[clave]} on:input={guardarContenido}></textarea>
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
          <label class="campo">
            <span>{$_('app.sermons.idea_exegetical')}</span>
            <small class="campo__pista">{$_('app.sermons.idea_exegetical_help')}</small>
            <textarea rows="3" bind:value={content.idea.exegetical} on:input={guardarContenido}></textarea>
          </label>
          <label class="campo">
            <span>{$_('app.sermons.idea_purpose')}</span>
            <small class="campo__pista">{$_('app.sermons.idea_purpose_help')}</small>
            <textarea rows="5" bind:value={content.idea.purpose} on:input={guardarContenido}></textarea>
          </label>
          <label class="campo">
            <span>{$_('app.sermons.idea_central')}</span>
            <small class="campo__pista">{$_('app.sermons.idea_central_help')}</small>
            <textarea rows="3" bind:value={content.idea.central} on:input={guardarContenido}></textarea>
          </label>
          <label class="campo">
            <span>{$_('app.sermons.idea_question')}</span>
            <small class="campo__pista">{$_('app.sermons.idea_question_help')}</small>
            <textarea rows="2" bind:value={content.idea.question} on:input={guardarContenido}></textarea>
          </label>
        </div>

      <!-- ── STRUCTURA ────────────────────────────────────────────────── -->
      {:else if paso === 'structure'}
        <div class="bloque">
          <h2>{$_('app.sermons.step_structure')}</h2>
          <Ajutor paso="structure" tip={sermon?.type} />
          <p class="bloque__ayuda">{$_('app.sermons.structure_help')}</p>

          {#each content.structure as punto, i (punto.id)}
            <div class="punto">
              <div class="punto__cabecera">
                <span class="punto__num">{i + 1}</span>
                <input
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
                  <input type="text" bind:value={sub.title} on:input={guardarContenido} placeholder={$_('app.sermons.subpoint_placeholder')} />
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

                {#each ['explain', 'illustrate', 'apply'] as campo (campo)}
                  <div class="campo">
                    <div class="campo__cabecera">
                      <span>{$_(`app.sermons.dev_${campo}`)}</span>
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
                    <textarea
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

      <!-- ── FINALIZARE ───────────────────────────────────────────────── -->
      {:else if paso === 'final'}
        <div class="bloque">
          <h2>{$_('app.sermons.step_final')}</h2>
          <Ajutor paso="final" tip={sermon?.type} />
          <label class="campo">
            <span>{$_('app.sermons.intro')}</span>
            <small class="campo__pista">{$_('app.sermons.intro_help')}</small>
            <textarea rows="8" bind:value={content.intro} on:input={guardarContenido}></textarea>
          </label>
          <label class="campo">
            <span>{$_('app.sermons.conclusion')}</span>
            <small class="campo__pista">{$_('app.sermons.conclusion_help')}</small>
            <textarea rows="8" bind:value={content.conclusion} on:input={guardarContenido}></textarea>
          </label>

          <!-- La serie NO va en `content_json`: es una columna de la tabla,
               porque el listado público filtra por ella y filtrar por dentro de
               un JSON obligaría a cargar todas las predicaciones enteras. -->
          <label class="campo">
            <span>{$_('app.sermons.series')}</span>
            <small class="campo__pista">{$_('app.sermons.series_help')}</small>
            <input type="text" bind:value={serie} on:input={guardarSerie} />
          </label>
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
          <p class="documento__parrafo">{quitarMarcas(content.intro)}</p>
        {/if}

        {#each content.structure as punto, i (punto.id)}
          {@const d = content.development[punto.id] || {}}
          <!-- El documento es la predicación en limpio: se lee y se imprime,
               así que va sin la sintaxis de marcado. -->
          <h2>{i + 1}. {quitarMarcas(punto.title) || $_('app.sermons.point_placeholder')}</h2>
          {#each punto.subpoints || [] as sub, j (sub.id)}
            <h3>{i + 1}.{j + 1} {quitarMarcas(sub.title)}</h3>
          {/each}
          {#if d.explain}<p class="documento__parrafo">{quitarMarcas(d.explain)}</p>{/if}
          {#if d.illustrate}<p class="documento__parrafo documento__parrafo--ilustra">{quitarMarcas(d.illustrate)}</p>{/if}
          {#if d.apply}<p class="documento__parrafo">{quitarMarcas(d.apply)}</p>{/if}
        {/each}

        {#if content.conclusion.trim()}
          <h2>{$_('app.sermons.conclusion')}</h2>
          <p class="documento__parrafo">{quitarMarcas(content.conclusion)}</p>
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
            <input type="text" readonly value={enlacePublico} on:focus={(e) => e.target.select()} />
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
          <textarea rows="2" bind:value={outline.idea} on:input={guardarSchita}></textarea>
        </label>

        <label class="campo">
          <span>{$_('app.sermons.outline_intro')}</span>
          <small class="campo__pista">{$_('app.sermons.outline_lines_help')}</small>
          <textarea
            class="campo__lista"
            rows="3"
            bind:value={textoIntro}
            on:input={() => { outline.intro = textoAClaves(textoIntro); guardarSchita(); }}
          ></textarea>
        </label>

        {#each outline.points as p, i (p.id || i)}
          <div class="punto">
            <textarea class="punto__titulo-area" rows="2" bind:value={p.title} on:input={guardarSchita}></textarea>
            <label class="campo">
              <span>{$_('app.sermons.outline_keywords')}</span>
              <!-- Una idea por línea. El texto del `textarea` es estado propio
                   (`textoClaves`) y no se vuelve a derivar del array mientras se
                   escribe: si se derivara, borrar un guion reordenaría el valor
                   bajo el cursor y saltaría al final en cada tecla. -->
              <textarea
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
          <textarea rows="3" bind:value={outline.application} on:input={guardarSchita}></textarea>
        </label>
        <label class="campo">
          <span>{$_('app.sermons.conclusion')}</span>
          <textarea rows="3" bind:value={outline.conclusion} on:input={guardarSchita}></textarea>
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
     buscador de la Biblia: escribiendo «ioan 3 16» salen las sugerencias. -->
<Modal
  open={buscadorAbierto}
  title={$_('app.sermons.refs_add')}
  eyebrow={$_('app.sermons.refs_title')}
  size="sm"
  fitContent
  onClose={() => (buscadorAbierto = false)}
>
  <label class="campo">
    <span>{$_('app.sermons.refs_search')}</span>
    <input
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

  .punto__cabecera {
    display: flex;
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
    flex: 1 1 auto;
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
      width: 1.7rem;
      height: 1.7rem;
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

    // La ilustración se distingue del resto sin gritar: es material de apoyo.
    &--ilustra {
      padding-left: 0.75rem;
      border-left: 2px solid var(--color-line);
      color: var(--color-ink-soft);
      font-style: italic;
    }
  }
</style>

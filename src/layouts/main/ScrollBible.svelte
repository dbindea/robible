<script>
  /**
   * Biblia a scroll (`/scroll`).
   *
   * Un versículo por pantalla, encajado, y el dedo hacia arriba. Es una pantalla
   * de LECTURA, y eso es todo lo que es.
   *
   * **Por qué existe como pantalla propia.** Nació dentro del Modo Proyección,
   * como un modo del móvil: la lámina ya sabía pintar un versículo a toda
   * pantalla y parecía gratis reutilizarla entera. No lo era. Para leer a scroll
   * había que pasar por `/proiectie` —el buscador de la iglesia, los botones de
   * proyector, el historial de lo proyectado— y nada de eso pinta nada en el
   * sofá. Desde el 21 sep 2026 son dos cosas separadas: `/proiectie` es para la
   * pantalla de la iglesia y `/scroll` es para leer.
   *
   * Lo único que sigue compartiendo con la proyección es la **lámina**
   * (`ProjectionSurface`) y los **ajustes de cómo se ve** (fondo, ocupación,
   * segundo idioma). Eso es dibujo, no funcionalidad: duplicarlo dejaría dos
   * láminas que se separan al primer retoque, que es justo lo que el componente
   * venía a evitar.
   *
   * **Qué se lee.** Lo que hubiera en pantalla al entrar, y hay dos casos:
   *
   *   búsqueda por palabras   los resultados, tal cual y en su orden. Son
   *                           versículos de libros distintos: aquí la lista se
   *                           acaba, porque «lo siguiente» no significa nada.
   *   lo demás                el capítulo desde el versículo en el que se
   *                           estaba, y **no se acaba nunca**: al llegar al
   *                           final engancha el capítulo siguiente, y luego el
   *                           libro siguiente.
   */
  import { onDestroy, onMount } from 'svelte';
  import ProjectionControls from '../../components/ProjectionControls.svelte';
  import ProjectionSurface from '../../components/ProjectionSurface.svelte';
  import { parseBiblePath, getBookIdFromSlug } from '../../services/bible-route.service';
  import { _ } from '../../services/i18n.service';
  import { navegarA } from '../../services/navigation.service';
  import {
    acotarOcupacion,
    cargarPreferencias,
    guardarPreferencias,
    leerOrigenScroll,
  } from '../../services/projection.service';
  import { getLastRead } from '../../services/reading-progress.service';
  import { applySeoMetadata } from '../../services/seo.service';
  import { keepScreenAwake } from '../../services/sermon-pulpit.service';
  import { textoDeVersiculo } from '../../services/versification.service';
  import {
    compareWithVersion,
    filter,
    getBibleVersionConfigOrDefault,
    initCompareVersion,
    selectedBibleVersion,
  } from '../../store/stores';
  import { BIBLE_VERSIONS } from '../../config/bible-versions.js';

  export let bible = [];
  export let map = {};
  export let compareBible = [];
  export let compareMap = {};
  /** Lo que hay en la lista de resultados ahora mismo, ya filtrado por Main. */
  export let result = [];

  $: versionConfig = getBibleVersionConfigOrDefault($selectedBibleVersion);
  $: versionSecundariaConfig = $compareWithVersion ? getBibleVersionConfigOrDefault($compareWithVersion) : null;

  // `noindex`: es una herramienta del dispositivo. El texto bíblico ya se
  // indexa en `/biblia/…`, y lo que se indexa de esto es la sección de la
  // portada que lo anuncia.
  $: applySeoMetadata({
    title: $_('app.scroll.seo_title'),
    description: $_('app.scroll.seo_description'),
    canonicalPath: '/scroll',
    versionConfig,
    robots: 'noindex, nofollow',
  });

  let prefs = cargarPreferencias();
  const persistir = () => guardarPreferencias(prefs);

  // ── Qué se lee ────────────────────────────────────────────────────────────
  //
  // `pasajes` es la lista viva: empieza con lo que había en pantalla y, si es
  // un capítulo, va creciendo por abajo conforme se lee.
  let pasajes = [];
  let indice = 0;
  /** El capítulo que se está recorriendo, o `null` si son resultados sueltos. */
  let recorriendo = null;

  $: actual = pasajes[indice] || null;

  const construirCapitulo = (book, chapter) => {
    const versos = bible?.[book]?.[chapter - 1] || [];
    const nombre = map[book] || '';
    return versos
      .map((texto, i) => ({
        book,
        chapter,
        verse: i + 1,
        texto: String(texto || '').trim(),
        referencia: `${nombre} ${chapter}:${i + 1}`,
      }))
      .filter((v) => v.texto);
  };

  /**
   * Una búsqueda por palabras es la que tiene texto y NO es por referencia.
   *
   * Importa la distinción: buscar «Ioan 3 16» deja en pantalla un capítulo y lo
   * que se quiere es seguir leyendo desde ahí; buscar «dragoste» deja cincuenta
   * versículos de treinta libros y lo que se quiere es verlos esos.
   */
  const esBusquedaDeTexto = (form) => !!String(form?.searchText || '').trim() && form?.searchType !== 'reference';

  /** De dónde venía: `/biblia/es/juan/3/16` da libro, capítulo y versículo. */
  const puntoDePartida = () => {
    const ruta = parseBiblePath(leerOrigenScroll());
    if (ruta?.bookSlug) {
      const book = getBookIdFromSlug(map, ruta.bookSlug);
      if (Number.isInteger(book) && book >= 0) {
        return { book, chapter: ruta.chapter || 1, verse: ruta.verse || 1 };
      }
    }
    // Sin origen utilizable, por donde se iba leyendo. El `+ 1` convierte el
    // índice de capítulo (base 0, como lo guarda la lectura) al número.
    const ultima = getLastRead();
    if (ultima) return { book: ultima.book, chapter: ultima.chapter + 1, verse: 1 };
    return { book: 0, chapter: 1, verse: 1 };
  };

  const arrancar = () => {
    const form = $filter;

    if (esBusquedaDeTexto(form) && result.length) {
      // Tal cual y en su orden: son los mismos que se veían en la lista.
      recorriendo = null;
      pasajes = result.map((v) => ({
        book: v.book,
        chapter: v.chapter,
        verse: v.index,
        texto: String(v.text || '').trim(),
        referencia: `${map[v.book] || ''} ${v.chapter}:${v.index}`,
      }));
      indice = 0;
      return;
    }

    const desde = puntoDePartida();
    const lista = construirCapitulo(desde.book, desde.chapter);
    if (!lista.length) return;
    recorriendo = { book: desde.book, chapter: desde.chapter };
    pasajes = lista;
    indice = Math.max(
      0,
      lista.findIndex((v) => v.verse === desde.verse),
    );
  };

  // ── Seguir leyendo sin fin ────────────────────────────────────────────────
  const MARGEN = 3;

  /** El capítulo de al lado, saltando de libro y dando la vuelta en Apocalipsa. */
  const capituloVecino = ({ book, chapter }, paso) => {
    const capsDe = (b) => bible?.[b]?.length || 0;
    if (paso > 0) {
      if (chapter < capsDe(book)) return { book, chapter: chapter + 1 };
      return { book: book + 1 < 66 ? book + 1 : 0, chapter: 1 };
    }
    if (chapter > 1) return { book, chapter: chapter - 1 };
    const anterior = book - 1 >= 0 ? book - 1 : 65;
    return { book: anterior, chapter: capsDe(anterior) || 1 };
  };

  /**
   * Se ha deslizado hasta otro versículo.
   *
   * Si queda poco para el final engancha el capítulo siguiente. Se añade AL
   * FINAL y nunca al principio: prepender obligaría a corregir el `scrollTop`
   * en el mismo fotograma y el salto se ve.
   */
  const alVerVersiculo = (visible) => {
    if (visible < 0 || visible >= pasajes.length) return;
    indice = visible;
    if (!recorriendo || visible < pasajes.length - MARGEN) return;

    const destino = capituloVecino(recorriendo, 1);
    const lista = construirCapitulo(destino.book, destino.chapter);
    if (!lista.length) return;
    recorriendo = destino;
    pasajes = [...pasajes, ...lista];
  };

  /** Cambiar de capítulo a mano. Sin efecto sobre una lista de resultados. */
  const irACapitulo = (paso) => {
    if (!actual) return;
    const base = recorriendo || { book: actual.book, chapter: actual.chapter };
    const destino = capituloVecino(base, paso);
    const lista = construirCapitulo(destino.book, destino.chapter);
    if (!lista.length) return;
    recorriendo = destino;
    pasajes = lista;
    indice = paso > 0 ? 0 : lista.length - 1;
  };

  // ── Lo que ve la lámina ───────────────────────────────────────────────────
  //
  // El segundo idioma se resuelve por REFERENCIA y no por posición: las
  // ediciones no numeran igual y pintar lo que caiga en el mismo índice pondría
  // dos textos distintos uno debajo del otro (CLAUDE.md, trampa 96).
  $: versiculos = pasajes.map((p) => ({
    clave: `${p.book}-${p.chapter}-${p.verse}`,
    principal: { texto: p.texto, referencia: p.referencia, version: versionConfig?.bibleName || '' },
    secundario: prefs.segundoIdioma
      ? {
          texto: textoDeVersiculo(compareBible, $compareWithVersion, p.book, p.chapter, p.verse),
          referencia: compareMap?.[p.book] ? `${compareMap[p.book]} ${p.chapter}:${p.verse}` : '',
          version: versionSecundariaConfig?.bibleName || '',
        }
      : { texto: '', referencia: '', version: '' },
  }));

  $: principal = versiculos[indice]?.principal || { texto: '', referencia: '', version: '' };
  $: secundario = versiculos[indice]?.secundario || { texto: '', referencia: '', version: '' };

  // ── Ajustes ───────────────────────────────────────────────────────────────
  let panelAbierto = '';

  const cerrarPanel = () => {
    panelAbierto = '';
    mostrarControles();
  };
  const alternarPanel = (cual) => {
    panelAbierto = panelAbierto === cual ? '' : cual;
    mostrarControles();
  };
  const elegirFondo = (key) => {
    prefs.fondo = key;
    persistir();
    cerrarPanel();
  };
  const masGrande = () => {
    prefs.ocupacion = acotarOcupacion(prefs.ocupacion + 5);
    persistir();
  };
  const masPequeno = () => {
    prefs.ocupacion = acotarOcupacion(prefs.ocupacion - 5);
    persistir();
  };
  const fijarOcupacion = (valor) => {
    prefs.ocupacion = acotarOcupacion(valor);
    persistir();
  };

  const alternarSegundoIdioma = () => {
    prefs.segundoIdioma = !prefs.segundoIdioma;
    if (prefs.segundoIdioma && !$compareWithVersion) initCompareVersion();
    if (prefs.segundoIdioma && !$compareWithVersion) {
      const otra = BIBLE_VERSIONS.find((v) => v.value !== $selectedBibleVersion);
      if (otra) compareWithVersion.set(otra.value);
    }
    persistir();
  };
  const elegirSegundaVersion = (valor) => {
    compareWithVersion.set(valor);
    prefs.segundoIdioma = true;
    persistir();
    cerrarPanel();
  };
  const intercambiarIdiomas = () => {
    prefs.invertido = !prefs.invertido;
    persistir();
  };

  /** Salir es VOLVER: al capítulo, a la búsqueda, a donde se estaba. */
  const salir = () => navegarA(leerOrigenScroll() || '/');

  // ── La barra de ajustes ───────────────────────────────────────────────────
  //
  // No se saca con un toque ni con el desplazamiento: leyendo, el dedo está en
  // la pantalla todo el rato y un golpe rápido recorre poco aunque lleve mucha
  // velocidad, así que salía sola cada dos o tres versículos, encima de lo que
  // se estaba leyendo. Se pide y se quita deslizando DE LADO, que es el único
  // gesto que aquí no significa nada más — el scroll es vertical.
  let controlesVisibles = true;
  let ocultarTimer;
  const ESPERA_MS = 8000;
  /** 'izq' | 'der' — de qué borde entra la barra, la del lado del gesto. */
  let ladoControles = 'der';
  /** La pista del gesto, hasta que se usa por primera vez. */
  let pistaGesto = true;

  const mostrarControles = () => {
    controlesVisibles = true;
    clearTimeout(ocultarTimer);
    ocultarTimer = setTimeout(() => {
      panelAbierto = '';
      controlesVisibles = false;
    }, ESPERA_MS);
  };

  const DESLIZAMIENTO_MINIMO = 60;
  let toqueInicio = null;

  const alEmpezarToque = (e) => {
    const t = e.touches?.[0];
    toqueInicio = t ? { x: t.clientX, y: t.clientY } : null;
  };

  const alTerminarToque = (e) => {
    if (!toqueInicio) return;
    const t = e.changedTouches?.[0];
    const dx = t ? t.clientX - toqueInicio.x : 0;
    const dy = t ? t.clientY - toqueInicio.y : 0;
    toqueInicio = null;
    if (!t) return;
    // El `1.4` descarta la diagonal de un scroll hecho con el pulgar, que
    // siempre se va un poco de lado.
    if (Math.abs(dx) < DESLIZAMIENTO_MINIMO || Math.abs(dx) < Math.abs(dy) * 1.4) return;
    pistaGesto = false;
    if (controlesVisibles) {
      clearTimeout(ocultarTimer);
      panelAbierto = '';
      controlesVisibles = false;
      return;
    }
    ladoControles = dx > 0 ? 'izq' : 'der';
    mostrarControles();
  };

  // Con ratón sí vale mover el puntero: no hay dedo que se confunda con un
  // gesto de lectura.
  const alMoverRaton = () => mostrarControles();

  // ── Teclado ───────────────────────────────────────────────────────────────
  //
  // Vertical, versículo; horizontal, capítulo. El mismo reparto que la
  // proyección, porque es el que corresponde a lo que se lee.
  const alPulsarTecla = (e) => {
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    const donde = e.target?.tagName;
    if (donde === 'INPUT' || donde === 'TEXTAREA' || e.target?.isContentEditable) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      if (panelAbierto) panelAbierto = '';
      else salir();
      return;
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      irACapitulo(1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      irACapitulo(-1);
    }
  };

  // ── Ciclo de vida ─────────────────────────────────────────────────────────
  let soltarPantalla = null;

  onMount(() => {
    prefs = cargarPreferencias();
    if (prefs.segundoIdioma) initCompareVersion();
    arrancar();
    mostrarControles();

    // Leyendo, la pantalla no se puede apagar a los treinta segundos.
    soltarPantalla = keepScreenAwake().release;

    // La lámina es `fixed inset:0`, pero la página de debajo sigue siendo alta
    // y el navegador pintaría su barra de desplazamiento encima. Se reutiliza
    // la clase que ya usa `Modal.svelte`.
    document.body.classList.add('drawer-open');
    window.addEventListener('keydown', alPulsarTecla);

    return () => {
      window.removeEventListener('keydown', alPulsarTecla);
    };
  });

  onDestroy(() => {
    clearTimeout(ocultarTimer);
    if (soltarPantalla) soltarPantalla();
    if (typeof document !== 'undefined') document.body.classList.remove('drawer-open');
  });
</script>

<!-- `versiculos` es lo que convierte la lámina en la lista deslizable: sin él
     pintaría un solo versículo, que es lo que hace en el proyector. -->
<ProjectionSurface
  {principal}
  {secundario}
  fondoKey={prefs.fondo}
  ocupacion={prefs.ocupacion}
  animacion="none"
  {indice}
  {versiculos}
  onVisible={alVerVersiculo}
  on:mousemove={alMoverRaton}
  on:touchstart={alEmpezarToque}
  on:touchend={alTerminarToque}
>
  <!-- El gesto no se adivina, así que se dice una vez: sale con la barra
       mientras no se haya usado y desaparece en cuanto se desliza. -->
  {#if pistaGesto && controlesVisibles}
    <p class="pista-gesto">{$_('app.projection.swipe_hint')}</p>
  {/if}

  <!-- Las flechas de capítulo, sólo cuando se está recorriendo uno: sobre una
       lista de resultados «el capítulo siguiente» no significa nada. -->
  {#if recorriendo}
    <div class="capitulos" class:capitulos--ocultos={!controlesVisibles}>
      <button type="button" aria-label={$_('app.projection.key_prev_chapter')} on:click={() => irACapitulo(-1)}>
        ‹
      </button>
      <button type="button" aria-label={$_('app.projection.key_next_chapter')} on:click={() => irACapitulo(1)}>
        ›
      </button>
    </div>
  {/if}

  <!-- La misma botonera que la proyección, con lo de proyectar apagado: aquí no
       hay pantalla en negro, ni animación de entrada, ni contador de
       diapositivas. Lo que queda es cómo se ve el texto, que sí importa
       leyendo. -->
  <ProjectionControls
    {prefs}
    {panelAbierto}
    {indice}
    total={pasajes.length}
    visibles={controlesVisibles}
    lado={ladoControles}
    conPantallaCompleta={false}
    conProyeccion={false}
    onPanel={alternarPanel}
    onSalir={salir}
    onMasGrande={masGrande}
    onMasPequeno={masPequeno}
    onOcupacion={fijarOcupacion}
    onFondo={elegirFondo}
    onSegundoIdioma={alternarSegundoIdioma}
    onSegundaVersion={elegirSegundaVersion}
    onIntercambiar={intercambiarIdiomas}
  />
</ProjectionSurface>

<style lang="scss">
  // Colores fijos y no los de la paleta, como todo lo que se pinta encima de la
  // lámina: ésta trae su propio fondo elegido entre once.
  .pista-gesto {
    position: absolute;
    left: 50%;
    bottom: 4.1rem;
    transform: translateX(-50%);
    z-index: 3;
    max-width: calc(100vw - 2rem);
    margin: 0;
    padding: 0.4rem 0.8rem;
    border-radius: var(--radius-pill);
    background: rgba(20, 24, 30, 0.86);
    color: #f2f4f7;
    font-size: 0.74rem;
    font-weight: 600;
    text-align: center;
    // Va sobre la zona por la que se desliza: sin esto se tragaría el gesto
    // que la explica.
    pointer-events: none;
  }

  // Flechas de capítulo, a los lados y a media altura: el pulgar llega sin
  // soltar el teléfono, y no compiten con el texto, que está centrado.
  .capitulos {
    position: absolute;
    inset: 0;
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 0.5rem;
    pointer-events: none;
    transition: opacity var(--motion-base) ease;

    button {
      display: inline-grid;
      place-items: center;
      // 2.75rem = 44 px, cómodo para un pulgar y por encima del mínimo de 24.
      width: 2.75rem;
      height: 2.75rem;
      border: 1px solid rgba(255, 255, 255, 0.16);
      border-radius: 50%;
      background: rgba(20, 24, 30, 0.72);
      color: #f2f4f7;
      font-size: 1.4rem;
      line-height: 1;
      cursor: pointer;
      // El contenedor no recibe clics —taparía el scroll de punta a punta—
      // pero los botones sí.
      pointer-events: auto;
    }
  }

  .capitulos--ocultos {
    opacity: 0;
    pointer-events: none;

    button {
      pointer-events: none;
    }
  }
</style>

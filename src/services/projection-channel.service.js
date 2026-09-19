/**
 * El puente entre la ventana de control y la ventana proyectada.
 *
 * Por qué existe: hasta el 16 sep 2026 la proyección era una capa
 * `fixed inset:0` **dentro del mismo documento**. Con dos monitores eso no
 * sirve: una ventana del navegador está en UNA pantalla, así que o se llevaba
 * el navegador entero al proyector —y el portátil se quedaba sin la
 * aplicación— o se dejaba en el portátil y el proyector no enseñaba nada. Y
 * mientras se proyectaba no había ni un campo de búsqueda a la vista: para
 * poner el versículo siguiente había que salir de la proyección.
 *
 * La solución es una segunda ventana del navegador (`/proiectie?ecran=1`) que
 * el operador arrastra al proyector y pone a pantalla completa. Las dos
 * ventanas son el mismo origen, así que se hablan por `BroadcastChannel` sin
 * servidor, sin red y sin permisos.
 *
 * **Se manda TEXTO, no coordenadas.** La ventana proyectada no carga ninguna
 * Biblia: recibe el versículo ya resuelto. Son ~4 MB que no se descargan dos
 * veces, y sobre todo evita que las dos ventanas puedan discrepar sobre qué
 * dice un versículo delante de la congregación. Es el mismo criterio que el
 * Modo Amvon (CLAUDE.md, trampa 30).
 */

import { esGeometria } from './projection.service.js';

/** Un solo canal para todo. El nombre lleva el prefijo del proyecto. */
export const NOMBRE_CANAL = 'robible:proiectie';

/** La ruta de la ventana proyectada. Es la misma pantalla con un parámetro:
 *  añadir una ruta obligaría a tocar cuatro ficheros (CLAUDE.md, trampa 11). */
export const RUTA_PANTALLA = '/proiectie?ecran=1';

/** El nombre de la ventana. Reutilizarlo evita abrir dos proyecciones. */
export const NOMBRE_VENTANA = 'robible-proiectie';

export const soportaCanal = () => typeof BroadcastChannel !== 'undefined';

/**
 * Tipos de mensaje. Son cuatro y cada uno va en una dirección:
 *
 *   estado   control → pantalla   lo que hay que pintar, entero
 *   listo    pantalla → control   «acabo de abrirme, mándame el estado»
 *   cerrando pantalla → control   «me han cerrado»
 *   tecla    pantalla → control   una tecla pulsada en la ventana proyectada
 *
 * `estado` va entero y no por diferencias a propósito: son cuatro campos y un
 * texto, el coste es nulo, y con diferencias una ventana que se abre tarde o
 * un mensaje perdido dejarían las dos pantallas discrepando sin forma de
 * recuperarse.
 */
export const MENSAJES = {
  ESTADO: 'estado',
  LISTO: 'listo',
  CERRANDO: 'cerrando',
  TECLA: 'tecla',
  /**
   * control → pantalla: «apártate del proyector».
   *
   * Existe porque **una ventana no se puede abrir ya a pantalla completa**: eso
   * exige activación del usuario en ESE documento, y una ventana recién abierta
   * no la tiene. Chrome lo probó con un `windowFeature` y abandonó el
   * experimento en 2024. Así que la ventana **no se cierra**: se sale de
   * pantalla completa, se encoge y se muda a la pantalla del portátil. Sigue
   * viva, y por eso un clic suyo basta para volver al proyector a pantalla
   * completa — la activación la pone ese clic.
   */
  CEDER: 'ceder',
  /** pantalla → control: 'proyector' | 'apartada'. Para que la consola lo diga. */
  VENTANA: 'ventana',
};

/**
 * Abre el canal y devuelve `{ enviar, cerrar }`.
 *
 * `alRecibir` se llama con cada mensaje ajeno. Un `BroadcastChannel` no se
 * escucha a sí mismo, así que no hace falta filtrar los propios.
 *
 * Si el navegador no lo soporta devuelve un objeto inerte en vez de `null`:
 * quien lo use no tiene que comprobar nada, y la proyección en una sola
 * pantalla —que no necesita canal— sigue funcionando igual.
 */
export const abrirCanal = (alRecibir) => {
  if (!soportaCanal()) return { enviar: () => {}, cerrar: () => {} };

  const canal = new BroadcastChannel(NOMBRE_CANAL);
  if (typeof alRecibir === 'function') {
    canal.onmessage = (e) => alRecibir(e.data);
  }

  return {
    enviar: (mensaje) => {
      try {
        canal.postMessage(mensaje);
      } catch {
        // Un canal cerrado lanza. No hay nada que hacer y no puede tumbar la
        // proyección en mitad de un culto.
      }
    },
    cerrar: () => {
      try {
        canal.close();
      } catch {
        /* ya estaba cerrado */
      }
    },
  };
};

/**
 * Dónde abrir la ventana proyectada.
 *
 * Con la API de gestión de ventanas (Chrome y Edge, previo permiso) se puede
 * saber que hay un segundo monitor y colocarla allí directamente. Sin ella
 * —Firefox, Safari, o permiso denegado— se abre una ventana normal y la
 * arrastra el operador: es un gesto que ya conoce cualquiera que haya
 * proyectado algo alguna vez, así que no se pide el permiso por adelantado ni
 * se bloquea nada si no está.
 *
 * Devuelve las coordenadas de la pantalla secundaria, o `null`.
 */
export const buscarPantallaSecundaria = async () => {
  try {
    if (!('getScreenDetails' in window)) return null;
    // `isExtended` es barato y no pide permiso: si sólo hay una pantalla, no
    // tiene sentido molestar al usuario con un diálogo.
    if (window.screen?.isExtended === false) return null;

    const detalles = await window.getScreenDetails();
    const secundaria = detalles.screens.find((p) => !p.isPrimary);
    if (!secundaria) return null;
    return {
      left: secundaria.availLeft,
      top: secundaria.availTop,
      width: secundaria.availWidth,
      height: secundaria.availHeight,
    };
  } catch {
    // El permiso se deniega o la API no está: se abre donde el navegador
    // quiera y el operador la mueve.
    return null;
  }
};

/**
 * Abre (o reutiliza) la ventana proyectada y la devuelve.
 *
 * **`window.open` va SÍNCRONO, lo primero de todo.** Es la única forma de que
 * cuente como abierta por el usuario: en cuanto se mete un `await` delante
 * —por ejemplo el de `getScreenDetails()`, que además pide permiso— el
 * navegador ya no la asocia al clic y el bloqueador de ventanas emergentes la
 * descarta en silencio. Se vio probándolo: el botón no hacía absolutamente
 * nada y no había ni error ni aviso.
 *
 * La colocación en el segundo monitor viene DESPUÉS, sobre la ventana ya
 * abierta. Si el permiso se deniega o la API no está, se queda donde el
 * navegador la haya puesto y la arrastra el operador — que es exactamente lo
 * que se hace con cualquier programa de presentación.
 *
 * Reutiliza por nombre: pulsar dos veces el botón trae al frente la que ya
 * está abierta en vez de dejar dos proyecciones discutiendo por el mismo
 * proyector.
 *
 * `geometria` son las coordenadas del proyector de la vez anterior. Van en la
 * cadena de rasgos y no sólo en el `moveTo` de después porque así la ventana
 * **nace** donde tiene que estar: con el `moveTo` a secas aparece un instante
 * en el portátil y salta, y ese salto se ve en la pantalla de la iglesia cada
 * vez que se recupera el proyector. Si el navegador no hace caso —sin permiso
 * de gestión de ventanas las coordenadas se recortan a la pantalla actual—
 * queda el `moveTo` de siempre.
 *
 * `alColocar` recibe las medidas reales cuando se encuentra el segundo
 * monitor, para poder guardarlas.
 */
export const abrirVentanaPantalla = (geometria = null, alColocar = null) => {
  const rasgos = ['popup=yes'];
  if (esGeometria(geometria)) {
    rasgos.push(
      `left=${Math.round(geometria.left)}`,
      `top=${Math.round(geometria.top)}`,
      `width=${Math.round(geometria.width)}`,
      `height=${Math.round(geometria.height)}`,
    );
  } else {
    rasgos.push('width=1280', 'height=720');
  }

  const ventana = window.open(RUTA_PANTALLA, NOMBRE_VENTANA, rasgos.join(','));
  if (!ventana) return null;
  ventana.focus();

  // Y se insiste con `moveTo` sobre la ventana ya abierta. Los rasgos de
  // `window.open` los interpreta cada navegador a su manera —y algunos los
  // recortan a la pantalla actual—, mientras que `moveTo` sobre una ventana
  // que hemos abierto nosotros sí se respeta en cuanto hay permiso de gestión
  // de ventanas. Es la diferencia entre recuperar el proyector y encontrarse
  // la proyección otra vez en el portátil.
  colocar(ventana, geometria);

  // Sin `await`: no se hace esperar al operador por una colocación que es una
  // comodidad, no un requisito.
  buscarPantallaSecundaria()
    .then((destino) => {
      // Lo recordado gana sobre lo que diga la API: si el operador la colocó a
      // mano en un sitio concreto —un proyector que no es la pantalla
      // «secundaria», una segunda pantalla con barra de tareas— ahí es donde
      // tiene que volver. La API sólo sirve para la primera vez.
      if (!destino || esGeometria(geometria)) return;
      colocar(ventana, destino);
      if (typeof alColocar === 'function') alColocar(destino);
    })
    .catch(() => {
      /* se queda donde esté; la mueve el operador */
    });

  return ventana;
};

const colocar = (ventana, geometria) => {
  if (!esGeometria(geometria)) return;
  try {
    ventana.moveTo(Math.round(geometria.left), Math.round(geometria.top));
    ventana.resizeTo(Math.round(geometria.width), Math.round(geometria.height));
  } catch {
    /* sin permiso de gestión de ventanas; la coloca el operador */
  }
};

/**
 * Dónde está AHORA la ventana proyectada.
 *
 * Es la medida buena, mejor que la de `getScreenDetails`: dice dónde la ha
 * puesto el operador de verdad, incluida la pantalla completa —ahí `screenX` y
 * `screenY` son el origen del proyector y `outerWidth`/`outerHeight` su tamaño
 * exacto—. Se lee justo antes de cerrarla al ceder el proyector, que es cuando
 * todavía se puede.
 *
 * Funciona sin ningún permiso: es una ventana nuestra, del mismo origen.
 */
export const leerGeometria = (ventana) => {
  try {
    if (!ventana || ventana.closed) return null;
    const g = {
      left: ventana.screenX,
      top: ventana.screenY,
      width: ventana.outerWidth,
      height: ventana.outerHeight,
    };
    return esGeometria(g) ? g : null;
  } catch {
    return null;
  }
};

/**
 * Si el navegador nos deja colocar ventanas en otra pantalla.
 *
 * Importa porque **sin este permiso Chrome recorta las coordenadas a la
 * pantalla actual**: por muy bien que recordemos dónde estaba el proyector, la
 * ventana reaparece en el portátil y hay que arrastrarla otra vez. Se consulta
 * sin provocar el diálogo, para poder avisar en la consola antes de que pase.
 *
 * Devuelve 'granted' | 'prompt' | 'denied' | 'unsupported'.
 */
export const estadoPermisoVentanas = async () => {
  if (typeof window === 'undefined' || !('getScreenDetails' in window)) return 'unsupported';
  // El nombre cambió a mitad de camino: primero `window-placement`, luego
  // `window-management`. Se prueban los dos, que es más corto que detectar
  // versiones de navegador; consultarlo NO abre el diálogo.
  for (const name of ['window-management', 'window-placement']) {
    try {
      const estado = await navigator.permissions?.query?.({ name });
      if (estado?.state) return estado.state;
    } catch {
      /* ese nombre no lo conoce: se prueba el otro */
    }
  }
  // Soporta la API pero no sabemos el estado: se trata como «aún no concedido»,
  // que es lo que deja el aviso a la vista en vez de esconderlo.
  return 'prompt';
};

/**
 * Pide el permiso. Tiene que salir de un gesto del usuario, como cualquier
 * diálogo de permisos, así que se llama desde el manejador de un clic.
 */
export const pedirPermisoVentanas = async () => {
  try {
    await window.getScreenDetails?.();
  } catch {
    /* lo ha denegado: el estado que se consulte después ya lo dirá */
  }
  return estadoPermisoVentanas();
};

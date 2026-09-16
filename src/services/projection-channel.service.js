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
 */
export const abrirVentanaPantalla = () => {
  const ventana = window.open(RUTA_PANTALLA, NOMBRE_VENTANA, 'popup=yes,width=1280,height=720');
  if (!ventana) return null;
  ventana.focus();

  // Sin `await`: no se hace esperar al operador por una colocación que es una
  // comodidad, no un requisito.
  buscarPantallaSecundaria()
    .then((destino) => {
      if (!destino) return;
      ventana.moveTo(destino.left, destino.top);
      ventana.resizeTo(destino.width, destino.height);
    })
    .catch(() => {
      /* se queda donde esté; la mueve el operador */
    });

  return ventana;
};

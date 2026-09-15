// Qué funciones puede usar cada cuenta.
//
// Contexto y decisión de producto (15 sep 2026): **leer la Biblia no se cobra
// nunca**. Lo que algún día puede requerir suscripción son utilidades muy por
// encima de lo que la gente espera de una Biblia en línea — la primera
// candidata es dictar la referencia por voz. Esto se escribe ahora para que el
// día que se active no haya que tocar diez pantallas: el interruptor es una
// constante de este fichero y una columna en la base de datos.
//
// **Hoy no cobra nada.** `EN_PRUEBAS` deja todas las funciones abiertas: se
// quiere que la gente las use y decir si merecen la pena antes de ponerles
// precio.
//
// ── Lo que este módulo NO es ────────────────────────────────────────────────
//
// No es un control de acceso. El dictado ocurre entero en el navegador (la Web
// Speech API), así que quien quiera saltárselo puede: no hay ninguna petición
// al servidor que se pueda denegar. Y está bien que sea así — esto no guarda un
// secreto, ordena una oferta. **Si algún día se cobra algo que sí cueste dinero
// por uso** (una transcripción en servidor, una llamada a un modelo), la
// comprobación tiene que estar en el worker, en la ruta que gasta, y no aquí.

/**
 * Mientras esté en `true`, todas las funciones están abiertas para todos.
 *
 * Es el interruptor de la fase de pruebas. Ponerlo en `false` activa los planes
 * tal y como están descritos abajo, sin tocar ningún componente.
 */
export const EN_PRUEBAS = true;

/** Planes. `free` es lo que tiene cualquiera que se registre. */
export const PLANES = ['free', 'plus'];

/**
 * Catálogo de funciones con plan.
 *
 * `desde` es el plan mínimo. `anonimo` dice si vale sin haber iniciado sesión —
 * hoy el dictado sí, porque durante las pruebas interesa que lo pruebe
 * cualquiera que entre, incluida la persona que proyecta en una iglesia y no
 * tiene cuenta.
 */
export const FUNCIONES = {
  // Dictar la referencia o la frase en vez de teclearla.
  voiceSearch: { desde: 'plus', anonimo: true },
};

const rango = (plan) => {
  const i = PLANES.indexOf(plan);
  return i === -1 ? 0 : i;
};

/** El plan de una cuenta. Sin sesión o sin dato, `free`. */
export const planDe = (user) => {
  const p = user?.plan;
  return PLANES.includes(p) ? p : 'free';
};

/**
 * ¿Puede esta cuenta usar esta función?
 *
 * @param {object|null} user  `$currentUser`, o null si no hay sesión.
 * @param {string} clave      Una de `FUNCIONES`.
 */
export const puedeUsar = (user, clave) => {
  const def = FUNCIONES[clave];
  // Una función que no está en el catálogo no tiene plan: es de todos. Así,
  // olvidarse de declararla deja la función ABIERTA en vez de romperla en
  // silencio para todo el mundo, que es el fallo que costaría caro.
  if (!def) return true;
  if (EN_PRUEBAS) return true;
  if (!user) return !!def.anonimo;
  return rango(planDe(user)) >= rango(def.desde);
};

/**
 * ¿Hay que enseñar que esto es de pago?
 *
 * Distinto de `puedeUsar`: durante las pruebas la respuesta es que no, aunque
 * la función tenga plan asignado. Sirve para que los componentes no tengan que
 * conocer `EN_PRUEBAS`.
 */
export const esDePago = (clave) => !EN_PRUEBAS && !!FUNCIONES[clave];

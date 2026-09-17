/**
 * Qué versiones de la Biblia ve cada uno en los selectores.
 *
 * RoBible tiene siete traducciones y va a tener más. Enseñarlas todas a todo el
 * mundo convierte el selector en una lista que hay que leer entera para cambiar
 * de idioma, y la mayoría de la gente usa una o dos.
 *
 * La regla, decidida el 17 sep 2026:
 *
 *   sin sesión   las cuatro de siempre, y no hay nada que configurar
 *   con sesión   las que el usuario haya activado en «Mi cuenta»
 *
 * No es un muro: las cuatro por defecto siguen siendo las de siempre y nadie
 * pierde nada por no registrarse. Lo que da la cuenta es poder **elegir**.
 *
 * La preferencia vive en `localStorage` y no en el servidor a propósito: es del
 * dispositivo, como la paleta o el progreso de lectura. En el portátil se
 * quieren las cuatro españolas para comparar; en el móvil, sólo una.
 */
import { derived, get, writable } from 'svelte/store';
import { BIBLE_VERSIONS } from '../config/bible-versions.js';
import { isAuthenticated } from './authStore';

const CLAVE = 'robible:versiones-activas';

/**
 * Las que había antes de que esto existiera, una por idioma.
 *
 * Es el valor por defecto y también el de quien no ha iniciado sesión, así que
 * cambiar esta lista cambia lo que ve todo el mundo. No es una constante
 * decorativa.
 */
export const VERSIONES_POR_DEFECTO = ['vdc', 'rvl', 'en_kjv', 'zh_cuv'];

const leer = () => {
  try {
    const guardado = JSON.parse(localStorage.getItem(CLAVE));
    if (!Array.isArray(guardado) || !guardado.length) return VERSIONES_POR_DEFECTO;
    // Se filtra contra el catálogo: una versión retirada dejaría una clave
    // huérfana que no se puede volver a quitar desde la interfaz.
    const validas = guardado.filter((v) => BIBLE_VERSIONS.some((b) => b.value === v && b.available));
    return validas.length ? validas : VERSIONES_POR_DEFECTO;
  } catch {
    return VERSIONES_POR_DEFECTO;
  }
};

export const versionesActivas = writable(typeof localStorage === 'undefined' ? VERSIONES_POR_DEFECTO : leer());

versionesActivas.subscribe((lista) => {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(lista));
  } catch {
    /* sin localStorage se queda en memoria y funciona igual */
  }
});

/**
 * Enciende o apaga una versión.
 *
 * **Nunca deja la lista vacía y nunca apaga la que se está leyendo.** Sin esas
 * dos guardas, el selector se quedaba sin opciones o la aplicación se quedaba
 * en una versión que ya no estaba en la lista — y desde ahí no había forma de
 * salir sin borrar el almacenamiento del navegador.
 */
export const alternarVersion = (valor, versionActiva) => {
  const lista = get(versionesActivas);
  const estaba = lista.includes(valor);

  if (estaba) {
    if (valor === versionActiva) return { ok: false, motivo: 'activa' };
    if (lista.length <= 1) return { ok: false, motivo: 'ultima' };
    versionesActivas.set(lista.filter((v) => v !== valor));
  } else {
    // Se guarda en el orden del catálogo y no en el de los clics: así el
    // selector sale siempre igual, con los idiomas juntos.
    const siguiente = BIBLE_VERSIONS.filter((b) => b.available && (b.value === valor || lista.includes(b.value))).map(
      (b) => b.value,
    );
    versionesActivas.set(siguiente);
  }

  return { ok: true };
};

/**
 * Las versiones que hay que ofrecer, ya resueltas.
 *
 * Es lo que tienen que usar los selectores — el de la barra, el de comparar y
 * el del segundo idioma de la proyección— en lugar de `getAvailableBibleVersions()`,
 * que devuelve el catálogo entero y no sabe nada del usuario.
 */
export const versionesDisponibles = derived([versionesActivas, isAuthenticated], ([$activas, $conSesion]) => {
  const permitidas = $conSesion ? $activas : VERSIONES_POR_DEFECTO;
  return BIBLE_VERSIONS.filter((v) => v.available && permitidas.includes(v.value));
});

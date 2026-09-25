/**
 * Datos del sitio que no son traducibles: quién hay detrás.
 *
 * Viven aquí y no dentro de cada pie porque hay DOS pies —el de la aplicación
 * y el de la landing, deliberadamente separados (CLAUDE.md, trampa 43)— y una
 * dirección escrita dos veces se separa al primer cambio. El marcado se
 * escribe en cada sitio; el dato, una sola vez.
 *
 * Nada de esto pasa por `$_()`: un nombre propio, una dirección postal y un
 * correo no se traducen. El texto que sí los acompaña (los encabezados de las
 * columnas) sí está en los cuatro idiomas.
 *
 * Aquí vivió también el enlace de donación de PayPal. Se retiró entero el 25
 * sep 2026 por decisión del propietario: RoBible no pide dinero en ninguna
 * pantalla. Si alguna vez vuelve, vuelve como decisión explícita, no
 * reactivando una constante olvidada.
 */

/** Quién responde de RoBible. Sale en el pie, en las cuatro páginas públicas. */
export const CONTACTO = {
  nombre: 'Dorel Bindea',
  direccion: '28500 Arganda del Rey (Madrid)',
  email: 'dbindea@gmail.com',
};

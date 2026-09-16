/**
 * Datos del sitio que no son traducibles: quién hay detrás y dónde donar.
 *
 * Viven aquí y no dentro de cada pie porque hay DOS pies —el de la aplicación
 * y el de la landing, deliberadamente separados (CLAUDE.md, trampa 43)— y una
 * dirección o un enlace de pago escritos dos veces se separan al primer
 * cambio. El marcado se escribe en cada sitio; el dato, una sola vez.
 *
 * Nada de esto pasa por `$_()`: un nombre propio, una dirección postal y un
 * correo no se traducen. El texto que sí los acompaña (los encabezados de las
 * columnas, el para qué de las donaciones) sí está en los cuatro idiomas.
 */

/** Quién responde de RoBible. Sale en el pie, en las cuatro páginas públicas. */
export const CONTACTO = {
  nombre: 'Dorel Bindea',
  direccion: '28500 Arganda del Rey (Madrid)',
  email: 'dbindea@gmail.com',
};

/**
 * Página de pago de PayPal a la que van las donaciones.
 *
 * Es un enlace de «No-Code Checkout» (`/ncp/payment/<id>`), creado desde el
 * panel de PayPal: una página alojada por ellos donde quien dona elige el
 * importe. Lo da el propietario de la cuenta y **no se puede deducir** —el
 * identificador no tiene relación con el nombre ni con el correo—, así que
 * aquí va tal cual lo entregó, sin reconstruirlo por partes.
 *
 * Vacío = no se pinta ningún botón en ninguna parte. Es el estado seguro: más
 * vale un pie sin botón que un botón que cobra a saber para quién.
 */
export const PAYPAL_ENLACE = 'https://www.paypal.com/ncp/payment/RHM4ARZK28FEQ';

/**
 * Se eligió una página alojada y no el SDK de botones inteligentes a propósito.
 *
 * El SDK es un `<script>` de paypal.com cargado en cada página, con sus
 * cookies y su huella — y la primera promesa de la landing es «la Biblia que
 * no te sigue». Un enlace normal no carga nada de terceros hasta que alguien
 * decide pulsarlo, que es exactamente donde debe estar la frontera. Es el
 * mismo criterio que con el dictado por voz (CLAUDE.md, trampa 92).
 */
export const hayDonaciones = () => PAYPAL_ENLACE.trim().length > 0;

/** El enlace de donación, o cadena vacía si no está configurado. */
export const enlaceDonacion = () => PAYPAL_ENLACE.trim();

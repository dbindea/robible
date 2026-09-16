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
 * Usuario de PayPal.me al que van las donaciones.
 *
 * ⚠️ VERIFICA que `https://paypal.me/<esto>` abre TU cuenta antes de subir a
 * producción. Los identificadores de PayPal.me se reparten por orden de
 * llegada: si éste lo tiene otra persona, el dinero de quien done acaba en su
 * cuenta y no hay forma de saberlo desde el código.
 *
 * Vacío = no se pinta ningún botón en ninguna parte. Es el estado seguro: más
 * vale un pie sin botón que un botón que cobra para un desconocido.
 */
export const PAYPAL_USUARIO = 'dbindea';

/**
 * Se eligió PayPal.me y no el SDK de botones inteligentes a propósito.
 *
 * El SDK es un `<script>` de paypal.com cargado en cada página, con sus
 * cookies y su huella — y la primera promesa de la landing es «la Biblia que
 * no te sigue». Un enlace normal no carga nada de terceros hasta que alguien
 * decide pulsarlo, que es exactamente donde debe estar la frontera. Es el
 * mismo criterio que con el dictado por voz (CLAUDE.md, trampa 92).
 */
export const hayDonaciones = () => PAYPAL_USUARIO.trim().length > 0;

/** El enlace de donación, o cadena vacía si no está configurado. */
export const enlaceDonacion = () => (hayDonaciones() ? `https://www.paypal.com/paypalme/${PAYPAL_USUARIO.trim()}` : '');

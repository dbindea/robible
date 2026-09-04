import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';

export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'public/build/**', 'workers/*/node_modules/**'],
  },
  js.configs.recommended,
  ...svelte.configs['flat/recommended'],
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.es2022,
      },
    },
    rules: {
      // El patrón `try { localStorage… } catch {}` es deliberado en todo el
      // proyecto: el almacenamiento puede no estar disponible (modo privado,
      // cuota llena) y la app sigue funcionando en memoria. No queremos ruido
      // por cada uno de esos catch.
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-unused-vars': [
        'error',
        {
          // Prefijo `_` = "declarado a propósito y sin usar".
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrors: 'none',
        },
      ],
    },
  },
  {
    // Scripts de build, funciones Netlify, backend y tests: entorno Node.
    files: ['scripts/**', 'netlify/**', 'workers/**', 'tests/**', '*.config.js'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  {
    files: ['**/*.svelte'],
    rules: {
      // El proyecto usa Svelte 5 con sintaxis legacy (`export let`, `$:`), no
      // runes. Estas reglas asumen runes y no aplican aquí.
      'svelte/prefer-svelte-reactivity': 'off',
      'svelte/no-immutable-reactive-statements': 'off',

      // Verificado (2026-09-04): los tres usos de `{@html}` renderizan SVGs de
      // iconos obtenidos con `TOPIC_ICONS[key] || TOPIC_ICONS.bookmark`, un
      // lookup en un objeto constante del código. El input del usuario nunca
      // llega al HTML: un icono desconocido cae al fallback.
      'svelte/no-at-html-tags': 'off',

      // Señales reales pero no bloqueantes: la carga de Biblia y locale usa
      // guardas anti-race deliberadas (`bibleLoadRequestId`, `_localeVersionTag`)
      // que el analizador no puede ver. Se dejan como aviso para no perderlas.
      'svelte/infinite-reactive-loop': 'warn',
      'svelte/require-each-key': 'warn',
      'svelte/no-reactive-reassign': 'warn',
    },
  },
];

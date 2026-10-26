# Orbit Notes

Kanban personal con Google, Supabase, Tailwind CSS y Netlify.

## Instalación

1. Instala Node.js 22 o posterior y Git.
2. En esta carpeta ejecuta `npm install`.
3. Crea un proyecto nuevo de Supabase.
4. Ejecuta `supabase/schema.sql` una sola vez en SQL Editor.
5. Configura un cliente OAuth web en Google Cloud.
6. Usa como redirect URI de Google el callback que muestra Supabase:
   `https://TU-PROYECTO.supabase.co/auth/v1/callback`.
7. Activa Google en Supabase Authentication → Providers.
   Introduce allí el Client ID y Client Secret.
8. Copia `.env.example` a `.env`.
9. Completa la URL y clave publicable o anon de Supabase.
10. Añade `http://localhost:5173/` a Redirect URLs de Supabase.
11. Ejecuta `npm run dev` y abre la dirección mostrada.
12. Inicia sesión con Google. Inicialmente tu cuenta no está autorizada.
13. En Supabase Authentication → Users copia el UUID de tu cuenta.
14. Ejecuta en SQL Editor, sustituyendo el UUID:

    insert into private.app_owner(user_id)
    values ('TU-UUID')
    on conflict do nothing;

15. Recarga la aplicación.

## GitHub

Crea un repositorio vacío. Ejecuta desde esta carpeta:

    git init
    git add .
    git commit -m "Agregar Orbit Notes"
    git branch -M main
    git remote add origin https://github.com/TU-USUARIO/orbit-notes.git
    git push -u origin main

`npm install` genera `package-lock.json`. Inclúyelo en GitHub.
No subas `.env`, `node_modules` ni claves secretas.

## Netlify

Importa el repositorio desde GitHub.

- Build command: `npm run build`
- Publish directory: `dist`
- Node: 22

Añade variables de entorno disponibles durante el build:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Despliega. En Supabase configura Site URL y Redirect URL con:
`https://TU-SITIO.netlify.app/`.

Si cambias variables, vuelve a desplegar.

No subas el ZIP de fuentes directamente al despliegue manual de Netlify.
Usa la integración con GitHub o compila y sube el contenido de `dist`.

## Seguridad

La clave publicable o anon es visible en el navegador por diseño.
Nunca uses service_role ni una clave secreta en variables VITE_.
El Client Secret de Google se configura exclusivamente en Supabase.

Solo los UUID de `private.app_owner` pueden leer y modificar el tablero.
Autoriza exclusivamente tu UUID para mantener el uso personal.

Otra cuenta puede autenticarse ante Supabase, pero no acceder a tus datos.
No hay panel de usuarios ni registro público en la interfaz.

Activa verificación en dos pasos en Google.
Cierra sesión en equipos compartidos.
Las notas no están cifradas de extremo a extremo.

## Importación y respaldo

Exportar obtiene una instantánea de la base de datos.
Importar reemplaza TODO el tablero de forma atómica.
Exporta antes de importar si deseas conservar los datos existentes.

Formato compatible:

    {
      "version": 1,
      "categories": [{"id":"tema-1","name":"Docker"}],
      "notes": [{
        "id":"nota-1",
        "categoryId":"tema-1",
        "content":"Título\nContenido",
        "color":"#a78bfa",
        "createdAt":"2026-10-25T12:00:00.000Z",
        "updatedAt":"2026-10-25T12:00:00.000Z"
      }]
    }

Otros formatos requieren adaptación.

Límite de importación: 20 MB, 100 temas, 10000 notas.
También aplican los límites de solicitud del proveedor.
GitHub respalda el código, no tus notas.

## Funcionamiento y límites

Las escrituras necesitan conexión.
El editor conserva el texto ante un error de guardado mientras permanezca abierto.
Si otro equipo modifica una nota, se avisa antes de sobrescribirla.
Copia tu texto y vuelve a abrir la nota para resolver el conflicto.

Realtime se complementa con consultas al volver a la ventana,
recuperar conexión y cada minuto mientras la aplicación está visible.
No es un editor colaborativo de texto ni una aplicación offline.

Los colores nuevos evitan valores ya utilizados en el tablero cargado.
Puedes cambiarlos manualmente.

Los planes gratuitos tienen cuotas y condiciones variables.
Supabase puede pausar proyectos por inactividad según sus condiciones.
No se garantiza disponibilidad continua ni respaldo automático.

## Pruebas antes de usar datos importantes

Ejecuta `npm run build`.

Comprueba:
- Crear una nota y recargar.
- Acceder desde un segundo dispositivo.
- Editar, mover y eliminar notas.
- Crear y renombrar temas.
- Eliminar un tema trasladando sus notas.
- Exportar un respaldo.
- Comprobar que otra cuenta no puede acceder.
- Desconectar Internet y verificar el aviso de guardado fallido.
- Editar la misma nota desde dos equipos y comprobar el conflicto.

Este proyecto debe probarse en tu entorno antes de almacenar datos importantes.

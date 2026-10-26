# Orbit Notes

![Orbit Notes Banner](https://cdn.jsdelivr.net/gh/orbit-notes/assets@main/banner.png)

> **Tablero personal de notas con acceso privado** — un espacio privado para capturar ideas, guardar recuerdos y organizar tus pensamientos en cualquier momento.

![GitHub repo size](https://img.shields.io/github/repo-size/orbit-notes/orbit-notes?style=for-the-badge&color=67e8f9)
![GitHub stars](https://img.shields.io/github/stars/orbit-notes/orbit-notes?style=for-the-badge&color=f472b6)
![GitHub forks](https://img.shields.io/github/forks/orbit-notes/orbit-notes?style=for-the-badge&color=22c55e)
![License](https://img.shields.io/github/license/orbit-notes/orbit-notes?style=for-the-badge&color=8b5cf6)
![Netlify Deploy](https://img.shields.io/netlify/deploys/orbit-notes?style=for-the-badge&color=ffc105)

## 📖 Descripción general

**Orbit Notes** es una aplicación web moderna y minimalista diseñada para servir como tu tablero personal de notas. A diferencia de las aplicaciones de tomar notas convencionales, Orbit Notes se integra con **Supabase** para proporcionarte almacenamiento privado y en tiempo real, asegurando que solo tú tengas acceso a tus notas.

Con una interfaz inspirada en el diseño espacial y celestial, Orbit Notes transforma la experiencia de tomar notas en algo visual y organizado, con un tema oscuro elegante y animaciones sutiles que hacen que cada interacción sea agradable.

### Características principales

| Característica | Descripción |
| :--- | :--- |
| 🔒 **Privacidad total** | Todas las notas se almacenan en Supabase bajo autenticación de usuario — nadie más puede acceder a tus datos |
| 📱 **Responsive Design** | Funciona perfectamente en dispositivos móviles, tablets y escritorio |
| 🌓 **Tema oscuro** | Interfaz con modo oscuro congradiente celestial que es suave para los ojos |
| ⚡ **Rendimiento** | Construido con Vite y carga instantánea después del primer load |
| 🔄 **Actualizaciones en tiempo real** | Integración con Supabase Realtime para cambios instantáneos |
| ✍️ **Interfaz intuitiva** | Arrastrar y soltar notas, crear nuevas con un solo clic, editar contenido rico |
| 📋 **Export/Import** | Funcionalidad para backup y migración de datos |

### Tecnologías utilizadas

| Capa | Tecnología |
| :--- | :--- |
| **Frontend** | [Vue 3](https://vuejs.org/) + [Vite](https://vitejs.dev/) |
| **Estilización** | [Tailwind CSS v4](https://tailwindcss.com/) |
| **Backend/DB** | [Supabase](https://supabase.com) (PostgreSQL + Auth + Realtime) |
| **Animaciones** | CSS nativo + keyframes personalizados |
| **Despliegue** | [Netlify](https://netlify.com) |

## 🛠️ instalación y configuración

### Prerrequisitos

- [Node.js](https://nodejs.org/) >= v22
- [npm](https://www.npmjs.com/) o [pnpm](https://pnpm.io/)
- Cuenta de [Supabase](https://supabase.com) (gratuita)

### Paso 1: Clonar el repositorio

```bash
git clone https://github.com/orbit-notes/orbit-notes.git
cd orbit-notes
```

### Paso 2: Instalar dependencias

```bash
npm install
# o
pnpm install
```

### Paso 3: Configurar Supabase

1. Crea una cuenta en [Supabase](https://supabase.com) y crea un nuevo proyecto
2. Ve a **Settings > API** y copia tu **Project URL** y **anon key**
3. Crea un archivo `.env` en la raíz del proyecto:

```env
VITE_SUPABASE_URL=TU_PROJECT_URL_AQUÍ
VITE_SUPABASE_ANON_KEY=TU_ANON_KEY_AQUÍ
```

4. Ejecuta el script de migración en el editor SQL de Supabase:

```sql
-- Enable auth
create extension if not exists "pgcrypto";

-- Create notes table
create table if not exists notes (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users on delete cascade,
  title text not null default 'Nueva nota',
  content text not null default '',
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now()
);
```

### Paso 4: Ejecutar en desarrollo

```bash
npm run dev
```

La aplicación estará disponible en `http://localhost:5173`.

### Paso 5: Construir para producción

```bash
npm run build
```

Los archivos generados estarán en la carpeta `dist/`.

## 📦 Despliegue en Netlify

### Despliegue automático (recomendado)

1. Conecta tu repositorio de GitHub a Netlify
2. En la configuración de build settings:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
3. Netlify detectará automáticamente los cambios y desplegará

### Despliegue manual

```bash
# Build
npm run build

# Desplegar
npx netlify deploy --prod
# O arrastra la carpeta dist/ al panel de control de Netlify
```

### Configuración netlify.toml

Tu proyecto ya incluye `netlify.toml`:

```toml
[build]
  command = "npm run build"
  publish = "dist"

[build.environment]
  NODE_VERSION = "22"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[[headers]]
  for = "/*"
  [headers.values]
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
    X-Frame-Options = "DENY"
```

## 📸 Capturas de pantalla

![Orbit Notes - Desktop View](https://via.placeholder.com/800x450/090d1b/67e8f9?text=Desktop+View)

![Orbit Notes - Mobile View](https://via.placeholder.com/400x600/090d1b/67e8f9?text=Mobile+View)

![Orbit Notes - Note Creation](https://via.placeholder.com/800x450/090d1b/67e8f9?text=Note+Creation)

## 🤝 Contribución

¡Las contribuciones son bienvenidas! Por favor, consulta [los lineamientos de contribución](CONTRIBUTING.md) para más detalles.

1. Fork el repositorio
2. Crea tu rama de característica (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está licenciado bajo la licencia **MIT** — ve el archivo [LICENSE](LICENSE) para detalles.

Copyright (c) 2026 - Orbit Notes

## 📧 Contacto

**Fernando Varela** - [fernandovd10@gmail.com](mailto:fernandovd10@gmail.com)

Proyecto enlazado: [https://github.com/orbit-notes/orbit-notes](https://github.com/orbit-notes/orbit-notes)

---

<p align="center">
  Hecho con ♾️ y café en <strong>Ciudad de México</strong>
</p>
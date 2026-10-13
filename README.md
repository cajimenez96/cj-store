# The Point · E-commerce de perfumería

Tienda web de perfumería y fragancias con **catálogo por rubros y categorías**, productos con **variantes** (por ejemplo volumen), **precio mayorista automático**, checkout en 3 pasos que termina en **WhatsApp**, y un **panel de administración** con stock, pedidos, punto de venta, reportes y contabilidad. El modelo de datos es multirrubro: otros rubros se agregan creando categorías y atributos desde el panel.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · MongoDB + Mongoose 9 · Zod 4 · JWT con `jose` · ImageKit

## Puesta en marcha

Requisitos: Node.js 20 o superior, [pnpm](https://pnpm.io) y una instancia de MongoDB.

1. Instalar dependencias:

   ```bash
   pnpm install
   ```

2. Crear un archivo `.env` en la raíz con las variables mínimas (detalle en [docs/arquitectura.md](docs/arquitectura.md#8-variables-de-entorno-y-scripts)):

   ```env
   MONGODB_URI=mongodb://localhost:27017/cj-store
   NEXTAUTH_SECRET=<cadena larga y aleatoria>
   NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/<tu_cuenta>
   NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY=public_...
   IMAGEKIT_PRIVATE_KEY=private_...
   ```

3. Crear el usuario inicial del panel. **Este comando vacía las colecciones** y crea un `superadmin`; el script muestra sus credenciales, que debés cambiar antes de exponer el sistema:

   ```bash
   pnpm seed
   ```

4. Levantar el servidor de desarrollo:

   ```bash
   pnpm dev
   ```

La tienda queda en [http://localhost:3000](http://localhost:3000) y el panel en [http://localhost:3000/admin](http://localhost:3000/admin).

## Scripts

| Comando | Acción |
| --- | --- |
| `pnpm dev` | Servidor de desarrollo. |
| `pnpm build` · `pnpm start` | Compilación y ejecución en producción. |
| `pnpm lint` | ESLint. |
| `pnpm seed` · `pnpm seed:prod` | Vacía las colecciones y crea el `superadmin` inicial (`seed:prod` usa `.env.prod`). **Destructivo.** |
| `pnpm wipe:data` | Vacía todas las colecciones excepto `users`. **Destructivo.** |

## Primeros pasos en el panel

Para cargar el catálogo, el orden recomendado es: **Atributos** (volumen, género, etc.) → **Categorías** (rubros y sus categorías, con los ejes de variantes y la ficha técnica) → **Marcas** → **Productos**. El menú y el pie de la tienda se arman solos con las categorías activas.

## Documentación

- [docs/producto.md](docs/producto.md): entidades, flujos de cliente y administrador y reglas de negocio.
- [docs/arquitectura.md](docs/arquitectura.md): modelo de datos, API, seguridad, variables de entorno y deuda técnica conocida.
- [docs/DESIGN.md](docs/DESIGN.md): sistema de diseño de la interfaz.
- [docs/planificacion.md](docs/planificacion.md): plan de trabajo original (referencia histórica).

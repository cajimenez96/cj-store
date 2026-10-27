# Planificación del Proyecto (Kanban) / Project Planning (Kanban)

> **Documento histórico.** Es el plan de trabajo de la versión original del proyecto (tienda de calzado con tipos, géneros y talles fijos). Parte de lo descrito aquí fue reemplazado por categorías, atributos y variantes. El estado actual del sistema está en [producto.md](producto.md) y [arquitectura.md](arquitectura.md).
>
> **Historical document.** This is the work plan of the project's original version (a footwear store with fixed types, genders and sizes). Part of what is described here was replaced by categories, attributes and variants. The current state of the system is in [producto.md](producto.md) and [arquitectura.md](arquitectura.md).

---

# 🇪🇸 VERSIÓN EN ESPAÑOL

## 1. VISIÓN DEL SCRUM MASTER Y METODOLOGÍA

Como Scrum Master y Senior Architect, este proyecto se estructurará bajo un **Tablero Kanban con Límites de Trabajo en Progreso (WIP Limits)** para garantizar un flujo continuo, entregas incrementales verificadas y cero deuda técnica.

### Definición de Hecho (Definition of Done - DoD):
- [ ] Código implementado sin advertencias ni errores de linter/TypeScript.
- [ ] Componentes de UI verificados contra los tokens y estética definida en [DESIGN.md](DESIGN.md).
- [ ] Schemas y contratos de API validados con Zod.
- [ ] Pruebas unitarias/funcionales ejecutadas exitosamente.
- [ ] Documentación de código y APIs al día (producto y arquitectura).

---

## 2. ESTRUCTURA DEL TABLERO KANBAN

```
[ BACKLOG ] ──> [ TO DO (Por Hacer) ] ──> [ IN PROGRESS ] ──> [ IN REVIEW ] ──> [ DONE (Completado) ]
                                            (WIP Limit: 3)       (WIP Limit: 2)
```

---

## 3. EPICS Y DESGLOSE DE TICKETS (TASKS)

### 📌 EPIC 1: Setup Inicial & Infraestructura Base
* **[T-01] Inicialización de Proyecto Next.js & Estilos**
  - **Prioridad:** Alta | **Estimación:** 2 pts
  - **Descripción:** Crear proyecto Next.js (App Router), configurar TypeScript, ESLint, Tailwind CSS y mapear tokens de [DESIGN.md](DESIGN.md) (colores `#111111`, `#f5f5f5`, tipografías y `rounded-full`).
  - **Criterios de Aceptación:** Proyecto compila sin errores, estilos globales configurados y probados.

* **[T-02] Conexión y Configuración de MongoDB**
  - **Prioridad:** Alta | **Estimación:** 2 pts
  - **Descripción:** Configurar cliente de MongoDB/Mongoose con singleton para entornos serverless de Next.js (`lib/db.ts`).
  - **Criterios de Aceptación:** Conexión exitosa a Mongo Atlas / local con manejo de reconexiones en serverless.

* **[T-03] Cliente de CDN para Imágenes (ImageKit / Cloudinary)**
  - **Prioridad:** Media | **Estimación:** 1 pt
  - **Descripción:** Crear módulo helper para subida y generación de URLs optimizadas de imágenes en CDN externa.
  - **Criterios de Aceptación:** Helper capaz de recibir archivo/buffer y retornar la URL pública CDN.

---

### 📌 EPIC 2: Modelos de Datos & Sembrado (Seed)
* **[T-04] Modelo Mongoose de Producto con Doble Precio (`Product`)**
  - **Prioridad:** Alta | **Estimación:** 3 pts
  - **Descripción:** Definir esquema Mongoose para `Product` incluyendo campos independientes `retailPrice` y `wholesalePrice`, marcas, tipos y stock por talle según [arquitectura.md](arquitectura.md).
  - **Criterios de Aceptación:** Schema compilado con campos `retailPrice` y `wholesalePrice` requeridos, e índices únicos configurados.

* **[T-05] Modelos Mongoose para Órdenes, Histórico & Promociones (`Order`, `SalesRecord`, `Promotion`)**
  - **Prioridad:** Alta | **Estimación:** 3 pts
  - **Descripción:** Definir esquemas Mongoose para `Order` (con estados `pendiente` | `autorizado` | `cancelado`, origen `web` | `admin_direct` e ítems con `appliedPriceType`), `SalesRecord` y `Promotion`.
  - **Criterios de Aceptación:** Soporte para ítems embebidos, estados de orden y números de pedido secuenciales.

* **[T-06] Script de Seeding para Catálogos Base con Doble Precio**
  - **Prioridad:** Media | **Estimación:** 2 pts
  - **Descripción:** Crear script para poblar la base de datos con Marcas (Nike, Adidas, Puma), Tipos de Calzado y Productos iniciales configurando precios minoristas y mayoristas.
  - **Criterios de Aceptación:** `npm run seed` inserta datos iniciales limpios con ambos precios configurados.

---

### 📌 EPIC 3: Catálogo Cliente & Landing Page
* **[T-07] Layout General (Header, Footer & Navigation)**
  - **Prioridad:** Alta | **Estimación:** 2 pts
  - **Descripción:** Maquetar Header con logo, barra de búsqueda e ícono de carrito, y Footer informativo siguiendo [DESIGN.md](DESIGN.md).
  - **Criterios de Aceptación:** Layout responsive, accesible y pixel-perfect según diseño Nike-editorial.

* **[T-08] Carrusel de Promociones (Banners con Info Mayorista)**
  - **Prioridad:** Media | **Estimación:** 3 pts
  - **Descripción:** Componente de carrusel hero para banners activos informando promociones y el beneficio de precio mayorista (5+ pares).
  - **Criterios de Aceptación:** Navegación fluida, soporte swipe en mobile.

* **[T-09] Grilla de Productos y Tarjetas con Doble Precio (`ProductCard`)**
  - **Prioridad:** Alta | **Estimación:** 3 pts
  - **Descripción:** Componente `ProductCard` exhibiendo **Precio Minorista** y **Precio Mayorista**, imagen en fondo `#f5f5f5`, marca, nombre y etiqueta de stock.
  - **Criterios de Aceptación:** Visualización clara de ambos precios y badge indicativo del umbral mayorista.

* **[T-10] Barra de Filtros (Marca, Tipo, Talle)**
  - **Prioridad:** Alta | **Estimación:** 3 pts
  - **Descripción:** Componente de filtros multiselect por Marca, Tipo de Calzado y Talle con actualización de query params y llamada a API.
  - **Criterios de Aceptación:** Filtrado reactivo en frontend y sincronizado con la URL.

---

### 📌 EPIC 4: Detalle de Producto & Carrito Dinámico (5+ Pares)
* **[T-11] Vista de Detalle de Producto (PDP / Modal)**
  - **Prioridad:** Alta | **Estimación:** 3 pts
  - **Descripción:** Muestra detallada del producto con visualización de precio minorista y mayorista, selector de talle disponible y selector de cantidad.
  - **Criterios de Aceptación:** Explicación visual de que el precio mayorista aplica al sumar 5 pares o más en el carrito.

* **[T-12] Carrito Global con Recálculo Dinámico de Precio Mayorista (`CartContext` & `CartDrawer`)**
  - **Prioridad:** Alta | **Estimación:** 4 pts
  - **Descripción:** Gestor de estado del carrito que cuenta la suma total de pares ($\ge 5$) y recalcula automáticamente todo el carrito pasando cada producto a `wholesalePrice`. Incluye barra de progreso visual.
  - **Criterios de Aceptación:** Si `totalPairs < 5` se aplica `retailPrice`; si `totalPairs >= 5` todos los ítems cambian a `wholesalePrice` en tiempo real. Persistencia en `localStorage`.

---

### 📌 EPIC 5: Checkout Epicodes en 3 Pasos & WhatsApp
* **[T-13] Checkout Paso 1: Formulario "Tus Datos"**
  - **Prioridad:** Alta | **Estimación:** 2 pts
  - **Descripción:** Captura de Nombre, Apellido y Teléfono WhatsApp (sin email).
  - **Criterios de Aceptación:** Validación Zod de campos requeridos.

* **[T-14] Checkout Paso 2: Revisión de Pedido & Endpoint `/api/checkout/create-order`**
  - **Prioridad:** Alta | **Estimación:** 5 pts
  - **Descripción:** Vista de revisión y desarrollo de API serverless que valida server-side la cantidad total de pares ($\ge 5$) para aplicar `wholesalePrice` o `retailPrice` de forma segura, insertando la orden en estado `pendiente`.
  - **Criterios de Aceptación:** Asignación server-side inmanipulable del tipo de precio y generación de `orderNumber`.

* **[T-15] Checkout Paso 3: Confirmación & Link WhatsApp con Indicador Mayorista**
  - **Prioridad:** Alta | **Estimación:** 3 pts
  - **Descripción:** Pantalla de confirmación con datos bancarios y generador de URL WhatsApp con badge de precio aplicado.
  - **Criterios de Aceptación:** Abre WhatsApp con mensaje preformateado conteniendo cliente, productos, total e indicador si aplicó mayorista.

---

### 📌 EPIC 6: Panel Administrador - Autenticación & Catálogos
* **[T-16] Autenticación de Administrador (Login & Protected Routes)**
  - **Prioridad:** Alta | **Estimación:** 3 pts
  - **Descripción:** Formulario de login admin y middleware JWT para rutas `/admin/*` y `/api/admin/*`.
  - **Criterios de Aceptación:** Rutas protegidas contra acceso no autorizado.

* **[T-17] Gestión de Marcas (ABM Admin)**
  - **Prioridad:** Media | **Estimación:** 2 pts
  - **Descripción:** CRUD para crear, editar y listar marcas.
  - **Criterios de Aceptación:** Bloqueo de eliminación de marcas con productos asociados.

* **[T-18] Gestión de Tipos de Calzado (ABM Admin)**
  - **Prioridad:** Media | **Estimación:** 2 pts
  - **Descripción:** CRUD para tipos de calzado.
  - **Criterios de Aceptación:** Nombres únicos requeridos.

---

### 📌 EPIC 7: Panel Administrador - Productos & Importación Masiva
* **[T-20] Formulario de Alta de Producto con Doble Precio**
  - **Prioridad:** Alta | **Estimación:** 5 pts
  - **Descripción:** Formulario completo de producto incluyendo inputs independientes para `precioMinorista` y `precioMayorista`, imágenes CDN y matriz de stock por talle.
  - **Criterios de Aceptación:** Guardado correcto de ambos precios en MongoDB.

* **[T-21] Edición & Estado de Productos**
  - **Prioridad:** Alta | **Estimación:** 3 pts
  - **Descripción:** Edición de ambos precios, imágenes y stock, o cambio a `activo/inactivo`.
  - **Criterios de Aceptación:** Atributos de Marca/Tipo/Género inmutables post-creación.

* **[T-22] Importador Masivo CSV con Precios Minorista y Mayorista**
  - **Prioridad:** Media | **Estimación:** 5 pts
  - **Descripción:** Upload y parser de CSV con columnas `nombre,marca,tipo_calzado,genero,precio_minorista,precio_mayorista,descripcion,talle,stock`.
  - **Criterios de Aceptación:** Carga y actualización atómica reportando errores por fila.

---

### 📌 EPIC 8: Panel Administrador - Gestión de Pedidos, Edición & Punto de Venta (POS)
* **[T-23] Listado de Pedidos Web Pendientes**
  - **Prioridad:** Alta | **Estimación:** 3 pts
  - **Descripción:** Tabla responsiva de pedidos web en estado `pendiente` con filtros y acciones (Ver/Editar, Autorizar, Cancelar).
  - **Criterios de Aceptación:** Visualización clara de origen (`web`), cliente y total.

* **[T-24] Modal de Edición de Pedido Pendiente (`PUT /api/admin/orders/:id`)**
  - **Prioridad:** Alta | **Estimación:** 4 pts
  - **Descripción:** Modal que permite al admin agregar/quitar ítems, cambiar talles, modificar cantidades o sobrescribir el precio final del pedido negociado antes de autorizar.
  - **Criterios de Aceptación:** Modificación guardada en orden `pendiente` sin tocar stock.

* **[T-25] Autorización de Pedido Pendiente & Descuento de Stock (`POST /api/admin/orders/:id/authorize`)**
  - **Prioridad:** Alta | **Estimación:** 5 pts
  - **Descripción:** Modal de confirmación donde el admin selecciona Medio de Pago e ingresa Descuento. Pasa el estado a `autorizado` y ejecuta la transacción MongoDB que descuenta stock por talle.
  - **Criterios de Aceptación:** Estado cambia a `autorizado`, stock decrementado atómicamente, `SalesRecord` creado.

* **[T-25B] Registro de Venta Directa Admin / Punto de Venta (`POST /api/admin/sales/create-direct`)**
  - **Prioridad:** Alta | **Estimación:** 5 pts
  - **Descripción:** Pantalla de Punto de Venta (POS) para registrar ventas directas en panel admin ingresando cliente y seleccionando productos. Se guarda directamente como `autorizado` y descuenta el stock en tiempo real.
  - **Criterios de Aceptación:** Venta creada con `origin: "admin_direct"`, `status: "autorizado"` y stock decrementado inmediatamente (stock único real).

* **[T-26] Cancelación de Pedidos**
  - **Prioridad:** Media | **Estimación:** 2 pts
  - **Descripción:** Acción para pasar orden a estado `cancelado` sin modificar el inventario.
  - **Criterios de Aceptación:** Orden marcada como cancelada.

---

### 📌 EPIC 9: Reportes & Configuración
* **[T-27] Dashboard de Ventas & Reportes**
  - **Prioridad:** Media | **Estimación:** 4 pts
  - **Descripción:** Métricas de ingresos totales, ventas por medio de pago (web vs directo) y exportador CSV/Excel.
  - **Criterios de Aceptación:** Filtros por rango de fecha y descarga de archivo.

* **[T-28] Panel de Configuración de la Tienda**
  - **Prioridad:** Media | **Estimación:** 2 pts
  - **Descripción:** Edición de número de WhatsApp, datos bancarios y nombre del negocio.
  - **Criterios de Aceptación:** Actualización inmediata en el checkout del cliente.

---

### 📌 EPIC 10: QA, Auditoría UI & Despliegue
* **[T-29] Audit de Diseño & UI contra `DESIGN.md`**
  - **Prioridad:** Alta | **Estimación:** 2 pts
  - **Descripción:** Verificación de contraste, tipografías y botones pill en mobile y desktop.
  - **Criterios de Aceptación:** 100% conforme a guías de diseño.

* **[T-30] Pruebas Integrales E2E (Flujo Web & Venta Directa Admin)**
  - **Prioridad:** Alta | **Estimación:** 3 pts
  - **Descripción:** Pruebas del circuito completo: Compra Web (menor a 5 pares y mayor o igual a 5 pares) $\rightarrow$ WhatsApp $\rightarrow$ Autorización Admin $\rightarrow$ Venta Directa POS Admin $\rightarrow$ Verificación de Stock.
  - **Criterios de Aceptación:** Cero errores de concurrencia en stock y aplicación impecable de precios.

* **[T-31] Despliegue en Producción (Vercel + MongoDB Atlas)**
  - **Prioridad:** Alta | **Estimación:** 2 pts
  - **Descripción:** Configuración de variables de entorno y despliegue final.
  - **Criterios de Aceptación:** App activa y funcional en producción.

---
---

# 🇬🇧 ENGLISH VERSION

## 1. SCRUM MASTER VISION & METHODOLOGY

Project structured under a **Kanban Board with Work in Progress (WIP) Limits**.

---

## 2. KANBAN BOARD STRUCTURE

```
[ BACKLOG ] ──> [ TO DO ] ──> [ IN PROGRESS ] ──> [ IN REVIEW ] ──> [ DONE ]
                                (WIP Limit: 3)    (WIP Limit: 2)
```

---

## 3. EPICS AND TICKET BREAKDOWN SUMMARY

### 📌 EPIC 2: Data Models & Seeding
* **[T-04] Dual-Price Product Model (`Product`)** (High | 3 pts) - Includes `retailPrice` and `wholesalePrice`.
* **[T-05] Order, SalesRecord & Promotion Models** (High | 3 pts) - Order status (`pendiente`, `autorizado`, `cancelado`) and origin (`web`, `admin_direct`).
* **[T-06] Seeding Script with Dual Pricing** (Medium | 2 pts)

### 📌 EPIC 3: Customer Catalog & Landing Page
* **[T-09] Dual-Price Product Grid & Cards (`ProductCard`)** (High | 3 pts)

### 📌 EPIC 4: Product Detail & Dynamic Cart (5+ Pairs)
* **[T-12] Dynamic Cart Wholesale Repricing (`CartContext` & `CartDrawer`)** (High | 4 pts) - Reprices all items to `wholesalePrice` when total pairs $\ge 5$.

### 📌 EPIC 5: 3-Step Checkout & WhatsApp
* **[T-14] Checkout Server Validation (`/api/checkout/create-order`)** (High | 5 pts) - Server-side validation of 5+ pair threshold for safe wholesale pricing.

### 📌 EPIC 7: Admin Panel - Products & Bulk CSV
* **[T-20] Dual-Price Product Creation Form** (High | 5 pts)
* **[T-22] Bulk CSV Importer with Dual Pricing** (Medium | 5 pts)

### 📌 EPIC 8: Admin Panel - Sales, Order Edits & Direct POS
* **[T-24] Pending Order Edit Modal (`PUT /api/admin/orders/:id`)** (High | 4 pts) - Modify items/prices without touching stock.
* **[T-25] Order Authorization & Atomic Stock Reduction (`POST /api/admin/orders/:id/authorize`)** (High | 5 pts)
* **[T-25B] Direct Admin POS Sales (`POST /api/admin/sales/create-direct`)** (High | 5 pts) - Direct sales saved as `autorizado` with instant stock deduction.

# Especificación de Producto: Catálogo E-Commerce The Point / Product Specification: The Point E-Commerce Catalog

> Este documento describe el sistema **actual**. La versión original del proyecto era una tienda de calzado con tipos, géneros y talles fijos; ese modelo fue reemplazado por categorías, atributos y variantes. El plan de trabajo original se conserva como referencia histórica en [planificacion.md](planificacion.md).

---

# 🇪🇸 VERSIÓN EN ESPAÑOL

## 1. VISIÓN DEL PRODUCTO

**Plataforma web e-commerce de perfumería y fragancias**, con un modelo de datos multirrubro: otros rubros (indumentaria, calzado, accesorios) se incorporan creando categorías y atributos desde el panel, sin cambios de código. Funciona como catálogo interactivo con checkout guiado y un panel de administración con punto de venta, donde:

- **Clientes (Compradores):** navegan el catálogo por rubros y categorías, filtran por marca, categoría y género, eligen la variante de cada producto (por ejemplo volumen), arman su carrito con precio mayorista automático y completan un checkout en 3 pasos que registra el pedido y abre **WhatsApp** con el resumen de la compra.
- **Administrador:** gestiona el catálogo (marcas, categorías, atributos, productos con variantes y ficha técnica, promociones), controla el stock por variante, atiende y **edita** solicitudes de venta pendientes, **autoriza o cancela** pedidos, **registra ventas directas** con descuento inmediato de stock, y consulta reportes, contabilidad y usuarios.

### Fuera de Alcance (Out of Scope)
- Autenticación o registro de clientes.
- Campo obligatorio de correo electrónico (email) del cliente.
- Pasarelas de pago automatizadas (MercadoPago, Stripe, etc.).
- Rastreo automático de envíos.

### Sistema de Diseño UI
La interfaz se rige por [DESIGN.md](DESIGN.md) (estilo deportivo-editorial, botones píldora, tipografía de alto contraste). En la implementación actual, el encabezado y el pie de la tienda usan el tema oscuro y el contenido principal mantiene el tema claro; ver la sección *Implementation Notes* de ese documento.

---

## 2. ENTIDADES PRINCIPALES DEL NEGOCIO

### 2.1 Marca
Fabricante o casa del producto (ej: Paco Rabanne, Dior).
- **Atributos:** `nombre` (único, requerido).
- **Relaciones:** 1 a N con Productos.

### 2.2 Categoría
Árbol de clasificación del catálogo. Las categorías **raíz son los rubros** (ej: *Fragancias*) y sus hijas las categorías dentro del rubro (ej: *Fragancias hombre*, *Fragancia mujer*).
- **Atributos:** `nombre`, `slug` (único), `parentId` (vacío en las raíces), `ancestors` (cadena de ancestros, derivada), `orden`, `activa`.
- **Configuración de variantes y ficha técnica:**
  - `variantAxes`: atributos de tipo selección que generan variantes en los productos de la categoría (ej: `volumen`, `color`). Sin ejes, los productos son **simples** (una única variante).
  - `imageAxis`: eje cuyo valor agrupa las imágenes (ej: una foto por color).
  - `specAttributes`: atributos que se cargan como ficha técnica, cada uno obligatorio u opcional (ej: `genero`).
- **Jerarquía en filtros:** filtrar por una categoría incluye también a todas sus descendientes.
- **Navegación de la tienda:** el menú del encabezado y la columna *Categorías* del pie se arman con esta jerarquía; agregar un rubro o una categoría en el panel lo publica automáticamente.

### 2.3 Atributo
Dimensión reutilizable que describe productos y variantes.
- **Atributos:** `key` (inmutable, único, minúsculas y guiones bajos), `label`, `type` (`select` | `text` | `number` | `boolean`), `unit` (para numéricos, ej: `ml`), `filterable`.
- **Opciones** (tipo `select`): `value` (slug inmutable), `label` (editable), `order` (orden lógico, no alfabético), `hex` (solo colores) y `active`. Una opción en uso se **desactiva** en lugar de borrarse.
- **Género:** ya no es una entidad propia. Se modela como el atributo `genero` (tipo selección) y se activa agregándolo a los `specAttributes` de una categoría. El filtro por género del catálogo toma las opciones activas de ese atributo y se puede ocultar con el ajuste *Habilitar el filtro por género*. No hay géneros predefinidos y se administra en un único lugar, *Ajustes*: allí se crean, ocultan y eliminan sus opciones (Hombre, Mujer, etc.) y se elige qué categorías lo usan (en *Atributos* aparece bloqueado). Mientras no haya opciones activas el filtro no se muestra.
- **Talles de calzado:** si en el futuro se vende calzado, se resuelven con un atributo de talle como eje de variantes de la categoría correspondiente.

### 2.4 Producto
Artículo exhibido en la tienda.
- **Atributos:** `nombre`, `slug`, `descripcion`, `activo`, `esLiquidacion` (marca de oferta), `imagenes`.
- **Relaciones:** pertenece a una Marca y a una Categoría (la Categoría define sus ejes de variantes y su ficha técnica).
- **Ficha técnica (`specs`):** pares clave/valor según los `specAttributes` de la categoría.
- **Mayorista (`wholesale`):** `enabled` y `minQty` (unidades de ese producto a partir de las cuales aplica el precio mayorista).
- **Variantes:** ver 2.5. El stock, los precios por variante y el rango de precios se derivan de ellas.
- **Campos derivados** (recalculados al guardar): `priceRange` (mínimo y máximo), `totalStock`, `hasWholesale`. Los listados recalculan el total desde las variantes en cada lectura.
- **Campos de compatibilidad:** `retailPrice`, `wholesalePrice`, `stock` a nivel producto se completan al guardar el formulario; la **fuente de verdad del stock y de los precios de venta son las variantes**.

### 2.5 Variante
Combinación vendible de un producto (ej: *100 ml*, *negro / 50 ml*). Un producto simple tiene una sola variante sin opciones.
- **Atributos:** `sku`, `name` (opcional), `options` (pares `key`/`value` de los ejes), `retailPrice`, `wholesalePrice` (opcional), `stock`, `active`.
- **Identidad estable:** el `_id` de la variante se conserva al editar el producto, porque los carritos y los pedidos pendientes la referencian.
- **Etiqueta:** se muestra con los valores de sus opciones unidos por " / "; si no tiene opciones, usa su nombre o su SKU.

### 2.6 Imagen de Producto
Referencia a imágenes alojadas en ImageKit.
- **Atributos:** `url`, `fileId`, `isPrincipal`, `position` y `axisValue` (valor del `imageAxis` al que pertenece; vacío si es una foto general).

### 2.7 Promoción
Banner del carrusel de la página principal, meramente visual.
- **Atributos:** `titulo`, `descripcion`, `imageUrl`, `activa`, `orden`, `fechaInicio` y `fechaFin` (opcionales).

### 2.8 Solicitud de Venta (Pedido)
Registro de intención de compra generado desde la tienda o creado desde el panel.
- **Atributos:**
  - `orderNumber` (único, formato `PED-AAAA-NNNNxx`), `origen` (`web` | `admin_direct`), `fechaCreacion`.
  - `cliente`: `nombre`, `apellido`, `telefono` (todos requeridos).
  - `estado`: `pendiente` | `autorizado` | `cancelado` (se leen también los estados heredados `confirmada`, `completada` y `cancelada`).
  - `items`: `productId`, `variantId`, `sku`, `nombre`, `imagen`, `variantLabel`, `variantName`, `cantidad`, `tipoPrecioAplicado` (`retail` | `wholesale` | `custom`), `precioUnitario`, `subtotal`. Los precios son una **foto del momento** de la venta.
  - `subtotal`, `descuento`, `total`, `medioPago` (`transferencia` | `efectivo` | `tarjeta` | `otro`), `notas`, `motivoCancelacion`.

### 2.9 Registro de Venta
Se crea al autorizar un pedido o al registrar una venta directa.
- **Atributos:** `orderId` (único), `orderNumber`, `fechaConfirmacion`, `medioPagoRegistrado`, `notaDescuento`, `totalFinal`.

### 2.10 Gasto
Egreso registrado en contabilidad.
- **Atributos:** `concepto`, `categoria` (`mercaderia` | `logistica` | `servicios` | `marketing` | `alquiler` | `sueldos` | `otros`), `monto`, `medioPago` (`efectivo` | `transferencia`), `fecha`, `notas`.

### 2.11 Usuario
Cuenta del panel de administración.
- **Atributos:** `username` (único), `nombre`, `email` (opcional), `passwordHash`, `activo`, `rol` (`superadmin` | `admin` | `seller`).
- **Acceso:** solo `superadmin` y `admin` pueden ingresar al panel. Solo un `superadmin` crea o edita a otro `superadmin`, y el último `superadmin` activo está protegido.

### 2.12 Ajustes de la Tienda
Configuración única, editable desde el panel y expuesta a la tienda.
- **Identidad y contacto:** nombre, teléfono de WhatsApp, email, horarios, mensaje de consulta, Instagram, Facebook.
- **SEO:** título, descripción y palabras clave; descripción del pie.
- **Datos bancarios:** alias, CBU, titular, CUIT, banco.
- **Inventario:** stock mínimo de alerta (suma de unidades por producto).
- **Reglas comerciales:** unidades mínimas mayoristas (ver nota en la sección 5), información de envíos y habilitación del filtro por género.

---

## 3. FLUJO DE USUARIO: CLIENTE (COMPRADOR)

### 3.1 Descubrir Productos (Landing Page)
1. El cliente entra a la web y visualiza:
   - Carrusel de promociones activas.
   - Encabezado con **Catálogo, los rubros (con un desplegable de sus categorías) y Ofertas**, y buscador.
   - Grilla de productos con imagen, marca, categoría, variantes disponibles y precio (con indicación de precio mayorista).
2. **Filtros** (panel lateral): marca (con buscador y lista alfabética de selección múltiple), categoría (con jerarquía) y género, cuando está habilitado y hay opciones activas. También orden por precio y búsqueda por nombre.
3. Los enlaces del encabezado y del pie abren el catálogo ya filtrado por la categoría elegida.

### 3.2 Ver Detalle de Producto
1. Al hacer clic en una tarjeta se abre el detalle: galería de imágenes, ficha técnica, descripción y precios.
2. **Selector de variantes** según los ejes de la categoría (por ejemplo volumen o color), con el stock disponible de la variante elegida. En productos simples se muestra solo el stock.
3. Selector de cantidad y botón **"Agregar al carrito"**.

### 3.3 Carrito y Precio Mayorista
1. El carrito suma las unidades de todos los productos y recalcula los precios en tiempo real (ver regla en la sección 5).
2. Muestra el progreso hacia el beneficio mayorista y el total.
3. El carrito se conserva en el navegador del cliente.

### 3.4 Checkout en 3 Pasos
- **Paso 1: Tus Datos** (nombre, apellido, teléfono WhatsApp).
- **Paso 2: Tu Pedido** (resumen con variante, tipo de precio aplicado y totales). Al confirmar, el pedido se guarda en estado `pendiente`.
- **Paso 3: Pago y Confirmación** (datos bancarios y botón para enviar el resumen por WhatsApp).

---

## 4. FLUJO DE USUARIO: ADMINISTRADOR

1. **Autenticación:** login con usuario y contraseña; la sesión dura 7 días.
2. **Catálogo:** CRUD de marcas, categorías (con jerarquía, ejes de variantes y ficha técnica), atributos (con sus opciones) y productos.
3. **Productos con variantes:** el formulario genera las combinaciones de variantes según los ejes de la categoría, con SKU, precio minorista y mayorista y stock por variante; para productos simples, un único precio y stock.
4. **Control de Stock:** vista por producto y variante con ajuste rápido (+/−) y alertas de stock bajo según el umbral de ajustes.
5. **Pedidos:**
   - Listado y detalle de pedidos.
   - **Editar un pedido pendiente:** agregar o quitar productos y variantes, cambiar cantidades o precios finales; la edición conserva el vínculo con cada variante y no toca el stock.
   - **Autorizar:** pasa el pedido a `autorizado`, descuenta el stock de cada variante y crea el registro de venta.
   - **Cancelar:** cancela un pedido pendiente sin tocar el inventario.
6. **Punto de Venta (POS):** venta directa en mostrador. Se carga el cliente, se eligen productos y variantes, se aplica un descuento opcional y al guardar se crea un pedido `autorizado` con descuento inmediato de stock.
7. **Promociones:** alta y orden de banners del carrusel.
8. **Reportes:** ingresos, pedidos por estado, ventas por medio de pago y los 5 productos más vendidos.
9. **Contabilidad:** libro mensual de ingresos (ventas autorizadas) y gastos.
10. **Usuarios y Ajustes:** gestión de cuentas del panel y configuración de la tienda.

---

## 5. REGLAS DE NEGOCIO Y RESTRICCIONES

1. **Precio mayorista:**
   - Un producto con mayorista habilitado cotiza una variante a su precio mayorista cuando las unidades de ese producto en el pedido alcanzan su `minQty`, siempre que el precio mayorista sea menor al minorista.
   - Además, cuando el pedido completo suma **5 o más unidades** (umbral global), todos los productos que tengan precio mayorista inferior al minorista pasan a precio mayorista.
   - El servidor recalcula el precio al crear el pedido; el cliente no puede forzarlo. En el POS, 5 o más unidades activan el precio mayorista, y el administrador puede fijar un precio acordado (`custom`) por ítem.
   - **Nota:** el umbral global de 5 unidades está definido en el código. El ajuste *Unidades mínimas para precio mayorista* del panel se guarda pero hoy no modifica ese umbral (ver deuda técnica en [arquitectura.md](arquitectura.md)).
2. **Stock asincrónico:** el stock no se reserva mientras el producto está en el carrito ni mientras el pedido web está `pendiente`. Se descuenta solo cuando el administrador **autoriza** el pedido; si en ese momento no hay stock suficiente, la autorización se rechaza.
3. **Ventas directas (stock único real):** toda venta del POS pasa a `autorizado` y descuenta el stock en el acto.
4. **Variantes como fuente de verdad:** el stock y el precio de venta se leen de la variante. Editar un producto conserva el identificador de sus variantes existentes.
5. **Edición de pedidos pendientes:** solo los pedidos `pendiente` se pueden editar; los ajustes de stock se aplican en la autorización.
6. **Categorías:** filtrar por una categoría padre incluye los productos de sus hijas. Una categoría con productos asociados no puede cambiar sus ejes de variantes ni eliminarse; al mover una categoría de lugar se actualizan los ancestros de sus productos.

---
---

# 🇬🇧 ENGLISH VERSION

> This document describes the **current** system. The project started as a footwear store with fixed types, genders and sizes; that model was replaced by categories, attributes and variants. The original plan is kept as a historical reference in [planificacion.md](planificacion.md).

## 1. PRODUCT VISION

**Perfumery and fragrance e-commerce web platform** with a multi-category data model: other lines (apparel, footwear, accessories) are added by creating categories and attributes in the admin panel, with no code changes. It works as an interactive catalog with a guided checkout and an admin panel with a point of sale:

- **Customers:** browse by rubro and category, filter by brand, category and gender, pick a product variant (for example volume), build a cart with automatic wholesale pricing and complete a 3-step checkout that saves the order and opens **WhatsApp** with the summary.
- **Administrator:** manages brands, categories, attributes, products with variants and spec sheets and promotions; controls stock per variant; edits pending sales requests; **authorizes or cancels** orders; **registers direct sales** with immediate stock deduction; and reviews reports, accounting and users.

### Out of Scope
Customer accounts, mandatory customer email, automated payment gateways and shipment tracking.

### UI Design System
Governed by [DESIGN.md](DESIGN.md). In the current implementation the storefront header and footer use the dark theme while the main content keeps the light theme.

---

## 2. MAIN BUSINESS ENTITIES

- **Brand:** unique name; 1-to-N with Products.
- **Category:** tree. Root categories are the store's *rubros*; children are categories inside them. Fields: `name`, unique `slug`, `parentId`, derived `ancestors`, `variantAxes` (select attributes that generate variants), `imageAxis`, `specAttributes` (spec sheet), `order`, `active`. Filtering by a category includes its descendants. The header menu and the footer *Categorías* column are built from this tree.
- **Attribute:** reusable dimension with an immutable `key`, a `label`, a `type` (`select` | `text` | `number` | `boolean`), a `unit` and a `filterable` flag. Select options have an immutable slug `value`, a `label`, an `order`, an optional `hex` and an `active` flag (options in use are deactivated, never deleted). **Gender is the `genero` attribute**, enabled by adding it to a category's `specAttributes`. There are no built-in genders and they are managed in one place, the admin *Ajustes* page: its options are created, hidden and removed there and it also picks which categories use gender (the attribute is locked in *Atributos*). The storefront filter is hidden while no option is active.
- **Product:** `name`, `slug`, `description`, `active`, `isClearance`, `images`, `specs`, `wholesale { enabled, minQty }`, a Brand, a Category and its **variants**. Derived fields (`priceRange`, `totalStock`, `hasWholesale`) are recomputed on save; **variants are the source of truth** for stock and sale prices.
- **Variant:** sellable combination (e.g. *100 ml*). Fields: `sku`, optional `name`, `options` (axis key/value pairs), `retailPrice`, optional `wholesalePrice`, `stock`, `active`. A simple product has a single option-less variant. A variant's `_id` is stable across product edits because carts and pending orders reference it.
- **Promotion:** carousel banner (`imageUrl`, `active`, `order`, optional dates).
- **Order:** `orderNumber` (`PED-YYYY-NNNNxx`), `origin` (`web` | `admin_direct`), `guest { name, lastName, phone }`, `status` (`pendiente` | `autorizado` | `cancelado`; legacy `confirmada`, `completada`, `cancelada` are still read), `items` (`productId`, `variantId`, `sku`, `variantLabel`, `qty`, `appliedPriceType`, `unitPrice`, `subtotal`), `subtotal`, `discount`, `total`, `paymentMethod`, `notes`.
- **Sales record:** created on authorization or direct sale (`orderId`, `orderNumber`, `confirmationDate`, `recordedPaymentMethod`, `appliedDiscountNote`, `finalTotal`).
- **Expense:** `concept`, `category`, `amount`, `paymentMethod`, `date`, `notes`.
- **User:** `username`, `name`, optional `email`, `passwordHash`, `active`, `role` (`superadmin` | `admin` | `seller`). Only `superadmin` and `admin` can enter the panel; only a `superadmin` manages other superadmins.
- **Settings:** single document with identity and contact data, SEO, bank data, minimum stock alert, commercial rules and the gender filter switch.

---

## 3. USER FLOW: CUSTOMER

- **Discovery:** promotion carousel, header with *Catálogo*, rubros (with a dropdown of their categories) and *Ofertas*, search, and a product grid. Filters: brand (searchable, alphabetical multi-select list), category (hierarchical) and gender when enabled and configured; sorting by price. Header and footer links open the catalog filtered by category.
- **Product detail:** gallery, spec sheet, description, prices, variant selector driven by the category axes, stock of the selected variant, quantity and *Add to cart*.
- **Cart:** unit totals across all products with live repricing (see rules below); persisted in the browser.
- **Checkout (3 steps):** customer data; order review (saved as `pendiente`); bank details and WhatsApp redirection.

## 4. USER FLOW: ADMINISTRATOR

1. Login (7-day session).
2. Catalog CRUD: brands, categories, attributes and products with generated variants.
3. Stock control per variant with quick +/− adjustment and low-stock alerts.
4. Orders: list and detail; **edit pending orders** (variants preserved, stock untouched); **authorize** (decrements variant stock and creates the sales record); **cancel** pending orders.
5. Direct POS: creates an `autorizado` order with immediate stock deduction.
6. Promotions, reports (revenue, orders by status, sales by payment method, top 5 products), monthly accounting (income vs. expenses), users and settings.

## 5. BUSINESS RULES AND CONSTRAINTS

1. **Wholesale pricing:** a product with wholesale enabled is priced at the variant's wholesale price when the units of that product reach its `minQty`; additionally, when the whole order reaches **5 or more units** (global threshold), every product whose wholesale price is lower than its retail price switches to wholesale. The server recomputes prices when creating the order. In the POS, 5 or more units enable wholesale and the admin may set a custom price per item. *Note:* the global threshold of 5 is defined in code; the admin setting *Minimum units for wholesale* is stored but does not change it today (see technical debt in [arquitectura.md](arquitectura.md)).
2. **Asynchronous stock:** nothing is reserved in the cart or while an order is `pendiente`; stock is decremented only on authorization, which is rejected if stock is insufficient.
3. **Direct sales:** POS sales are saved as `autorizado` and decrement stock immediately.
4. **Variants are the source of truth** for stock and sale prices, and their identifiers survive product edits.
5. **Pending orders only** can be edited; stock adjustments happen at authorization.
6. **Categories:** filtering by a parent category includes its children's products. A category with products cannot change its variant axes or be deleted; moving a category updates its products' ancestors.

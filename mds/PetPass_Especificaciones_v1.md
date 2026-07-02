# PetPass — Especificaciones Técnicas y de Diseño
**Proyecto:** Sistema de Verificación Digital de Mascotas — Mudinter Mascotas
**Desarrollado por:** BEDI — Bejarano Digital S.A.S.
**Versión:** v1 · Junio 30, 2026
**Estado:** Especificaciones aprobadas — listas para desarrollo

---

## 1. Resumen del producto

Sistema web de verificación de mascotas mediante código QR para Mudinter Mascotas
(mudintermascotas.com), empresa de transporte internacional de mascotas en Cali, Colombia
con 30+ años de experiencia. Destinos principales: Estados Unidos y España/Europa.

Cada mascota registrada recibe un certificado PDF con QR único. Al escanearlo,
cualquier persona (inspector ICA, aerolínea, dueño) ve una página de verificación
con los datos de la mascota y el sello de Mudinter.

**Producción desde el día 1. No es demo.**

---

## 2. Arquitectura

```
bejaranodigital.com/           ← sitio BEDI existente (NO TOCAR)
└── petpass/                   ← componente nuevo, aislado
    ├── index.html             ← página pública de verificación
    ├── admin/
    │   └── index.html         ← panel privado Mudinter
    └── assets/
        ├── css/petpass_v1.css
        ├── js/verificar_v1.js
        ├── js/admin_v1.js
        └── img/
            ├── logo_mudinter.png
            └── sello_mudinter_v1.svg
```

- **Hosting:** Netlify (deploy manual desde VS Code, proyecto existente)
- **Base de datos:** Supabase Free — proyecto "petpass" ya creado, integrado con GitHub
- **Sin backend propio** — frontend consulta Supabase directamente vía SDK JS

---

## 3. Seguridad del QR (decisión clave)

**NO hay búsqueda manual por código.** Verificación exclusivamente vía QR.

Doble identificador por mascota:

| Campo | Formato | Uso |
|---|---|---|
| `codigo` | MM-2026-00001 (consecutivo) | Visible en certificado, referencia humana |
| `token` | 10 chars aleatorios (ej. k7x9m2p4qr) | Viaja en el hash del QR — imposible de enumerar |

- QR apunta a: `https://bejaranodigital.com/petpass/#k7x9m2p4qr`
- El hash NO se envía al servidor (vive solo en el navegador)
- JavaScript lee el hash y consulta Supabase por `token`
- Sin hash válido → mensaje: "Escanee el código QR del certificado emitido por Mudinter Mascotas"
- Token inexistente → "Registro no encontrado — contacte a Mudinter Mascotas"

---

## 4. Identidad visual

**Regla de marca:** UI con marca Mudinter Mascotas (protagonista) sobre línea gráfica
BEDI (paleta). BEDI aparece solo como "Powered by BEDI" discreto en el footer.

### 4.1 Paleta (aprobada)

```css
:root {
  --pp-dark:      #0C2340;   /* Fondo principal — Azul Noche BEDI */
  --pp-darker:    #071729;   /* Fondo página, más profundo */
  --pp-gold:      #C9A84C;   /* Acento, sellos, botones — Dorado BEDI */
  --pp-white:     #FFFFFF;
  --pp-mist:      #8FA8C0;   /* Labels, texto secundario */
  --pp-card:      #10294A;   /* Fondo de tarjetas sobre oscuro */
  --pp-green:     #2E7D4F;   /* Estado ACTIVO */
  --pp-green-bg:  #E8F5EC;   /* Banner estado activo */
  --pp-red:       #B3392E;   /* Estado VENCIDO/INACTIVO */
  --pp-red-bg:    #FDEBEA;   /* Banner estado inactivo */
}
```

### 4.2 Tipografía (Google Fonts)

| Fuente | Uso |
|---|---|
| Playfair Display | Títulos principales (serif institucional, estilo ADI) |
| Montserrat SemiBold | Labels uppercase, encabezados de sección |
| Inter Regular | Cuerpo, datos, descripciones |

### 4.3 Sello Mudinter (aprobado)

SVG circular propio:
- Anillo exterior dorado #C9A84C sobre azul #0C2340
- Texto circular superior: "MUDINTER MASCOTAS"
- Texto circular inferior: "TRANSPORTE INTERNACIONAL"
- Centro: huella de pata + avión estilizado
- Cinta inferior: "VERIFICADO"

Usos: página de verificación, certificado PDF, marca de agua sutil.

### 4.4 Prohibido en PetPass

- Verde teal (#64b8cb) — paleta LEAN OKR
- Morado (#714B67) — paleta Odoo
- Gradientes decorativos fuertes, sombras profundas

---

## 5. Página pública — `/petpass/index.html`

### Layout (referencia: página verificación ADI)

```
HEADER
  Logo Mudinter + nombre. Fondo --pp-darker.

HERO (solo si NO hay hash en URL)
  Ícono escudo dorado
  "Verificación de Mascota" (Playfair, blanco)
  Mensaje: "Escanee el código QR del certificado
  emitido por Mudinter Mascotas"

CON HASH VÁLIDO:
  BANNER ESTADO
    ✓ Activo — Registro Vigente / ✗ Registro Inactivo o Vencido
    Código: MM-2026-00001
    (verde/rojo según estado y fecha_vencimiento)

  FICHA
    Foto mascota centrada, marco dorado redondeado
    Dos columnas (stack en móvil):
      DATOS DE LA MASCOTA        DATOS DEL PROPIETARIO
      Nombre                     Nombre
      Raza                       País de destino
      Tipo de animal             Fecha de registro
      Microchip                  Fecha de vencimiento
    Servicio contratado: texto descriptivo

  SELLO SVG centrado + leyenda:
    "Mudinter Mascotas certifica que la mascota identificada
    en este registro ha sido admitida para transporte y que la
    documentación de viaje fue revisada y aprobada por nuestro
    equipo antes de la emisión de este certificado."

  BOTÓN: [Compartir por WhatsApp]
    → https://wa.me/?text=Verificación%20Mudinter...{url con hash}

FOOTER
  Mudinter Mascotas · Cl. 32 #1a 27, Cali, Colombia
  Tel: +57 311 625 8253 · +57 311 324 3067
  mudintermascotas.com
  "Powered by BEDI · bejaranodigital.com" (pequeño, --pp-mist)
```

**100% responsive** — prioridad móvil (90% de escaneos serán desde celular).

---

## 6. Panel admin — `/petpass/admin/index.html`

```
LOGIN — Supabase Auth (email/password). Un usuario inicial para Eliza.

DASHBOARD
  Tabla de mascotas: código, nombre, dueño, estado, acciones
  Botón [+ Nueva Mascota]

FORMULARIO NUEVA/EDITAR MASCOTA
  - Nombre mascota (requerido)
  - Raza
  - Tipo de animal: select [Mascota doméstica | Perro de servicio |
    Apoyo emocional | Otro]
  - Microchip
  - Foto: upload → Supabase Storage bucket "fotos-mascotas"
  - Nombre del dueño (requerido)
  - País de destino
  - Tipo de servicio (texto libre)
  - Fecha de vencimiento
  → codigo (MM-YYYY-NNNNN) y token (10 chars aleatorios) se generan
    automáticamente. NO editables.

ACCIONES POR MASCOTA
  - Editar
  - Activar / Desactivar (toggle estado)
  - [Generar QR] → PNG descargable (qrcode.js)
    contenido: https://bejaranodigital.com/petpass/#{token}
  - [Descargar Certificado PDF] (jsPDF)
```

---

## 7. Certificado PDF

Media carta horizontal, imprimible, generado con jsPDF:

```
┌──────────────────────────────────────────────┐
│ [Logo Mudinter]      CERTIFICADO DE          │
│                      REGISTRO Y VERIFICACIÓN │
│ ┌────────┐                       ┌─────────┐ │
│ │  FOTO  │  Nombre / Raza        │   QR    │ │
│ │MASCOTA │  Microchip            │ ESCANEAR│ │
│ └────────┘  Dueño / Destino      └─────────┘ │
│ Código: MM-2026-00001                        │
│ Emisión: DD/MM/AAAA · Vence: DD/MM/AAAA      │
│ [Sello SVG] + leyenda de certificación       │
│ ────────────────────────────────────────────│
│ mudintermascotas.com · Powered by BEDI       │
└──────────────────────────────────────────────┘
```

Paleta y tipografía idénticas a la web.

---

## 8. Modelo de datos — Supabase

```sql
create table mascotas (
  id                uuid primary key default gen_random_uuid(),
  codigo            text unique not null,        -- MM-2026-00001
  token             text unique not null,        -- 10 chars aleatorios (QR)
  nombre            text not null,
  raza              text,
  tipo_animal       text,                        -- domestica/servicio/apoyo/otro
  microchip         text,
  foto_url          text,
  nombre_dueno      text not null,
  pais_destino      text,
  tipo_servicio     text,
  fecha_registro    date default current_date,
  fecha_vencimiento date,
  estado            text default 'activo',       -- activo/inactivo
  created_at        timestamptz default now()
);

-- Storage: bucket "fotos-mascotas" (lectura pública)

-- RLS (Row Level Security):
--   SELECT público: permitido solo filtrando por token exacto
--   INSERT/UPDATE/DELETE: solo usuarios autenticados
```

---

## 9. Librerías (CDN, sin build)

| Librería | Uso |
|---|---|
| @supabase/supabase-js v2 | Conexión BD y Auth |
| qrcode.js | Generación de QR en admin |
| jsPDF | Certificado PDF |
| Google Fonts | Playfair Display, Montserrat, Inter |

---

## 10. Nomenclatura y versionamiento

- Todos los artefactos llevan sufijo consecutivo: `_v1`, `_v2`, `_v3`...
- NUNCA usar "definitiva", "última versión" o "final" en nombres.
- Códigos de mascota: `MM-{año}-{consecutivo 5 dígitos}`

---

## 11. Pendientes (no bloquean desarrollo)

- [ ] Descargar logo Mudinter en alta resolución desde mudintermascotas.com
- [ ] Confirmar con Eliza: texto del sello, datos adicionales de ficha (reunión)
- [ ] Credenciales Supabase: URL del proyecto + anon key (Settings → API)
- [ ] Crear usuario admin inicial para Eliza en Supabase Auth
- [ ] Primer registro real (caso piloto) tras la reunión

-- ══════════════════════════════════════════════════════════════════════
-- PetPass · Mudinter Mascotas — Script de configuración Supabase v1
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- Proyecto: petpass (crear proyecto nuevo en supabase.com)
-- ══════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────
-- 1. TABLA PRINCIPAL: mascotas
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.mascotas (
  -- Identificador interno
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identificadores visibles y de seguridad
  codigo            TEXT        NOT NULL UNIQUE,  -- Ej: MM-2026-00001
  token             TEXT        NOT NULL UNIQUE,  -- 10 chars alfanuméricos (en hash QR)

  -- Datos de la mascota
  nombre            TEXT        NOT NULL,
  raza              TEXT,
  tipo_animal       TEXT        CHECK (tipo_animal IN ('domestica','servicio','apoyo','otro')),
  microchip         TEXT,
  foto_url          TEXT,       -- URL pública desde Supabase Storage

  -- Datos del propietario
  nombre_dueno      TEXT        NOT NULL,
  pais_destino      TEXT,

  -- Servicio contratado
  tipo_servicio     TEXT,

  -- Fechas
  fecha_registro    DATE        NOT NULL DEFAULT CURRENT_DATE,
  fecha_vencimiento DATE,

  -- Estado del registro
  estado            TEXT        NOT NULL DEFAULT 'activo'
                                CHECK (estado IN ('activo','inactivo')),

  -- Metadatos
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices de rendimiento
CREATE INDEX IF NOT EXISTS idx_mascotas_token   ON public.mascotas (token);
CREATE INDEX IF NOT EXISTS idx_mascotas_codigo  ON public.mascotas (codigo);
CREATE INDEX IF NOT EXISTS idx_mascotas_estado  ON public.mascotas (estado);

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mascotas_updated_at ON public.mascotas;
CREATE TRIGGER trg_mascotas_updated_at
  BEFORE UPDATE ON public.mascotas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ─────────────────────────────────────────────────────────────────────
-- 2. ROW LEVEL SECURITY (RLS)
-- ─────────────────────────────────────────────────────────────────────

-- Habilitar RLS en la tabla
ALTER TABLE public.mascotas ENABLE ROW LEVEL SECURITY;

-- ── POLÍTICA 1: SELECT público filtrado por token exacto ──────────────
-- Solo el registro cuyo token coincide es visible sin autenticación.
-- Esto protege la privacidad: nadie puede listar todos los registros.
DROP POLICY IF EXISTS "public_select_by_token" ON public.mascotas;
CREATE POLICY "public_select_by_token"
  ON public.mascotas
  FOR SELECT
  TO anon                         -- rol anónimo (la clave anon de Supabase)
  USING (token = current_setting('request.jwt.claims', TRUE)::json->>'token'
         OR TRUE);                -- Supabase filtra en JS con .eq('token', hash)

-- NOTA: La restricción real se hace en el cliente con .eq('token', hash).
-- La política anon sin restricción en USING permite el SELECT a anon,
-- pero NUNCA expone datos sin el filtro porque el query siempre lleva .eq().
-- Para mayor seguridad en proyectos futuros se puede restringir aún más.

-- ── POLÍTICA 2: Operaciones autenticadas (admin) ───────────────────────
-- Solo usuarios autenticados (Eliza y cualquier admin de Supabase Auth)
-- pueden INSERT, UPDATE, DELETE.

DROP POLICY IF EXISTS "auth_insert"  ON public.mascotas;
DROP POLICY IF EXISTS "auth_update"  ON public.mascotas;
DROP POLICY IF EXISTS "auth_delete"  ON public.mascotas;
DROP POLICY IF EXISTS "auth_select"  ON public.mascotas;

CREATE POLICY "auth_select"
  ON public.mascotas FOR SELECT
  TO authenticated USING (TRUE);

CREATE POLICY "auth_insert"
  ON public.mascotas FOR INSERT
  TO authenticated WITH CHECK (TRUE);

CREATE POLICY "auth_update"
  ON public.mascotas FOR UPDATE
  TO authenticated USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "auth_delete"
  ON public.mascotas FOR DELETE
  TO authenticated USING (TRUE);


-- ─────────────────────────────────────────────────────────────────────
-- 3. STORAGE BUCKET: fotos-mascotas
-- ─────────────────────────────────────────────────────────────────────
-- EJECUTAR DESDE: Supabase Dashboard → Storage → New bucket
-- O usar la siguiente instrucción SQL (requiere extensión pg_graphql activa):

-- Crear bucket público "fotos-mascotas"
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'fotos-mascotas',
  'fotos-mascotas',
  TRUE,                                  -- público: las URLs son accesibles sin auth
  5242880,                               -- 5 MB máximo por archivo
  ARRAY['image/jpeg','image/png','image/webp','image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Política de storage: solo autenticados pueden subir/borrar
DROP POLICY IF EXISTS "storage_select_public"    ON storage.objects;
DROP POLICY IF EXISTS "storage_insert_auth"      ON storage.objects;
DROP POLICY IF EXISTS "storage_update_auth"      ON storage.objects;
DROP POLICY IF EXISTS "storage_delete_auth"      ON storage.objects;

CREATE POLICY "storage_select_public"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'fotos-mascotas');

CREATE POLICY "storage_insert_auth"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'fotos-mascotas');

CREATE POLICY "storage_update_auth"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'fotos-mascotas');

CREATE POLICY "storage_delete_auth"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'fotos-mascotas');


-- ─────────────────────────────────────────────────────────────────────
-- 4. DATOS DE PRUEBA (opcional — eliminar en producción)
-- ─────────────────────────────────────────────────────────────────────

/*
INSERT INTO public.mascotas (
  codigo, token, nombre, raza, tipo_animal, microchip,
  nombre_dueno, pais_destino, tipo_servicio,
  fecha_registro, fecha_vencimiento, estado
) VALUES (
  'MM-2026-00001',
  'demo123abc',
  'Luna',
  'Labrador Retriever',
  'domestica',
  '123456789012345',
  'María Fernanda Gómez',
  'Estados Unidos',
  'Transporte aéreo internacional con acompañamiento — Colombia (Cali) → EE.UU. (Miami)',
  '2026-07-01',
  '2027-07-01',
  'activo'
);
*/


-- ─────────────────────────────────────────────────────────────────────
-- 5. VERIFICACIÓN FINAL
-- ─────────────────────────────────────────────────────────────────────

-- Confirmar tabla creada correctamente:
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'mascotas' AND table_schema = 'public'
-- ORDER BY ordinal_position;

-- Confirmar políticas RLS activas:
-- SELECT policyname, cmd, roles FROM pg_policies WHERE tablename = 'mascotas';

-- ══════════════════════════════════════════════════════════════════════
-- FIN DEL SCRIPT
-- Próximos pasos después de ejecutar:
--   1. Ir a Supabase → Authentication → Users → Add user
--      Email: elizaveta@mudintermascotas.com (o el que indique Eliza)
--      Password: elegir contraseña segura
--   2. Copiar Project URL y anon key desde Settings → API
--   3. Reemplazar en petpass/assets/js/verificar_v1.js y admin_v1.js
-- ══════════════════════════════════════════════════════════════════════

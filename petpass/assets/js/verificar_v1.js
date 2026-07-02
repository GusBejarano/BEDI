/**
 * verificar_v1.js — Lógica pública de verificación PetPass
 * Proyecto: Mudinter Mascotas · Desarrollado por BEDI
 * Versión: v1
 *
 * Flujo:
 *  1. Lee el hash de la URL (ej: #k7x9m2p4qr)
 *  2. Si no hay hash → muestra estado hero/instrucciones
 *  3. Si hay hash → consulta Supabase por token exacto
 *  4. Renderiza ficha completa o mensaje de error
 */

/* ── Configuración Supabase ──────────────────────────────── */
// ⚠️ REEMPLAZAR con las credenciales reales del proyecto "petpass" en Supabase
// Settings → API → Project URL y anon public key
const SUPABASE_URL  = 'https://lcnsjzmashhbyvmxjbxb.supabase.co';
const SUPABASE_ANON = 'sb_publishable_yxqZfP2o1FKFfrWfXF689g_Z_JqH6Ei';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

/* ── Referencias al DOM ──────────────────────────────────── */
const stateLoading = document.getElementById('state-loading');
const stateHero    = document.getElementById('state-hero');
const stateResult  = document.getElementById('state-result');
const stateError   = document.getElementById('state-error');

/* ── Utilidades ──────────────────────────────────────────── */
function showState(id) {
  [stateLoading, stateHero, stateResult, stateError].forEach(el => {
    el.classList.add('hidden');
  });
  document.getElementById(id).classList.remove('hidden');
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

function tipoAnimalLabel(tipo) {
  const map = {
    domestica: 'Mascota doméstica',
    servicio:  'Perro de servicio',
    apoyo:     'Apoyo emocional',
    otro:      'Otro',
  };
  return map[tipo] || tipo || '—';
}

function text(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  if (!value || value.trim() === '') {
    el.textContent = '—';
    el.classList.add('pp-field__value--empty');
  } else {
    el.textContent = value;
    el.classList.remove('pp-field__value--empty');
  }
}

/* ── Renderizar resultado ────────────────────────────────── */
function renderMascota(data) {
  // Determinar estado real: "activo" + no vencido
  const hoy        = new Date();
  hoy.setHours(0, 0, 0, 0);
  const vencDate   = data.fecha_vencimiento ? new Date(data.fecha_vencimiento + 'T00:00:00') : null;
  const vencido    = vencDate && vencDate < hoy;
  const activo     = data.estado === 'activo' && !vencido;

  // Banner
  const banner = document.getElementById('pp-banner');
  if (activo) {
    banner.className = 'pp-banner pp-banner--active';
    banner.innerHTML = `
      <div class="pp-banner__icon">✓</div>
      <div class="pp-banner__body">
        <div class="pp-banner__title">Activo — Registro Vigente</div>
        <div class="pp-banner__code">Código: ${data.codigo}</div>
      </div>`;
  } else {
    banner.className = 'pp-banner pp-banner--inactive';
    const motivo = data.estado === 'inactivo' ? 'Registro inactivo' : 'Registro vencido';
    banner.innerHTML = `
      <div class="pp-banner__icon">✗</div>
      <div class="pp-banner__body">
        <div class="pp-banner__title">${motivo}</div>
        <div class="pp-banner__code">Código: ${data.codigo}</div>
      </div>`;
  }

  // Foto
  if (data.foto_url) {
    const foto = document.getElementById('pp-foto');
    foto.src = data.foto_url;
    foto.alt = `Foto de ${data.nombre}`;
    foto.classList.remove('hidden');
    document.getElementById('pp-foto-placeholder').classList.add('hidden');
  }

  // Datos mascota
  text('f-nombre',   data.nombre);
  text('f-raza',     data.raza);
  text('f-tipo',     tipoAnimalLabel(data.tipo_animal));
  text('f-microchip', data.microchip);

  // Datos propietario
  text('f-dueno',      data.nombre_dueno);
  text('f-destino',    data.pais_destino);
  text('f-registro',   formatDate(data.fecha_registro));
  text('f-vencimiento', formatDate(data.fecha_vencimiento));

  // Servicio contratado
  if (data.tipo_servicio && data.tipo_servicio.trim()) {
    document.getElementById('f-servicio').textContent = data.tipo_servicio;
    document.getElementById('servicio-wrap').classList.remove('hidden');
  }

  // Botón WhatsApp
  const url    = encodeURIComponent(window.location.href);
  const nombre = encodeURIComponent(data.nombre || 'la mascota');
  const waText = encodeURIComponent(
    `🐾 Verificación Mudinter Mascotas\n\n` +
    `Mascota: ${data.nombre} (${data.raza || ''})\n` +
    `Propietario: ${data.nombre_dueno}\n` +
    `Código: ${data.codigo}\n\n` +
    `Ver registro oficial:\n${window.location.href}`
  );
  document.getElementById('btn-wa').href = `https://wa.me/?text=${waText}`;

  showState('state-result');
}

/* ── Entrada principal ───────────────────────────────────── */
async function init() {
  const hash  = window.location.hash.replace('#', '').trim();

  // Sin hash → mostrar instrucciones
  if (!hash) {
    showState('state-hero');
    return;
  }

  // Con hash → buscar en Supabase
  showState('state-loading');

  // Validar credenciales de placeholder
  if (SUPABASE_URL.includes('REEMPLAZAR') || SUPABASE_ANON.includes('REEMPLAZAR')) {
    document.getElementById('error-title').textContent = 'Configuración pendiente';
    document.getElementById('error-msg').textContent =
      'Las credenciales de Supabase aún no han sido configuradas. Contacte al administrador.';
    showState('state-error');
    return;
  }

  try {
    const { data, error } = await supabase
      .from('mascotas')
      .select('*')
      .eq('token', hash)
      .single();

    if (error || !data) {
      document.getElementById('error-title').textContent = 'Registro no encontrado';
      document.getElementById('error-msg').textContent =
        'No se encontró ningún registro con este código QR. ' +
        'Contacte a Mudinter Mascotas para verificar la validez del certificado.';
      showState('state-error');
      return;
    }

    renderMascota(data);

  } catch (err) {
    console.error('PetPass error:', err);
    document.getElementById('error-title').textContent = 'Error de conexión';
    document.getElementById('error-msg').textContent =
      'No fue posible consultar el registro en este momento. Intente nuevamente o contacte a Mudinter Mascotas.';
    showState('state-error');
  }
}

// Arrancar al cargar
document.addEventListener('DOMContentLoaded', init);

// Reaccionar si el hash cambia (por si navegan desde URL directa)
window.addEventListener('hashchange', init);

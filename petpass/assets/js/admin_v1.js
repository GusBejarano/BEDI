/**
 * admin_v1.js — Panel administrativo PetPass
 * Proyecto: Mudinter Mascotas · Desarrollado por BEDI
 * Versión: v1
 */

/* ── Configuración Supabase ──────────────────────────────── */
// ⚠️ REEMPLAZAR con las credenciales reales del proyecto "petpass"
const SUPABASE_URL  = 'https://lcnsjzmashhbyvmxjbxb.supabase.co';
const SUPABASE_ANON = 'sb_publishable_yxqZfP2o1FKFfrWfXF689g_Z_JqH6Ei';
const STORAGE_BUCKET = 'fotos-mascotas';
const BASE_VERIFY_URL = 'https://bejaranodigital.com/petpass/';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

/* ── Estado global ───────────────────────────────────────── */
let currentUser   = null;
let editingId     = null;   // UUID de la mascota en edición (null = nueva)
let uploadedFoto  = null;   // File object de la foto a subir
let qrCurrentToken = null;  // token del QR activo

/* ── Utilidades generales ────────────────────────────────── */
function $(id)  { return document.getElementById(id); }
function show(id) { $(id).classList.remove('hidden'); }
function hide(id) { $(id).classList.add('hidden'); }

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

function generateToken(length = 10) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

function generateCodigo(n, year) {
  const pad = String(n).padStart(5, '0');
  return `MM-${year}-${pad}`;
}

/* ── Toasts ──────────────────────────────────────────────── */
function toast(msg, type = 'info') {
  const icons = { success: '✓', error: '✗', info: 'ℹ' };
  const div = document.createElement('div');
  div.className = `pp-toast pp-toast--${type}`;
  div.innerHTML = `<span>${icons[type]}</span><span>${msg}</span>`;
  $('toast-container').appendChild(div);
  setTimeout(() => div.remove(), 4500);
}

/* ── Pantallas ───────────────────────────────────────────── */
function showLogin()     { show('screen-login'); hide('screen-dashboard'); }
function showDashboard() { hide('screen-login'); show('screen-dashboard'); }

/* ══════════════════════════════════════════════════════════
   AUTH
   ══════════════════════════════════════════════════════════ */
async function login() {
  const email = $('login-email').value.trim();
  const pass  = $('login-pass').value;

  if (!email || !pass) {
    $('login-error').textContent = 'Ingrese correo y contraseña.';
    show('login-error');
    return;
  }

  $('btn-login').textContent = 'Ingresando…';
  $('btn-login').disabled = true;
  hide('login-error');

  const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });

  $('btn-login').textContent = 'Ingresar al panel';
  $('btn-login').disabled = false;

  if (error) {
    $('login-error').textContent = 'Credenciales incorrectas. Intente nuevamente.';
    show('login-error');
    return;
  }

  currentUser = data.user;
  $('admin-user-email').textContent = currentUser.email;
  showDashboard();
  loadMascotas();
}

async function logout() {
  await supabase.auth.signOut();
  currentUser = null;
  showLogin();
}

/* ══════════════════════════════════════════════════════════
   CARGA Y RENDER DE TABLA
   ══════════════════════════════════════════════════════════ */
async function loadMascotas() {
  $('tabla-body').innerHTML = `
    <tr><td colspan="8" class="text-center text-mist" style="padding:2rem;">Cargando…</td></tr>`;

  const { data, error } = await supabase
    .from('mascotas')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    $('tabla-body').innerHTML = `
      <tr><td colspan="8" class="text-center" style="padding:2rem;color:var(--pp-red);">
        Error al cargar registros. Verifique la conexión.
      </td></tr>`;
    return;
  }

  // Stats
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const activas = (data || []).filter(m => {
    const venc = m.fecha_vencimiento ? new Date(m.fecha_vencimiento + 'T00:00:00') : null;
    return m.estado === 'activo' && (!venc || venc >= hoy);
  });
  $('stat-total').textContent    = data?.length ?? 0;
  $('stat-activas').textContent  = activas.length;
  $('stat-inactivas').textContent = (data?.length ?? 0) - activas.length;

  if (!data || data.length === 0) {
    $('tabla-body').innerHTML = `
      <tr><td colspan="8" class="text-center text-mist" style="padding:2rem;">
        Aún no hay mascotas registradas. Haga clic en "+ Nueva Mascota" para comenzar.
      </td></tr>`;
    return;
  }

  $('tabla-body').innerHTML = data.map(m => {
    const venc = m.fecha_vencimiento ? new Date(m.fecha_vencimiento + 'T00:00:00') : null;
    const vencido = venc && venc < hoy;
    const esActivo = m.estado === 'activo' && !vencido;
    const badgeCls = esActivo ? 'pp-badge--active' : 'pp-badge--inactive';
    const badgeTxt = esActivo ? 'Activo' : (vencido ? 'Vencido' : 'Inactivo');

    return `
    <tr>
      <td style="font-family:var(--font-heading);font-size:0.8rem;color:var(--pp-gold);font-weight:600;">
        ${m.codigo}
      </td>
      <td><strong>${escHtml(m.nombre)}</strong></td>
      <td>${escHtml(m.raza || '—')}</td>
      <td>${escHtml(m.nombre_dueno)}</td>
      <td>${escHtml(m.pais_destino || '—')}</td>
      <td>${formatDate(m.fecha_vencimiento)}</td>
      <td><span class="pp-badge ${badgeCls}">${badgeTxt}</span></td>
      <td>
        <div class="pp-table-actions">
          <button class="pp-btn pp-btn--ghost pp-btn--sm" onclick="abrirEditar('${m.id}')">Editar</button>
          <button class="pp-btn pp-btn--ghost pp-btn--sm" onclick="abrirQR('${m.token}','${m.codigo}')">QR</button>
          <button class="pp-btn pp-btn--primary pp-btn--sm" onclick="descargarPDF('${m.id}')">PDF</button>
          <button class="pp-btn pp-btn--${esActivo ? 'danger' : 'ghost'} pp-btn--sm"
                  onclick="toggleEstado('${m.id}','${m.estado}')">
            ${esActivo ? 'Desactivar' : 'Activar'}
          </button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ══════════════════════════════════════════════════════════
   MODAL MASCOTA — NUEVA / EDITAR
   ══════════════════════════════════════════════════════════ */
function resetForm() {
  $('form-mascota').reset();
  $('foto-preview').classList.add('hidden');
  $('upload-text').classList.remove('hidden');
  uploadedFoto = null;
  hide('err-nombre'); hide('err-dueno'); hide('err-foto'); hide('err-general');
  hide('row-auto'); hide('row-estado');
  editingId = null;
  $('f-registro').value = todayISO();
}

function abrirNueva() {
  resetForm();
  $('modal-title').textContent = 'Nueva Mascota';
  $('btn-guardar-text').textContent = 'Guardar registro';
  show('modal-mascota');
}

async function abrirEditar(id) {
  const { data, error } = await supabase
    .from('mascotas').select('*').eq('id', id).single();
  if (error || !data) { toast('No se pudo cargar el registro.', 'error'); return; }

  resetForm();
  editingId = id;
  $('modal-title').textContent = 'Editar Mascota';
  $('btn-guardar-text').textContent = 'Actualizar registro';

  // Mostrar código y token (solo lectura)
  $('display-codigo').textContent = data.codigo;
  $('display-token').textContent  = data.token;
  show('row-auto');
  show('row-estado');

  // Rellenar campos
  $('f-nombre').value    = data.nombre    || '';
  $('f-raza').value      = data.raza      || '';
  $('f-tipo').value      = data.tipo_animal || '';
  $('f-microchip').value = data.microchip || '';
  $('f-dueno').value     = data.nombre_dueno || '';
  $('f-destino').value   = data.pais_destino || '';
  $('f-servicio').value  = data.tipo_servicio || '';
  $('f-registro').value  = data.fecha_registro || todayISO();
  $('f-vencimiento').value = data.fecha_vencimiento || '';
  $('f-estado').value    = data.estado || 'activo';

  // Foto preview
  if (data.foto_url) {
    $('foto-preview').src = data.foto_url;
    $('foto-preview').classList.remove('hidden');
    $('upload-text').classList.add('hidden');
  }

  show('modal-mascota');
}

function cerrarModal() {
  hide('modal-mascota');
  resetForm();
}

/* ── Guardar (nueva o editar) ────────────────────────────── */
async function guardarMascota() {
  // Validación básica
  let valid = true;
  if (!$('f-nombre').value.trim()) { show('err-nombre'); valid = false; }
  else { hide('err-nombre'); }
  if (!$('f-dueno').value.trim())  { show('err-dueno');  valid = false; }
  else { hide('err-dueno'); }
  if (!valid) return;

  $('btn-guardar').disabled = true;
  $('btn-guardar-text').textContent = 'Guardando…';
  hide('err-general');

  try {
    // Subir foto si hay nueva
    let foto_url = null;
    if (uploadedFoto) {
      const ext  = uploadedFoto.name.split('.').pop();
      const path = `${Date.now()}_${generateToken(6)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(path, uploadedFoto, { upsert: true });

      if (upErr) throw new Error('Error al subir la foto: ' + upErr.message);

      const { data: urlData } = supabase.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(path);
      foto_url = urlData.publicUrl;
    }

    const payload = {
      nombre:           $('f-nombre').value.trim(),
      raza:             $('f-raza').value.trim()      || null,
      tipo_animal:      $('f-tipo').value             || null,
      microchip:        $('f-microchip').value.trim() || null,
      nombre_dueno:     $('f-dueno').value.trim(),
      pais_destino:     $('f-destino').value.trim()   || null,
      tipo_servicio:    $('f-servicio').value.trim()  || null,
      fecha_registro:   $('f-registro').value         || todayISO(),
      fecha_vencimiento:$('f-vencimiento').value      || null,
    };
    if (foto_url) payload.foto_url = foto_url;

    if (editingId) {
      // Edición
      payload.estado = $('f-estado').value;
      const { error } = await supabase
        .from('mascotas').update(payload).eq('id', editingId);
      if (error) throw error;
      toast('Registro actualizado correctamente.', 'success');

    } else {
      // Nueva — generar código y token
      const year = new Date().getFullYear();

      // Obtener el siguiente consecutivo
      const { count } = await supabase
        .from('mascotas').select('id', { count: 'exact', head: true });
      const n = (count || 0) + 1;

      payload.codigo = generateCodigo(n, year);
      payload.token  = generateToken(10);
      payload.estado = 'activo';

      const { error } = await supabase
        .from('mascotas').insert([payload]);
      if (error) throw error;
      toast('Mascota registrada exitosamente.', 'success');
    }

    cerrarModal();
    loadMascotas();

  } catch (err) {
    console.error('guardarMascota error:', err);
    $('err-general').textContent = 'Error: ' + (err.message || 'Intente nuevamente.');
    show('err-general');
  } finally {
    $('btn-guardar').disabled = false;
    $('btn-guardar-text').textContent = editingId ? 'Actualizar registro' : 'Guardar registro';
  }
}

/* ── Toggle estado ───────────────────────────────────────── */
async function toggleEstado(id, estadoActual) {
  const nuevoEstado = estadoActual === 'activo' ? 'inactivo' : 'activo';
  const { error } = await supabase
    .from('mascotas').update({ estado: nuevoEstado }).eq('id', id);
  if (error) { toast('No se pudo actualizar el estado.', 'error'); return; }
  toast(`Registro ${nuevoEstado === 'activo' ? 'activado' : 'desactivado'}.`, 'success');
  loadMascotas();
}

/* ══════════════════════════════════════════════════════════
   QR
   ══════════════════════════════════════════════════════════ */
function abrirQR(token, codigo) {
  qrCurrentToken = token;
  const url = BASE_VERIFY_URL + '#' + token;

  // Limpiar canvas anterior
  $('qr-canvas-wrap').innerHTML = '';

  // Generar QR
  new QRCode($('qr-canvas-wrap'), {
    text: url,
    width: 240,
    height: 240,
    colorDark: '#0C2340',
    colorLight: '#FFFFFF',
    correctLevel: QRCode.CorrectLevel.H,
  });

  $('qr-url-display').textContent = url;
  $('qr-codigo').textContent = codigo;
  show('modal-qr');
}

function cerrarQR() {
  hide('modal-qr');
  qrCurrentToken = null;
}

function descargarQR() {
  const canvas = $('qr-canvas-wrap').querySelector('canvas');
  if (!canvas) { toast('Espere a que el QR se genere.', 'info'); return; }
  const link = document.createElement('a');
  link.download = `PetPass_QR_${qrCurrentToken || 'qr'}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
  toast('QR descargado.', 'success');
}

/* ══════════════════════════════════════════════════════════
   CERTIFICADO PDF (jsPDF)
   ══════════════════════════════════════════════════════════ */
async function descargarPDF(id) {
  toast('Generando certificado PDF…', 'info');

  const { data: m, error } = await supabase
    .from('mascotas').select('*').eq('id', id).single();
  if (error || !m) { toast('No se pudo cargar el registro.', 'error'); return; }

  try {
    const { jsPDF } = window.jspdf;
    // Media carta horizontal: 215.9 × 139.7 mm
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [215.9, 139.7] });
    const W = 215.9, H = 139.7;

    /* ── Fondo azul noche ── */
    doc.setFillColor(12, 35, 64);
    doc.rect(0, 0, W, H, 'F');

    /* ── Borde dorado ── */
    doc.setDrawColor(201, 168, 76);
    doc.setLineWidth(0.8);
    doc.rect(4, 4, W - 8, H - 8, 'S');

    /* ── Cabecera ── */
    // Franja superior
    doc.setFillColor(7, 23, 41);
    doc.rect(0, 0, W, 28, 'F');

    // Nombre empresa
    doc.setTextColor(201, 168, 76);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('MUDINTER MASCOTAS', 12, 12);

    doc.setTextColor(143, 168, 192);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text('TRANSPORTE INTERNACIONAL DE MASCOTAS', 12, 18);

    // Título certificado (derecha)
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('CERTIFICADO DE REGISTRO', W - 12, 11, { align: 'right' });
    doc.setTextColor(201, 168, 76);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('Y VERIFICACIÓN DIGITAL', W - 12, 17, { align: 'right' });

    /* ── Línea separadora dorada ── */
    doc.setDrawColor(201, 168, 76);
    doc.setLineWidth(0.5);
    doc.line(12, 28, W - 12, 28);

    /* ── Código y fechas ── */
    doc.setTextColor(201, 168, 76);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('CÓDIGO:', 12, 35);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.text(m.codigo, 36, 35);

    doc.setTextColor(143, 168, 192);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text(`Emisión: ${formatDate(m.fecha_registro)}`, 12, 41);
    doc.text(`Vence:   ${formatDate(m.fecha_vencimiento)}`, 12, 46);

    /* ── Foto mascota (si existe) ── */
    let fotoLoaded = false;
    if (m.foto_url) {
      try {
        const img = await loadImageDataURL(m.foto_url);
        doc.addImage(img, 'JPEG', 12, 52, 30, 30);
        fotoLoaded = true;
      } catch (_) { /* si falla, sin foto */ }
    }

    /* ── Datos mascota ── */
    const colA = fotoLoaded ? 48 : 12;

    doc.setTextColor(201, 168, 76);
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.text('DATOS DE LA MASCOTA', colA, 55);

    const camposMascota = [
      ['Nombre',    m.nombre || '—'],
      ['Raza',      m.raza   || '—'],
      ['Tipo',      tipoLabel(m.tipo_animal)],
      ['Microchip', m.microchip || '—'],
    ];
    let y = 61;
    camposMascota.forEach(([label, val]) => {
      doc.setTextColor(143, 168, 192);
      doc.setFontSize(6);
      doc.setFont('helvetica', 'normal');
      doc.text(label.toUpperCase(), colA, y);
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.text(val, colA, y + 4);
      y += 10;
    });

    /* ── Datos propietario ── */
    const colB = 100;
    doc.setTextColor(201, 168, 76);
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.text('DATOS DEL PROPIETARIO', colB, 55);

    const camposProp = [
      ['Propietario', m.nombre_dueno || '—'],
      ['País destino', m.pais_destino  || '—'],
    ];
    let yB = 61;
    camposProp.forEach(([label, val]) => {
      doc.setTextColor(143, 168, 192);
      doc.setFontSize(6);
      doc.setFont('helvetica', 'normal');
      doc.text(label.toUpperCase(), colB, yB);
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.text(val, colB, yB + 4);
      yB += 10;
    });

    /* ── Servicio contratado ── */
    if (m.tipo_servicio) {
      doc.setTextColor(201, 168, 76);
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'bold');
      doc.text('SERVICIO CONTRATADO', 12, 105);
      doc.setTextColor(200, 220, 240);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      const lines = doc.splitTextToSize(m.tipo_servicio, 130);
      doc.text(lines, 12, 110);
    }

    /* ── QR ── */
    const qrCanvas = await generarQRCanvas(BASE_VERIFY_URL + '#' + m.token);
    if (qrCanvas) {
      doc.addImage(qrCanvas.toDataURL('image/png'), 'PNG', W - 48, 48, 36, 36);
      doc.setTextColor(143, 168, 192);
      doc.setFontSize(5.5);
      doc.setFont('helvetica', 'normal');
      doc.text('ESCANEAR PARA', W - 30, 87, { align: 'center' });
      doc.text('VERIFICAR', W - 30, 91, { align: 'center' });
    }

    /* ── Línea y footer ── */
    doc.setDrawColor(201, 168, 76);
    doc.setLineWidth(0.3);
    doc.line(12, H - 18, W - 12, H - 18);

    doc.setTextColor(143, 168, 192);
    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    doc.text('mudintermascotas.com · Cl. 32 #1a 27, Cali, Colombia · +57 311 625 8253', W / 2, H - 13, { align: 'center' });
    doc.setTextColor(80, 110, 140);
    doc.text('Powered by BEDI · bejaranodigital.com', W / 2, H - 8, { align: 'center' });

    doc.save(`PetPass_Certificado_${m.codigo}.pdf`);
    toast('Certificado descargado.', 'success');

  } catch (err) {
    console.error('PDF error:', err);
    toast('Error al generar el PDF: ' + err.message, 'error');
  }
}

function tipoLabel(tipo) {
  const map = { domestica: 'Mascota doméstica', servicio: 'Perro de servicio',
                apoyo: 'Apoyo emocional', otro: 'Otro' };
  return map[tipo] || tipo || '—';
}

async function loadImageDataURL(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      c.getContext('2d').drawImage(img, 0, 0);
      resolve(c.toDataURL('image/jpeg'));
    };
    img.onerror = reject;
    img.src = url;
  });
}

async function generarQRCanvas(url) {
  return new Promise((resolve) => {
    const div = document.createElement('div');
    try {
      new QRCode(div, {
        text: url, width: 128, height: 128,
        colorDark: '#0C2340', colorLight: '#FFFFFF',
        correctLevel: QRCode.CorrectLevel.H,
      });
      setTimeout(() => {
        const canvas = div.querySelector('canvas');
        resolve(canvas || null);
      }, 300);
    } catch (_) { resolve(null); }
  });
}

/* ══════════════════════════════════════════════════════════
   UPLOAD DE FOTO
   ══════════════════════════════════════════════════════════ */
function initUpload() {
  const area    = $('upload-area');
  const input   = $('f-foto');
  const preview = $('foto-preview');
  const text    = $('upload-text');

  area.addEventListener('click', () => input.click());

  input.addEventListener('change', () => {
    const file = input.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      $('err-foto').textContent = 'La foto no puede superar 5 MB.';
      show('err-foto');
      return;
    }
    hide('err-foto');
    uploadedFoto = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      preview.src = e.target.result;
      preview.classList.remove('hidden');
      text.classList.add('hidden');
    };
    reader.readAsDataURL(file);
  });

  area.addEventListener('dragover', (e) => { e.preventDefault(); area.classList.add('dragging'); });
  area.addEventListener('dragleave', () => area.classList.remove('dragging'));
  area.addEventListener('drop', (e) => {
    e.preventDefault();
    area.classList.remove('dragging');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      input.files = e.dataTransfer.files;
      input.dispatchEvent(new Event('change'));
    }
  });
}

/* ══════════════════════════════════════════════════════════
   INIT — listeners y sesión
   ══════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', async () => {
  // Verificar credenciales placeholder
  if (SUPABASE_URL.includes('REEMPLAZAR')) {
    $('login-error').textContent =
      '⚠️ Credenciales Supabase no configuradas. Edite admin_v1.js con la URL y anon key del proyecto.';
    show('login-error');
  }

  // Verificar sesión activa
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    currentUser = session.user;
    $('admin-user-email').textContent = currentUser.email;
    showDashboard();
    loadMascotas();
  } else {
    showLogin();
  }

  // Auth
  $('btn-login').addEventListener('click', login);
  $('login-pass').addEventListener('keydown', (e) => { if (e.key === 'Enter') login(); });
  $('btn-logout').addEventListener('click', logout);

  // Modal mascota
  $('btn-nueva').addEventListener('click', abrirNueva);
  $('modal-close').addEventListener('click', cerrarModal);
  $('btn-cancelar').addEventListener('click', cerrarModal);
  $('btn-guardar').addEventListener('click', guardarMascota);

  // Cerrar modal al clic en backdrop
  $('modal-mascota').addEventListener('click', (e) => {
    if (e.target === $('modal-mascota')) cerrarModal();
  });

  // Modal QR
  $('qr-close').addEventListener('click', cerrarQR);
  $('qr-close-btn').addEventListener('click', cerrarQR);
  $('btn-descargar-qr').addEventListener('click', descargarQR);
  $('modal-qr').addEventListener('click', (e) => {
    if (e.target === $('modal-qr')) cerrarQR();
  });

  // Upload foto
  initUpload();
});

// Exponer funciones usadas desde el HTML (onclick en tabla)
window.abrirEditar    = abrirEditar;
window.abrirQR        = abrirQR;
window.descargarPDF   = descargarPDF;
window.toggleEstado   = toggleEstado;

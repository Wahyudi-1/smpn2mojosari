/**
 * =================================================================
 * SCRIPT UTAMA - SISTEM JURNAL & DISIPLIN GURU
 * =================================================================
 * @version 1.0
 * @author Disesuaikan oleh AI untuk Proyek Anda
 *
 * Terhubung dengan Supabase untuk otentikasi dan database.
 * Mengelola semua logika frontend, dari login hingga input data.
 */

// ====================================================================
// TAHAP 1: KONFIGURASI GLOBAL DAN STATE APLIKASI
// ====================================================================

// --- Inisialisasi Klien Supabase ---
const SUPABASE_URL = 'URL_PROYEK_ANDA_YANG_DISALIN'; // <-- GANTI DENGAN URL ANDA
const SUPABASE_ANON_KEY = 'KUNCI_ANON_ANDA_YANG_DISALIN'; // <-- GANTI DENGAN KUNCI ANON ANDA

const { createClient } = window.supabase;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- State Aplikasi (Cache Sederhana) ---
const AppState = {
    user: null,
    profile: null,
    assignments: [],
    students: [],
    violations: [],
    teachers: [],
    allAssignments: []
};

// ====================================================================
// TAHAP 2: FUNGSI-FUNGSI PEMBANTU (HELPERS)
// ====================================================================

function showLoading(isLoading) {
    const loader = document.getElementById('loadingIndicator');
    if (loader) loader.style.display = isLoading ? 'flex' : 'none';
}

function showStatusMessage(message, type = 'info', duration = 4000) {
    const statusEl = document.getElementById('statusMessage');
    if (!statusEl) { alert(message); return; }
    statusEl.textContent = message;
    statusEl.className = `status-message ${type}`;
    statusEl.style.display = 'block';
    window.scrollTo(0, 0);
    if (duration > 0) setTimeout(() => { statusEl.style.display = 'none'; }, duration);
}

function populateDropdown(selectElementId, data, valueField, textField, defaultOptionText) {
    const select = document.getElementById(selectElementId);
    if (!select) return;
    select.innerHTML = `<option value="">-- ${defaultOptionText} --</option>`;
    const uniqueItems = [...new Map(data.map(item => [item[valueField], item])).values()];
    uniqueItems.forEach(item => {
        const option = document.createElement('option');
        option.value = item[valueField];
        option.textContent = item[textField];
        select.appendChild(option);
    });
}


// ====================================================================
// TAHAP 3: FUNGSI OTENTIKASI & MANAJEMEN SESI
// ====================================================================

async function checkAuthenticationAndSetup() {
    const { data: { session } } = await supabase.auth.getSession();
    const isDashboardPage = window.location.pathname.includes('dashboard.html');
    const isLoginPage = window.location.pathname.includes('index.html');

    if (!session && isDashboardPage) {
        window.location.replace('index.html');
        return;
    }
    
    if (session && isLoginPage && !window.location.hash.includes('type=recovery')) {
        window.location.replace('dashboard.html');
        return;
    }

    if (session) {
        AppState.user = session.user;
        const { data, error } = await supabase.from('profiles').select('*').eq('id', AppState.user.id).single();
        if (data) {
            AppState.profile = data;
            document.getElementById('welcomeMessage').textContent = `Selamat Datang, ${data.full_name || session.user.email}!`;
        }
    }
}

async function handleLogin() {
    const email = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    showLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    showLoading(false);
    if (error) return showStatusMessage(`Login Gagal: ${error.message}`, 'error');
    window.location.href = 'dashboard.html';
}

async function handleLogout() {
    if (!confirm('Apakah Anda yakin ingin logout?')) return;
    showLoading(true);
    await supabase.auth.signOut();
    showLoading(false);
    window.location.replace('index.html');
}

// ... (Tambahkan fungsi handleForgotPassword dan setupPasswordToggle dari App 1 jika diperlukan) ...

// ====================================================================
// TAHAP 4: FUNGSI UTAMA APLIKASI
// ====================================================================

// --- 4.1 Inisialisasi & Kontrol UI ---
async function checkUserRoleAndSetupUI() {
    if (!AppState.profile) return;
    if (AppState.profile.role !== 'Admin') {
        document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
    } else {
         document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'block'); // atau 'inline-block', 'flex', dll.
    }
}

async function loadInitialData() {
    showLoading(true);
    const promises = [
        supabase.from('penugasan_guru').select('kelas, mata_pelajaran').eq('guru_id', AppState.user.id),
        supabase.from('siswa').select('nisn, nama'),
        supabase.from('pelanggaran_master').select('id, deskripsi')
    ];

    if (AppState.profile.role === 'Admin') {
        promises.push(supabase.from('profiles').select('id, full_name').eq('role', 'Guru'));
        promises.push(supabase.from('penugasan_guru').select('*, profiles(full_name)'));
    }

    const [assignments, students, violations, teachers, allAssignments] = await Promise.all(promises);
    
    if (assignments.data) AppState.assignments = assignments.data;
    if (students.data) AppState.students = students.data;
    if (violations.data) AppState.violations = violations.data;
    if (teachers && teachers.data) AppState.teachers = teachers.data;
    if (allAssignments && allAssignments.data) AppState.allAssignments = allAssignments.data;

    showLoading(false);
}

function populateInitialDropdowns() {
    // Untuk form jurnal guru
    populateDropdown('jurnalKelas', AppState.assignments, 'kelas', 'kelas', 'Pilih Kelas');
    populateDropdown('jurnalMapel', AppState.assignments, 'mata_pelajaran', 'mata_pelajaran', 'Pilih Mata Pelajaran');
    
    // Untuk form disiplin
    populateDropdown('deskripsiDisiplinInput', AppState.violations, 'id', 'deskripsi', 'Pilih Pelanggaran');
    
    // Untuk form penugasan (Admin)
    if (AppState.profile.role === 'Admin') {
        populateDropdown('penugasanGuru', AppState.teachers, 'id', 'full_name', 'Pilih Guru');
    }
}

// --- 4.2 Fungsi Modul Jurnal ---
async function handleJurnalSubmit(event) {
    event.preventDefault();
    const jurnalData = {
        guru_id: AppState.user.id,
        kelas: document.getElementById('jurnalKelas').value,
        mata_pelajaran: document.getElementById('jurnalMapel').value,
        tanggal: document.getElementById('jurnalTanggal').value,
        materi: document.getElementById('jurnalMateri').value,
        catatan: document.getElementById('jurnalCatatan').value,
    };
    if (!jurnalData.kelas || !jurnalData.mata_pelajaran || !jurnalData.tanggal || !jurnalData.materi) {
        return showStatusMessage('Harap isi semua kolom yang wajib diisi.', 'error');
    }
    showLoading(true);
    const { error } = await supabase.from('jurnal_pelajaran').insert(jurnalData);
    showLoading(false);
    if (error) {
        return showStatusMessage(`Gagal menyimpan jurnal: ${error.message}`, 'error');
    }
    showStatusMessage('Jurnal berhasil disimpan!', 'success');
    event.target.reset();
}

async function loadRiwayatJurnal() {
    const tableBody = document.getElementById('riwayatJurnalTableBody');
    if (!tableBody) return;
    tableBody.innerHTML = '<tr><td colspan="5">Memuat riwayat...</td></tr>';
    
    let query = supabase.from('jurnal_pelajaran').select('*').order('tanggal', { ascending: false });
    // Admin melihat semua, guru hanya miliknya sendiri (RLS menangani ini, tapi bisa juga eksplisit)
    if (AppState.profile.role !== 'Admin') {
        query = query.eq('guru_id', AppState.user.id);
    }

    const { data, error } = await query;
    if (error) return tableBody.innerHTML = '<tr><td colspan="5">Gagal memuat riwayat.</td></tr>';
    
    tableBody.innerHTML = data.length === 0 
        ? '<tr><td colspan="5" style="text-align: center;">Belum ada riwayat jurnal.</td></tr>'
        : data.map(j => `
            <tr>
                <td data-label="Tanggal">${new Date(j.tanggal).toLocaleDateString('id-ID')}</td>
                <td data-label="Kelas">${j.kelas}</td>
                <td data-label="Mapel">${j.mata_pelajaran}</td>
                <td data-label="Materi">${j.materi.substring(0, 50)}...</td>
                <td data-label="Aksi"><button class="btn btn-sm btn-secondary">Detail</button></td>
            </tr>
        `).join('');
}


// --- 4.3 Fungsi Modul Disiplin ---
function setupSiswaSearch() {
    const searchInput = document.getElementById('nisnDisiplinInput');
    const suggestionsContainer = document.getElementById('nisnSuggestions');
    const namaSiswaInput = document.getElementById('namaSiswaDisiplin');

    searchInput.addEventListener('input', () => {
        const query = searchInput.value.toLowerCase();
        if (query.length < 2) {
            suggestionsContainer.innerHTML = '';
            return;
        }
        const filteredSiswa = AppState.students.filter(s => 
            s.nama.toLowerCase().includes(query) || s.nisn.includes(query)
        ).slice(0, 5); // Batasi 5 hasil

        suggestionsContainer.innerHTML = filteredSiswa.map(s => 
            `<div class="suggestion-item" data-nisn="${s.nisn}" data-nama="${s.nama}">${s.nama} (${s.nisn})</div>`
        ).join('');
    });

    suggestionsContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('suggestion-item')) {
            const nisn = e.target.dataset.nisn;
            const nama = e.target.dataset.nama;
            searchInput.value = nisn;
            namaSiswaInput.value = nama;
            suggestionsContainer.innerHTML = '';
        }
    });
}

async function handleDisiplinSubmit(event) {
    event.preventDefault();
    const disiplinData = {
        nisn_siswa: document.getElementById('nisnDisiplinInput').value,
        id_pelanggaran: document.getElementById('deskripsiDisiplinInput').value,
        pencatat_id: AppState.user.id
    };
    if (!disiplinData.nisn_siswa || !disiplinData.id_pelanggaran) {
        return showStatusMessage('Harap pilih siswa dan jenis pelanggaran.', 'error');
    }
    showLoading(true);
    const { error } = await supabase.from('catatan_disiplin').insert(disiplinData);
    showLoading(false);
    if (error) return showStatusMessage(`Gagal menyimpan: ${error.message}`, 'error');
    showStatusMessage('Catatan disiplin berhasil disimpan!', 'success');
    event.target.reset();
}


// --- 4.4 Fungsi Modul Admin ---
async function handlePenugasanSubmit(event) {
    event.preventDefault();
    const penugasanData = {
        guru_id: document.getElementById('penugasanGuru').value,
        kelas: document.getElementById('penugasanKelas').value,
        mata_pelajaran: document.getElementById('penugasanMapel').value
    };
    showLoading(true);
    const { error } = await supabase.from('penugasan_guru').insert(penugasanData);
    showLoading(false);
    if (error) return showStatusMessage(`Gagal menyimpan: ${error.message}`, 'error');
    showStatusMessage('Penugasan berhasil disimpan!', 'success');
    event.target.reset();
    loadPenugasanTable(); // Muat ulang tabel
}

function loadPenugasanTable() {
    const tableBody = document.getElementById('penugasanTableBody');
    tableBody.innerHTML = AppState.allAssignments.map(a => `
        <tr>
            <td data-label="Guru">${a.profiles.full_name}</td>
            <td data-label="Kelas">${a.kelas}</td>
            <td data-label="Mapel">${a.mata_pelajaran}</td>
            <td data-label="Aksi"><button class="btn btn-sm btn-danger" onclick="deletePenugasan('${a.id}')">Hapus</button></td>
        </tr>
    `).join('');
}

async function deletePenugasan(id) {
    if (!confirm('Yakin ingin menghapus penugasan ini?')) return;
    showLoading(true);
    const { error } = await supabase.from('penugasan_guru').delete().eq('id', id);
    showLoading(false);
    if (error) return showStatusMessage(`Gagal menghapus: ${error.message}`, 'error');
    showStatusMessage('Penugasan berhasil dihapus.', 'success');
    // Refresh data
    const { data } = await supabase.from('penugasan_guru').select('*, profiles(full_name)');
    AppState.allAssignments = data;
    loadPenugasanTable();
}

async function handlePenggunaSubmit(event) {
    event.preventDefault();
    const nama = document.getElementById('formNamaPengguna').value;
    const email = document.getElementById('formEmailPengguna').value;
    const password = document.getElementById('formPasswordPengguna').value;
    const role = document.getElementById('formPeran').value;
    
    showLoading(true);
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                full_name: nama,
                role: role // Ini akan diambil oleh trigger handle_new_user
            }
        }
    });
    showLoading(false);

    if (error) return showStatusMessage(`Gagal membuat pengguna: ${error.message}`, 'error');
    if (data.user) showStatusMessage(`Pengguna ${email} berhasil dibuat!`, 'success');
    event.target.reset();
}

// ... (Tambahkan fungsi untuk CRUD Siswa, mirip dengan App 1) ...

// ====================================================================
// TAHAP 5: INISIALISASI DAN EVENT LISTENERS
// ====================================================================

function setupDashboardListeners() {
    document.getElementById('logoutButton')?.addEventListener('click', handleLogout);

    document.querySelectorAll('.section-nav button').forEach(button => {
        button.addEventListener('click', (e) => {
            const sectionId = e.currentTarget.dataset.section;
            document.querySelectorAll('.content-section').forEach(s => s.style.display = 'none');
            document.getElementById(sectionId).style.display = 'block';

            document.querySelectorAll('.section-nav button').forEach(btn => btn.classList.remove('active'));
            e.currentTarget.classList.add('active');

            // Jalankan fungsi spesifik saat tab dibuka
            if (sectionId === 'riwayatJurnalSection') loadRiwayatJurnal();
            if (sectionId === 'penugasanSection') loadPenugasanTable();
        });
    });

    // Event listeners untuk form
    document.getElementById('formJurnal')?.addEventListener('submit', handleJurnalSubmit);
    document.getElementById('formDisiplin')?.addEventListener('submit', handleDisiplinSubmit);
    document.getElementById('formPenugasan')?.addEventListener('submit', handlePenugasanSubmit);
    document.getElementById('formPengguna')?.addEventListener('submit', handlePenggunaSubmit);
    
    // Inisialisasi fitur lain
    setupSiswaSearch();
}

async function initDashboardPage() {
    await checkAuthenticationAndSetup();
    if (AppState.user) {
        await checkUserRoleAndSetupUI();
        await loadInitialData();
        populateInitialDropdowns();
        setupDashboardListeners();
        // Tampilkan section default
        document.querySelector('.section-nav button[data-section="jurnalSection"]')?.click();
    }
}

async function initLoginPage() {
    await checkAuthenticationAndSetup();
    document.querySelector('.login-box form')?.addEventListener('submit', (e) => { e.preventDefault(); handleLogin(); });
    // ... (tambahkan listener untuk lupa password dan toggle password dari App 1) ...
}

// --- Titik Masuk Aplikasi ---
document.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname.includes('dashboard.html')) {
        initDashboardPage();
    } else {
        initLoginPage();
    }
});

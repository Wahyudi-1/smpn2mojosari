/**
 * =================================================================
 * SCRIPT UTAMA - SISTEM JURNAL & DISIPLIN GURU
 * =================================================================
 * @version 2.0 - Final Clean Code
 * @author Disesuaikan oleh AI untuk Proyek Anda
 *
 * Terhubung dengan Supabase untuk otentikasi dan database.
 * Mengelola semua logika frontend, dari login hingga input data.
 */

// ====================================================================
// TAHAP 1: KONFIGURASI GLOBAL DAN STATE APLIKASI
// ====================================================================

const SUPABASE_URL = 'https://patjsszankjdlnktrfmh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBhdGpzc3phbmtqZGxua3RyZm1oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM3NzEzODUsImV4cCI6MjA2OTM0NzM4NX0.eZLV-7HbhQMFS3EF4e-Q5UuPRKVssgirL1cQxj7yJEg';

const { createClient } = window.supabase;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
    const isLoginPage = !isDashboardPage;

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
        const { data } = await supabase.from('profiles').select('*').eq('id', AppState.user.id).single();
        if (data) {
            AppState.profile = data;
            const welcomeEl = document.getElementById('welcomeMessage');
            if(welcomeEl) welcomeEl.textContent = `Selamat Datang, ${data.full_name || session.user.email}!`;
        }
    }
}

async function handleLogin() {
    const email = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    if(!email || !password) return showStatusMessage('Email dan password harus diisi.', 'error');
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

async function handleForgotPassword() {
    const emailEl = document.getElementById('username');
    const email = emailEl.value;
    if (!email) {
        return showStatusMessage('Silakan masukkan alamat email Anda, lalu klik "Lupa Password?".', 'error');
    }
    if (!confirm(`Anda akan mengirimkan link reset password ke alamat: ${email}. Lanjutkan?`)) {
        return;
    }
    showLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/index.html',
    });
    showLoading(false);
    if (error) return showStatusMessage(`Gagal mengirim email: ${error.message}`, 'error');
    showStatusMessage('Email untuk reset password telah dikirim! Silakan periksa kotak masuk Anda.', 'success');
}

function setupPasswordToggle() {
    const toggleIcon = document.getElementById('togglePassword');
    const passwordInput = document.getElementById('password');
    if (!toggleIcon || !passwordInput) return;
    const eyeIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16"><path d="M10.5 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z"/><path d="M0 8s3-5.5 8-5.5S16 8 16 8s-3 5.5-8 5.5S0 8 0 8zm8 3.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z"/></svg>`;
    const eyeSlashIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16"><path d="M13.359 11.238C15.06 9.72 16 8 16 8s-3-5.5-8-5.5a7.028 7.028 0 0 0-2.79.588l.77.771A5.94 5.94 0 0 1 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.134 13.134 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755-.165.165-.337.328-.517.486l.708.709z"/><path d="M11.297 9.176a3.5 3.5 0 0 0-4.474-4.474l.823.823a2.5 2.5 0 0 1 2.829 2.829l.822.822zm-2.943 1.288.822.822.083.083.083.083a3.5 3.5 0 0 1-4.474-4.474l.823.823a2.5 2.5 0 0 0 2.829 2.829l.822.822.083.083z"/><path d="M3.35 5.47c-.18.16-.353.322-.518.487A13.134 13.134 0 0 0 1.172 8l.195.288c.335.48.83 1.12 1.465 1.755C4.121 11.332 5.881 12.5 8 12.5c.716 0 1.39-.133 2.02-.36l.77.772A7.029 7.029 0 0 1 8 13.5C3 13.5 0 8 0 8s.939-1.721 2.641-3.238l.708.709zm10.296 6.884-12-12 .708-.708 12 12-.708.708z"/></svg>`;
    toggleIcon.innerHTML = eyeIcon;
    toggleIcon.addEventListener('click', () => {
        const isPassword = passwordInput.type === 'password';
        passwordInput.type = isPassword ? 'text' : 'password';
        toggleIcon.innerHTML = isPassword ? eyeSlashIcon : eyeIcon;
    });
}

function setupAuthListener() {
    supabase.auth.onAuthStateChange((event, session) => {
        if (event === "PASSWORD_RECOVERY") {
            const loginBox = document.querySelector('.login-box');
            const resetContainer = document.getElementById('resetPasswordContainer');
            if (!loginBox || !resetContainer) return;
            loginBox.style.display = 'none';
            resetContainer.style.display = 'grid';

            document.getElementById('resetPasswordForm').onsubmit = async (e) => {
                e.preventDefault();
                const newPassword = document.getElementById('newPassword').value;
                if (!newPassword || newPassword.length < 6) {
                    return showStatusMessage('Password baru minimal 6 karakter.', 'error');
                }
                showLoading(true);
                const { error } = await supabase.auth.updateUser({ password: newPassword });
                showLoading(false);
                if (error) return showStatusMessage(`Gagal memperbarui password: ${error.message}`, 'error');
                
                showStatusMessage('Password berhasil diperbarui! Anda akan diarahkan ke halaman login.', 'success', 3000);
                setTimeout(() => { window.location.hash = ''; window.location.reload(); }, 3000);
            };
        }
    });
}

// ====================================================================
// TAHAP 4: FUNGSI UTAMA APLIKASI
// ====================================================================

// --- 4.1 Inisialisasi & Kontrol UI ---
async function checkUserRoleAndSetupUI() {
    if (!AppState.profile) return;
    const adminElements = document.querySelectorAll('.admin-only');
    if (AppState.profile.role !== 'Admin') {
        adminElements.forEach(el => el.style.display = 'none');
    } else {
        adminElements.forEach(el => {
             el.style.display = el.tagName === 'DIV' ? 'block' : 'inline-block';
         });
    }
}

async function loadInitialData() {
    showLoading(true);
    const promises = [
        supabase.from('penugasan_guru').select('kelas, mata_pelajaran').eq('guru_id', AppState.user.id),
        supabase.from('siswa').select('nisn, nama, kelas').order('nama'),
        supabase.from('pelanggaran_master').select('id, deskripsi').order('deskripsi')
    ];

    if (AppState.profile.role === 'Admin') {
        promises.push(supabase.from('profiles').select('id, full_name').eq('role', 'Guru').order('full_name'));
        promises.push(supabase.from('penugasan_guru').select('*, profiles(full_name)').order('kelas'));
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
    populateDropdown('jurnalKelas', AppState.assignments, 'kelas', 'kelas', 'Pilih Kelas');
    populateDropdown('jurnalMapel', AppState.assignments, 'mata_pelajaran', 'mata_pelajaran', 'Pilih Mata Pelajaran');
    populateDropdown('deskripsiDisiplinInput', AppState.violations, 'id', 'deskripsi', 'Pilih Pelanggaran');
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
    if (error) return showStatusMessage(`Gagal menyimpan jurnal: ${error.message}`, 'error');
    showStatusMessage('Jurnal berhasil disimpan!', 'success');
    event.target.reset();
}

async function loadRiwayatJurnal() {
    const tableBody = document.getElementById('riwayatJurnalTableBody');
    if (!tableBody) return;
    tableBody.innerHTML = '<tr><td colspan="5">Memuat riwayat...</td></tr>';
    
    let query = supabase.from('jurnal_pelajaran').select('*, profiles(full_name)').order('tanggal', { ascending: false });
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

    searchInput?.addEventListener('input', () => {
        const query = searchInput.value.toLowerCase();
        suggestionsContainer.style.display = 'block';
        if (query.length < 2) {
            suggestionsContainer.innerHTML = '';
            return;
        }
        const filteredSiswa = AppState.students.filter(s => 
            s.nama.toLowerCase().includes(query) || s.nisn.includes(query)
        ).slice(0, 5);

        suggestionsContainer.innerHTML = filteredSiswa.map(s => 
            `<div class="suggestion-item" data-nisn="${s.nisn}" data-nama="${s.nama}">${s.nama} (${s.nisn})</div>`
        ).join('');
    });
    
    searchInput?.addEventListener('blur', () => {
        setTimeout(() => { suggestionsContainer.style.display = 'none'; }, 200);
    });

    suggestionsContainer?.addEventListener('click', (e) => {
        if (e.target.classList.contains('suggestion-item')) {
            const nisn = e.target.dataset.nisn;
            const nama = e.target.dataset.nama;
            searchInput.value = nisn;
            namaSiswaInput.value = nama;
            suggestionsContainer.innerHTML = '';
            suggestionsContainer.style.display = 'none';
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
    document.getElementById('namaSiswaDisiplin').value = '';
}

// --- 4.4 Fungsi Modul Admin (Penugasan & Pengguna) ---
async function handlePenugasanSubmit(event) {
    event.preventDefault();
    const penugasanData = {
        guru_id: document.getElementById('penugasanGuru').value,
        kelas: document.getElementById('penugasanKelas').value.trim(),
        mata_pelajaran: document.getElementById('penugasanMapel').value.trim()
    };
    showLoading(true);
    const { error } = await supabase.from('penugasan_guru').insert(penugasanData);
    showLoading(false);
    if (error) return showStatusMessage(`Gagal menyimpan: ${error.message}`, 'error');
    showStatusMessage('Penugasan berhasil disimpan!', 'success');
    event.target.reset();
    const { data } = await supabase.from('penugasan_guru').select('*, profiles(full_name)');
    if(data) AppState.allAssignments = data;
    loadPenugasanTable();
}

function loadPenugasanTable() {
    const tableBody = document.getElementById('penugasanTableBody');
    if(!tableBody) return;
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
    const { data } = await supabase.from('penugasan_guru').select('*, profiles(full_name)');
    if(data) AppState.allAssignments = data;
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
                role: role
            }
        }
    });
    showLoading(false);

    if (error) return showStatusMessage(`Gagal membuat pengguna: ${error.message}`, 'error');
    if (data.user) showStatusMessage(`Pengguna ${email} berhasil dibuat!`, 'success');
    event.target.reset();
}

// --- 4.5 Fungsi Modul Manajemen Siswa (Admin) ---
function loadSiswaTable() {
    const tableBody = document.getElementById('siswaResultsTableBody');
    if (!tableBody) return;
    const siswaData = AppState.students;
    
    tableBody.innerHTML = siswaData.length === 0 
        ? '<tr><td colspan="4" style="text-align: center;">Belum ada data siswa.</td></tr>'
        : siswaData.map(s => `
            <tr>
                <td data-label="NISN">${s.nisn}</td>
                <td data-label="Nama">${s.nama}</td>
                <td data-label="Kelas">${s.kelas}</td>
                <td data-label="Aksi">
                    <button class="btn btn-sm btn-secondary" onclick="editSiswaHandler('${s.nisn}')">Ubah</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteSiswaHandler('${s.nisn}')">Hapus</button>
                </td>
            </tr>
        `).join('');
}

async function saveSiswaHandler(event) {
    event.preventDefault();
    const oldNisn = document.getElementById('formNisnOld').value;
    const siswaData = {
        nisn: document.getElementById('formNisn').value.trim(),
        nama: document.getElementById('formNama').value.trim(),
        kelas: document.getElementById('formKelas').value.trim(),
    };

    if (!siswaData.nisn || !siswaData.nama || !siswaData.kelas) {
        return showStatusMessage('Semua kolom siswa wajib diisi.', 'error');
    }

    showLoading(true);
    let error;
    if (oldNisn) {
        const { error: updateError } = await supabase.from('siswa').update(siswaData).eq('nisn', oldNisn);
        error = updateError;
    } else {
        const { error: insertError } = await supabase.from('siswa').insert(siswaData);
        error = insertError;
    }
    showLoading(false);

    if (error) return showStatusMessage(`Gagal menyimpan data siswa: ${error.message}`, 'error');
    
    showStatusMessage(oldNisn ? 'Data siswa berhasil diperbarui.' : 'Siswa baru berhasil ditambahkan.', 'success');
    resetFormSiswa();
    
    const { data: updatedSiswa } = await supabase.from('siswa').select('nisn, nama, kelas');
    if (updatedSiswa) AppState.students = updatedSiswa;
    loadSiswaTable();
}

function editSiswaHandler(nisn) {
    const siswa = AppState.students.find(s => s.nisn === nisn);
    if (!siswa) return;
    
    document.getElementById('formNisn').value = siswa.nisn;
    document.getElementById('formNama').value = siswa.nama;
    document.getElementById('formKelas').value = siswa.kelas;
    document.getElementById('formNisnOld').value = siswa.nisn;
    document.getElementById('saveSiswaButton').textContent = 'Update Data Siswa';
    document.getElementById('formSiswa').scrollIntoView({ behavior: 'smooth' });
}

function resetFormSiswa() {
    document.getElementById('formSiswa').reset();
    document.getElementById('formNisnOld').value = '';
    document.getElementById('saveSiswaButton').textContent = 'Simpan Data Siswa';
}

async function deleteSiswaHandler(nisn) {
    if (!confirm(`Yakin ingin menghapus siswa dengan NISN: ${nisn}? Tindakan ini tidak dapat dibatalkan.`)) return;

    showLoading(true);
    const { error } = await supabase.from('siswa').delete().eq('nisn', nisn);
    showLoading(false);

    if (error) return showStatusMessage(`Gagal menghapus siswa: ${error.message}`, 'error');

    showStatusMessage('Siswa berhasil dihapus.', 'success');
    AppState.students = AppState.students.filter(s => s.nisn !== nisn);
    loadSiswaTable();
}

// ====================================================================
// TAHAP 5: INISIALISASI DAN EVENT LISTENERS
// ====================================================================

function setupDashboardListeners() {
    document.getElementById('logoutButton')?.addEventListener('click', handleLogout);

    const navButtons = document.querySelectorAll('.sidebar-nav .btn-nav');
    navButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            const sectionId = e.currentTarget.dataset.section;
            document.querySelectorAll('.dashboard-content .content-section').forEach(s => s.style.display = 'none');
            const activeSection = document.getElementById(sectionId);
            if (activeSection) activeSection.style.display = 'block';
            navButtons.forEach(btn => btn.classList.remove('active'));
            e.currentTarget.classList.add('active');

            if (sectionId === 'riwayatJurnalSection') loadRiwayatJurnal();
            if (sectionId === 'penugasanSection') loadPenugasanTable();
            if (sectionId === 'siswaSection') loadSiswaTable();
        });
    });

    document.getElementById('formJurnal')?.addEventListener('submit', handleJurnalSubmit);
    document.getElementById('formDisiplin')?.addEventListener('submit', handleDisiplinSubmit);
    document.getElementById('formPenugasan')?.addEventListener('submit', handlePenugasanSubmit);
    document.getElementById('formPengguna')?.addEventListener('submit', handlePenggunaSubmit);
    document.getElementById('formSiswa')?.addEventListener('submit', saveSiswaHandler);
    document.getElementById('resetSiswaButton')?.addEventListener('click', resetFormSiswa);
    
    setupSiswaSearch();
}

async function initDashboardPage() {
    await checkAuthenticationAndSetup();
    if (AppState.user) {
        setupAuthListener();
        await checkUserRoleAndSetupUI();
        await loadInitialData();
        populateInitialDropdowns();
        setupDashboardListeners();
        document.querySelector('.sidebar-nav .btn-nav')?.click();
    }
}

async function initLoginPage() {
    await checkAuthenticationAndSetup();
    setupAuthListener();
    setupPasswordToggle();
    document.querySelector('.login-box form')?.addEventListener('submit', (e) => { e.preventDefault(); handleLogin(); });
    document.getElementById('forgotPasswordLink')?.addEventListener('click', (e) => { e.preventDefault(); handleForgotPassword(); });
}

// --- Titik Masuk Aplikasi ---
document.addEventListener('DOMContentLoaded', () => {
    if (document.querySelector('.dashboard-wrapper')) {
        initDashboardPage();
    } else if (document.querySelector('.login-box')) {
        initLoginPage();
    }
});

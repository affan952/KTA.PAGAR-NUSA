/* ---------- CONFIG ---------- */
/* Jika mau pakai Firebase: isi firebaseConfig dengan detail projectmu.
   Jika biarkan kosong (null), sistem akan menggunakan localStorage. */
const firebaseConfig = null;
/*
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "PROJECT.firebaseapp.com",
  databaseURL: "https://PROJECT.firebaseio.com",
  projectId: "PROJECT",
  storageBucket: "PROJECT.appspot.com",
  messagingSenderId: "123456",
  appId: "1:123456:web:abcdef"
};
*/
/* ---------------------------- */

let useFirebase = false;
if (firebaseConfig) {
  firebase.initializeApp(firebaseConfig);
  useFirebase = true;
  var db = firebase.database();
  var storage = firebase.storage();
  var auth = firebase.auth();
}

/* Helpers */
function uid() { return 'PN-' + Date.now(); }
function toast(msg){ alert(msg); }

/* Form handling */
const form = document.getElementById('ktaForm');
const fotoInput = document.getElementById('foto');
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = {
    id: uid(),
    nama: document.getElementById('nama').value.trim(),
    tempat: document.getElementById('tempat').value.trim(),
    tanggal: document.getElementById('tanggal').value,
    alamat: document.getElementById('alamat').value.trim(),
    rayon: document.getElementById('rayon').value.trim(),
    sabuk: document.getElementById('sabuk').value,
    tanggal_daftar: new Date().toISOString().slice(0,10),
    foto: null,
    status: 'Aktif'
  };

  // Jika ada foto dan pakai firebase -> upload dulu
  const file = fotoInput.files[0];
  try {
    if (useFirebase && file) {
      const ref = storage.ref().child('foto/'+data.id+'-'+file.name);
      await ref.put(file);
      data.foto = await ref.getDownloadURL();
    } else if (file) {
      // local mode: we can't store binary in localStorage; mark filename only
      data.foto = file.name;
    }

    if (useFirebase) {
      await db.ref('anggota/'+data.id).set(data);
    } else {
      let arr = JSON.parse(localStorage.getItem('ktaData') || '[]');
      arr.push(data);
      localStorage.setItem('ktaData', JSON.stringify(arr));
    }

    toast('Data anggota berhasil disimpan!');
    form.reset();
    loadTable();
  } catch (err) {
    console.error(err);
    toast('Gagal menyimpan data: ' + err.message);
  }
});

/* Load and render table */
const tbody = document.querySelector('#tabelAnggota tbody');
async function loadTable() {
  tbody.innerHTML = '';
  let dataArr = [];
  if (useFirebase) {
    const snap = await db.ref('anggota').get();
    if (snap.exists()) {
      const obj = snap.val();
      dataArr = Object.keys(obj).map(k => obj[k]);
    }
  } else {
    dataArr = JSON.parse(localStorage.getItem('ktaData') || '[]');
  }

  // render
  dataArr.sort((a,b)=> a.tanggal_daftar < b.tanggal_daftar ? 1 : -1);
  const q = document.getElementById('search').value.toLowerCase();
  dataArr.filter(item => {
    return !q || (item.nama && item.nama.toLowerCase().includes(q)) || (item.rayon && item.rayon.toLowerCase().includes(q));
  }).forEach(item => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${item.id}</td>
      <td>${escapeHtml(item.nama)} ${item.foto ? `<br><small class="muted">${item.foto.includes('http') ? '<a target="_blank" href="'+item.foto+'">Foto</a>' : escapeHtml(item.foto)}</small>` : ''}</td>
      <td>${escapeHtml(item.rayon||'-')}</td>
      <td>${escapeHtml(item.sabuk||'-')}</td>
      <td>
        <button class="action-btn" onclick="viewDetail('${item.id}')">Lihat</button>
        <button class="action-btn" onclick="hapus('${item.id}')">Hapus</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}
document.getElementById('search').addEventListener('input', loadTable);

/* View detail (simple alert) */
window.viewDetail = async function(id){
  let item = null;
  if (useFirebase) {
    const snap = await db.ref('anggota/'+id).get();
    item = snap.exists() ? snap.val() : null;
  } else {
    let arr = JSON.parse(localStorage.getItem('ktaData') || '[]');
    item = arr.find(i=>i.id===id);
  }
  if (!item) return alert('Data tidak ditemukan');
  alert(`ID: ${item.id}\nNama: ${item.nama}\nRayon: ${item.rayon}\nSabuk: ${item.sabuk}\nAlamat: ${item.alamat}\nTanggal Daftar: ${item.tanggal_daftar}`);
}

/* Hapus data (admin only in production) */
window.hapus = async function(id){
  if (!confirm('Hapus data anggota ini?')) return;
  if (useFirebase) {
    await db.ref('anggota/'+id).remove();
  } else {
    let arr = JSON.parse(localStorage.getItem('ktaData') || '[]');
    arr = arr.filter(i=>i.id!==id);
    localStorage.setItem('ktaData', JSON.stringify(arr));
  }
  loadTable();
}

/* Export JSON */
document.getElementById('btnExport').addEventListener('click', function(){
  let arr = JSON.parse(localStorage.getItem('ktaData') || '[]');
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(arr, null, 2));
  const a = document.createElement('a');
  a.href = dataStr; a.download = 'kta-data.json'; a.click();
});

/* Admin login modal (simple integration with Firebase Auth if enabled) */
const modal = document.getElementById('modal');
document.getElementById('btnAdmin').addEventListener('click', ()=> modal.classList.remove('hidden'));
document.getElementById('closeModal').addEventListener('click', ()=> modal.classList.add('hidden'));

document.getElementById('loginBtn').addEventListener('click', async ()=>{
  const email = document.getElementById('adminEmail').value;
  const pass = document.getElementById('adminPass').value;
  const msg = document.getElementById('loginMsg');
  if (!useFirebase) {
    // Local quick-auth (NOT SECURE): treat preset password "admin123"
    if (pass === 'admin123') {
      modal.classList.add('hidden');
      toast('Login admin lokal berhasil (demo).');
    } else {
      msg.textContent = 'Password salah (demo).';
    }
    return;
  }
  try {
    await auth.signInWithEmailAndPassword(email, pass);
    modal.classList.add('hidden');
    toast('Login admin berhasil.');
  } catch(err) {
    msg.textContent = 'Login gagal: ' + err.message;
  }
});

/* Utility */
function escapeHtml(s){ if(!s) return ''; return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

/* Init */
loadTable();

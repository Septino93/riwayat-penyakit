const $ = id => document.getElementById(id);

window.addEventListener("DOMContentLoaded", () => {
  const dialog = $("detailDialog");
  if (dialog?.open) dialog.close();
  dialog?.removeAttribute("open");
});

let rows = [];
let selectedReg = "";
let selectedRow = null;
let session = "";

const PROFILE_KEYS = [
  "Timestamp",
  "Nomor Registrasi",
  "Email",
  "Nama Pemegang Polis",
  "Nomor Handphone Pemegang Polis",
  "Nama Tertanggung",
  "Nomor Handphone Tertanggung",
  "Jenis Kelamin Tertanggung",
  "Tanggal Lahir Tertanggung",
  "Nama Ibu Kandung Tertanggung",
  "Tinggi Badan Tertanggung",
  "Berat Badan Tertanggung",
  "Nama Pembayar Premi",
  "Hubungan Calon Tertanggung dengan Calon Pembayar Premi",
  "Penghasilan Kotor Tahunan",
  "Sumber Penghasilan",
  "Nama Perusahaan (Tempat Kerja)",
  "Jenis Usaha",
  "Bidang Usaha",
  "Jabatan",
  "Uraian Pekerjaan (Bagian)",
  "Status",
  "Sudah Dibaca",
  "Terakhir Dibaca"
];

const SYSTEM_KEYS = [
  "Timestamp",
  "Nomor Registrasi",
  "Status",
  "Sudah Dibaca",
  "Terakhir Dibaca",
  "Folder Dokumen"
];

try {
  session = localStorage.getItem("frpAdminSession") || "";
} catch {}

$("loginBtn").onclick = login;
$("adminPassword").onkeydown = event => {
  if (event.key === "Enter") login();
};
$("refreshBtn").onclick = loadData;
$("searchInput").oninput = render;
$("logoutBtn").onclick = () => logout();
$("closeDialog").onclick = () => $("detailDialog").close();
$("exportPdfBtn").onclick = exportPdf;
$("openFolderBtn").onclick = openFolder;
$("whatsappBtn").onclick = openWhatsApp;
$("deleteDataBtn").onclick = deleteData;

document.querySelectorAll(".detail-tab").forEach(button => {
  button.onclick = () => activateTab(button.dataset.tab);
});

function apiUrl() {
  const url = window.APP_CONFIG?.API_URL || "";
  if (!url || url.includes("PASTE_")) {
    throw new Error("API_URL belum diisi pada assets/js/config.js.");
  }
  return url;
}

async function call(action, payload = {}) {
  const response = await fetch(apiUrl(), {
    method: "POST",
    headers: {"Content-Type": "text/plain;charset=utf-8"},
    body: JSON.stringify({action, ...payload})
  });

  const text = await response.text();
  let data;

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Respons backend tidak valid.");
  }

  if (!data.success) {
    throw new Error(data.message || "Proses gagal.");
  }

  return data;
}

async function login() {
  const username = $("adminUsername").value.trim();
  const password = $("adminPassword").value;

  if (!username || !password) {
    return showLoginError("Username dan password wajib diisi.");
  }

  $("loginBtn").disabled = true;
  $("loginBtn").textContent = "Memeriksa...";
  $("loginError").hidden = true;

  try {
    const data = await call("login", {username, password});
    session = data.session;

    try {
      localStorage.setItem("frpAdminSession", session);
    } catch {}

    $("adminPassword").value = "";
    await loadData();
  } catch (error) {
    showLoginError(error.message);
  } finally {
    $("loginBtn").disabled = false;
    $("loginBtn").textContent = "Masuk";
  }
}

async function loadData() {
  try {
    const data = await call("listData", {session});
    rows = data.rows || [];

    const detailDialog = $("detailDialog");
    if (detailDialog?.open) detailDialog.close();
    detailDialog?.removeAttribute("open");

    $("loginPanel").hidden = true;
    $("dashboardPanel").hidden = false;
    $("dashboardError").hidden = true;

    updateStats();
    render();
  } catch (error) {
    if (/sesi|login|token/i.test(error.message)) {
      logout(false);
    } else {
      showDashboardError(error.message);
    }
  }
}

function updateStats() {}

function render() {
  const query = $("searchInput").value.trim().toLowerCase();

  const filtered = rows.filter(row => {
    const haystack = Object.values(row).join(" ").toLowerCase();
    return !query || haystack.includes(query);
  });

  $("emptyState").hidden = filtered.length > 0;
  $("tableBody").innerHTML = filtered.map(renderRow).join("");

  document.querySelectorAll("[data-reg]").forEach(button => {
    button.onclick = () => openDetail(button.dataset.reg);
  });
}
function renderRow(row) {
  const registration = row["Nomor Registrasi"] || "";
  const name = row["Nama Tertanggung"] || "-";
  const phone = row["Nomor Handphone Tertanggung"] || "-";
  const email = row.Email || "-";
  const read = isRead(row);

  return `
    <tr class="${read ? "" : "unread-row"}">
      <td>
        <strong class="registration-code">${esc(registration)}</strong>
      </td>
      <td>
        <span class="table-date">${esc(row.Timestamp || "-")}</span>
      </td>
      <td>
        <div class="person-cell">
          <div class="person-avatar">${esc(getInitials(name))}</div>
          <div>
            <strong>${esc(name)}</strong>
            <span>${esc(row["Jenis Kelamin Tertanggung"] || "-")}</span>
          </div>
        </div>
      </td>
      <td>
        <div class="contact-cell">
          <strong>${esc(phone)}</strong>
          <span>${esc(email)}</span>
        </div>
      </td>
      <td>
        <button class="btn secondary small" data-reg="${escAttr(registration)}">
          Lihat Detail
        </button>
      </td>
    </tr>`;
}
async function openDetail(registrationNumber) {
  try {
    const data = await call("getDetail", {
      session,
      registrationNumber
    });

    selectedReg = registrationNumber;
    selectedRow = data.row;

    const name = selectedRow["Nama Tertanggung"] || "Nasabah";
    const documents = getDocuments(selectedRow).filter(document => document.key !== "Folder Dokumen");

    $("detailTitle").textContent = name;
    $("detailMeta").textContent =
      `${registrationNumber} • ${selectedRow.Timestamp || "Tanggal tidak tersedia"}`;


    renderProfile(selectedRow);
    renderAnswers(selectedRow);
    renderDocuments(documents);
    activateTab("profile");

    const detailDialog = $("detailDialog");
    if (detailDialog.open) detailDialog.close();
    detailDialog.showModal();

    const localRow = rows.find(row => row["Nomor Registrasi"] === registrationNumber);
    if (localRow) {
      localRow["Sudah Dibaca"] = "Ya";
      localRow["Terakhir Dibaca"] = selectedRow["Terakhir Dibaca"] || "Baru dibuka";
    }

    updateStats();
    render();
  } catch (error) {
    alert(error.message);
  }
}

function renderProfile(row) {
  const entries = PROFILE_KEYS
    .filter(key => String(row[key] || "").trim())
    .map(key => [key, row[key]]);

  $("profileContent").innerHTML = entries.length
    ? entries.map(([key, value]) => detailItem(key, value)).join("")
    : emptyPanel("Data nasabah belum tersedia.");
}

function renderAnswers(row) {
  const documents = new Set(getDocuments(row).map(item => item.key));

  const entries = Object.entries(row).filter(([key, value]) => {
    return String(value || "").trim() &&
      !PROFILE_KEYS.includes(key) &&
      !SYSTEM_KEYS.includes(key) &&
      !documents.has(key) &&
      !looksLikeDocument(key, value);
  });

  $("answerContent").innerHTML = entries.length
    ? entries.map(([key, value]) => detailItem(key, value)).join("")
    : emptyPanel("Jawaban kuisioner belum tersedia.");
}

function renderDocuments(documents) {
  const folderUrl = selectedRow?.["Folder Dokumen"] || "";

  const folderCard = folderUrl
    ? `
      <article class="document-card folder-document-card">
        <div class="document-icon folder-icon">DIR</div>
        <div class="document-card-body">
          <small>Folder Dokumen</small>
          <strong>Seluruh dokumen pengajuan</strong>
        </div>
        <div class="document-card-actions">
          <a class="btn folder-btn small" href="${escAttr(folderUrl)}" target="_blank" rel="noopener">
            Buka Folder
          </a>
        </div>
      </article>`
    : "";

  const fileCards = documents
    .filter(document => document.key !== "Folder Dokumen")
    .map(document => `
      <article class="document-card">
        <div class="document-icon">${documentIcon(document.url)}</div>
        <div class="document-card-body">
          <small>${esc(document.key)}</small>
          <strong>${esc(cleanDocumentTitle(document.key))}</strong>
        </div>
        <div class="document-card-actions">
          <a class="btn secondary small" href="${escAttr(document.url)}" target="_blank" rel="noopener">
            Preview
          </a>
          <a class="btn download-btn small" href="${escAttr(getDownloadUrl(document.url))}" target="_blank" rel="noopener">
            Download
          </a>
        </div>
      </article>
    `).join("");

  $("documentContent").innerHTML = folderCard || fileCards
    ? folderCard + fileCards
    : emptyPanel("Tidak ada dokumen yang tersimpan.");
}
function getDocuments(row) {
  const documents = [];

  Object.entries(row).forEach(([key, value]) => {
    const urls = extractUrls(value);

    if (urls.length && looksLikeDocument(key, value)) {
      urls.forEach(url => documents.push({key, url}));
    }
  });

  return documents;
}

function looksLikeDocument(key, value) {
  const label = String(key).toLowerCase();
  const text = String(value || "");

  return /foto|dokumen|ktp|kartu keluarga|buku bank|lampiran|folder/i.test(label) ||
    /^https?:\/\/(drive\.google\.com|docs\.google\.com)/i.test(text.trim());
}

function extractUrls(value) {
  return String(value || "")
    .split(/\s+/)
    .map(item => item.trim())
    .filter(item => /^https?:\/\//i.test(item));
}

function detailItem(key, value) {
  return `
    <div class="detail-item">
      <small>${esc(key)}</small>
      <div>${renderValue(value)}</div>
    </div>`;
}

function activateTab(tabName) {
  document.querySelectorAll(".detail-tab").forEach(button => {
    button.classList.toggle("active", button.dataset.tab === tabName);
  });

  document.querySelectorAll(".detail-tab-panel").forEach(panel => {
    panel.classList.toggle("active", panel.id === `tab-${tabName}`);
  });
}

async function exportPdf() {
  if (!selectedReg) return;

  $("exportPdfBtn").disabled = true;
  $("exportPdfBtn").textContent = "Membuat PDF...";

  try {
    const data = await call("exportPdf", {
      session,
      registrationNumber: selectedReg
    });

    const link = document.createElement("a");
    link.href = data.url;
    link.download = "";
    link.style.display = "none";

    document.body.appendChild(link);
    link.click();
    link.remove();
  } catch (error) {
    alert(error.message);
  } finally {
    $("exportPdfBtn").disabled = false;
    $("exportPdfBtn").textContent = "Download PDF";
  }
}
function openFolder() {
  const folderUrl = selectedRow?.["Folder Dokumen"] || "";

  if (!folderUrl) {
    alert("Folder Google Drive tidak ditemukan.");
    return;
  }

  window.open(folderUrl, "_blank", "noopener");
}

function openWhatsApp() {
  if (!selectedRow) return;

  const phone =
    selectedRow["Nomor Handphone Tertanggung"] ||
    selectedRow["Nomor Handphone Pemegang Polis"] ||
    "";

  if (!phone) {
    alert("Nomor WhatsApp tidak tersedia.");
    return;
  }

  let whatsappNumber = String(phone).replace(/\D/g, "");

  if (whatsappNumber.indexOf("0") === 0) {
    whatsappNumber = "62" + whatsappNumber.substring(1);
  } else if (whatsappNumber.indexOf("62") !== 0) {
    whatsappNumber = "62" + whatsappNumber;
  }

  window.open(
    "https://wa.me/" + whatsappNumber,
    "_blank",
    "noopener"
  );
}

async function deleteData() {
  if (!selectedReg || !selectedRow) return;

  const name = selectedRow["Nama Tertanggung"] || "Nasabah";
  const confirmed = confirm(
    `Hapus pengajuan ini?\n\nNama: ${name}\nRegistrasi: ${selectedReg}\n\nData di Google Sheets, folder dokumen, dan PDF akan dipindahkan ke Sampah. Tindakan ini tidak dapat dibatalkan dari dashboard.`
  );

  if (!confirmed) return;

  $("deleteDataBtn").disabled = true;
  $("deleteDataBtn").textContent = "Menghapus...";

  try {
    await call("deleteData", {
      session,
      registrationNumber: selectedReg
    });

    $("detailDialog").close();
    selectedReg = "";
    selectedRow = null;
    await loadData();
    alert("Pengajuan berhasil dihapus.");
  } catch (error) {
    alert(error.message);
  } finally {
    $("deleteDataBtn").disabled = false;
    $("deleteDataBtn").textContent = "Hapus";
  }
}

function cleanDocumentTitle(label) {
  return String(label || "Dokumen")
    .replace(/^\d+[a-z]?(?:\.\d+)?\.?\s*/i, "")
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getDownloadUrl(url) {
  const fileId = getDriveFileId(url);
  return fileId
    ? `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`
    : url;
}

function getDriveFileId(url) {
  const text = String(url || "");

  const fileMatch = text.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch) return fileMatch[1];

  const idMatch = text.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch) return idMatch[1];

  return "";
}

function logout(showMessage = true) {
  const detailDialog = $("detailDialog");
  if (detailDialog?.open) detailDialog.close();
  detailDialog?.removeAttribute("open");

  session = "";
  rows = [];
  selectedReg = "";
  selectedRow = null;

  try {
    localStorage.removeItem("frpAdminSession");
  } catch {}

  $("dashboardPanel").hidden = true;
  $("loginPanel").hidden = false;

  if (showMessage) {
    showLoginError("Anda sudah keluar dari dashboard.");
  }
}

function isRead(row) {
  return String(row["Sudah Dibaca"] || "").toLowerCase() === "ya";
}

function statusClass(status) {
  return {
    "Baru": "status-blue",
    "Sedang Dicek": "status-yellow",
    "Dokumen Kurang": "status-red",
    "Sudah Lengkap": "status-green",
    "Selesai": "status-dark"
  }[status] || "status-blue";
}

function getInitials(name) {
  return String(name || "N")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(word => word[0])
    .join("")
    .toUpperCase();
}

function documentIcon(url) {
  const lower = String(url).toLowerCase();
  if (lower.includes(".pdf")) return "PDF";
  return "IMG";
}

function documentName(url) {
  try {
    return decodeURIComponent(new URL(url).pathname.split("/").filter(Boolean).pop() || "Dokumen");
  } catch {
    return "Dokumen";
  }
}

function emptyPanel(message) {
  return `<div class="tab-empty">${esc(message)}</div>`;
}

function renderValue(value) {
  const text = String(value);

  if (/^https?:\/\//i.test(text.trim())) {
    return `<a href="${escAttr(text.trim())}" target="_blank" rel="noopener">Buka tautan</a>`;
  }

  return esc(text);
}

function showLoginError(message) {
  $("loginError").textContent = message;
  $("loginError").hidden = false;
}

function showDashboardError(message) {
  $("dashboardError").textContent = message;
  $("dashboardError").hidden = false;
}

function esc(value) {
  return String(value).replace(/[&<>'"]/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;"
  }[character]));
}

function escAttr(value) {
  return esc(value);
}

if (session) loadData();

setInterval(() => {
  if (session) loadData();
}, 30000);

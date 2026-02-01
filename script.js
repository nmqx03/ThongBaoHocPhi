const { useState, useRef, useCallback, useEffect } = React;

// ─── HÀM HỖ TRỞ ──────────────────────────────────────────────────
function fmt(n) {
  if (!n && n !== 0) return "0";
  return Number(n).toLocaleString("vi-VN");
}

function parseSheet(ws) {
  const json = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
  const students = [];
  let sttCounter = 1;
  for (let r = 4; r < 34; r++) {
    const row = json[r];
    if (!row) continue;
    const name = row[38];
    const sessions = Number(row[39]) || 0;
    const pricePerSession = Number(row[40]) || 0;
    const fee = Number(row[41]) || 0;
    const cls = row[4] || "";
    if (!name || String(name).trim() === "") continue;
    students.push({ 
      stt: sttCounter++,
      name: String(name).trim(), 
      cls: String(cls).trim(),
      sessions, pricePerSession, fee
    });
  }
  return students;
}

// ─── RECEIPT MARKUP (reused by both modal + off-screen render) ────
function ReceiptMarkup({ student, bankInfo, qrCodeUrl, id }) {
  return (
    <div className="receipt" id={id || undefined}>
      <div className="receipt-header">
        <img src="images/logo2.png" alt="Logo" className="receipt-logo"
          onError={(e) => { e.target.style.display = 'none'; }} />
        <div className="receipt-addr">Số điện thoại: 0981.802.098 - Mrs.Trang </div>
        <div className="receipt-title">Thông Báo Học Phí</div>
      </div>
      <div className="receipt-info">
        <div className="info-item">
          <span className="info-label">Tên Học Sinh:</span>
          <span className="info-value">{student.name}</span>
        </div>
        <div className="info-item">
          <span className="info-label">Lớp:</span>
          <span className="info-value">{student.cls || "—"}</span>
        </div>
        <div className="info-item">
          <span className="info-label">Số Buổi Học:</span>
          <span className="info-value">{student.sessions || 0} buổi</span>
        </div>
        <div className="info-item">
          <span className="info-label">Học Phí 1 Buổi:</span>
          <span className="info-value">{fmt(student.pricePerSession)} VND</span>
        </div>
      </div>
      <div className="receipt-total">
        <div><div className="receipt-total-label">Tổng học phí</div></div>
        <div className="receipt-total-value">{fmt(student.fee)} VND</div>
      </div>
      {bankInfo && (
        <div className="receipt-bank">
          <div className="receipt-bank-title">Thông tin thanh toán</div>
          <div className="receipt-bank-row"><span>Ngân hàng</span><span>{bankInfo.bank || "—"}</span></div>
          <div className="receipt-bank-row"><span>Số TK</span><span>{bankInfo.account || "—"}</span></div>
          <div className="receipt-bank-row"><span>Chủ TK</span><span>{bankInfo.owner || "—"}</span></div>
        </div>
      )}
      {qrCodeUrl && (
        <div className="receipt-qr">
          <img src={qrCodeUrl} alt="QR Code" className="receipt-qr-image"
            onError={(e) => { e.target.style.display = 'none'; }} />
        </div>
      )}
      <div className="receipt-footer"></div>
    </div>
  );
}

// ─── OFF-SCREEN RENDER → CANVAS ──────────────────────────────────
// Tạo receipt element tương tự modal, render off-screen rồi capture
function renderReceiptToCanvas(student, bankInfo, qrCodeUrl) {
  return new Promise((resolve, reject) => {
    // Tạo container tạm
    const tempContainer = document.createElement("div");
    tempContainer.id = "temp-receipt-container";
    tempContainer.style.cssText = "position:fixed;left:-9999px;top:0;pointer-events:none;z-index:-1;";
    document.body.appendChild(tempContainer);
    
    // Render receipt vào container tạm
    const root = ReactDOM.createRoot(tempContainer);
    root.render(
      React.createElement(ReceiptMarkup, {
        student: student,
        bankInfo: bankInfo,
        qrCodeUrl: qrCodeUrl,
        id: "temp-receipt"
      })
    );
    
    // Đợi render xong và ảnh load
    setTimeout(() => {
      const el = document.getElementById("temp-receipt");
      if (!el) {
        document.body.removeChild(tempContainer);
        reject(new Error("Receipt element not found"));
        return;
      }
      
      // Capture với html2canvas
      window.html2canvas(el, { 
        scale: 2, 
        useCORS: true, 
        allowTaint: true,
        backgroundColor: "#fff",
        logging: false
      })
      .then((canvas) => {
        root.unmount();
        document.body.removeChild(tempContainer);
        resolve(canvas);
      })
      .catch((err) => {
        root.unmount();
        document.body.removeChild(tempContainer);
        reject(err);
      });
    }, 500); // Đợi 500ms để React render và ảnh load
  });
}

// ─── COMPONENT CHÍNH ─────────────────────────────────────────────
function App() {
  const [sheets, setSheets] = useState({});
  const [sheetNames, setSheetNames] = useState([]);
  const [activeSheet, setActiveSheet] = useState("");
  const [selected, setSelected] = useState(null);
  const [preview, setPreview] = useState(false);
  const [bankInfo] = useState({ bank: "Vietinbank", account: "0981802098", owner: "HOANG THU TRANG" });
  const qrCodeUrl = "images/qr1.png";
  const [checkedStudents, setCheckedStudents] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [toast, setToast] = useState(null);       // { text, progress } | null
  const [copiedCards, setCopiedCards] = useState({}); // key → true (flash ✓)

  // ─── Auto-scale modal receipt ──────────────────────────────────
  useEffect(() => {
    if (!preview) return;
    const scaleReceipt = () => {
      const container = document.getElementById("receipt-display-container");
      const receipt = document.getElementById("receipt-print");
      if (!container || !receipt) return;
      const receiptWidth = 1080;
      const receiptHeight = receipt.offsetHeight || 1920;
      const availableHeight = window.innerHeight * 0.9 - 140;
      const availableWidth = window.innerWidth * 0.9 - 40;
      const scale = Math.min(availableWidth / receiptWidth, availableHeight / receiptHeight, 1);
      container.style.transform = `scale(${scale})`;
      container.style.transformOrigin = "top center";
      container.parentElement.style.height = `${receiptHeight * scale}px`;
    };
    setTimeout(scaleReceipt, 50);
    window.addEventListener('resize', scaleReceipt);
    return () => window.removeEventListener('resize', scaleReceipt);
  }, [preview, selected]);

  // ─── Upload ────────────────────────────────────────────────────
  const handleFile = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const wb = XLSX.read(ev.target.result, { type: "array" });
      const name = wb.SheetNames[0];
      setSheets({ [name]: parseSheet(wb.Sheets[name]) });
      setSheetNames([name]);
      setActiveSheet(name);
      setSelected(null);
      setCheckedStudents({});
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  }, []);

  // ─── Reset ─────────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    setSheets({}); setSheetNames([]); setActiveSheet("");
    setSelected(null); setPreview(false);
    setCheckedStudents({}); setSearchTerm("");
  }, []);

  // ─── Toggle checkbox ───────────────────────────────────────────
  const toggleCheck = useCallback((key) => {
    setCheckedStudents(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const students = sheets[activeSheet] || [];

  const filteredStudents = students.filter(s => {
    if (!searchTerm.trim()) return true;
    const t = searchTerm.toLowerCase();
    return s.name.toLowerCase().includes(t) || s.cls.toLowerCase().includes(t) || s.stt.toString().includes(t);
  });

  const checkedCount = students.filter(s => checkedStudents[`${s.name}-${s.fee}`]).length;

  // ─── Modal: Save ───────────────────────────────────────────────
  const saveImage = useCallback(() => {
    const container = document.getElementById("receipt-display-container");
    const el = document.getElementById("receipt-print");
    if (!el || !container) return;
    const orig = container.style.transform;
    container.style.transform = "none";
    window.html2canvas(el, { scale: 2, useCORS: true, backgroundColor: "#fff" }).then((canvas) => {
      container.style.transform = orig;
      const link = document.createElement("a");
      link.download = `${selected?.name || "phieu"}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    });
  }, [selected]);

  // ─── Modal: Copy ───────────────────────────────────────────────
  const copyImage = useCallback(() => {
    const container = document.getElementById("receipt-display-container");
    const el = document.getElementById("receipt-print");
    if (!el || !container) return;
    const orig = container.style.transform;
    container.style.transform = "none";
    window.html2canvas(el, { scale: 2, useCORS: true, backgroundColor: "#fff" }).then((canvas) => {
      container.style.transform = orig;
      canvas.toBlob((blob) => {
        navigator.clipboard.write([new window.ClipboardItem({ "image/png": blob })])
          .then(() => alert("✅ Đã copy ảnh phiếu về clipboard!"))
          .catch(() => alert("⚠️ Browser không hỗ trợ copy ảnh. Thử tính năng Download."));
      });
    });
  }, []);

  // ─── Card: Copy 1 phiếu (không mở modal) ─────────────────────
  const copyOneCard = useCallback(async (e, student) => {
    e.stopPropagation();
    const key = `${student.name}-${student.fee}`;
    try {
      const canvas = await renderReceiptToCanvas(student, bankInfo, qrCodeUrl);
      const blob = await new Promise((res) => canvas.toBlob(res, "image/png"));
      await navigator.clipboard.write([new window.ClipboardItem({ "image/png": blob })]);
      setCopiedCards(prev => ({ ...prev, [key]: true }));
      setTimeout(() => setCopiedCards(prev => ({ ...prev, [key]: false })), 1400);
    } catch (err) {
      alert("⚠️ Không thể copy. Thử mở phiếu và copy từ modal.");
    }
  }, [bankInfo, qrCodeUrl]);

  // ─── Bulk: Download tất cả phiếu đã check ────────────────────
  const downloadChecked = useCallback(async () => {
    const list = students.filter(s => checkedStudents[`${s.name}-${s.fee}`]);
    if (list.length === 0) return;
    setToast({ text: `Đang tạo 0 / ${list.length} phiếu...`, progress: 0 });

    for (let i = 0; i < list.length; i++) {
      const s = list[i];
      try {
        const canvas = await renderReceiptToCanvas(s, bankInfo, qrCodeUrl);
        const link = document.createElement("a");
        link.download = `${s.name}_${s.cls || "lop"}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
        await new Promise(r => setTimeout(r, 250));
      } catch (err) { console.warn("Lỗi render:", s.name, err); }
      setToast({ text: `Đang tạo phiếu ${i + 1} / ${list.length}...`, progress: ((i + 1) / list.length) * 100 });
    }
    setToast({ text: `✅ Đã download ${list.length} phiếu!`, progress: 100 });
    setTimeout(() => setToast(null), 2000);
  }, [students, checkedStudents, bankInfo, qrCodeUrl]);

  // ─── Bỏ chọn tất cả checkbox ──────────────────────────────────
  const unselectAll = useCallback(() => {
    setCheckedStudents({});
  }, []);

  // ─── RENDER ────────────────────────────────────────────────────
  return (
    <>
      <div className="app">
        {/* Logo */}
        <div className="logo-row">
          <div className="logo-icon">📄</div>
          <div>
            <div className="logo-text">Thông báo học phí</div>
            <div className="logo-sub">Tạo phiếu thông báo học phí từ Excel</div>
          </div>
        </div>

        {/* Upload (chưa có file) */}
        {sheetNames.length === 0 && (
          <label className="upload-zone" htmlFor="file-input">
            <div className="upload-icon">
              <img src="images/excel-icon.png" alt="Excel" style={{ width: "150px", height: "90px" }} 
                onError={(e) => { e.target.style.display = 'none'; e.target.parentElement.textContent = '📊'; }} />
            </div>
            <div className="upload-title">Click để chọn file Excel</div>
            <input id="file-input" className="upload-input" type="file" accept=".xlsx,.xls" onChange={handleFile} />
          </label>
        )}

        {/* Đổi file + Làm mới */}
        {sheetNames.length > 0 && (
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 15 }}>
            <label className="upload-zone active" htmlFor="file-input2" style={{ padding: "16px", marginBottom: 0, flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "center" }}>
                <span style={{ fontSize: 20 }}>✅</span>
                <span style={{ color: "#48bb78", fontWeight: 600, fontSize: 14 }}>
                  {sheetNames[0]} - Click để đổi file
                </span>
              </div>
              <input id="file-input2" className="upload-input" type="file" accept=".xlsx,.xls" onChange={handleFile} />
            </label>
            <button className="btn-reset" onClick={handleReset}>🔄 Làm mới</button>
          </div>
        )}

        {sheetNames.length > 0 && (
          <>
            {/* Tìm kiếm */}
            <div style={{ marginTop: 15 }}>
              <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="🔍 Tìm kiếm theo tên, lớp hoặc số thứ tự..." style={{ width: "100%" }} />
            </div>

            {/* Grid thẻ học sinh */}
            {filteredStudents.length > 0 ? (
              <div className="students-grid">
                {filteredStudents.map((s, i) => {
                  const key = `${s.name}-${s.fee}`;
                  const isChecked = checkedStudents[key] || false;
                  const isCopied = copiedCards[key] || false;
                  return (
                    <div key={i}
                      className={`student-card ${selected?.name === s.name && selected?.fee === s.fee ? "selected" : ""} ${isChecked ? "checked" : ""}`}
                      onClick={() => { setSelected(s); setPreview(true); }}
                    >
                      {/* STT góc trái trên */}
                      <div className="card-stt">{s.stt}</div>

                      {/* Checkbox góc phải trên */}
                      <div className="card-checkbox" onClick={(e) => { e.stopPropagation(); toggleCheck(key); }}>
                        <input type="checkbox" checked={isChecked} onChange={() => {}} />
                      </div>

                      {/* Copy button góc trái dưới */}
                      <button className={`card-copy-btn ${isCopied ? "copied" : ""}`}
                        onClick={(e) => copyOneCard(e, s)} title="Copy ảnh phiếu">
                        {isCopied ? "✓" : "📋"}
                      </button>

                      <div className="card-name">{s.name}</div>
                      <div className="card-info">
                        <span><span className="card-label">Lớp:</span> {s.cls || "—"}</span>
                        <span><span className="card-label">Số buổi:</span> {s.sessions || 0}</span>
                      </div>
                      <div className="card-info">
                        <span><span className="card-label">1 buổi:</span> {fmt(s.pricePerSession)}đ</span>
                      </div>
                      <div className="card-price">{fmt(s.fee)} VND</div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="empty-state">
                <div className="icon">🔍</div>
                <div>{searchTerm ? `Không tìm thấy học sinh nào với từ khóa "${searchTerm}"` : "Không tìm thấy dữ liệu học sinh trong sheet này."}</div>
              </div>
            )}

            {/* Btn row */}
            <div className="btn-row">
              <span className="btn-count">
                {searchTerm ? `${filteredStudents.length}/${students.length} học sinh` : `${students.length} học sinh`}
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn-unselect" onClick={unselectAll} disabled={checkedCount === 0}>
                  ❌ Bỏ chọn tất cả
                </button>
                <button className="btn-copy-checked" onClick={downloadChecked} disabled={checkedCount === 0}>
                  ⬇️ {checkedCount > 0 ? `Download ${checkedCount} phiếu đã chọn` : "Chọn để download"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Modal preview */}
      {preview && selected && (
        <div className="modal-overlay" onClick={() => setPreview(false)}>
          <div className="modal-wrap" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Phiếu thông báo học phí – {selected.name}</h3>
              <button className="modal-close" onClick={() => setPreview(false)}>×</button>
            </div>
            <div style={{ background: "#f7fafc", overflow: "hidden", display: "flex", justifyContent: "center", alignItems: "flex-start", maxHeight: "calc(90vh - 140px)" }}>
              <div className="receipt-display-wrapper" id="receipt-display-container">
                <ReceiptMarkup student={selected} bankInfo={bankInfo} qrCodeUrl={qrCodeUrl} id="receipt-print" />
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn-dark" onClick={copyImage}>📋 Copy</button>
              <button className="btn-dark" onClick={saveImage}>⬇️ Download</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast (bulk download progress) */}
      {toast && (
        <div className="toast-progress">
          <span>{toast.text}</span>
          {toast.progress < 100 && (
            <div className="toast-bar-wrap">
              <div className="toast-bar" style={{ width: `${toast.progress}%` }}></div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

// ─── RENDER ỨNG DỤNG ─────────────────────────────────────────────
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
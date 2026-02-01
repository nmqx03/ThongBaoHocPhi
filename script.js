const { useState, useRef, useCallback } = React;

// ─── HÀM HỖ TRỢ ──────────────────────────────────────────────────
function fmt(n) {
  if (!n && n !== 0) return "0";
  return Number(n).toLocaleString("vi-VN");
}

function parseSheet(ws) {
  const json = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
  
  // Cấu trúc dữ liệu:
  // AM5-AM34 (cột 38, dòng 4-33): Tên học sinh
  // AN5-AN34 (cột 39, dòng 4-33): Số buổi học
  // AO5-AO34 (cột 40, dòng 4-33): Học phí 1 buổi
  // AP5-AP34 (cột 41, dòng 4-33): Tổng học phí
  // E5-E34 (cột 4, dòng 4-33): Lớp
  
  const students = [];
  let sttCounter = 1; // Đếm số thứ tự cho học sinh có dữ liệu
  
  // Duyệt từ dòng 5 (index 4) đến dòng 34 (index 33)
  for (let r = 4; r < 34; r++) {
    const row = json[r];
    if (!row) continue;
    
    const name = row[38]; // Cột AM (index 38)
    const sessions = Number(row[39]) || 0; // Cột AN (index 39) - Số buổi
    const pricePerSession = Number(row[40]) || 0; // Cột AO (index 40)
    const fee = Number(row[41]) || 0; // Cột AP (index 41)
    const cls = row[4] || ""; // Cột E (lớp)
    
    // Bỏ qua nếu không có tên
    if (!name || String(name).trim() === "") continue;
    
    students.push({ 
      stt: sttCounter++, // Số thứ tự tự động tăng
      name: String(name).trim(), 
      cls: String(cls).trim(),
      sessions,
      pricePerSession,
      fee
    });
  }
  
  return students;
}

// ─── COMPONENT PHIẾU THÔNG BÁO ─────────────────────────────────────────
function Receipt({ student, month, schoolName, bankInfo, qrCodeUrl }) {
  return (
    <div className="receipt" id="receipt-print">
      {/* Phần header */}
      <div className="receipt-header">
        <div className="receipt-school">{schoolName || "TRƯỜNG HỌC"}</div>
        <div className="receipt-addr">Địa chỉ: LK0908 - Khu đô thị TMS - Hùng Vương - Phúc Yên    </div>
        <div className="receipt-addr">Số điện thoại: 0981.802.098 </div>
        <div className="receipt-title">Thông Báo Học Phí</div>
      </div>

      {/* Thông tin học sinh */}
      <div className="receipt-info">
        <div className="info-item">
          <span className="info-label">Tên Học Sinh</span>
          <span className="info-value">{student.name}</span>
        </div>
        <div className="info-item">
          <span className="info-label">Lớp</span>
          <span className="info-value">{student.cls || "—"}</span>
        </div>
        <div className="info-item">
          <span className="info-label">Số Buổi Học</span>
          <span className="info-value">{student.sessions || 0} buổi</span>
        </div>
        <div className="info-item">
          <span className="info-label">Học Phí 1 Buổi</span>
          <span className="info-value">{fmt(student.pricePerSession)} VND</span>
        </div>
      </div>

      {/* Tổng tiền cần nộp */}
      <div className="receipt-total">
        <div>
          <div className="receipt-total-label">Tổng học phí</div>
        </div>
        <div className="receipt-total-value">{fmt(student.fee)} VND</div>
      </div>

      {/* Thông tin ngân hàng */}
      {bankInfo && (
        <div className="receipt-bank">
          <div className="receipt-bank-title">Thông tin thanh toán</div>
          <div className="receipt-bank-row">
            <span>Ngân hàng</span>
            <span>{bankInfo.bank || "—"}</span>
          </div>
          <div className="receipt-bank-row">
            <span>Số TK</span>
            <span>{bankInfo.account || "—"}</span>
          </div>
          <div className="receipt-bank-row">
            <span>Chủ TK</span>
            <span>{bankInfo.owner || "—"}</span>
          </div>
        </div>
      )}

      {/* Mã QR thanh toán (chỉ hiện nếu có) */}
      {qrCodeUrl && (
        <div className="receipt-qr">
          <img 
            src={qrCodeUrl} 
            alt="QR Code" 
            className="receipt-qr-image"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        </div>
      )}

      {/* Footer */}
      <div className="receipt-footer">
       
      </div>
    </div>
  );
}

// ─── COMPONENT CHÍNH ─────────────────────────────────────────────────
function App() {
  // Các state để quản lý dữ liệu
  const [sheets, setSheets] = useState({});
  const [sheetNames, setSheetNames] = useState([]);
  const [activeSheet, setActiveSheet] = useState("");
  const [selected, setSelected] = useState(null);
  const [preview, setPreview] = useState(false);
  const [schoolName, setSchoolName] = useState("TMS English Club");
  const [bankInfo, setBankInfo] = useState({ 
    bank: "Vietinbank", 
    account: "0981802098", 
    owner: "HOANG THU TRANG" 
  });
  const qrCodeUrl = "images/qr1.png"; // Đường dẫn ảnh QR code cố định
  const [checkedStudents, setCheckedStudents] = useState({}); // Lưu trạng thái checkbox
  const [searchTerm, setSearchTerm] = useState(""); // Từ khóa tìm kiếm

  // Xử lý khi upload file Excel
  const handleFile = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (ev) => {
      const wb = XLSX.read(ev.target.result, { type: "array" });
      
      // Chỉ lấy sheet đầu tiên
      const firstSheetName = wb.SheetNames[0];
      const firstSheet = wb.Sheets[firstSheetName];
      const students = parseSheet(firstSheet);
      
      setSheets({ [firstSheetName]: students });
      setSheetNames([firstSheetName]);
      setActiveSheet(firstSheetName);
      setSelected(null);
      setCheckedStudents({}); // Reset checkbox khi upload file mới
    };
    
    reader.readAsArrayBuffer(file);
    
    // Reset input để có thể upload lại cùng file
    e.target.value = '';
  }, []);

  // Xử lý nút Làm mới - quay về trang chủ
  const handleReset = useCallback(() => {
    setSheets({});
    setSheetNames([]);
    setActiveSheet("");
    setSelected(null);
    setPreview(false);
    setCheckedStudents({});
    setSearchTerm("");
  }, []);

  // Toggle checkbox cho học sinh
  const toggleCheck = useCallback((studentKey) => {
    setCheckedStudents(prev => ({
      ...prev,
      [studentKey]: !prev[studentKey]
    }));
  }, []);

  const students = sheets[activeSheet] || [];
  
  // Lọc học sinh theo từ khóa tìm kiếm
  const filteredStudents = students.filter(s => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return s.name.toLowerCase().includes(term) || 
           s.cls.toLowerCase().includes(term) ||
           s.stt.toString().includes(term);
  });

  // Lưu ảnh phiếu
  const saveImage = useCallback(() => {
    const el = document.getElementById("receipt-print");
    if (!el) return;
    
    window.html2canvas(el, { 
      scale: 2, 
      useCORS: true, 
      backgroundColor: "#fff" 
    }).then((canvas) => {
      const link = document.createElement("a");
      link.download = `${selected?.name || "phieu"}_${activeSheet || ""}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    });
  }, [selected, activeSheet]);

  // Copy ảnh phiếu vào clipboard
  const copyImage = useCallback(() => {
    const el = document.getElementById("receipt-print");
    if (!el) return;
    
    window.html2canvas(el, { 
      scale: 2, 
      useCORS: true, 
      backgroundColor: "#fff" 
    }).then((canvas) => {
      canvas.toBlob((blob) => {
        navigator.clipboard.write([
          new window.ClipboardItem({ "image/png": blob })
        ]).then(() => {
          alert("✅ Đã copy ảnh phiếu về clipboard!");
        }).catch(() => {
          alert("⚠️ Browser không hỗ trợ copy ảnh. Thử tính năng Download.");
        });
      });
    });
  }, []);

  return (
    <>
      <div className="app">
        {/* Logo và tiêu đề */}
        <div className="logo-row">
          <div className="logo-icon">📄</div>
          <div>
            <div className="logo-text">Tuition Notice Generator</div>
            <div className="logo-sub">Tạo phiếu thông báo học phí từ Excel</div>
          </div>
        </div>

        {/* Khu vực upload file */}
        {sheetNames.length === 0 && (
          <label className="upload-zone" htmlFor="file-input">
            <div className="upload-icon">📂</div>
            <div className="upload-title">Kéo & thả file Excel vào đây</div>
            <div className="upload-sub">Hoặc click để chọn file .xlsx</div>
            <input 
              id="file-input" 
              className="upload-input" 
              type="file" 
              accept=".xlsx,.xls" 
              onChange={handleFile} 
            />
          </label>
        )}

        {/* Khu vực đổi file và làm mới */}
        {sheetNames.length > 0 && (
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 15 }}>
            <label 
              className="upload-zone active" 
              htmlFor="file-input2" 
              style={{ padding: "16px", marginBottom: 0, flex: 1 }}
            >
              <div style={{ 
                display: "flex", 
                alignItems: "center", 
                gap: 12, 
                justifyContent: "center" 
              }}>
                <span style={{ fontSize: 20 }}>✅</span>
                <span style={{ 
                  color: "#48bb78", 
                  fontWeight: 600, 
                  fontSize: 14 
                }}>
                  {sheetNames[0]} - Click để đổi file
                </span>
              </div>
              <input 
                id="file-input2" 
                className="upload-input" 
                type="file" 
                accept=".xlsx,.xls" 
                onChange={handleFile} 
              />
            </label>
            <button className="btn-reset" onClick={handleReset}>
              🔄 Làm mới
            </button>
          </div>
        )}

        {/* Không hiện tabs nữa - chỉ lấy sheet đầu */}
        {sheetNames.length > 0 && (
          <>

            {/* Ô nhập tên trường */}
            <div style={{ display: "flex", gap: 12, marginTop: 15, flexWrap: "wrap" }}>
              <input
                type="text"
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                placeholder="TMS English Club"
                style={{ flex: 1, minWidth: 200 }}
              />
            </div>

            {/* Ô tìm kiếm học sinh */}
            <div style={{ marginTop: 15 }}>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="🔍 Tìm kiếm theo tên, lớp hoặc số thứ tự..."
                style={{ width: "100%" }}
              />
            </div>

            {/* Danh sách thẻ học sinh */}
            {filteredStudents.length > 0 ? (
              <div className="students-grid">
                {filteredStudents.map((s, i) => {
                  const studentKey = `${s.name}-${s.fee}`;
                  const isChecked = checkedStudents[studentKey] || false;
                  
                  return (
                    <div
                      key={i}
                      className={`student-card ${
                        selected?.name === s.name && selected?.fee === s.fee 
                          ? "selected" 
                          : ""
                      } ${isChecked ? "checked" : ""}`}
                      onClick={() => { 
                        setSelected(s); 
                        setPreview(true); 
                      }}
                    >
                      {/* Số thứ tự góc trái trên */}
                      <div className="card-stt">{s.stt}</div>
                      
                      {/* Checkbox góc phải trên */}
                      <div 
                        className="card-checkbox"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleCheck(studentKey);
                        }}
                      >
                        <input 
                          type="checkbox" 
                          checked={isChecked}
                          onChange={() => {}}
                        />
                      </div>
                      
                      <div className="card-name">{s.name}</div>
                      <div className="card-info">
                        <span>
                          <span className="card-label">Lớp:</span> {s.cls || "—"}
                        </span>
                        <span>
                          <span className="card-label">Số buổi:</span> {s.sessions || 0}
                        </span>
                      </div>
                      <div className="card-info">
                        <span>
                          <span className="card-label">1 buổi:</span> {fmt(s.pricePerSession)}đ
                        </span>
                      </div>
                      <div className="card-price">{fmt(s.fee)} VND</div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="empty-state">
                <div className="icon">🔍</div>
                <div>
                  {searchTerm 
                    ? `Không tìm thấy học sinh nào với từ khóa "${searchTerm}"`
                    : "Không tìm thấy dữ liệu học sinh trong sheet này."
                  }
                </div>
              </div>
            )}

            {/* Hiển thị số lượng học sinh */}
            <div className="btn-row">
              <span className="btn-count">
                {searchTerm 
                  ? `${filteredStudents.length}/${students.length} học sinh`
                  : `${students.length} học sinh`
                }
              </span>
            </div>
          </>
        )}
      </div>

      {/* Modal xem trước và tải xuống phiếu */}
      {preview && selected && (
        <div className="modal-overlay" onClick={() => setPreview(false)}>
          <div className="modal-wrap" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Phiếu thông báo học phí – {selected.name}</h3>
              <button 
                className="modal-close" 
                onClick={() => setPreview(false)}
              >
                ×
              </button>
            </div>
            <div style={{ 
              padding: "20px 16px", 
              background: "#f7fafc", 
              overflow: "auto" 
            }}>
              <Receipt 
                student={selected} 
                month={activeSheet} 
                schoolName={schoolName} 
                bankInfo={bankInfo}
                qrCodeUrl={qrCodeUrl}
              />
            </div>
            <div className="modal-actions">
              <button className="btn-dark" onClick={copyImage}>
                📋 Copy
              </button>
              <button className="btn-dark" onClick={saveImage}>
                ⬇️ Download
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── RENDER ỨNG DỤNG ───────────────────────────────────────────────────
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
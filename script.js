/* ==========================================================
   Body Scent — script.js (ใช้ร่วมกันทุกหน้า)
   - product.html : แสดงการ์ดสินค้า + ปุ่มกรอง mood
   - order.html   : เติมฟอร์มจาก URL + ส่งออเดอร์ไป Apps Script
   - admin.html   : แสดงออเดอร์จาก CSV เป็นตาราง (ล่าสุดก่อน)
   ========================================================== */

// *** ใส่ URL ของ Apps Script (ที่ลงท้าย /exec) ตรงนี้ ***
const APPS_SCRIPT_URL = 'PASTE_YOUR_APPS_SCRIPT_URL_HERE';

// *** ใส่ URL CSV ของ Google Sheet (Publish to web แบบ CSV) ตรงนี้ ***
const CSV_URL = 'PASTE_YOUR_CSV_URL_HERE';

const MOODS = [
  { key: 'all', label: 'ทั้งหมด' },
  { key: 'fresh', label: 'Fresh' },
  { key: 'sweet', label: 'Sweet' },
  { key: 'confident', label: 'Confident' },
  { key: 'romance', label: 'Romance' }
];

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('product-list')) initProductPage();
  if (document.getElementById('orderForm')) initOrderPage();
  if (document.getElementById('ordersTable')) initAdminPage();
});

/* ==========================================================
   หน้า product.html
   ต้องมีใน HTML: #filter-bar และ #product-list
   ========================================================== */
function initProductPage() {
  const grid = document.getElementById('product-list');
  const filterBox = document.getElementById('filter-bar');
  let products = [];

  const params = new URLSearchParams(window.location.search);
  const validKeys = MOODS.map(m => m.key);
  let currentMood = validKeys.includes(params.get('mood')) ? params.get('mood') : 'all';

  function renderFilters() {
    if (!filterBox) return;
    filterBox.textContent = '';
    MOODS.forEach(m => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'filter-btn' + (m.key === currentMood ? ' is-active' : '');
      btn.textContent = m.label;
      btn.addEventListener('click', () => {
        currentMood = m.key;
        const url = new URL(window.location.href);
        if (m.key === 'all') url.searchParams.delete('mood');
        else url.searchParams.set('mood', m.key);
        history.replaceState(null, '', url);
        renderFilters();
        renderProducts();
      });
      filterBox.appendChild(btn);
    });
  }

  function renderProducts() {
    grid.textContent = '';
    const list = currentMood === 'all' ? products : products.filter(p => p.mood === currentMood);

    if (list.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'text-muted';
      empty.textContent = 'ยังไม่มีสินค้าในหมวดนี้';
      grid.appendChild(empty);
      return;
    }
    list.forEach(p => grid.appendChild(createCard(p)));
  }

  renderFilters();

  fetch('products.json')
    .then(res => {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then(data => {
      products = data;
      renderProducts();
    })
    .catch(error => {
      console.error(error);
      grid.textContent = '';
      const msg = document.createElement('p');
      msg.className = 'text-muted';
      msg.textContent = 'โหลดข้อมูลสินค้าไม่สำเร็จ กรุณารีเฟรชหน้าอีกครั้ง';
      grid.appendChild(msg);
    });
}

function createCard(p) {
  const card = document.createElement('article');
  card.className = 'product-card';
  card.dataset.mood = p.mood;

  const img = document.createElement('img');
  img.className = 'product-image';
  img.src = p.image;
  img.alt = p.name;
  img.loading = 'lazy';

  const body = document.createElement('div');
  body.className = 'product-body';

  // ไซส์ (โรลออนไม่มีไซส์ ให้แสดงเป็นชนิดสินค้าแทน)
  const meta = document.createElement('div');
  meta.className = 'product-meta';
  const dot = document.createElement('span');
  dot.className = 'mood-dot';
  const metaText = document.createElement('span');
  metaText.textContent = p.size ? p.size : (p.type === 'rollon' ? 'โรลออน' : '');
  meta.append(dot, metaText);

  const name = document.createElement('h3');
  name.className = 'product-name';
  name.textContent = p.name;

  const foot = document.createElement('div');
  foot.className = 'product-foot';

  const price = document.createElement('span');
  price.className = 'product-price';
  price.textContent = p.price + ' บาท';

  // ชื่อสินค้าที่ส่งไปหน้า order (ต่อไซส์ถ้ามี)
  const itemName = p.size ? p.name + ' ' + p.size : p.name;
  const buy = document.createElement('a');
  buy.className = 'btn';
  buy.textContent = 'สั่งซื้อ';
  buy.href = 'order.html?item=' + encodeURIComponent(itemName) + '&price=' + encodeURIComponent(p.price);

  foot.append(price, buy);
  body.append(meta, name, foot);
  card.append(img, body);
  return card;
}

/* ==========================================================
   หน้า order.html
   ต้องมีใน HTML: form#orderForm, input #customerName, #contact,
   #items, #total และ #note พร้อมปุ่ม type="submit" (ยืนยันสั่งซื้อ)
   ========================================================== */
function initOrderPage() {
  const form = document.getElementById('orderForm');
  const itemsEl = document.getElementById('items');
  const totalEl = document.getElementById('total');

  // เติมค่าจาก URL parameter ทันทีที่โหลดหน้า (ทั้ง items และ total)
  const params = new URLSearchParams(window.location.search);
  const item = params.get('item');
  const price = params.get('price');
  if (item && itemsEl) itemsEl.value = item;
  if (price && totalEl) totalEl.value = price;

  form.addEventListener('submit', event => {
    event.preventDefault();

    const submitBtn = form.querySelector('[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    const payload = {
      customerName: document.getElementById('customerName').value,
      contact: document.getElementById('contact').value,
      items: document.getElementById('items').value,
      total: document.getElementById('total').value,
      note: document.getElementById('note').value
    };

    fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify(payload)
    })
    .then(() => { window.location.href = 'thankyou.html'; })
    .catch(error => {
      console.error(error);
      alert('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
      if (submitBtn) submitBtn.disabled = false;
    });
  });
}

/* ==========================================================
   หน้า admin.html
   ต้องมีใน HTML: <table id="ordersTable"><thead>…</thead><tbody></tbody></table>
   คอลัมน์: วันเวลา, ชื่อลูกค้า, เบอร์โทร/Line, รายการสินค้า, จำนวนเงินรวม, หมายเหตุ
   ========================================================== */
function initAdminPage() {
  const tbody = document.querySelector('#ordersTable tbody');
  const COLS = 6;

  function showMessage(text) {
    tbody.textContent = '';
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = COLS;
    td.textContent = text;
    tr.appendChild(td);
    tbody.appendChild(tr);
  }

  showMessage('กำลังโหลดข้อมูล...');

  fetch(CSV_URL)
    .then(res => {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.text();
    })
    .then(text => {
      let rows = parseCSV(text).filter(r => r.some(cell => cell.trim() !== ''));

      // ถ้าแถวแรกเป็นหัวตาราง (คอลัมน์ A ไม่มีตัวเลขเลย) ให้ข้ามไป
      if (rows.length > 0 && !/\d/.test(rows[0][0] || '')) rows.shift();

      if (rows.length === 0) {
        showMessage('ยังไม่มีรายการสั่งซื้อ');
        return;
      }

      // Apps Script เพิ่มแถวใหม่ต่อท้ายเสมอ → กลับลำดับให้ล่าสุดขึ้นก่อน
      rows.reverse();

      tbody.textContent = '';
      rows.forEach(r => {
        const tr = document.createElement('tr');
        for (let i = 0; i < COLS; i++) {
          const td = document.createElement('td');
          td.textContent = r[i] !== undefined ? r[i] : '';
          tr.appendChild(td);
        }
        tbody.appendChild(tr);
      });
    })
    .catch(error => {
      console.error(error);
      showMessage('โหลดข้อมูลไม่สำเร็จ กรุณารีเฟรชหน้าอีกครั้ง');
    });
}

/* ---------- parse CSV (เขียนเอง ไม่ใช้ library) ----------
   รองรับ: ข้อความในเครื่องหมาย "..." , "" แทน " ในข้อความ,
   ขึ้นบรรทัดใหม่ในช่อง, ท้ายบรรทัดแบบ \r\n หรือ \n, และ BOM */
function parseCSV(text) {
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);

  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }

  // แถวสุดท้ายที่ไม่มี newline ปิดท้าย
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

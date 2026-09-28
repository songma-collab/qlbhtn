import { formatMoney } from '../../../utils/helpers';

export function createReceiptElement(doc: Document, record: any, staffName: string, staffId: string): HTMLDivElement {
  const root = doc.createElement('div');
  root.style.cssText = 'font-family:monospace;padding:20px;max-width:300px;margin:auto;color:black;background:white;';
  const add = (tag: string, value: unknown, style = '') => {
    const el = doc.createElement(tag);
    el.textContent = String(value ?? '');
    el.style.cssText = style;
    root.appendChild(el);
  };
  const line = () => { const el = doc.createElement('div'); el.style.cssText = 'border-bottom:1px dashed #000;margin:10px 0;'; root.appendChild(el); };
  const row = (label: string, value: unknown, bold = false) => {
    const el = doc.createElement('div'); el.style.cssText = 'display:flex;justify-content:space-between;margin-bottom:5px;font-size:14px;';
    const left = doc.createElement('span'); left.textContent = label;
    const right = doc.createElement('span'); right.textContent = String(value ?? ''); if (bold) right.style.fontWeight = 'bold';
    el.append(left, right); root.appendChild(el);
  };
  add('h2', 'ĐẠI LÝ BHXH SÔNG MÃ', 'text-align:center;margin:5px 0;font-size:24px;');
  add('p', 'Mã ĐL: VSS-SM-001', 'text-align:center;font-size:12px;margin:5px 0;'); line();
  add('h3', 'BIÊN LAI THU TIỀN', 'text-align:center;margin:5px 0;font-size:18px;');
  add('p', new Date(record.date).toLocaleString('vi-VN'), 'text-align:center;font-size:12px;margin:5px 0;'); line();
  row('Khách hàng:', record.name, true); row('CCCD:', record.cccd); row('Loại dịch vụ:', record.type, true); line();
  row('TỔNG TIỀN:', formatMoney(record.amount), true); line();
  add('p', '(Đã thu tiền mặt/chuyển khoản)\nCảm ơn Quý khách!', 'text-align:center;font-style:italic;font-size:11px;white-space:pre-line;');
  add('p', `NV Thu Tiền\n${staffName}\nMã NV: ${staffId}`, 'text-align:right;font-size:12px;white-space:pre-line;margin-top:15px;');
  return root;
}

export const printReceipt = (record: any, staff: any[]) => {
  const staffMember = staff.find(s => s.id === record.staffId);
  const staffName = staffMember ? staffMember.name : (record.staffId || 'Admin');
  const staffIdDisplay = staffMember ? staffMember.id : (record.staffId || 'admin-1');

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.title = `Biên Lai - ${String(record.name || '')}`;
    printWindow.document.body.replaceChildren(createReceiptElement(printWindow.document, record, staffName, staffIdDisplay));
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 500);
  }
};

export const exportReceiptAsImage = async (
  record: any, 
  staff: any[], 
  showToast: (msg: string) => void, 
  showAlert: (title: string, msg: string, type: string) => void
) => {
  if (!record) return;

  const staffMember = staff.find(s => s.id === record.staffId);
  const staffName = staffMember ? staffMember.name : (record.staffId || 'Admin');
  const staffIdDisplay = staffMember ? staffMember.id : (record.staffId || 'admin-1');

  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '-9999px';
  container.style.width = '300px';
  container.style.padding = '20px';
  container.style.backgroundColor = 'white';
  container.style.color = 'black';
  container.style.fontFamily = 'monospace';
  
  container.appendChild(createReceiptElement(document, record, staffName, staffIdDisplay));
  document.body.appendChild(container);

  try {
    const html2canvas = (await import('html2canvas')).default;
    const canvas = await html2canvas(container, { scale: 2 });
    const imgData = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = imgData;
    link.download = `Bien_Lai_${String(record.name || '').replace(/\s+/g, '_')}_${record.id}.png`;
    link.click();
    showToast('Đã xuất hình ảnh biên lai!');
  } catch (err) {
    console.error(err);
    showAlert('Lỗi', 'Không thể xuất hình ảnh biên lai.', 'error');
  } finally {
    document.body.removeChild(container);
  }
};

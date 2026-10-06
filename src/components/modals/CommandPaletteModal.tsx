import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';
import { Search, User, CreditCard, Plus, ArrowRight, X, Phone } from 'lucide-react';
import { formatDateVN } from '../../utils/helpers';

interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({ isOpen, onClose }) => {
  const { records, setGlobalRegisterModal } = useAppContext();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const filteredRecords = React.useMemo(() => {
    if (!query.trim()) return [];
    const q = query.trim().toLowerCase();
    return (records || [])
      .filter((r) => {
        return (
          r.name?.toLowerCase().includes(q) ||
          r.cccd?.toLowerCase().includes(q) ||
          r.bhxh?.toLowerCase().includes(q) ||
          r.phone?.toLowerCase().includes(q)
        );
      })
      .slice(0, 8);
  }, [records, query]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-gray-100 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="relative flex items-center px-4 py-3.5 border-b border-gray-100 bg-gray-50/50">
          <Search size={20} className="text-gray-400 mr-3 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm nhanh khách hàng (Họ tên, CCCD, Mã BHXH, SĐT) hoặc chọn lệnh..."
            className="w-full bg-transparent text-sm text-gray-800 placeholder-gray-400 outline-none font-medium"
          />
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Results / Commands List */}
        <div className="max-h-96 overflow-y-auto p-2 divide-y divide-gray-50">
          {/* Quick Actions if query is empty */}
          {!query.trim() && (
            <div className="p-2 space-y-1">
              <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider px-2 py-1">
                Lối tắt nhanh
              </div>
              <button
                onClick={() => {
                  onClose();
                  setGlobalRegisterModal({ isOpen: true, type: 'BHXH' });
                }}
                className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-blue-50/70 text-gray-700 hover:text-[#004182] transition cursor-pointer text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 text-[#004182] flex items-center justify-center font-bold">
                    <Plus size={16} />
                  </div>
                  <div>
                    <div className="text-sm font-bold">Đăng ký mới BHXH Tự nguyện</div>
                    <div className="text-xs text-gray-400">Tạo hồ sơ và tính toán mức đóng BHXH</div>
                  </div>
                </div>
                <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded font-mono group-hover:bg-blue-100">Alt+1</span>
              </button>

              <button
                onClick={() => {
                  onClose();
                  setGlobalRegisterModal({ isOpen: true, type: 'BHYT' });
                }}
                className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-sky-50/70 text-gray-700 hover:text-sky-700 transition cursor-pointer text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center font-bold">
                    <Plus size={16} />
                  </div>
                  <div>
                    <div className="text-sm font-bold">Đăng ký mới BHYT Hộ gia đình</div>
                    <div className="text-xs text-gray-400">Tạo hồ sơ tính giảm trừ hộ gia đình</div>
                  </div>
                </div>
                <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded font-mono group-hover:bg-sky-100">Alt+2</span>
              </button>

              <button
                onClick={() => {
                  onClose();
                  navigate('/admin/finance');
                }}
                className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-emerald-50/70 text-gray-700 hover:text-emerald-700 transition cursor-pointer text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                    <CreditCard size={16} />
                  </div>
                  <div>
                    <div className="text-sm font-bold">Quản lý Giao dịch & Thu tiền</div>
                    <div className="text-xs text-gray-400">Xem dòng tiền, hoa hồng và xuất phiếu thu</div>
                  </div>
                </div>
                <ArrowRight size={16} className="text-gray-400" />
              </button>
            </div>
          )}

          {/* Search Results */}
          {query.trim() && (
            <div className="p-2 space-y-1">
              <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider px-2 py-1">
                Kết quả tìm kiếm ({filteredRecords.length})
              </div>
              {filteredRecords.length === 0 ? (
                <div className="py-8 text-center text-gray-400 text-sm">
                  Không tìm thấy hồ sơ khách hàng phù hợp với từ khóa "{query}"
                </div>
              ) : (
                filteredRecords.map((r) => (
                  <button
                    key={r.id || `${r.cccd}-${r.date}`}
                    onClick={() => {
                      onClose();
                      navigate(`/admin/${r.type?.toLowerCase() || 'crm'}`);
                    }}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-gray-50 text-left transition cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center font-bold shrink-0">
                        <User size={16} />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-gray-900 flex items-center gap-2">
                          {r.name}
                          <span
                            className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded ${
                              r.type === 'BHXH' ? 'bg-blue-100 text-blue-700' : 'bg-sky-100 text-sky-700'
                            }`}
                          >
                            {r.type}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 flex items-center gap-3 mt-0.5">
                          <span>CCCD: <strong className="text-gray-700">{r.cccd || r.bhxh || '---'}</strong></span>
                          {r.phone && (
                            <span className="flex items-center gap-1">
                              <Phone size={10} /> {r.phone}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-semibold text-gray-500 block">
                        Hạn: {formatDateVN(r.next_payment || (r as any).nextPayment) || '---'}
                      </span>
                      <span className="text-[10px] font-bold text-emerald-600">
                        {r.status || 'Đang tham gia'}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer shortcuts info */}
        <div className="px-4 py-2.5 bg-gray-50 text-[11px] text-gray-500 flex items-center justify-between border-t border-gray-100">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="px-1.5 py-0.5 bg-white border border-gray-200 rounded font-mono text-[10px] shadow-2xs">ESC</kbd> Đóng
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-white border border-gray-200 rounded font-mono text-[10px] shadow-2xs">Ctrl + K</kbd> Mở tìm kiếm
            </span>
          </div>
          <span className="text-gray-400">Quản lý BHXH / BHYT Pro</span>
        </div>
      </div>
    </div>
  );
};

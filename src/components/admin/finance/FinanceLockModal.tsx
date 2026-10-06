import React from 'react';
import { Lock, Unlock, AlertTriangle } from 'lucide-react';

interface FinanceLockModalProps {
  isOpen: boolean;
  onClose: () => void;
  lockActionType: 'lock' | 'unlock';
  currentPeriodLabel: string;
  targetUnlockKey: string;
  formattedLockedList: Array<{ key: string; label: string; sortVal: number }>;
  executeLockCurrent: () => void;
  executeUnlockKeys: (keys: string[]) => void;
}

export const FinanceLockModal: React.FC<FinanceLockModalProps> = ({
  isOpen,
  onClose,
  lockActionType,
  currentPeriodLabel,
  targetUnlockKey,
  formattedLockedList,
  executeLockCurrent,
  executeUnlockKeys
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-[#004182]/60 backdrop-blur-sm z-[250] flex items-center justify-center p-4 transition-all">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all border border-gray-100 animate-in fade-in zoom-in duration-200">
        <div className="p-6 sm:p-8 text-center">
          {lockActionType === 'lock' ? (
            <>
              <div className="w-20 h-20 rounded-full mx-auto flex items-center justify-center mb-5 bg-amber-100 text-amber-600 ring-8 ring-amber-50">
                <Lock size={38} />
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-[#004182] mb-3">
                Khóa Dữ Liệu {currentPeriodLabel}
              </h3>
              <div className="bg-gray-50 p-4 rounded-2xl mb-6 text-left border border-gray-100">
                <div className="text-gray-700 text-xs sm:text-sm leading-relaxed font-medium">
                  Bạn đang chuẩn bị <strong className="text-amber-600 font-bold">KHÓA DỮ LIỆU</strong> cho <strong className="text-gray-900 font-bold">{currentPeriodLabel}</strong>.
                  <p className="text-gray-500 text-xs mt-2 pt-2 border-t border-gray-200/60 leading-normal">
                    • Sau khi khóa, toàn bộ hồ sơ giao dịch trong kỳ này sẽ được bảo vệ an toàn. Mọi thao tác sửa hoặc xóa dữ liệu sẽ bị vô hiệu hóa.
                  </p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button 
                  type="button" 
                  onClick={onClose} 
                  className="w-full sm:w-1/2 py-3 px-4 rounded-xl text-gray-600 font-bold bg-gray-100 hover:bg-gray-200 transition text-sm cursor-pointer border-none"
                >
                  Hủy thao tác
                </button>
                <button 
                  type="button" 
                  onClick={executeLockCurrent} 
                  className="w-full sm:w-1/2 py-3 px-4 rounded-xl text-white font-bold transition shadow-lg flex items-center justify-center gap-2 text-sm cursor-pointer border-none bg-gradient-to-r from-amber-600 to-slate-800 hover:from-amber-700 hover:to-slate-900"
                >
                  <Lock size={18} /> Xác Nhận Khóa
                </button>
              </div>
            </>
          ) : (
            (() => {
              const targetKey = targetUnlockKey || formattedLockedList[0]?.key || '';
              const targetItem = formattedLockedList.find(x => x.key === targetKey);
              const latestItem = formattedLockedList[0];
              const isLatest = targetKey === latestItem?.key;

              const intermediateItems = formattedLockedList.filter(x => x.sortVal >= (targetItem?.sortVal || 0));
              const intermediateKeys = intermediateItems.map(x => x.key);
              const newerLabels = intermediateItems.slice(0, -1).map(x => x.label).join(', ');

              return (
                <>
                  <div className="w-20 h-20 rounded-full mx-auto flex items-center justify-center mb-5 bg-emerald-100 text-emerald-600 ring-8 ring-emerald-50">
                    <Unlock size={38} />
                  </div>
                  <h3 className="text-xl sm:text-2xl font-black text-[#004182] mb-3">
                    Mở Khóa Dữ Liệu {targetItem?.label || ''}
                  </h3>

                  {isLatest || formattedLockedList.length <= 1 ? (
                    <>
                      <div className="bg-gray-50 p-4 rounded-2xl mb-6 text-left border border-gray-100">
                        <div className="text-gray-700 text-xs sm:text-sm leading-relaxed font-medium">
                          Bạn đang chuẩn bị <strong className="text-emerald-600 font-bold">MỞ KHÓA</strong> dữ liệu cho <strong className="text-gray-900 font-bold">{targetItem?.label}</strong>.
                          <p className="text-gray-500 text-xs mt-2 pt-2 border-t border-gray-200/60 leading-normal">
                            • Sau khi mở khóa, các nhân viên có thể thực hiện chỉnh sửa, cập nhật hoặc xóa dữ liệu bình thường.
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-3 justify-center">
                        <button 
                          type="button" 
                          onClick={onClose} 
                          className="w-full sm:w-1/2 py-3 px-4 rounded-xl text-gray-600 font-bold bg-gray-100 hover:bg-gray-200 transition text-sm cursor-pointer border-none"
                        >
                          Hủy thao tác
                        </button>
                        <button 
                          type="button" 
                          onClick={() => executeUnlockKeys([targetKey])} 
                          className="w-full sm:w-1/2 py-3 px-4 rounded-xl text-white font-bold transition shadow-lg flex items-center justify-center gap-2 text-sm cursor-pointer border-none bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700"
                        >
                          <Unlock size={18} /> Mở Khóa Ngay
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="bg-amber-50 p-4 rounded-2xl mb-6 text-left border border-amber-200">
                        <h5 className="font-bold text-amber-900 text-xs sm:text-sm mb-1.5 flex items-center gap-1.5 font-sans">
                          <AlertTriangle size={16} className="text-amber-600 shrink-0" />
                          Yêu cầu quy tắc thứ tự mở khóa:
                        </h5>
                        <p className="text-amber-800 text-xs sm:text-sm leading-relaxed font-medium">
                          Bạn đang chọn mở khóa <strong className="text-amber-950 font-bold">{targetItem?.label}</strong>.
                          <br />
                          Hiện tại các kỳ gần hơn (<strong className="text-amber-950 font-bold">{newerLabels}</strong>) đang được khóa.
                        </p>
                        <p className="text-xs text-amber-700 mt-2 pt-2 border-t border-amber-200/70 font-medium">
                          • Theo quy định kế toán, bạn phải mở khóa lần lượt các kỳ gần nhất trước.
                        </p>
                      </div>

                      <div className="flex flex-col gap-2.5">
                        <button 
                          type="button" 
                          onClick={() => executeUnlockKeys(intermediateKeys)} 
                          className="w-full py-3 px-4 rounded-xl text-white font-bold transition shadow-md flex items-center justify-center gap-2 text-xs sm:text-sm cursor-pointer border-none bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700"
                        >
                          <Unlock size={16} /> Mở khóa tất cả từ {latestItem?.label} đến {targetItem?.label}
                        </button>
                        <button 
                          type="button" 
                          onClick={() => latestItem && executeUnlockKeys([latestItem.key])} 
                          className="w-full py-2.5 px-4 rounded-xl text-emerald-800 font-bold transition bg-emerald-100 hover:bg-emerald-200 flex items-center justify-center gap-2 text-xs sm:text-sm cursor-pointer border border-emerald-300"
                        >
                          <Unlock size={16} /> Mở khóa kỳ gần nhất ({latestItem?.label})
                        </button>
                        <button 
                          type="button" 
                          onClick={onClose} 
                          className="w-full py-2.5 px-4 rounded-xl text-gray-500 font-bold hover:bg-gray-100 transition text-xs cursor-pointer border-none"
                        >
                          Hủy thao tác
                        </button>
                      </div>
                    </>
                  )}
                </>
              );
            })()
          )}
        </div>
      </div>
    </div>
  );
};

export default FinanceLockModal;

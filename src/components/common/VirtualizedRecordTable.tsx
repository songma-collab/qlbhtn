import React, { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { UserCheck, Eye, QrCode, UserPlus, Copy, Zap, Edit, Trash2, Phone, History } from 'lucide-react';
import { CustomerStatusBadge, CustomerParticipationBadge } from './CustomerStatusBadge';
import { formatDateVN } from '../../utils/helpers';
import { RecordType } from '../../context/types';

interface VirtualizedRecordTableProps {
  records: RecordType[];
  selectedIds: number[];
  onSelectRow: (id: number) => void;
  onSelectAll: (selected: boolean) => void;
  onStatusClick: (record: RecordType) => void;
  onParticipationClick?: (record: RecordType) => void;
  onViewHistory: (record: RecordType) => void;
  onVietQrClick: (record: RecordType) => void;
  onAssignClick: (id: number) => void;
  onCopyZalo: (record: RecordType) => void;
  onExtendClick: (record: RecordType) => void;
  onEditClick: (record: RecordType) => void;
  onDeleteClick: (id: number) => void;
  currentUserRole?: string;
}

export const VirtualizedRecordTable: React.FC<VirtualizedRecordTableProps> = ({
  records,
  selectedIds,
  onSelectRow,
  onSelectAll,
  onStatusClick,
  onParticipationClick,
  onViewHistory,
  onVietQrClick,
  onAssignClick,
  onCopyZalo,
  onExtendClick,
  onEditClick,
  onDeleteClick,
  currentUserRole,
}) => {
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: records.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64,
    overscan: 10,
  });

  const allSelected = records.length > 0 && records.every(r => r.id && selectedIds.includes(r.id));

  if (records.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500 bg-white rounded-2xl border border-gray-100">
        Không tìm thấy hồ sơ nào phù hợp.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-6">
      {/* Header Bar */}
      <div className="bg-[#004182] text-white font-semibold text-sm grid grid-cols-12 px-4 py-3 items-center">
        <div className="col-span-1 flex items-center justify-center">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={(e) => onSelectAll(e.target.checked)}
            className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
          />
        </div>
        <div className="col-span-3 font-semibold">Họ & Tên</div>
        <div className="col-span-2 font-semibold">Số ĐDCN / CCCD</div>
        <div className="col-span-1 font-semibold">Loại</div>
        <div className="col-span-2 font-semibold">Hạn tiếp theo</div>
        <div className="col-span-1 font-semibold">Trạng thái</div>
        <div className="col-span-2 font-semibold text-right pr-2">Thao tác</div>
      </div>

      {/* Virtualized Scrollable Viewport */}
      <div
        ref={parentRef}
        className="overflow-y-auto max-h-[620px] divide-y divide-gray-100 relative w-full"
        style={{ contain: 'strict' }}
      >
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const r = records[virtualRow.index];
            const isSelected = r.id ? selectedIds.includes(r.id) : false;
            const rawCccd = r.cccd || r.bhxh || '';

            return (
              <div
                key={virtualRow.key}
                data-index={virtualRow.index}
                ref={rowVirtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                className={`grid grid-cols-12 px-4 py-3 items-center text-sm transition hover:bg-gray-50/80 ${
                  isSelected ? 'bg-blue-50/60' : 'bg-white'
                }`}
              >
                {/* Checkbox */}
                <div className="col-span-1 flex items-center justify-center">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => r.id && onSelectRow(r.id)}
                    disabled={!r.id}
                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                  />
                </div>

                {/* Name & Phone */}
                <div className="col-span-3">
                  <span className="font-semibold text-gray-800 block truncate">{r.name}</span>
                  <span className="text-xs text-gray-500 font-normal flex items-center mt-0.5">
                    <Phone size={11} className="mr-1 text-gray-400 shrink-0" />
                    {r.phone || '---'}
                  </span>
                  {r.notes && (
                    <span className="text-[11px] text-gray-500 font-normal block truncate max-w-[240px] mt-0.5" title={r.notes}>
                      <strong className="text-gray-600">Ghi chú:</strong> {r.notes}
                    </span>
                  )}
                </div>

                {/* CCCD */}
                <div className="col-span-2 text-gray-900 font-medium">
                  {rawCccd || '---'}
                </div>

                {/* Type */}
                <div className="col-span-1">
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-bold ${
                      r.type === 'BHXH' ? 'bg-blue-100 text-[#004182]' : 'bg-sky-100 text-sky-700'
                    }`}
                  >
                    {r.type}
                  </span>
                </div>

                {/* Date & Badge */}
                <div className="col-span-2">
                  <span className="text-gray-600 font-medium block text-xs">
                    {formatDateVN(r.nextPayment) || '---'}
                  </span>
                  <div className="mt-1">
                    <CustomerStatusBadge paymentStatus={r.paymentStatus} nextPayment={r.nextPayment} />
                  </div>
                </div>

                {/* Status */}
                <div className="col-span-1">
                  <CustomerParticipationBadge
                    status={r.status || 'Đang tham gia'}
                    interactive={Boolean(r.id)}
                    onClick={() => r.id && onStatusClick(r)}
                  />
                </div>

                {/* Actions */}
                <div className="col-span-2 flex items-center justify-end gap-1.5 pr-2">
                  <button
                    onClick={() => r.id && onStatusClick(r)}
                    disabled={!r.id}
                    className="p-1 text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded transition"
                    title="Đổi trạng thái"
                  >
                    <UserCheck size={15} />
                  </button>
                  {onParticipationClick && (
                    <button
                      onClick={() => onParticipationClick(r)}
                      disabled={!r.id}
                      className="p-1 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded transition"
                      title="Hồ sơ tham gia trước đây"
                    >
                      <History size={15} />
                    </button>
                  )}
                  <button
                    onClick={() => onViewHistory(r)}
                    disabled={!r.id}
                    className="p-1 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded transition"
                    title="Xem lịch sử tra cứu"
                  >
                    <Eye size={15} />
                  </button>
                  <button
                    onClick={() => onVietQrClick(r)}
                    disabled={!r.id}
                    className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition"
                    title="Mã VietQR nộp tiền"
                  >
                    <QrCode size={15} />
                  </button>
                  {currentUserRole !== 'Nhân viên' && (
                    <button
                      onClick={() => r.id && onAssignClick(r.id)}
                      disabled={!r.id}
                      className="p-1 text-purple-500 hover:text-purple-600 hover:bg-purple-50 rounded transition"
                      title="Phân công"
                    >
                      <UserPlus size={15} />
                    </button>
                  )}
                  <button
                    onClick={() => r.id && onCopyZalo(r)}
                    disabled={!r.id}
                    className="p-1 text-green-500 hover:text-green-600 hover:bg-green-50 rounded transition"
                    title="Copy tin nhắn Zalo"
                  >
                    <Copy size={15} />
                  </button>
                  <button
                    onClick={() => r.id && onExtendClick(r)}
                    disabled={!r.id}
                    className="p-1 text-amber-500 hover:text-amber-600 hover:bg-amber-50 rounded transition"
                    title="Gia hạn"
                  >
                    <Zap size={15} />
                  </button>
                  <button
                    onClick={() => r.id && onEditClick(r)}
                    disabled={!r.id}
                    className="p-1 text-sky-600 hover:text-sky-700 hover:bg-sky-50 rounded transition"
                    title="Chỉnh sửa"
                  >
                    <Edit size={15} />
                  </button>
                  <button
                    onClick={() => r.id && onDeleteClick(r.id)}
                    disabled={!r.id}
                    className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition"
                    title="Xóa"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Footer Info */}
      <div className="bg-gray-50 px-4 py-2 text-xs text-gray-500 border-t border-gray-100 flex justify-between items-center">
        <span>⚡ Chế độ tối ưu Virtualization: Hiển thị mượt mà <strong>{records.length}</strong> bản ghi</span>
        <span>Đã chọn: <strong>{selectedIds.length}</strong></span>
      </div>
    </div>
  );
};

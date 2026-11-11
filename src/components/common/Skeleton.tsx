import React from 'react';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

/**
 * Atomic Primitive Skeleton với hiệu ứng Shimmer lướt sóng ánh sáng êm dịu (CLS = 0)
 */
export const Skeleton: React.FC<SkeletonProps> = ({ className = '', ...props }) => {
  return (
    <div
      aria-hidden="true"
      className={`skeleton-shimmer rounded-md ${className}`}
      {...props}
    />
  );
};

/**
 * Skeleton mô phỏng Bảng Danh bạ Khách hàng CRM chuẩn xác từng cột
 */
export const CustomerTableSkeleton: React.FC<{ rows?: number }> = ({ rows = 6 }) => {
  return (
    <div className="w-full overflow-hidden" role="status" aria-label="Đang tải dữ liệu bảng...">
      {/* Table Header Placeholder */}
      <div className="hidden md:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-100/90 text-slate-700 font-bold border-b border-slate-300 text-xs uppercase tracking-wider">
            <tr>
              <th className="p-4 w-12 text-center">
                <Skeleton className="w-4 h-4 mx-auto rounded" />
              </th>
              <th className="p-4">Họ & Tên Khách Hàng</th>
              <th className="p-4">Số ĐDCN / CCCD</th>
              <th className="p-4">Số Điện Thoại</th>
              <th className="p-4">Kỳ đóng</th>
              <th className="p-4">Hạn đóng tiếp</th>
              <th className="p-4">Trạng Thái Đóng</th>
              <th className="p-4">Trạng Thái KH</th>
              <th className="p-4 text-center whitespace-nowrap">THAO TÁC</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {Array.from({ length: rows }).map((_, idx) => (
              <tr key={`skel-row-${idx}`} className="border-b border-slate-100">
                {/* Checkbox */}
                <td className="p-4 text-center">
                  <Skeleton className="w-4 h-4 mx-auto rounded" />
                </td>
                {/* Họ tên */}
                <td className="p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-36 rounded" />
                    <Skeleton className="h-4 w-10 rounded" />
                  </div>
                  <Skeleton className="h-3 w-24 rounded" />
                </td>
                {/* CCCD */}
                <td className="p-4 space-y-1.5">
                  <Skeleton className="h-4 w-28 rounded" />
                  <Skeleton className="h-3 w-20 rounded" />
                </td>
                {/* Phone */}
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <Skeleton className="w-3.5 h-3.5 rounded-full" />
                    <Skeleton className="h-4 w-24 rounded" />
                  </div>
                </td>
                {/* Kỳ đóng */}
                <td className="p-4">
                  <Skeleton className="h-4 w-24 rounded" />
                </td>
                {/* Hạn đóng tiếp */}
                <td className="p-4">
                  <Skeleton className="h-4 w-20 rounded" />
                </td>
                {/* Trạng thái đóng */}
                <td className="p-4">
                  <Skeleton className="h-6 w-24 rounded-full" />
                </td>
                {/* Trạng thái KH */}
                <td className="p-4">
                  <Skeleton className="h-6 w-28 rounded-full" />
                </td>
                {/* Thao tác */}
                <td className="p-4">
                  <div className="flex items-center justify-center gap-2">
                    <Skeleton className="w-7 h-7 rounded-lg" />
                    <Skeleton className="w-7 h-7 rounded-lg" />
                    <Skeleton className="w-7 h-7 rounded-lg" />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card Skeleton Placeholder */}
      <div className="md:hidden divide-y divide-slate-100 p-3 space-y-3">
        {Array.from({ length: Math.min(rows, 4) }).map((_, idx) => (
          <div key={`skel-mob-${idx}`} className="p-4 bg-white rounded-xl border border-slate-200/80 space-y-3">
            <div className="flex justify-between items-start">
              <div className="flex items-start gap-2.5">
                <Skeleton className="w-4 h-4 mt-1 rounded" />
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-32 rounded" />
                  <Skeleton className="h-3 w-20 rounded" />
                </div>
              </div>
              <Skeleton className="h-5 w-12 rounded-md" />
            </div>
            <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200/60">
              <Skeleton className="h-8 rounded-lg" />
              <Skeleton className="h-8 rounded-lg" />
              <Skeleton className="h-8 rounded-lg" />
              <Skeleton className="h-8 rounded-lg" />
            </div>
            <div className="flex justify-between items-center pt-1">
              <Skeleton className="h-6 w-24 rounded-full" />
              <div className="flex gap-1.5">
                <Skeleton className="w-7 h-7 rounded-lg" />
                <Skeleton className="w-7 h-7 rounded-lg" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Skeleton mô phỏng Danh bạ Thẻ đối tượng (Directory Cards View)
 */
export const CustomerDirectorySkeleton: React.FC<{ count?: number }> = ({ count = 6 }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 p-4" role="status" aria-label="Đang tải danh bạ thẻ...">
      {Array.from({ length: count }).map((_, idx) => (
        <div key={`skel-card-${idx}`} className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Skeleton className="w-10 h-10 rounded-full" />
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-28 rounded" />
                <Skeleton className="h-3 w-20 rounded" />
              </div>
            </div>
            <Skeleton className="h-5 w-12 rounded-md" />
          </div>
          <div className="space-y-2 py-1 border-t border-b border-slate-100">
            <div className="flex justify-between">
              <Skeleton className="h-3 w-16 rounded" />
              <Skeleton className="h-3 w-28 rounded" />
            </div>
            <div className="flex justify-between">
              <Skeleton className="h-3 w-20 rounded" />
              <Skeleton className="h-3 w-24 rounded" />
            </div>
          </div>
          <div className="flex justify-between items-center pt-1">
            <Skeleton className="h-6 w-24 rounded-full" />
            <div className="flex gap-1">
              <Skeleton className="w-7 h-7 rounded-lg" />
              <Skeleton className="w-7 h-7 rounded-lg" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

/**
 * Skeleton mô phỏng Trung Tâm Điều Hành & Bảng Điều Khiển (Dashboard)
 */
export const DashboardSkeleton: React.FC = () => {
  return (
    <div className="space-y-5 animate-tab-fade" role="status" aria-label="Đang tải trung tâm điều hành...">
      {/* Top Filter Bar Placeholder */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-2">
          <Skeleton className="h-6 w-64 rounded-md" />
          <Skeleton className="h-4 w-96 rounded-md" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-32 rounded-xl" />
          <Skeleton className="h-9 w-24 rounded-xl" />
        </div>
      </div>

      {/* 4 KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div key={`skel-kpi-${idx}`} className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-28 rounded" />
              <Skeleton className="w-9 h-9 rounded-xl" />
            </div>
            <Skeleton className="h-8 w-36 rounded-md" />
            <Skeleton className="h-3 w-44 rounded" />
          </div>
        ))}
      </div>

      {/* Leaderboard Banner Placeholder */}
      <div className="bg-slate-200/70 skeleton-shimmer rounded-2xl h-16 w-full" />

      {/* 2 Main Chart Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Bar Chart Panel */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <div className="space-y-1.5">
              <Skeleton className="h-5 w-48 rounded" />
              <Skeleton className="h-3 w-64 rounded" />
            </div>
            <Skeleton className="h-8 w-32 rounded-lg" />
          </div>
          <div className="h-64 flex items-end justify-between gap-4 pt-6 px-4">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div key={`skel-bar-${idx}`} className="flex-1 flex flex-col items-center gap-2">
                <Skeleton className={`w-full rounded-t-lg h-[${40 + (idx % 3) * 35}%]`} style={{ height: `${35 + (idx * 11) % 55}%` }} />
                <Skeleton className="h-3 w-10 rounded" />
              </div>
            ))}
          </div>
        </div>

        {/* Donut Chart Panel */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-4 flex flex-col justify-between">
          <div className="border-b border-slate-100 pb-3 space-y-1.5">
            <Skeleton className="h-5 w-36 rounded" />
            <Skeleton className="h-3 w-48 rounded" />
          </div>
          <div className="flex items-center justify-center py-6">
            <Skeleton className="w-44 h-44 rounded-full border-8 border-slate-100" />
          </div>
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <div className="flex justify-between">
              <Skeleton className="h-3 w-24 rounded" />
              <Skeleton className="h-3 w-10 rounded" />
            </div>
            <div className="flex justify-between">
              <Skeleton className="h-3 w-28 rounded" />
              <Skeleton className="h-3 w-10 rounded" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Module Loading Fallback thông minh theo từng tab quản trị
 */
export const ModuleLoadingSkeleton: React.FC<{ tab?: string }> = ({ tab }) => {
  if (tab === 'dashboard') {
    return <DashboardSkeleton />;
  }
  if (tab?.startsWith('crm-') || tab?.startsWith('finance-')) {
    return (
      <div className="space-y-4 animate-tab-fade">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex justify-between items-center">
          <div className="space-y-2">
            <Skeleton className="h-6 w-56 rounded" />
            <Skeleton className="h-4 w-80 rounded" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-28 rounded-xl" />
            <Skeleton className="h-9 w-32 rounded-xl" />
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <CustomerTableSkeleton rows={8} />
        </div>
      </div>
    );
  }

  // Generic fallback cho các phân hệ khác (Báo cáo, Cấu hình, Nhân viên...)
  return (
    <div className="space-y-4 animate-tab-fade">
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-2">
        <Skeleton className="h-6 w-60 rounded" />
        <Skeleton className="h-4 w-96 rounded" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Skeleton className="h-28 rounded-2xl bg-white border border-slate-200" />
        <Skeleton className="h-28 rounded-2xl bg-white border border-slate-200" />
        <Skeleton className="h-28 rounded-2xl bg-white border border-slate-200" />
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-xs">
        <Skeleton className="h-5 w-40 rounded" />
        <Skeleton className="h-4 w-full rounded" />
        <Skeleton className="h-4 w-5/6 rounded" />
        <Skeleton className="h-4 w-3/4 rounded" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    </div>
  );
};

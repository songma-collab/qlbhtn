import React from 'react';
import { BarChart3, PieChart } from 'lucide-react';
import { Bar, Doughnut } from 'react-chartjs-2';
import { formatMoney } from '../../../utils/helpers';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

export interface FinancialChartsStatsProps {
  bhxhNewRevenue: number;
  bhytNewRevenue: number;
  bhxhRenewRevenue: number;
  bhytRenewRevenue: number;
  totalPayToBHXH: number;
  totalStaffCommission: number;
  totalRefund: number;
}

interface FinancialSettlementChartsProps {
  financialStats: FinancialChartsStatsProps;
}

export const FinancialSettlementCharts: React.FC<FinancialSettlementChartsProps> = ({
  financialStats
}) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      {/* Chart 1: Doanh thu theo loại hình & đối tượng */}
      <div className="lg:col-span-2 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[#004182]" />
                <span>Cơ Cấu Doanh Thu Tăng Mới vs Gia Hạn (VNĐ)</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">So sánh doanh số thực thu theo loại hình BHXH và BHYT</p>
            </div>
          </div>
          <div className="h-64">
            <Bar
              data={{
                labels: ['BHXH Tự Nguyện', 'BHYT Hộ Gia Đình'],
                datasets: [
                  {
                    label: 'Tăng Mới / Đăng Ký Mới',
                    data: [financialStats.bhxhNewRevenue, financialStats.bhytNewRevenue],
                    backgroundColor: '#004182',
                    borderRadius: 6,
                  },
                  {
                    label: 'Gia Hạn / Đóng Tiếp',
                    data: [financialStats.bhxhRenewRevenue, financialStats.bhytRenewRevenue],
                    backgroundColor: '#10b981',
                    borderRadius: 6,
                  }
                ]
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { 
                    position: 'top' as const,
                    labels: {
                      boxWidth: 12,
                      usePointStyle: true,
                      pointStyle: 'circle',
                      font: { size: 11, weight: 'bold' }
                    }
                  },
                  tooltip: {
                    callbacks: {
                      label: (context) => ` ${context.dataset.label}: ${formatMoney(Number(context.raw))}`
                    }
                  }
                },
                scales: {
                  x: {
                    grid: { display: false }
                  },
                  y: {
                    grid: { color: '#f1f5f9' },
                    ticks: {
                      callback: (value) => formatMoney(Number(value)),
                      font: { size: 11 }
                    }
                  }
                }
              }}
            />
          </div>
        </div>
      </div>

      {/* Chart 2: Dòng tiền Vào - Ra */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <PieChart className="w-4 h-4 text-indigo-600" />
                <span>Phân Bổ Dòng Tiền Thu Vào</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Tỷ lệ nộp BHXH, hoa hồng và thoái thu</p>
            </div>
          </div>
          <div className="h-52 flex items-center justify-center">
            <Doughnut
              data={{
                labels: ['Nộp Cơ Quan BHXH', 'Hoa Hồng Cán Bộ', 'Thoái Thu Hoàn Tiền'],
                datasets: [
                  {
                    data: [
                      financialStats.totalPayToBHXH,
                      financialStats.totalStaffCommission,
                      financialStats.totalRefund
                    ],
                    backgroundColor: ['#004182', '#f59e0b', '#ef4444'],
                    borderWidth: 0,
                  }
                ]
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { 
                    position: 'bottom' as const,
                    labels: {
                      boxWidth: 10,
                      usePointStyle: true,
                      font: { size: 11 }
                    }
                  },
                  tooltip: {
                    callbacks: {
                      label: (context) => ` ${context.label}: ${formatMoney(Number(context.raw))}`
                    }
                  }
                }
              }}
            />
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-600 space-y-1.5 font-mono tabular-nums">
          <div className="flex justify-between items-center">
            <span className="text-slate-500 font-sans">Nộp BHXH:</span>
            <b className="text-[#004182]">{formatMoney(financialStats.totalPayToBHXH)}</b>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-500 font-sans">Chi Trả Cán Bộ:</span>
            <b className="text-amber-600">{formatMoney(financialStats.totalStaffCommission)}</b>
          </div>
          {financialStats.totalRefund > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-sans">Thoái thu hoàn trả:</span>
              <b className="text-rose-600">-{formatMoney(financialStats.totalRefund)}</b>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

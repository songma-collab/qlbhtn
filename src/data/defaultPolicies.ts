import { Policy } from '../context/types';

/**
 * Danh sách 8 quyết định / chính sách hệ thống cốt lõi theo Luật BHXH 2024 & các Nghị định ban hành
 * (Tập trung tối ưu đúng 5 nhóm tham số chính sách của hệ thống)
 * 1. Mức lương cơ sở (NĐ 73/2024, NĐ 161/2026)
 * 2. Chuẩn nghèo nông thôn (NĐ 07/2021/NĐ-CP)
 * 3. Cài đặt Tỷ lệ Hoa hồng đại lý (QĐ 11/QĐ-BHXH, QĐ điều chỉnh 2026)
 * 4. Lãi suất đầu tư quỹ (Công văn 151/BHXH-ĐTQ & 59/TB-BHXH)
 * 5. Hệ số trượt giá JSON BHXH (Thông tư 01/2025/TT-BLĐTBXH & CV 340/BHXH-CSXH 2026)
 */
export const DEFAULT_SYSTEM_POLICIES: Policy[] = [
  // 1. MỨC LƯƠNG CƠ SỞ
  {
    id: 1,
    parameter_type: 'base_salary',
    name: 'Nghị định 73/2024/NĐ-CP',
    value: 2340000,
    effective_date: '2024-07-01',
    description: 'Quy định mức lương cơ sở đối với cán bộ, công chức, viên chức và lực lượng vũ trang (2.340.000 đồng/tháng)',
    notes: 'Quy định mức lương cơ sở đối với cán bộ, công chức, viên chức và lực lượng vũ trang (2.340.000 đồng/tháng)',
    is_active: false,
    created_at: '2026-07-23 16:01:22.912539+00'
  },
  {
    id: 2,
    parameter_type: 'base_salary',
    name: 'Nghị định số 161/2026/NĐ-CP',
    value: 2530000,
    effective_date: '2026-07-01',
    description: 'NĐ 161/2026/NĐ-CP ngày 15/5/2026 quy định mức lương cơ sở mới và chế độ tiền thưởng (2.530.000 đồng/tháng)',
    notes: 'NĐ 161/2026/NĐ-CP ngày 15/5/2026 quy định mức lương cơ sở mới và chế độ tiền thưởng (2.530.000 đồng/tháng)',
    is_active: true,
    created_at: '2026-07-23 16:01:22.912539+00'
  },

  // 2. CHUẨN NGHÈO NÔNG THÔN
  {
    id: 3,
    parameter_type: 'poverty_standard',
    name: 'Chuẩn nghèo nông thôn 2026',
    value: 1500000,
    effective_date: '2026-01-01',
    description: 'Điều 3 Nghị định 07/2021/NĐ-CP quy định chuẩn nghèo đa chiều giai đoạn 2022-2025 và áp dụng 2026 (1.500.000 đồng/tháng)',
    notes: 'Điều 3 Nghị định 07/2021/NĐ-CP quy định chuẩn nghèo đa chiều giai đoạn 2022-2025 và áp dụng 2026 (1.500.000 đồng/tháng)',
    is_active: true,
    created_at: '2026-07-23 16:01:22.912539+00'
  },

  // 3. TỶ LỆ HOA HỒNG ĐẠI LÝ
  {
    id: 4,
    parameter_type: 'commission',
    name: 'Quyết định 11/QĐ-BHXH (Cũ)',
    value: {
      commBHXHNew: 5,
      commBHYTNew: 5,
      commBHXHRenew: 3,
      commBHYTRenew: 3
    },
    effective_date: '2026-01-01',
    description: 'Quyết định 11/QĐ-BHXH mức chi thù lao đại lý: BHXH mới 5%, gia hạn 3%; BHYT mới 5%, gia hạn 3%',
    notes: 'Quyết định 11/QĐ-BHXH mức chi thù lao đại lý: BHXH mới 5%, gia hạn 3%; BHYT mới 5%, gia hạn 3%',
    is_active: false,
    created_at: '2026-07-23 16:01:22.912539+00'
  },
  {
    id: 5,
    parameter_type: 'commission',
    name: 'Cài đặt Tỷ lệ Hoa hồng đại lý 2026',
    value: {
      commBHXHNew: 20,
      commBHXHRenew: 9,
      commBHYTNew: 9,
      commBHYTRenew: 5,
      commBHXHNew1M: 12,
      commBHXHNew3M: 15,
      commBHXHNew6M: 17,
      commBHXHNew12M: 20
    },
    effective_date: '2026-08-01',
    description: 'Cơ chế tỷ lệ hoa hồng đại lý: BHXH mới (1T: 12%, 3T: 15%, 6T: 17%, 12T: 20%); BHXH gia hạn: 9%; BHYT mới: 9%, gia hạn: 5%',
    notes: 'Cơ chế tỷ lệ hoa hồng đại lý: BHXH mới (1T: 12%, 3T: 15%, 6T: 17%, 12T: 20%); BHXH gia hạn: 9%; BHYT mới: 9%, gia hạn: 5%',
    is_active: true,
    created_at: '2026-07-30 11:25:35.325719+00'
  },

  // 4. LÃI SUẤT ĐẦU TƯ QUỸ
  {
    id: 6,
    parameter_type: 'investment_rate',
    name: 'Quyết định điều chỉnh Lãi suất đầu tư quỹ 2026',
    value: 0.31,
    effective_date: '2026-01-01',
    description: 'Công văn 151/BHXH-ĐTQ và Công văn 59/TB-BHXH lãi suất đầu tư quỹ 0.31%/tháng',
    notes: 'Công văn 151/BHXH-ĐTQ và Công văn 59/TB-BHXH lãi suất đầu tư quỹ 0.31%/tháng',
    is_active: true,
    created_at: '2026-07-23 16:01:22.912539+00'
  },

  // 5. HỆ SỐ TRƯỢT GIÁ (JSON BHXH)
  {
    id: 7,
    parameter_type: 'cpi_index',
    name: 'Thông tư điều chỉnh Hệ số trượt giá (JSON BHXH) 2025',
    value: {
      "1994": 5.81, "1995": 4.91, "1996": 4.65, "1997": 4.5, "1998": 4.18, "1999": 4.01,
      "2000": 4.07, "2001": 4.09, "2002": 3.94, "2003": 3.81, "2004": 3.54, "2005": 3.27,
      "2006": 3.05, "2007": 2.81, "2008": 2.29, "2009": 2.14, "2010": 1.96, "2011": 1.65,
      "2012": 1.51, "2013": 1.42, "2014": 1.36, "2015": 1.36, "2016": 1.32, "2017": 1.28,
      "2018": 1.23, "2019": 1.2, "2020": 1.16, "2021": 1.14, "2022": 1.11, "2023": 1.07,
      "2024": 1.03, "2025": 1
    },
    effective_date: '2025-01-01',
    description: 'Thông tư số 01/2025/TT-BLĐTBXH ngày 10/1/2025 điều chỉnh tiền lương và thu nhập đã đóng BHXH',
    notes: 'Thông tư số 01/2025/TT-BLĐTBXH ngày 10/1/2025 điều chỉnh tiền lương và thu nhập đã đóng BHXH',
    is_active: false,
    created_at: '2026-07-23 16:01:22.912539+00'
  },
  {
    id: 8,
    parameter_type: 'cpi_index',
    name: 'Công văn 340/BHXH-CSXH đ/c Hệ số trượt giá 2026',
    value: {
      "1994": 5.81, "1995": 4.91, "1996": 4.65, "1997": 4.5, "1998": 4.18, "1999": 4.01,
      "2000": 4.07, "2001": 4.09, "2002": 3.94, "2003": 3.81, "2004": 3.54, "2005": 3.27,
      "2006": 3.05, "2007": 2.81, "2008": 2.29, "2009": 2.14, "2010": 1.96, "2011": 1.65,
      "2012": 1.51, "2013": 1.42, "2014": 1.36, "2015": 1.36, "2016": 1.32, "2017": 1.28,
      "2018": 1.23, "2019": 1.2, "2020": 1.16, "2021": 1.14, "2022": 1.11, "2023": 1.07,
      "2024": 1.03, "2025": 1, "2026": 1
    },
    effective_date: '2026-01-01',
    description: 'Hệ số trượt giá năm 2026 theo Công văn 340/BHXH-CSXH',
    notes: 'Hệ số trượt giá năm 2026 theo Công văn 340/BHXH-CSXH',
    is_active: true,
    created_at: '2026-07-23 16:01:22.912539+00'
  }
];

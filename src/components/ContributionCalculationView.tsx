import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import BHXHCalc from './calculators/BHXHCalc';
import BHYTCalc from './calculators/BHYTCalc';
import RegisterModal from './modals/RegisterModal';
import { Helmet } from 'react-helmet-async';
import { Calculator } from 'lucide-react';
import { getLocalYYYYMMDD } from '../utils/helpers';
import {
  getPolicyValueForDate,
  calculateVoluntaryBHXHRoadmap
} from '../utils/calculations';

const ContributionCalculationView: React.FC = () => {
  const { globalRegisterModal, setGlobalRegisterModal, policies, settings } = useAppContext();
  const location = useLocation();

  const [calcTab, setCalcTab] = useState<'bhxh' | 'bhyt'>('bhxh');
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [registerType, setRegisterType] = useState<'BHXH' | 'BHYT'>('BHXH');
  const [registerInitialData, setRegisterInitialData] = useState<any>(null);

  // Dynamic policy extraction based on current date
  const dateStr = getLocalYYYYMMDD();
  const povertyStandard = policies && policies.length > 0
    ? Number(getPolicyValueForDate(policies, 'poverty_standard', dateStr, settings?.povertyStandard || 1500000))
    : (settings?.povertyStandard || 1500000);
  const baseSalary = policies && policies.length > 0
    ? Number(getPolicyValueForDate(policies, 'base_salary', dateStr, settings?.baseSalary || 2340000))
    : (settings?.baseSalary || 2340000);

  useEffect(() => {
    if (globalRegisterModal.isOpen) {
      openRegisterModal(globalRegisterModal.type, globalRegisterModal.initialData);
      setGlobalRegisterModal({ isOpen: false, type: 'BHXH' });
    }
  }, [globalRegisterModal, setGlobalRegisterModal]);

  // Handle location state tab if passed
  useEffect(() => {
    if (location.state && (location.state as any).tab) {
      const tab = (location.state as any).tab;
      if (tab === 'bhxh' || tab === 'bhyt') {
        setCalcTab(tab);
      }
    }
  }, [location]);

  // Standardized registration modal opener
  const openRegisterModal = (type: 'BHXH' | 'BHYT', initialData?: any) => {
    let enrichedData = initialData || null;

    if (type === 'BHXH' && initialData) {
      const inc = Number(initialData.income) || povertyStandard;
      const yrs = Number(initialData.years) || 15;
      const nnRate = initialData.nnSupport != null ? Number(initialData.nnSupport) : 20;
      const dpRate = initialData.dpSupport != null ? Number(initialData.dpSupport) : 0;

      const roadmap = calculateVoluntaryBHXHRoadmap({
        income: inc,
        years: yrs,
        povertyStandard,
        nsnnRate: nnRate,
        dpRate
      });

      enrichedData = {
        ...initialData,
        income: inc,
        years: yrs,
        nnSupport: nnRate,
        dpSupport: dpRate,
        roadmap,
        first10YearsMonthly: roadmap.first10YearsMonthly,
        after10YearsMonthly: roadmap.after10YearsMonthly,
        totalContributed: roadmap.totalContributed,
        notes: initialData.notes || ''
      };
    }

    setRegisterType(type);
    setRegisterInitialData(enrichedData);
    setIsRegisterModalOpen(true);
  };

  return (
    <div className="flex-1 flex flex-col justify-between bg-[#f0f4f8]">
      <Helmet>
        <title>Tính Mức Đóng BHXH &amp; BHYT | Đại Lý Thu Sông Mã</title>
        <meta 
          name="description" 
          content="Công cụ tính mức đóng BHXH tự nguyện và BHYT hộ gia đình chuẩn Luật BHXH 2024 và Nghị định 159/2025. Dự toán lộ trình an sinh và đăng ký tham gia trực tuyến nhanh chóng." 
        />
      </Helmet>

      {/* Main Content Area */}
      <main className="max-w-[1360px] w-full mx-auto px-4 sm:px-10 lg:px-12 py-8 sm:py-10 flex flex-col gap-8">
        
        {/* Interactive Calculator Container */}
        <section id="calc-combined" className="w-full bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-8 lg:p-10 shadow-sm border border-gray-200/80 space-y-6">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 pb-6 border-b border-gray-100">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-[#eff4ff] text-[#004182] flex items-center justify-center shrink-0 shadow-sm">
                <Calculator className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl sm:text-3xl font-black text-[#004182] mb-1 tracking-tight">
                  Dự Toán &amp; Đăng Ký
                </h1>
                <p className="text-xs sm:text-base text-gray-500 font-medium">
                  Xác định lộ trình an sinh cá nhân hóa chuẩn Luật BHXH 2024 &amp; Nghị định 159/2025/NĐ-CP.
                </p>
              </div>
            </div>
            
            <div className="flex p-1.5 bg-blue-50/80 rounded-2xl border border-blue-100 w-full sm:w-auto">
              <button 
                onClick={() => setCalcTab('bhxh')} 
                className={`flex-1 sm:flex-none px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl font-bold transition-all text-xs sm:text-sm cursor-pointer whitespace-nowrap ${
                  calcTab === 'bhxh' 
                    ? 'bg-white shadow-md text-[#004182] font-black' 
                    : 'text-gray-600 hover:text-[#004182]'
                }`}
              >
                BHXH Tự Nguyện
              </button>
              <button 
                onClick={() => setCalcTab('bhyt')} 
                className={`flex-1 sm:flex-none px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl font-bold transition-all text-xs sm:text-sm cursor-pointer whitespace-nowrap ${
                  calcTab === 'bhyt' 
                    ? 'bg-white shadow-md text-[#004182] font-black' 
                    : 'text-gray-600 hover:text-[#004182]'
                }`}
              >
                BHYT Hộ Gia Đình
              </button>
            </div>
          </div>

          <div className="w-full relative bg-transparent">
            {calcTab === 'bhxh' && <BHXHCalc onRegister={(data) => openRegisterModal('BHXH', data)} />}
            {calcTab === 'bhyt' && <BHYTCalc onRegister={(data) => openRegisterModal('BHYT', data)} />}
          </div>
        </section>
      </main>

      {isRegisterModalOpen && (
        <RegisterModal 
          isOpen={isRegisterModalOpen} 
          onClose={() => setIsRegisterModalOpen(false)} 
          type={registerType} 
          initialData={registerInitialData}
        />
      )}
    </div>
  );
};

export default ContributionCalculationView;


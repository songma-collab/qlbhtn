import React from 'react';
import FinanceView, { FinanceViewProps } from './FinanceView';

export interface FinanceProps extends FinanceViewProps {
  type: 'BHXH' | 'BHYT';
}

export const Finance: React.FC<FinanceProps> = ({ type }) => {
  return <FinanceView type={type} />;
};

export { FinanceView };
export default Finance;

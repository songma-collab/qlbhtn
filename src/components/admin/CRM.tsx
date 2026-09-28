import React from 'react';
import CRMView, { CRMViewProps } from './CRMView';

export interface CRMProps extends CRMViewProps {
  type: 'BHXH' | 'BHYT' | 'ALL' | string;
}

export const CRM: React.FC<CRMProps> = ({ type }) => {
  return <CRMView type={type} />;
};

export { CRMView };
export default CRM;

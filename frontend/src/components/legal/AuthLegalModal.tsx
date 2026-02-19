import React from 'react';
import { Modal } from '../feedback/Modal/Modal';
import { useTranslation } from 'react-i18next';
import TermsContent from './TermsContent';
import PrivacyContent from './PrivacyContent';

interface AuthLegalModalProps {
  visible: boolean;
  onClose: () => void;
  type: 'terms' | 'privacy';
}

const AuthLegalModal: React.FC<AuthLegalModalProps> = ({ visible, onClose, type }) => {
  const { t } = useTranslation('legal');

  const title = type === 'terms' ? t('terms.title') : t('privacy.title');

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title={title}
      size="full"
      showCloseButton
    >
      {type === 'terms' ? <TermsContent /> : <PrivacyContent />}
    </Modal>
  );
};

export default AuthLegalModal;

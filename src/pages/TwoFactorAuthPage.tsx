import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import TwoFactorAuth from './TwoFactorAuth';
import useI18n from '../i18n';

const TwoFactorAuthPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [secret, setSecret] = useState('');
  const [customAlert, setCustomAlert] = useState({ isOpen: false, message: '' });

  // 处理返回操作
  const handleBack = () => {
    navigate('/app');
  };

  return (
    <Layout title={t('app.twoFactorAuth')} onBack={handleBack}>
      <div className="two-factor-auth-page">
        <div className="card-section">
          <h2>{t('app.twoFactorAuth')}</h2>
          <p>{t('app.twoFactorAuthDescription')}</p>

          <TwoFactorAuth
            secret={secret}
            onSecretChange={setSecret}
            onCustomAlert={setCustomAlert}
          />
        </div>

        {/* 自定义提示框 */}
        {customAlert.isOpen && (
          <div className="toast">
            <div className="toast-content">
              {customAlert.message}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default TwoFactorAuthPage;
import React from 'react';
import useI18n from '../i18n';
import './Layout.css';

interface LayoutProps {
  title: string;
  onBack: () => void;
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ title, onBack, children }) => {
  const { t } = useI18n();

  return (
    <div className="app-page">
      {/* 头部导航栏 */}
      <header className="app-header">
        <div className="header-left">
          {/* 左侧可以添加其他元素 */}
        </div>
        <h1 className="header-title">{title}</h1>
        <div className="header-actions">
          <button className="back-button" onClick={onBack}>
            {t('app.back')} →
          </button>
        </div>
      </header>

      {/* 内容区域 */}
      <main className="app-main">
        <div className="content">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
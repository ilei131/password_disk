import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { save, open } from '@tauri-apps/plugin-dialog';
import useI18n from '../i18n';
import Layout from '../components/Layout';

const BackupPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [backupContent, setBackupContent] = useState('');
  const [restoreContent, setRestoreContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [customAlert, setCustomAlert] = useState({ isOpen: false, message: '' });

  // 处理返回操作
  const handleBack = () => {
    navigate('/app');
  };

  // 备份密码库
  const handleBackupVault = async () => {
    setLoading(true);
    setError('');

    try {
      const content = await invoke('backup_vault', {});
      setBackupContent(content as string);
      setCustomAlert({ isOpen: true, message: t('backup.backup_success') });
    } catch (error) {
      console.error('备份密码库失败:', error);
      setCustomAlert({ isOpen: true, message: t('backup.backup_failed') });
    } finally {
      setLoading(false);
    }
  };

  // 恢复密码库
  const handleRestoreVault = async () => {
    if (!restoreContent.trim()) {
      setCustomAlert({ isOpen: true, message: t('backup.invalid_backup') });
      return;
    }

    setLoading(true);
    setError('');

    try {
      const success = await invoke('restore_vault', { content: restoreContent });
      if (success) {
        setCustomAlert({ isOpen: true, message: t('backup.restore_success') });
        // 恢复成功后返回主页面
        setTimeout(() => {
          navigate('/app');
        }, 1000);
      } else {
        setCustomAlert({ isOpen: true, message: t('backup.restore_failed') });
      }
    } catch (error) {
      console.error('恢复密码库失败:', error);
      setCustomAlert({ isOpen: true, message: t('backup.restore_failed') });
    } finally {
      setLoading(false);
    }
  };

  // 导出备份到文件
  const exportToFile = async () => {
    if (!backupContent) {
      setCustomAlert({ isOpen: true, message: t('backup.no_backup_content') });
      return;
    }

    try {
      // 生成文件名，包含当前日期
      const now = new Date();
      const fileName = `password-disk-backup-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}.json`;

      // 打开保存文件对话框
      const filePath = await save({
        defaultPath: fileName,
        filters: [
          {
            name: 'JSON Files',
            extensions: ['json']
          }
        ]
      });

      // 如果用户选择了路径
      if (filePath) {
        // 写入文件内容
        await writeTextFile(filePath, backupContent);
        setCustomAlert({ isOpen: true, message: t('backup.export_success') });
      }
    } catch (error) {
      console.error('导出文件失败:', error);
      setCustomAlert({ isOpen: true, message: t('backup.export_failed') });
    }
  };

  // 从文件导入
  const importFromFile = async () => {
    try {
      // 打开文件选择对话框
      const filePath = await open({
        filters: [
          {
            name: 'JSON Files',
            extensions: ['json']
          }
        ],
        multiple: false
      });

      // 如果用户选择了文件
      if (filePath && typeof filePath === 'string') {
        // 读取文件内容
        const content = await readTextFile(filePath);

        // 设置恢复内容
        setRestoreContent(content);

        setCustomAlert({ isOpen: true, message: t('backup.import_success') });
      }
    } catch (error) {
      console.error('导入文件失败:', error);
      setCustomAlert({ isOpen: true, message: t('backup.import_failed') });
    }
  };

  return (
    <Layout title={t('backup.title')} onBack={handleBack}>
      <div className="backup-page-content">
        {/* 备份部分 */}
        <div className="card-section">
          <h2>{t('backup.create_backup')}</h2>
          <div className="actions">
            <button
              className="primary-button"
              onClick={handleBackupVault}
              disabled={loading}
            >
              {loading ? t('backup.creating_backup') : t('backup.create_backup')}
            </button>
            <button
              className="secondary-button"
              onClick={exportToFile}
              disabled={!backupContent || loading}
            >
              {t('backup.export_to_file')}
            </button>
          </div>
          <div className="textarea-section">
            <h3>{t('backup.backup_content')}</h3>
            <textarea
              value={backupContent}
              onChange={(e) => setBackupContent(e.target.value)}
              placeholder={t('backup.backup_content_placeholder')}
              rows={10}
              readOnly
            />
          </div>
        </div>

        {/* 恢复部分 */}
        <div className="card-section">
          <h2>{t('backup.restore_backup')}</h2>
          <div className="actions">
            <button
              className="primary-button"
              onClick={handleRestoreVault}
              disabled={!restoreContent || loading}
            >
              {loading ? t('backup.restoring_backup') : t('backup.restore_backup')}
            </button>
            <button
              className="secondary-button"
              onClick={importFromFile}
              disabled={loading}
            >
              {t('backup.import_from_file')}
            </button>
          </div>
          <div className="textarea-section">
            <h3>{t('backup.restore_content')}</h3>
            <textarea
              value={restoreContent}
              onChange={(e) => setRestoreContent(e.target.value)}
              placeholder={t('backup.restore_content_placeholder')}
              rows={10}
            />
          </div>
        </div>

        {/* 错误信息 */}
        {error && <div className="error-message">{error}</div>}

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

export default BackupPage;
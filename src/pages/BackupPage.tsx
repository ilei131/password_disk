import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { save, open } from '@tauri-apps/plugin-dialog';
import useI18n from '../i18n';
import Layout from '../components/Layout';
import { Toast } from '../components/Toast';
import CloudLoginDialog from '../components/CloudLoginDialog';
import { ConfirmDialog } from '../components/ConfirmDialog';
import './BackupPage.css';

interface BackupPageProps {
  onBack: () => void;
}

const BackupPage: React.FC<BackupPageProps> = ({ onBack }) => {
  const { t } = useI18n();
  const [backupContent, setBackupContent] = useState('');
  const [restoreContent, setRestoreContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [customAlert, setCustomAlert] = useState({ isOpen: false, message: '' });
  const [showCloudLogin, setShowCloudLogin] = useState(false);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);

  // 组件初始化时读取密码库内容
  useEffect(() => {
    const loadBackupContent = async () => {
      setLoading(true);
      setError('');

      try {
        const content = await invoke('backup_vault', {});
        setBackupContent(content as string);
      } catch (error) {
        console.error('读取密码库失败:', error);
        setCustomAlert({ isOpen: true, message: t('backup.backup_failed') });
      } finally {
        setLoading(false);
      }
    };

    loadBackupContent();
  }, [t]);

  // 处理返回操作
  const handleBack = () => {
    onBack();
  };

  // 复制到剪贴板
  const copyToClipboard = async () => {
    if (!backupContent) {
      setCustomAlert({ isOpen: true, message: t('backup.no_backup_content') });
      return;
    }

    try {
      await navigator.clipboard.writeText(backupContent);
      setCustomAlert({ isOpen: true, message: t('backup.copy_success') });
    } catch (error) {
      console.error('复制到剪贴板失败:', error);
      setCustomAlert({ isOpen: true, message: t('backup.copy_failed') });
    }
  };



  // 显示恢复确认对话框
  const handleRestoreVault = async () => {
    if (!restoreContent.trim()) {
      setCustomAlert({ isOpen: true, message: t('backup.invalid_backup') });
      return;
    }

    setShowRestoreConfirm(true);
  };

  // 确认恢复密码库
  const confirmRestoreVault = async () => {
    setShowRestoreConfirm(false);
    setLoading(true);
    setError('');

    try {
      const success = await invoke('restore_vault', { content: restoreContent });
      if (success) {
        setCustomAlert({ isOpen: true, message: t('backup.restore_success') });
        // 恢复成功后返回主页面
        setTimeout(() => {
          onBack();
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

  // 打开云登录弹窗
  const handleBackupToCloud = () => {
    setShowCloudLogin(true);
  };

  // 登录成功后处理备份至云端
  const handleCloudLoginSuccess = async (userId: string) => {
    //await backupToCloud(userId);
  };

  // 备份至云端
  const backupToCloud = async (userId: string) => {
    if (!backupContent) {
      setCustomAlert({ isOpen: true, message: t('backup.no_backup_content') });
      return;
    }

    setLoading(true);

    try {
      // 先获取云端密码库数据
      console.log('尝试获取云端密码库数据，用户ID:', userId);

      const getResponse = await invoke('get_cloud_passwords', {
        userId: userId
      });

      console.log('获取云端密码库响应:', getResponse);

      const getdata = getResponse as any;

      let cloudPasswordId = '';
      if (getdata.passwords && getdata.passwords.length > 0) {
        // 如果云端已有数据，使用第一个数据的id
        cloudPasswordId = getdata.passwords[0].id;
      }

      // 构造同步数据
      const syncData = {
        userId: userId,
        password: {
          id: userId || undefined,
          password: backupContent
        }
      };

      // 同步至云端
      console.log('尝试同步至云端:', syncData);

      const syncResponse = await invoke('sync', {
        request: syncData
      });

      console.log('同步响应:', syncResponse);

      const syncResult = syncResponse as any;

      if (syncResult.success) {
        setCustomAlert({ isOpen: true, message: t('backup.cloud_backup_success') });
      } else {
        setCustomAlert({ isOpen: true, message: syncResult.error || t('backup.cloud_backup_failed') });
      }
    } catch (error) {
      console.error('备份至云端失败:', error);
      setCustomAlert({ isOpen: true, message: `${t('backup.cloud_network_error')}: ${error instanceof Error ? error.message : '未知错误'}` });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout title={t('backup.title')} onBack={handleBack}>
      <div className="backup-page-content">
        {/* 备份部分 */}
        <div className="card-section">
          <h2>{t('backup.backup_title')}</h2>
          <div className="actions">
            <button
              className="primary-button"
              onClick={copyToClipboard}
              disabled={!backupContent || loading}
            >
              {t('backup.copy_to_clipboard')}
            </button>
            <button
              className="secondary-button"
              onClick={exportToFile}
              disabled={!backupContent || loading}
            >
              {t('backup.export_to_file')}
            </button>
            <button
              className="secondary-button"
              onClick={handleBackupToCloud}
              disabled={!backupContent || loading}
            >
              {t('backup.backup_2_the_cloud')}
            </button>
          </div>
          <div className="textarea-section">
            <h3>{t('backup.backup_content')}</h3>
            <textarea
              value={backupContent}
              onChange={(e) => setBackupContent(e.target.value)}
              placeholder={t('backup.backup_content')}
              rows={10}
              readOnly
            />
          </div>
        </div>

        {/* 恢复部分 */}
        <div className="card-section">
          <h2>{t('backup.restore_title')}</h2>
          <div className="actions">
            <button
              className="primary-button"
              onClick={handleRestoreVault}
              disabled={!restoreContent || loading}
            >
              {t('backup.restore_vault')}
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
              placeholder={t('backup.restore_content')}
              rows={10}
            />
          </div>
        </div>

        {/* 错误信息 */}
        {error && <div className="error-message">{error}</div>}

        {/* 自定义提示框 */}
        <Toast
          isOpen={customAlert.isOpen}
          message={customAlert.message}
          onClose={() => setCustomAlert({ isOpen: false, message: '' })}
        />

        {/* 云登录弹窗 */}
        <CloudLoginDialog
          isOpen={showCloudLogin}
          onClose={() => setShowCloudLogin(false)}
          onLoginSuccess={handleCloudLoginSuccess}
        />

        {/* 恢复确认对话框 */}
        <ConfirmDialog
          isOpen={showRestoreConfirm}
          title={t('backup.restore_confirm_title')}
          message={t('backup.restore_confirm_message')}
          onConfirm={confirmRestoreVault}
          onCancel={() => setShowRestoreConfirm(false)}
          okLabel={t('app.confirm')}
          cancelLabel={t('app.cancel')}
        />
      </div>
    </Layout>
  );
};

export default BackupPage;
import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import useI18n from '../i18n';
import './CloudLoginDialog.css';

interface CloudLoginDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (userId: string, backup?: string) => void;
  operation?: 'backup' | 'restore';
}

const CloudLoginDialog: React.FC<CloudLoginDialogProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  operation = 'backup'
}) => {
  const { t } = useI18n();
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 当对话框打开时重置所有状态
  useEffect(() => {
    if (isOpen) {
      setIsRegistering(false);
      setUsername('');
      setPassword('');
      setError('');
      setLoading(false);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    console.log('开始登录/注册流程');
    console.log('操作类型:', isRegistering ? '注册' : (operation === 'backup' ? '备份' : '同步'));
    console.log('用户名:', username);
    console.log('密码:', password ? '******' : '空');

    try {
      console.log('开始调用后端接口...');
      let response: any;
      if (isRegistering) {
        // 调用注册命令
        console.log('调用 register 命令');
        response = await invoke('register', {
          username,
          password
        });
      } else if (operation === 'backup') {
        // 调用登录命令（备份操作）
        console.log('调用 login 命令（备份操作）');
        // 获取本地密码库内容
        console.log('开始获取本地密码库内容...');
        const backupResponse = await invoke('backup_vault');
        console.log('获取本地密码库内容成功:', backupResponse);
        console.log('备份密码库内容:', backupResponse ? '******' : '空');
        response = await invoke('login', {
          username,
          password,
          backup: backupResponse
        });
      } else {
        // 调用同步命令（恢复操作）
        console.log('调用 sync 命令（恢复操作）');
        response = await invoke('sync', {
          username,
          password
        });
      }

      console.log('后端接口调用成功，响应数据:', response);

      if (response.success) {
        console.log('操作成功，用户ID:', response.id);

        if (isRegistering) {
          // 注册成功，显示登录状态，保留用户名和密码，不关闭弹窗
          console.log('注册成功，切换到登录状态');
          // 显示注册成功提示
          setError(t('cloud.register_success'));
          // 切换到登录状态，但保留用户名和密码
          setIsRegistering(false);
        } else {
          // 登录或同步成功，关闭对话框并通知登录成功
          console.log('关闭对话框并通知登录成功');
          onLoginSuccess(response.id || '', response.backup);
          onClose();
        }
      } else {
        console.log('操作失败，错误信息:', response.error);
        setError(response.error || t('cloud.login_failed'));
      }
    } catch (error) {
      console.error('登录/注册失败，捕获到错误:', error);
      console.error('错误类型:', typeof error);
      console.error('错误对象:', error);
      setError(`${t('cloud.network_error')}: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      console.log('登录/注册流程结束');
      setLoading(false);
    }
  };

  return (
    <div className={`login-dialog-overlay ${isOpen ? 'active' : ''}`}>
      {isOpen && (
        <div className="login-dialog-content">
          <div className="login-dialog-header">
            <h2>{isRegistering ? t('cloud.register') : (operation === 'backup' ? t('backup.backup_2_the_cloud') : t('backup.restore_from_cloud'))}</h2>
            <button className="login-close-button" onClick={onClose}>×</button>
          </div>
          <form onSubmit={handleSubmit} className="login-dialog-form">
            {error && <div className="login-error-message">{error}</div>}
            <div className="login-form-group">
              <label htmlFor="username">{t('cloud.username')}</label>
              <input
                type="text"
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <div className="login-form-group">
              <label htmlFor="password">{t('cloud.password')}</label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <div className="login-form-actions">
              <button
                type="button"
                className="login-secondary-button"
                onClick={onClose}
                disabled={loading}
              >
                {t('cloud.cancel')}
              </button>
              <button
                type="submit"
                className="login-primary-button"
                disabled={loading}
              >
                {loading ? t('cloud.loading') : isRegistering ? t('cloud.register') : (operation === 'backup' ? t('backup.backup') : t('backup.sync'))}
              </button>
            </div>
            <div className="login-form-footer">
              <button
                type="button"
                className="login-link-button"
                onClick={() => setIsRegistering(!isRegistering)}
                disabled={loading}
              >
                {isRegistering ? t('cloud.have_account') : t('cloud.no_account')}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default CloudLoginDialog;

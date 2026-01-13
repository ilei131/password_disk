import React, { useState, useEffect } from 'react';
import { invoke } from "@tauri-apps/api/core";
import useI18n from '../i18n';

interface TwoFactorAuthProps {
  secret?: string;
  onSecretChange?: (secret: string) => void;
  onCustomAlert?: (alert: { isOpen: boolean; message: string }) => void;
}

const TwoFactorAuth: React.FC<TwoFactorAuthProps> = ({ secret = '', onSecretChange, onCustomAlert }) => {
  const { t } = useI18n();
  const [code, setCode] = useState('');
  const [timeLeft, setTimeLeft] = useState(30);
  const [inputSecret, setInputSecret] = useState(secret);
  const countdownIntervalRef = React.useRef<NodeJS.Timeout | null>(null);

  // 生成TOTP验证码
  const generateCode = async (onSuccess?: () => void) => {
    if (!inputSecret) {
      setCode('');
      return;
    }
    try {
      const token = await invoke<string>("generate_two_factor_code", {
        secret: inputSecret
      });
      setCode(token);
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error('Error generating 2FA code:', error);
      setCode('');
    }
  };

  // 复制验证码到剪贴板
  const copyCode = async () => {
    if (code) {
      try {
        await navigator.clipboard.writeText(code);
        if (onCustomAlert) {
          onCustomAlert({
            isOpen: true,
            message: t('app.passwordCopied')
          });
        }
      } catch (error) {
        console.error('Error copying code:', error);
        if (onCustomAlert) {
          onCustomAlert({
            isOpen: true,
            message: t('app.copyFailed')
          });
        }
      }
    }
  };

  // 处理secret输入变化
  const handleSecretChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSecret = e.target.value;
    setInputSecret(newSecret);
    if (onSecretChange) {
      onSecretChange(newSecret);
    }
  };

  // 初始化和每30秒更新一次验证码
  useEffect(() => {
    // 重置倒计时为30秒
    setTimeLeft(30);

    // 清理之前的定时器
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }

    // 只有当inputSecret不为空时，才生成验证码和启动倒计时
    if (inputSecret) {
      // 立即生成一次验证码
      const initCode = async () => {
        await generateCode(() => {
          // 验证码生成成功后，启动倒计时
          const interval = setInterval(() => {
            setTimeLeft(prev => {
              if (prev <= 1) {
                // 当倒计时结束时，生成新的验证码
                const refreshCode = async () => {
                  await generateCode();
                };
                refreshCode();
                return 30;
              }
              return prev - 1;
            });
          }, 1000);
          countdownIntervalRef.current = interval;
        });
      };
      initCode();
    }

    return () => {
      // 清理定时器
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    };
  }, [inputSecret]);

  return (
    <div className="two-factor-auth">
      <h3>{t('app.twoFactorAuth')}</h3>
      <div className="two-factor-input">
        <label htmlFor="two-factor-secret">{t('app.twoFactorSecret')}:</label>
        <input
          type="text"
          id="two-factor-secret"
          value={inputSecret}
          onChange={handleSecretChange}
          placeholder={t('app.enterTwoFactorSecret')}
        />
      </div>
      {inputSecret && (
        <div className="two-factor-code-container">
          <div className="two-factor-code">
            <span className="code-value">{code || '--'}</span>
            <button
              className="copy-password-button"
              onClick={copyCode}
              disabled={!code}
              aria-label={t('app.copyCode')}
            >
              📋
            </button>
          </div>
          <div className="two-factor-timer">
            <div className="timer-bar-container">
              <div
                className="timer-bar"
                style={{ width: `${(timeLeft / 30) * 100}%` }}
              ></div>
            </div>
            <span className="timer-text">{timeLeft}s</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default TwoFactorAuth;
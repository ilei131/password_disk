import React, { useEffect } from 'react';

const AdSense: React.FC = () => {
  useEffect(() => {
    // 广告由 index.html 中的全局脚本自动初始化，无需手动调用
  }, []);

  return (
    <div>
      {/* password-disk */}
      <ins className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client="ca-pub-5543110969323200"
        data-ad-slot="9663750214"
        data-ad-format="auto"
        data-full-width-responsive="true"></ins>
    </div>
  );
};

export default AdSense;
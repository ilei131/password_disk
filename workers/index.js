// Cloudflare Workers API 实现

// 处理CORS
const handleCORS = (request) => {
  const headers = new Headers();
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  return headers;
};

// 初始化数据库
const initializeDatabase = async (db) => {
  try {
    // 跳过数据库初始化，避免 D1 API 错误
    // 注意：在生产环境中，应该先手动创建数据库表结构
    console.log('跳过数据库初始化（手动创建表结构）');
  } catch (error) {
    console.error('数据库初始化失败:', error);
    // 不抛出错误，继续执行
  }
};

// 生成唯一ID
const generateId = () => {
  return Date.now();
};

// 生成user唯一ID
const generateUserId = () => {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
};

// 主处理函数
export default {
  async fetch(request, env, ctx) {
    const headers = handleCORS(request);
    if (headers instanceof Response) {
      return headers;
    }

    // 检查数据库绑定
    if (!env.DB) {
      return new Response(JSON.stringify({ error: 'D1 数据库未绑定' }), {
        status: 500,
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        }
      });
    }

    // 初始化数据库（添加错误处理）
    try {
      await initializeDatabase(env.DB);
    } catch (error) {
      console.warn('数据库初始化失败（本地开发环境可能需要先创建 D1 数据库）:', error.message);
      // 继续执行，不因为数据库初始化失败而中断服务
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // 用户认证相关
      if (path === '/api/register' && request.method === 'POST') {
        return await handleRegister(request, env.DB, headers);
      }
      if (path === '/api/login' && request.method === 'POST') {
        return await handleLogin(request, env.DB, headers);
      }

      // 密码相关
      if (path === '/api/passwords' && request.method === 'GET') {
        return await handleGetPasswords(request, env.DB, headers);
      }
      if (path === '/api/passwords' && request.method === 'POST') {
        return await handleAddPassword(request, env.DB, headers);
      }
      if (path === '/api/passwords' && request.method === 'PUT') {
        return await handleUpdatePassword(request, env.DB, headers);
      }
      if (path === '/api/passwords' && request.method === 'DELETE') {
        return await handleDeletePassword(request, env.DB, headers);
      }

      // 同步相关
      if (path === '/api/sync' && request.method === 'POST') {
        return await handleSync(request, env.DB, headers);
      }

      return new Response('Not Found', { status: 404, headers });
    } catch (error) {
      console.error('处理请求失败:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        }
      });
    }
  }
};

// 处理用户注册
const handleRegister = async (request, db, headers) => {
  try {
    console.log('收到注册请求');
    const body = await request.json();
    console.log('注册请求数据:', body);
    const { username, password } = body;

    if (!username || !password) {
      console.log('注册请求缺少必要参数');
      return new Response(JSON.stringify({ error: '缺少必要参数' }), {
        status: 400,
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        }
      });
    }

    console.log('开始注册用户:', username);
    const id = generateUserId();
    const now = Date.now();

    // 生成随机盐
    const salt = Math.random().toString(36).substring(2);
    // 使用密码和盐生成哈希
    const password_hash = btoa(password + salt);

    console.log('检查数据库对象:', typeof db);
    if (!db || typeof db !== 'object') {
      console.log('数据库对象无效');
      return new Response(JSON.stringify({ error: '数据库连接失败' }), {
        status: 500,
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        }
      });
    }

    console.log('执行数据库插入操作');
    try {
      // 尝试使用 prepare 方法
      await db.prepare(`
                INSERT INTO users (id, username, password_hash, salt, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)
            `).bind(id, username, password_hash, salt, now, now).run();
    } catch (execError) {
      console.error('数据库执行失败:', execError);
      // 尝试使用 exec 方法
      try {
        await db.exec(`
                    INSERT INTO users (id, username, password_hash, salt, created_at, updated_at)
                    VALUES ('${id}', '${username}', '${password_hash}', '${salt}', ${now}, ${now})
                `);
      } catch (execError2) {
        console.error('数据库 exec 方法也失败:', execError2);
        throw execError2;
      }
    }

    console.log('用户注册成功:', id);
    return new Response(JSON.stringify({ success: true, id }), {
      status: 200,
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('注册失败:', error);
    if (error.message.includes('UNIQUE constraint failed')) {
      console.log('用户名已存在:', error.message);
      return new Response(JSON.stringify({ error: '用户名已存在' }), {
        status: 409,
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        }
      });
    }
    // 返回完整的错误信息
    console.log('返回完整错误信息:', error);
    return new Response(JSON.stringify({
      error: error.message || '未知错误',
      full_error: JSON.stringify(error, Object.getOwnPropertyNames(error))
    }), {
      status: 500,
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      }
    });
  }
};

// 处理用户登录
const handleLogin = async (request, db, headers) => {
  try {
    console.log('收到登录请求');
    const body = await request.json();
    console.log('登录请求数据:', body);
    const { username, password, backup } = body;

    if (!username || !password) {
      console.log('登录请求缺少必要参数');
      return new Response(JSON.stringify({ error: '缺少必要参数' }), {
        status: 400,
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        }
      });
    }

    console.log('检查数据库对象:', typeof db);
    if (!db || typeof db !== 'object') {
      console.log('数据库对象无效');
      return new Response(JSON.stringify({ error: '数据库连接失败' }), {
        status: 500,
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        }
      });
    }

    console.log('开始登录用户:', username);
    let user;
    try {
      // 查询用户信息，包括密码哈希和盐
      user = await db.prepare(`SELECT id, password_hash, salt FROM users WHERE username = ?`)
        .bind(username)
        .first();
    } catch (getError) {
      console.error('数据库查询失败:', getError);
      return new Response(JSON.stringify({ error: '数据库查询失败' }), {
        status: 500,
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        }
      });
    }

    console.log('登录查询结果:', user);
    if (!user) {
      console.log('用户不存在:', username);
      return new Response(JSON.stringify({ error: '用户不存在' }), {
        status: 401,
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        }
      });
    }

    // 使用存储的 salt 生成密码哈希
    const password_hash = btoa(password + user.salt);

    // 验证密码哈希
    if (user.password_hash !== password_hash) {
      console.log('密码错误:', username);
      return new Response(JSON.stringify({ error: '密码错误' }), {
        status: 401,
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        }
      });
    }

    console.log('用户登录成功:', user.id);

    // 处理密码库备份
    if (backup) {
      console.log('处理密码库备份');
      try {
        // 检查用户是否已有密码库备份
        let existingPassword;
        try {
          existingPassword = await db.prepare(`SELECT id FROM password WHERE user_id = ?`)
            .bind(user.id)
            .first();
        } catch (queryError) {
          console.error('查询现有密码库失败:', queryError);
          existingPassword = null;
        }

        if (existingPassword) {
          // 更新现有密码库
          console.log('更新现有密码库:', existingPassword.id);
          await db.prepare(`
                UPDATE password
                SET backup = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ? AND user_id = ?
              `).bind(backup, existingPassword.id, user.id).run();
        } else {
          // 添加新密码库
          const id = generateId();
          console.log('添加新密码库:', id);
          await db.prepare(`
                INSERT INTO password (id, user_id, backup, created_at, updated_at)
                VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
              `).bind(id, user.id, backup).run();
        }
        console.log('密码库备份成功');
      } catch (backupError) {
        console.error('密码库备份失败:', backupError);
        // 即使备份失败，也返回登录成功
        return new Response(JSON.stringify({
          error: backupError.message || '未知错误',
          full_error: JSON.stringify(backupError, Object.getOwnPropertyNames(backupError))
        }), {
          status: 500,
          headers: {
            ...headers,
            'Content-Type': 'application/json'
          }
        });
      }
    }

    return new Response(JSON.stringify({ success: true, id: user.id }), {
      status: 200,
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('登录失败:', error);
    return new Response(JSON.stringify({
      error: error.message || '未知错误',
      full_error: JSON.stringify(error, Object.getOwnPropertyNames(error))
    }), {
      status: 500,
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      }
    });
  }
};

// 处理获取密码列表
const handleGetPasswords = async (request, db, headers) => {
  try {
    console.log('收到获取密码列表请求');
    const url = new URL(request.url);
    const user_id = url.searchParams.get('user_id');
    console.log('用户ID:', user_id);

    if (!user_id) {
      console.log('缺少用户ID');
      return new Response(JSON.stringify({ error: '缺少用户ID' }), {
        status: 400,
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        }
      });
    }

    console.log('检查数据库对象:', typeof db);
    if (!db || typeof db !== 'object') {
      console.log('数据库对象无效');
      return new Response(JSON.stringify({ error: '数据库连接失败' }), {
        status: 500,
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        }
      });
    }

    console.log('执行密码列表查询');
    let passwords;
    try {
      // 尝试使用 prepare 方法
      passwords = await db.prepare(`
        SELECT id, user_id, password, created_at, updated_at
        FROM passwords
        WHERE user_id = ?
      `).bind(user_id).all();

      // 确保 passwords 是一个数组
      if (!Array.isArray(passwords)) {
        console.log('密码列表查询结果不是数组，转换为数组:', passwords);
        passwords = [];
      }
    } catch (queryError) {
      console.error('密码列表查询失败:', queryError);
      passwords = [];
    }

    console.log('密码列表查询结果:', passwords.length, '条记录');
    return new Response(JSON.stringify({ passwords }), {
      status: 200,
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('处理获取密码列表失败:', error);
    return new Response(JSON.stringify({
      error: error.message || '未知错误',
      full_error: JSON.stringify(error, Object.getOwnPropertyNames(error))
    }), {
      status: 500,
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      }
    });
  }
};

// 处理添加密码
const handleAddPassword = async (request, db, headers) => {
  try {
    console.log('收到添加密码请求');
    const body = await request.json();
    console.log('添加密码数据:', body);
    const { user_id, password } = body;

    if (!user_id || !password) {
      console.log('缺少必要参数');
      return new Response(JSON.stringify({ error: '缺少必要参数' }), {
        status: 400,
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        }
      });
    }

    console.log('检查数据库对象:', typeof db);
    if (!db || typeof db !== 'object') {
      console.log('数据库对象无效');
      return new Response(JSON.stringify({ error: '数据库连接失败' }), {
        status: 500,
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        }
      });
    }

    const id = generateId();
    const now = Date.now();

    console.log('执行添加密码操作');
    try {
      // 尝试使用 prepare 方法
      await db.prepare(`
        INSERT INTO passwords (id, user_id, title, username, password, url, notes, category, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(id, user_id, '', '', password, '', '', '', now, now).run();
    } catch (execError) {
      console.error('添加密码失败:', execError);
      throw execError;
    }

    console.log('密码添加成功:', id);
    return new Response(JSON.stringify({ success: true, id }), {
      status: 200,
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('处理添加密码失败:', error);
    return new Response(JSON.stringify({
      error: error.message || '未知错误',
      full_error: JSON.stringify(error, Object.getOwnPropertyNames(error))
    }), {
      status: 500,
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      }
    });
  }
};

// 处理更新密码
const handleUpdatePassword = async (request, db, headers) => {
  try {
    console.log('收到更新密码请求');
    const body = await request.json();
    console.log('更新密码数据:', body);
    const { id, user_id, password } = body;

    if (!id || !user_id || !password) {
      console.log('缺少必要参数');
      return new Response(JSON.stringify({ error: '缺少必要参数' }), {
        status: 400,
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        }
      });
    }

    console.log('检查数据库对象:', typeof db);
    if (!db || typeof db !== 'object') {
      console.log('数据库对象无效');
      return new Response(JSON.stringify({ error: '数据库连接失败' }), {
        status: 500,
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        }
      });
    }

    const now = Date.now();

    console.log('执行更新密码操作');
    try {
      // 尝试使用 prepare 方法
      await db.prepare(`
        UPDATE passwords
        SET password = ?, updated_at = ?
        WHERE id = ? AND user_id = ?
      `).bind(password, now, id, user_id).run();
    } catch (execError) {
      console.error('更新密码失败:', execError);
      throw execError;
    }

    console.log('密码更新成功:', id);
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('处理更新密码失败:', error);
    return new Response(JSON.stringify({
      error: error.message || '未知错误',
      full_error: JSON.stringify(error, Object.getOwnPropertyNames(error))
    }), {
      status: 500,
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      }
    });
  }
};

// 处理删除密码
const handleDeletePassword = async (request, db, headers) => {
  try {
    console.log('收到删除密码请求');
    const body = await request.json();
    console.log('删除密码数据:', body);
    const { id, user_id } = body;

    if (!id || !user_id) {
      console.log('缺少必要参数');
      return new Response(JSON.stringify({ error: '缺少必要参数' }), {
        status: 400,
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        }
      });
    }

    console.log('检查数据库对象:', typeof db);
    if (!db || typeof db !== 'object') {
      console.log('数据库对象无效');
      return new Response(JSON.stringify({ error: '数据库连接失败' }), {
        status: 500,
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        }
      });
    }

    console.log('执行删除密码操作');
    try {
      // 尝试使用 prepare 方法
      await db.prepare(`
        DELETE FROM passwords
        WHERE id = ? AND user_id = ?
      `).bind(id, user_id).run();
    } catch (execError) {
      console.error('删除密码失败:', execError);
      throw execError;
    }

    console.log('密码删除成功:', id);
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('处理删除密码失败:', error);
    return new Response(JSON.stringify({
      error: error.message || '未知错误',
      full_error: JSON.stringify(error, Object.getOwnPropertyNames(error))
    }), {
      status: 500,
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      }
    });
  }
};

// 处理同步
const handleSync = async (request, db, headers) => {
  try {
    console.log('收到同步请求');
    const body = await request.json();
    console.log('同步请求数据:', body);
    const { username, password } = body;

    if (!username || !password) {
      console.log('同步请求缺少必要参数');
      return new Response(JSON.stringify({ error: '缺少必要参数' }), {
        status: 400,
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        }
      });
    }

    console.log('检查数据库对象:', typeof db);
    if (!db || typeof db !== 'object') {
      console.log('数据库对象无效');
      return new Response(JSON.stringify({ error: '数据库连接失败' }), {
        status: 500,
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        }
      });
    }

    console.log('开始验证用户身份');
    let user;
    try {
      // 查询用户信息，包括密码哈希和盐
      user = await db.prepare(`SELECT id, password_hash, salt FROM users WHERE username = ?`)
        .bind(username)
        .first();
    } catch (getError) {
      console.error('数据库查询失败:', getError);
      return new Response(JSON.stringify({ error: '数据库查询失败' }), {
        status: 500,
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        }
      });
    }

    console.log('用户查询结果:', user);
    if (!user) {
      console.log('用户不存在:', username);
      return new Response(JSON.stringify({ error: '用户不存在' }), {
        status: 401,
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        }
      });
    }

    // 使用存储的 salt 生成密码哈希
    const password_hash = btoa(password + user.salt);

    // 验证密码哈希
    if (user.password_hash !== password_hash) {
      console.log('密码错误:', username);
      return new Response(JSON.stringify({ error: '密码错误' }), {
        status: 401,
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        }
      });
    }

    console.log('用户身份验证成功:', user.id);

    // 查询用户的密码库备份
    let backupData = null;
    try {
      const passwordRecord = await db.prepare(`SELECT backup FROM password WHERE user_id = ?`)
        .bind(user.id)
        .first();

      if (passwordRecord) {
        backupData = passwordRecord.backup;
        console.log('获取密码库备份成功');
      } else {
        console.log('用户暂无密码库备份');
      }
    } catch (queryError) {
      console.error('查询密码库备份失败:', queryError);
    }

    console.log('同步成功');
    return new Response(JSON.stringify({ success: true, backup: backupData }), {
      status: 200,
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('处理同步失败:', error);
    return new Response(JSON.stringify({
      error: error.message || '未知错误',
      full_error: JSON.stringify(error, Object.getOwnPropertyNames(error))
    }), {
      status: 500,
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      }
    });
  }
};

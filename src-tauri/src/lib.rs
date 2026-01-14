// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use lazy_static::lazy_static;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use std::sync::{Arc, RwLock};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri_plugin_dialog;
use tauri_plugin_fs;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct EncryptedPasswordItem {
    pub id: String,
    pub title: String,
    pub username: String,
    pub password: String, // 加密后的密码
    pub url: String,
    pub notes: String,
    pub category: String,
    pub created_at: u64,
    pub updated_at: u64,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CreatePasswordItem {
    pub title: String,
    pub username: String,
    pub password: String, // 明文密码，仅在内存中使用
    pub url: String,
    pub notes: String,
    pub category: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct PasswordItem {
    pub id: String,
    pub title: String,
    pub username: String,
    pub password: String, // 明文密码，仅在内存中使用
    pub url: String,
    pub notes: String,
    pub category: String,
    pub created_at: u64,
    pub updated_at: u64,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Category {
    pub id: String,
    pub name: String,
    pub icon: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct PasswordVault {
    pub master_password_hash: String,
    pub salt: String, // 用于密钥派生的盐
    pub passwords: Vec<EncryptedPasswordItem>,
    pub categories: Vec<Category>,
}

// 创建全局线程安全的密码库
lazy_static! {
    pub static ref PASSWORD_VAULT: Arc<RwLock<Option<PasswordVault>>> = Arc::new(RwLock::new(None));
    pub static ref VAULT_FILE_PATH: String = {
        // 使用dirs 5.x API
        if let Some(data_dir) = dirs::data_dir() {
            let mut path = data_dir.join("PasswordDisk");
            path.push("password_vault.json");
            path.to_str()
                .unwrap_or("/tmp/password_vault.json")
                .to_string()
        } else {
            //  fallback to /tmp if data_dir fails
            "/tmp/password_vault.json".to_string()
        }
    };
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn initialize_vault(master_password: &str) -> Result<bool, String> {
    let vault_path = Path::new(&*VAULT_FILE_PATH);

    // 检查密码库是否已存在
    if vault_path.exists() {
        return Err("密码库已存在".to_string());
    }

    // 创建默认分类
    let default_categories = vec![
        Category {
            id: "1".to_string(),
            name: "所有".to_string(),
            icon: "📁".to_string(),
        },
        Category {
            id: "2".to_string(),
            name: "个人".to_string(),
            icon: "👤".to_string(),
        },
        Category {
            id: "3".to_string(),
            name: "工作".to_string(),
            icon: "💼".to_string(),
        },
        Category {
            id: "4".to_string(),
            name: "金融".to_string(),
            icon: "💰".to_string(),
        },
        Category {
            id: "5".to_string(),
            name: "社交媒体".to_string(),
            icon: "📱".to_string(),
        },
    ];

    // 生成主密码哈希
    let hashed_password = bcrypt::hash(master_password, bcrypt::DEFAULT_COST)
        .map_err(|e| format!("密码哈希失败: {}", e))?;

    // 生成盐
    let salt = rand::random::<[u8; 16]>();
    let salt_hex = hex::encode(salt);

    // 创建新的密码库
    let new_vault = PasswordVault {
        master_password_hash: hashed_password,
        salt: salt_hex,
        passwords: Vec::new(),
        categories: default_categories,
    };

    // 保存密码库到文件
    save_vault(&new_vault)?;

    // 加载到内存
    *PASSWORD_VAULT.write().unwrap() = Some(new_vault);

    Ok(true)
}

#[tauri::command]
async fn verify_master_password(master_password: &str) -> Result<bool, String> {
    // 加载密码库
    let vault = load_vault()?;

    // 验证主密码
    if bcrypt::verify(master_password, &vault.master_password_hash)
        .map_err(|e| format!("密码验证失败: {}", e))?
    {
        // 加载到内存
        *PASSWORD_VAULT.write().unwrap() = Some(vault);
        Ok(true)
    } else {
        Ok(false)
    }
}

#[tauri::command]
async fn get_passwords(master_password: &str) -> Result<Vec<PasswordItem>, String> {
    let vault = get_vault()?;

    // 验证主密码
    if !bcrypt::verify(master_password, &vault.master_password_hash)
        .map_err(|e| format!("密码验证失败: {}", e))?
    {
        return Err("主密码错误".to_string());
    }

    // 生成密钥
    let salt = hex::decode(&vault.salt).map_err(|e| format!("解码盐失败: {}", e))?;
    let key = derive_key(master_password, &salt);

    // 解密密码
    let mut decrypted_passwords = Vec::new();
    for encrypted_item in vault.passwords {
        let decrypted_password = decrypt_data(&encrypted_item.password, &key)
            .map_err(|e| format!("解密密码失败: {}", e))?;

        decrypted_passwords.push(PasswordItem {
            id: encrypted_item.id,
            title: encrypted_item.title,
            username: encrypted_item.username,
            password: decrypted_password,
            url: encrypted_item.url,
            notes: encrypted_item.notes,
            category: encrypted_item.category,
            created_at: encrypted_item.created_at,
            updated_at: encrypted_item.updated_at,
        });
    }

    Ok(decrypted_passwords)
}

#[tauri::command]
async fn get_categories() -> Result<Vec<Category>, String> {
    let vault = get_vault()?;
    Ok(vault.categories.clone())
}

#[tauri::command]
async fn add_password(
    password: CreatePasswordItem,
    master_password: &str,
) -> Result<PasswordItem, String> {
    let mut vault = get_vault()?;

    // 验证主密码
    if !bcrypt::verify(master_password, &vault.master_password_hash)
        .map_err(|e| format!("密码验证失败: {}", e))?
    {
        return Err("主密码错误".to_string());
    }

    // 生成密钥
    let salt = hex::decode(&vault.salt).map_err(|e| format!("解码盐失败: {}", e))?;
    let key = derive_key(master_password, &salt);

    // 加密密码
    let encrypted_password =
        encrypt_data(&password.password, &key).map_err(|e| format!("加密密码失败: {}", e))?;

    // 生成唯一ID
    let id = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_millis()
        .to_string();
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs();

    let new_encrypted_password = EncryptedPasswordItem {
        id: id.clone(),
        title: password.title.clone(),
        username: password.username.clone(),
        password: encrypted_password,
        url: password.url.clone(),
        notes: password.notes.clone(),
        category: password.category.clone(),
        created_at: now,
        updated_at: now,
    };

    let new_password = PasswordItem {
        id,
        title: password.title,
        username: password.username,
        password: password.password,
        url: password.url,
        notes: password.notes,
        category: password.category,
        created_at: now,
        updated_at: now,
    };

    // 添加到密码库
    vault.passwords.push(new_encrypted_password);

    // 保存并更新内存
    save_vault(&vault)?;
    *PASSWORD_VAULT.write().unwrap() = Some(vault);

    Ok(new_password)
}

#[tauri::command]
async fn update_password(
    password: PasswordItem,
    master_password: &str,
) -> Result<PasswordItem, String> {
    let mut vault = get_vault()?;

    // 验证主密码
    if !bcrypt::verify(master_password, &vault.master_password_hash)
        .map_err(|e| format!("密码验证失败: {}", e))?
    {
        return Err("主密码错误".to_string());
    }

    // 生成密钥
    let salt = hex::decode(&vault.salt).map_err(|e| format!("解码盐失败: {}", e))?;
    let key = derive_key(master_password, &salt);

    // 加密密码
    let encrypted_password =
        encrypt_data(&password.password, &key).map_err(|e| format!("加密密码失败: {}", e))?;

    // 查找并更新密码
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs();

    if let Some(index) = vault.passwords.iter().position(|p| p.id == password.id) {
        let created_at = vault.passwords[index].created_at;

        vault.passwords[index] = EncryptedPasswordItem {
            id: password.id.clone(),
            title: password.title.clone(),
            username: password.username.clone(),
            password: encrypted_password,
            url: password.url.clone(),
            notes: password.notes.clone(),
            category: password.category.clone(),
            created_at: created_at,
            updated_at: now,
        };

        // 保存并更新内存
        save_vault(&vault)?;
        *PASSWORD_VAULT.write().unwrap() = Some(vault);

        Ok(PasswordItem {
            id: password.id,
            title: password.title,
            username: password.username,
            password: password.password,
            url: password.url,
            notes: password.notes,
            category: password.category,
            created_at: created_at,
            updated_at: now,
        })
    } else {
        Err("密码不存在".to_string())
    }
}

#[tauri::command]
async fn delete_password(id: &str) -> Result<bool, String> {
    let mut vault = get_vault()?;

    // 查找并删除密码
    if let Some(index) = vault.passwords.iter().position(|p| p.id == id) {
        vault.passwords.remove(index);

        // 保存并更新内存
        save_vault(&vault)?;
        *PASSWORD_VAULT.write().unwrap() = Some(vault);

        Ok(true)
    } else {
        Err("密码不存在".to_string())
    }
}

#[tauri::command]
async fn add_category(category: Category) -> Result<Category, String> {
    let mut vault = get_vault()?;

    // 生成唯一ID
    let id = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_millis()
        .to_string();

    let new_category = Category { id, ..category };

    // 添加到密码库
    vault.categories.push(new_category.clone());

    // 保存并更新内存
    save_vault(&vault)?;
    *PASSWORD_VAULT.write().unwrap() = Some(vault);

    Ok(new_category)
}

#[tauri::command]
async fn update_category(category: Category) -> Result<Category, String> {
    let mut vault = get_vault()?;

    // 查找并更新分类
    if let Some(index) = vault.categories.iter().position(|c| c.id == category.id) {
        vault.categories[index] = category.clone();

        // 保存并更新内存
        save_vault(&vault)?;
        *PASSWORD_VAULT.write().unwrap() = Some(vault);

        Ok(category)
    } else {
        Err("分类不存在".to_string())
    }
}

#[tauri::command]
async fn delete_category(id: &str) -> Result<bool, String> {
    let mut vault = get_vault()?;

    // 查找并删除分类
    if let Some(index) = vault.categories.iter().position(|c| c.id == id) {
        vault.categories.remove(index);

        // 保存并更新内存
        save_vault(&vault)?;
        *PASSWORD_VAULT.write().unwrap() = Some(vault);

        Ok(true)
    } else {
        Err("分类不存在".to_string())
    }
}

#[tauri::command]
async fn generate_password(
    length: u32,
    include_uppercase: bool,
    include_lowercase: bool,
    include_numbers: bool,
    include_symbols: bool,
) -> Result<String, String> {
    use rand::Rng;

    let mut chars = Vec::new();

    if include_uppercase {
        chars.extend('A'..='Z');
    }
    if include_lowercase {
        chars.extend('a'..='z');
    }
    if include_numbers {
        chars.extend('0'..='9');
    }
    if include_symbols {
        chars.extend("!@#$%^&*()_+-=[]{}|;:,.<>?".chars());
    }

    if chars.is_empty() {
        return Err("至少需要选择一种字符类型".to_string());
    }

    let mut rng = rand::thread_rng();
    let mut result = String::with_capacity(length as usize);

    for _ in 0..length {
        let idx = rng.gen_range(0..chars.len());
        result.push(chars[idx]);
    }

    Ok(result)
}

#[tauri::command]
async fn generate_two_factor_code(secret: &str) -> Result<String, String> {
    use data_encoding::BASE32;
    use totp_rs::Algorithm;
    use totp_rs::TOTP;

    if secret.is_empty() {
        return Err("2FA密钥不能为空".to_string());
    }

    // 解码Base32编码的密钥，使用标准BASE32字母表（兼容GitHub）
    // 处理可能的空格和大小写问题
    let normalized_secret = secret.trim().to_uppercase();

    // 使用标准BASE32字母表解码，忽略padding
    let decoded_secret = match BASE32.decode(normalized_secret.as_bytes()) {
        Ok(decoded) => decoded,
        Err(_e) => {
            // 尝试添加padding后再解码
            let padded_secret = match normalized_secret.len() % 8 {
                2 => format!("{}{}", normalized_secret, "======"),
                4 => format!("{}{}", normalized_secret, "===="),
                5 => format!("{}{}", normalized_secret, "==="),
                7 => format!("{}{}", normalized_secret, "="),
                _ => normalized_secret,
            };

            match BASE32.decode(padded_secret.as_bytes()) {
                Ok(decoded) => decoded,
                Err(e) => {
                    return Err(format!("解码Base32密钥失败: {:?}", e));
                }
            }
        }
    };

    // 调试信息：显示原始解码后的密钥长度
    let _original_len = decoded_secret.len();

    // 检查密钥长度，确保不超过TOTP要求的最大长度
    // 对于SHA1，推荐密钥长度为20字节（160位）
    // totp-rs 5.0版本对密钥长度有严格限制
    let mut truncated_secret = decoded_secret;
    // 对于SHA1算法，使用20字节密钥长度
    if truncated_secret.len() > 20 {
        // 截断密钥到20字节，这是SHA1的推荐长度
        truncated_secret.truncate(20);
    }

    // 获取密钥长度用于调试
    let _secret_len = truncated_secret.len();

    // 创建TOTP生成器，使用new_unchecked方法
    // 注意：new_unchecked会跳过验证，可能会创建不安全的TOTP生成器
    // 但对于测试目的，我们可以尝试这种方法
    let totp = TOTP::new_unchecked(
        Algorithm::SHA1,  // 算法
        6,                // 位数
        1,                // skew（时间步长乘数）
        30,               // step（时间步长，秒）
        truncated_secret, // 密钥
    );

    // 生成当前时间的验证码
    let code = totp
        .generate_current()
        .map_err(|e| format!("生成验证码失败: {:?}", e))?;

    Ok(code)
}

// 辅助函数：获取密码库
fn get_vault() -> Result<PasswordVault, String> {
    // 尝试从内存获取
    {
        let vault = PASSWORD_VAULT.read().unwrap();
        if let Some(vault) = &*vault {
            return Ok(vault.clone());
        }
    }

    // 从文件加载
    load_vault()
}

// 辅助函数：加载密码库
fn load_vault() -> Result<PasswordVault, String> {
    let vault_path = Path::new(&*VAULT_FILE_PATH);

    if !vault_path.exists() {
        return Err("密码库不存在".to_string());
    }

    let contents = fs::read_to_string(vault_path).map_err(|e| format!("读取密码库失败: {}", e))?;
    let vault: PasswordVault =
        serde_json::from_str(&contents).map_err(|e| format!("解析密码库失败: {}", e))?;

    Ok(vault)
}

// 辅助函数：使用主密码生成AES密钥
fn derive_key(master_password: &str, salt: &[u8]) -> [u8; 32] {
    use sha2::Digest;
    let mut hasher = sha2::Sha256::new();
    hasher.update(master_password);
    hasher.update(salt);
    let result = hasher.finalize();
    let mut key = [0u8; 32];
    key.copy_from_slice(&result[..]);
    key
}

// 辅助函数：加密数据
fn encrypt_data(data: &str, key: &[u8]) -> Result<String, String> {
    use aes::Aes256;
    use cipher::BlockEncrypt;
    use cipher::KeyInit;
    use generic_array::typenum::U16;
    use generic_array::GenericArray;

    type Block = GenericArray<u8, U16>;

    let iv = rand::random::<[u8; 16]>();
    let cipher = Aes256::new_from_slice(key).map_err(|e| format!("创建加密器失败: {}", e))?;

    let mut buffer = data.as_bytes().to_vec();
    let padding_size = 16 - (buffer.len() % 16);
    buffer.extend(vec![padding_size as u8; padding_size]);

    let mut block = Block::default();
    for chunk in buffer.chunks_mut(16) {
        block.copy_from_slice(chunk);
        cipher.encrypt_block(&mut block);
        chunk.copy_from_slice(&block);
    }

    let mut result = Vec::new();
    result.extend(&iv);
    result.extend(buffer);

    Ok(hex::encode(result))
}

// 辅助函数：解密数据
fn decrypt_data(encrypted: &str, key: &[u8]) -> Result<String, String> {
    use aes::Aes256;
    use cipher::BlockDecrypt;
    use cipher::KeyInit;
    use generic_array::typenum::U16;
    use generic_array::GenericArray;

    type Block = GenericArray<u8, U16>;

    let encrypted_bytes = hex::decode(encrypted).map_err(|e| format!("解码失败: {}", e))?;
    if encrypted_bytes.len() < 16 {
        return Err("加密数据太短".to_string());
    }

    let (_iv, ciphertext) = encrypted_bytes.split_at(16);
    let mut buffer = ciphertext.to_vec();

    let cipher = Aes256::new_from_slice(key).map_err(|e| format!("创建解密器失败: {}", e))?;

    let mut block = Block::default();
    for chunk in buffer.chunks_mut(16) {
        block.copy_from_slice(chunk);
        cipher.decrypt_block(&mut block);
        chunk.copy_from_slice(&block);
    }

    let padding_size = buffer.last().copied().unwrap_or(0) as usize;
    if padding_size > 0 && padding_size <= 16 {
        buffer.truncate(buffer.len() - padding_size);
    }

    String::from_utf8(buffer).map_err(|e| format!("转换为字符串失败: {}", e))
}

// 辅助函数：保存密码库
fn save_vault(vault: &PasswordVault) -> Result<(), String> {
    let vault_path = Path::new(&*VAULT_FILE_PATH);

    // 确保目录存在
    if let Some(parent) = vault_path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("创建目录失败: {}", e))?;
    }

    let contents = serde_json::to_string(vault).map_err(|e| format!("序列化密码库失败: {}", e))?;
    fs::write(vault_path, contents).map_err(|e| format!("写入密码库失败: {}", e))?;

    Ok(())
}

#[tauri::command]
async fn backup_vault() -> Result<String, String> {
    let vault_path = Path::new(&*VAULT_FILE_PATH);
    if !vault_path.exists() {
        return Err("密码库文件不存在".to_string());
    }

    // 读取密码库文件内容
    match std::fs::read_to_string(vault_path) {
        Ok(content) => Ok(content),
        Err(e) => Err(format!("读取密码库文件失败: {}", e)),
    }
}

#[tauri::command]
async fn restore_vault(content: &str) -> Result<bool, String> {
    let vault_path = Path::new(&*VAULT_FILE_PATH);

    // 首先验证输入内容是否为有效的 PasswordVault 结构
    match serde_json::from_str::<PasswordVault>(content) {
        Err(e) => return Err(format!("解析密码库失败: {}", e)),
        Ok(_) => {}
    }

    // 确保目录存在
    if let Some(parent) = vault_path.parent() {
        if !parent.exists() {
            match std::fs::create_dir_all(parent) {
                Err(e) => return Err(format!("创建目录失败: {}", e)),
                _ => {}
            }
        }
    }

    // 写入密码库文件
    match std::fs::write(vault_path, content) {
        Ok(_) => {
            // 重新加载密码库
            match load_vault() {
                Ok(vault) => {
                    let mut vault_guard = PASSWORD_VAULT.write().unwrap();
                    *vault_guard = Some(vault);
                    Ok(true)
                }
                Err(e) => Err(format!("加载密码库失败: {}", e)),
            }
        }
        Err(e) => Err(format!("写入密码库文件失败: {}", e)),
    }
}

#[tauri::command]
async fn get_vault_path() -> String {
    VAULT_FILE_PATH.clone()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler!(
            greet,
            initialize_vault,
            verify_master_password,
            get_passwords,
            get_categories,
            add_password,
            update_password,
            delete_password,
            add_category,
            update_category,
            delete_category,
            generate_password,
            generate_two_factor_code,
            backup_vault,
            restore_vault,
            get_vault_path
        ))
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

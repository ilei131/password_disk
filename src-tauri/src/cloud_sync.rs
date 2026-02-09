// 云同步相关接口实现
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, RwLock};

// API 基础 URL
const BASE_URL: &str = "https://password-disk.ilei.workers.dev";

// 内存存储用户数据
lazy_static::lazy_static! {
    pub static ref USERS: Arc<RwLock<HashMap<String, UserData>>> = Arc::new(RwLock::new(HashMap::new()));
    pub static ref PASSWORDS: Arc<RwLock<HashMap<String, PasswordData>>> = Arc::new(RwLock::new(HashMap::new()));
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct UserData {
    pub id: String,
    pub username: String,
    pub password_hash: String,
    pub salt: String,
    pub created_at: u64,
    pub updated_at: u64,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct PasswordData {
    pub id: String,
    pub user_id: String,
    pub password: String,
    pub created_at: u64,
    pub updated_at: u64,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct RegisterRequest {
    pub username: String,
    pub password: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SyncRequest {
    #[serde(rename = "userId")]
    pub user_id: String,
    pub password: Option<SyncPasswordData>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SyncPasswordData {
    pub id: Option<String>,
    pub password: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ApiResponse {
    pub success: bool,
    pub id: Option<String>,
    pub error: Option<String>,
    pub passwords: Option<Vec<PasswordData>>,
}

#[tauri::command]
pub async fn register(username: String, password: String) -> ApiResponse {
    println!("开始处理注册请求");
    println!("用户名: {}", username);
    println!(
        "密码: {}",
        if password.is_empty() { "空" } else { "******" }
    );

    let client = Client::new();
    let url = format!("{}/api/register", BASE_URL);
    println!("API URL: {}", url);

    let request = RegisterRequest { username, password };
    println!("请求数据: {:?}", request);

    println!("发送网络请求...");
    let response = match client.post(&url).json(&request).send().await {
        Ok(res) => {
            println!("网络请求成功，状态码: {}", res.status());
            res
        }
        Err(e) => {
            println!("网络请求失败: {}", e);
            return ApiResponse {
                success: false,
                id: None,
                error: Some(format!("网络请求失败: {}", e)),
                passwords: None,
            };
        }
    };

    println!("解析响应数据...");
    let response_data: Result<serde_json::Value, _> = response.json().await;
    match response_data {
        Ok(data) => {
            println!("响应数据解析成功: {:?}", data);
            if data
                .get("success")
                .and_then(|v| v.as_bool())
                .unwrap_or(false)
            {
                println!("注册成功");
                ApiResponse {
                    success: true,
                    id: data
                        .get("id")
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string()),
                    error: None,
                    passwords: None,
                }
            } else {
                let error_msg = data
                    .get("error")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string())
                    .or(Some("注册失败".to_string()));
                println!("注册失败: {:?}", error_msg);
                ApiResponse {
                    success: false,
                    id: None,
                    error: error_msg,
                    passwords: None,
                }
            }
        }
        Err(e) => {
            println!("解析响应失败: {}", e);
            ApiResponse {
                success: false,
                id: None,
                error: Some(format!("解析响应失败: {}", e)),
                passwords: None,
            }
        }
    }
}

#[tauri::command]
pub async fn login(username: String, password: String) -> ApiResponse {
    println!("开始处理登录请求");
    println!("用户名: {}", username);
    println!(
        "密码: {}",
        if password.is_empty() { "空" } else { "******" }
    );

    let client = Client::new();
    let url = format!("{}/api/login", BASE_URL);
    println!("API URL: {}", url);

    let request = LoginRequest { username, password };
    println!("请求数据: {:?}", request);

    println!("发送网络请求...");
    let response = match client.post(&url).json(&request).send().await {
        Ok(res) => {
            println!("网络请求成功，状态码: {}", res.status());
            res
        }
        Err(e) => {
            println!("网络请求失败: {}", e);
            return ApiResponse {
                success: false,
                id: None,
                error: Some(format!("网络请求失败: {}", e)),
                passwords: None,
            };
        }
    };

    println!("解析响应数据...");
    let response_data: Result<serde_json::Value, _> = response.json().await;
    match response_data {
        Ok(data) => {
            println!("响应数据解析成功: {:?}", data);
            if data
                .get("success")
                .and_then(|v| v.as_bool())
                .unwrap_or(false)
            {
                println!("登录成功");
                ApiResponse {
                    success: true,
                    id: data
                        .get("id")
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string()),
                    error: None,
                    passwords: None,
                }
            } else {
                let error_msg = data
                    .get("error")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string())
                    .or(Some("登录失败".to_string()));
                println!("登录失败: {:?}", error_msg);
                ApiResponse {
                    success: false,
                    id: None,
                    error: error_msg,
                    passwords: None,
                }
            }
        }
        Err(e) => {
            println!("解析响应失败: {}", e);
            ApiResponse {
                success: false,
                id: None,
                error: Some(format!("解析响应失败: {}", e)),
                passwords: None,
            }
        }
    }
}

#[tauri::command]
pub async fn sync(request: SyncRequest) -> ApiResponse {
    let client = Client::new();
    let url = format!("{}/api/sync", BASE_URL);

    let response = match client.post(&url).json(&request).send().await {
        Ok(res) => res,
        Err(e) => {
            return ApiResponse {
                success: false,
                id: None,
                error: Some(format!("网络请求失败: {}", e)),
                passwords: None,
            };
        }
    };

    let response_data: Result<serde_json::Value, _> = response.json().await;
    match response_data {
        Ok(data) => {
            if data
                .get("success")
                .and_then(|v| v.as_bool())
                .unwrap_or(false)
            {
                ApiResponse {
                    success: true,
                    id: None,
                    error: None,
                    passwords: None,
                }
            } else {
                ApiResponse {
                    success: false,
                    id: None,
                    error: data
                        .get("error")
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string())
                        .or(Some("同步失败".to_string())),
                    passwords: None,
                }
            }
        }
        Err(e) => ApiResponse {
            success: false,
            id: None,
            error: Some(format!("解析响应失败: {}", e)),
            passwords: None,
        },
    }
}

#[tauri::command]
pub async fn get_cloud_passwords(user_id: String) -> ApiResponse {
    let client = Client::new();
    let url = format!("{}/api/passwords?user_id={}", BASE_URL, user_id);

    let response = match client.get(&url).send().await {
        Ok(res) => res,
        Err(e) => {
            return ApiResponse {
                success: false,
                id: None,
                error: Some(format!("网络请求失败: {}", e)),
                passwords: None,
            };
        }
    };

    let response_data: Result<serde_json::Value, _> = response.json().await;
    match response_data {
        Ok(data) => {
            if let Some(passwords_array) = data.get("passwords").and_then(|v| v.as_array()) {
                let mut passwords = Vec::new();
                for password_item in passwords_array {
                    if let Some(id) = password_item.get("id").and_then(|v| v.as_str()) {
                        if let Some(user_id) = password_item.get("user_id").and_then(|v| v.as_str())
                        {
                            if let Some(password) =
                                password_item.get("password").and_then(|v| v.as_str())
                            {
                                let created_at = password_item
                                    .get("created_at")
                                    .and_then(|v| v.as_u64())
                                    .unwrap_or(0);
                                let updated_at = password_item
                                    .get("updated_at")
                                    .and_then(|v| v.as_u64())
                                    .unwrap_or(0);

                                passwords.push(PasswordData {
                                    id: id.to_string(),
                                    user_id: user_id.to_string(),
                                    password: password.to_string(),
                                    created_at,
                                    updated_at,
                                });
                            }
                        }
                    }
                }
                ApiResponse {
                    success: true,
                    id: None,
                    error: None,
                    passwords: Some(passwords),
                }
            } else {
                ApiResponse {
                    success: true,
                    id: None,
                    error: None,
                    passwords: Some(Vec::new()),
                }
            }
        }
        Err(e) => ApiResponse {
            success: false,
            id: None,
            error: Some(format!("解析响应失败: {}", e)),
            passwords: None,
        },
    }
}

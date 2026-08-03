use std::path::PathBuf;

use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use md5::{Digest, Md5};
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppEntry {
    pub id: String,
    pub name: String,
    pub display_name: String,
    pub path: String,
    pub icon_data_url: String,
}

fn entry_id(path: &str) -> String {
    BASE64.encode(path.as_bytes())
}

fn md5_hex(input: &str) -> String {
    let mut hasher = Md5::new();
    hasher.update(input.as_bytes());
    format!("{:x}", hasher.finalize())
}

fn data_url(bytes: &[u8]) -> String {
    format!("data:image/png;base64,{}", BASE64.encode(bytes))
}

pub fn scan_applications(scan_paths: Vec<String>, cache_dir: PathBuf) -> Vec<AppEntry> {
    #[cfg(target_os = "macos")]
    {
        mac::scan(scan_paths, cache_dir)
    }
    #[cfg(target_os = "windows")]
    {
        windows::scan(scan_paths)
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        let _ = (scan_paths, cache_dir);
        Vec::new()
    }
}

#[cfg(target_os = "macos")]
mod mac {
    use std::collections::HashSet;
    use std::fs;
    use std::path::{Path, PathBuf};
    use std::process::Command;
    use std::time::UNIX_EPOCH;

    use super::{data_url, entry_id, md5_hex, AppEntry};

    const ICON_SIZE: &str = "64";
    const CHINESE_LPROJ_PRIORITY: &[&str] = &[
        "zh-Hans",
        "zh-Hant",
        "zh-CN",
        "zh-TW",
        "zh_CN",
        "zh_TW",
        "zh",
    ];

    const SYSTEM_APP_CHINESE_NAMES: &[(&str, &str)] = &[
        ("Activity Monitor", "活动监视器"),
        ("AirPort Utility", "无线网络实用工具"),
        ("App Store", "App Store"),
        ("Audio MIDI Setup", "音频 MIDI 设置"),
        ("Automator", "自动操作"),
        ("Bluetooth File Exchange", "蓝牙文件交换"),
        ("Books", "图书"),
        ("Boot Camp Assistant", "Boot Camp 助理"),
        ("Calculator", "计算器"),
        ("Calendar", "日历"),
        ("Chess", "国际象棋"),
        ("Clock", "时钟"),
        ("ColorSync Utility", "ColorSync 实用工具"),
        ("Console", "控制台"),
        ("Contacts", "通讯录"),
        ("Dictionary", "词典"),
        ("Digital Color Meter", "数码测色计"),
        ("Disk Utility", "磁盘工具"),
        ("FaceTime", "FaceTime 通话"),
        ("FindMy", "查找"),
        ("Font Book", "字体册"),
        ("Freeform", "无边记"),
        ("Grapher", "Grapher"),
        ("Home", "家庭"),
        ("Image Capture", "图像捕捉"),
        ("Image Playground", "图像游乐场"),
        ("iPhone Mirroring", "iPhone 镜像"),
        ("Journal", "手记"),
        ("Magnifier", "放大器"),
        ("Mail", "邮件"),
        ("Maps", "地图"),
        ("Messages", "信息"),
        ("Migration Assistant", "迁移助理"),
        ("Mission Control", "调度中心"),
        ("Music", "音乐"),
        ("News", "新闻"),
        ("Notes", "备忘录"),
        ("Passwords", "密码"),
        ("Phone", "电话"),
        ("Photo Booth", "Photo Booth"),
        ("Photos", "照片"),
        ("Podcasts", "播客"),
        ("Preview", "预览"),
        ("Print Center", "打印中心"),
        ("QuickTime Player", "QuickTime Player"),
        ("Reminders", "提醒事项"),
        ("Screen Sharing", "屏幕共享"),
        ("Screenshot", "截屏"),
        ("Script Editor", "脚本编辑器"),
        ("Shortcuts", "快捷指令"),
        ("Siri", "Siri"),
        ("Stickies", "便笺"),
        ("Stocks", "股市"),
        ("System Information", "系统信息"),
        ("System Settings", "系统设置"),
        ("TV", "电视"),
        ("Terminal", "终端"),
        ("TextEdit", "文本编辑"),
        ("Time Machine", "时间机器"),
        ("Tips", "使用技巧"),
        ("VoiceMemos", "语音备忘录"),
        ("VoiceOver Utility", "旁白实用工具"),
        ("Weather", "天气"),
    ];

    fn is_system_app_path(app_path: &Path) -> bool {
        let text = app_path.to_string_lossy();
        text.starts_with("/System/Applications/")
            || text.starts_with("/System/Cryptexes/App/System/Applications/")
    }

    fn system_chinese_name(name: &str) -> Option<&str> {
        SYSTEM_APP_CHINESE_NAMES
            .iter()
            .find(|(key, _)| *key == name)
            .map(|(_, value)| *value)
    }

    struct PlistInfo {
        name: String,
        icon_file: Option<String>,
    }

    fn read_plist(app_path: &Path) -> Option<PlistInfo> {
        let info_path = app_path.join("Contents/Info.plist");
        let bytes = fs::read(info_path).ok()?;
        let value = plist::Value::from_reader(std::io::Cursor::new(bytes)).ok()?;
        let dict = value.as_dictionary()?;
        let display = dict
            .get("CFBundleDisplayName")
            .and_then(|value| value.as_string());
        let name = dict.get("CFBundleName").and_then(|value| value.as_string());
        let icon_file = dict
            .get("CFBundleIconFile")
            .and_then(|value| value.as_string())
            .map(|value| value.to_string());
        let name = display
            .or(name)
            .unwrap_or_else(|| app_path.file_name().and_then(|name| name.to_str()).unwrap_or(""));
        Some(PlistInfo {
            name: name.to_string(),
            icon_file,
        })
    }

    fn read_localized_name(app_path: &Path) -> Option<String> {
        let resources = app_path.join("Contents/Resources");
        for locale in CHINESE_LPROJ_PRIORITY {
            let strings_path = resources
                .join(format!("{locale}.lproj"))
                .join("InfoPlist.strings");
            if !strings_path.is_file() {
                continue;
            }
            let output = Command::new("/usr/bin/plutil")
                .args(["-convert", "xml1", "-o", "-"])
                .arg(&strings_path)
                .output()
                .ok()?;
            if !output.status.success() {
                continue;
            }
            let Ok(value) = plist::Value::from_reader(std::io::Cursor::new(output.stdout)) else {
                continue;
            };
            let Some(dict) = value.as_dictionary() else {
                continue;
            };
            for key in ["CFBundleDisplayName", "CFBundleName"] {
                if let Some(name) = dict.get(key).and_then(|value| value.as_string()) {
                    if !name.is_empty() {
                        return Some(name.to_string());
                    }
                }
            }
        }
        None
    }

    fn walk_apps(dir: &Path, seen: &mut HashSet<PathBuf>, apps: &mut Vec<PathBuf>) {
        if !dir.is_dir() {
            return;
        }
        let real = fs::canonicalize(dir).unwrap_or_else(|_| dir.to_path_buf());
        if !seen.insert(real) {
            return;
        }
        let Ok(entries) = fs::read_dir(dir) else {
            return;
        };
        for entry in entries.flatten() {
            let path = entry.path();
            let is_dir = if entry.file_type().map(|t| t.is_symlink()).unwrap_or(false) {
                fs::metadata(&path).map(|meta| meta.is_dir()).unwrap_or(false)
            } else {
                entry.file_type().map(|t| t.is_dir()).unwrap_or(false)
            };
            if !is_dir {
                continue;
            }
            if path.extension().and_then(|ext| ext.to_str()) == Some("app") && path.is_dir() {
                apps.push(path);
                continue;
            }
            walk_apps(&path, seen, apps);
        }
    }

    fn find_icon_path(app_path: &Path, plist: &PlistInfo) -> Option<PathBuf> {
        let resources = app_path.join("Contents/Resources");
        if !resources.is_dir() {
            return None;
        }
        let named = plist
            .icon_file
            .clone()
            .or_else(|| Some(plist.name.clone()))?;
        let base = resources.join(&named);
        for candidate in [base.clone(), base.with_extension("icns")] {
            if candidate.is_file() {
                return Some(candidate);
            }
        }
        let mut icns_files: Vec<PathBuf> = fs::read_dir(&resources)
            .ok()?
            .flatten()
            .map(|entry| entry.path())
            .filter(|path| path.extension().and_then(|ext| ext.to_str()) == Some("icns"))
            .collect();
        icns_files.sort_by_key(|path| fs::metadata(path).map(|meta| meta.len()).unwrap_or(0));
        icns_files.last().cloned()
    }

    fn icon_data_url(app_path: &Path, plist: &PlistInfo, cache_dir: &Path) -> String {
        let Some(icon_path) = find_icon_path(app_path, plist) else {
            return String::new();
        };
        let mtime = fs::metadata(&icon_path)
            .ok()
            .and_then(|meta| meta.modified().ok())
            .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
            .map(|duration| duration.as_millis() as u64)
            .unwrap_or(0);
        let hash = md5_hex(&app_path.to_string_lossy());
        let cache_file = cache_dir.join(format!("v2-{hash}-{mtime}.png"));
        if cache_file.is_file() {
            if let Ok(bytes) = fs::read(&cache_file) {
                return data_url(&bytes);
            }
        }
        let _ = fs::create_dir_all(cache_dir);
        let temp_file = cache_dir.join(format!("tmp-{hash}-{mtime}.png"));
        let status = Command::new("/usr/bin/sips")
            .args(["-s", "format", "png", "-Z", ICON_SIZE])
            .arg(&icon_path)
            .args(["--out"])
            .arg(&temp_file)
            .status();
        if status.map(|value| value.success()).unwrap_or(false) && temp_file.is_file() {
            let _ = fs::rename(&temp_file, &cache_file);
            if let Ok(bytes) = fs::read(&cache_file) {
                return data_url(&bytes);
            }
        }
        String::new()
    }

    pub fn scan(scan_paths: Vec<String>, cache_dir: PathBuf) -> Vec<AppEntry> {
        let mut seen = HashSet::new();
        let mut apps = Vec::new();
        for raw_path in scan_paths {
            let mut candidates = Vec::new();
            walk_apps(Path::new(&raw_path), &mut seen, &mut candidates);
            for app_path in candidates {
                let Some(plist) = read_plist(&app_path) else {
                    continue;
                };
                let localized = read_localized_name(&app_path);
                let system_name = if is_system_app_path(&app_path) {
                    system_chinese_name(&plist.name)
                } else {
                    None
                };
                let display_name = localized
                    .or_else(|| system_name.map(|name| name.to_string()))
                    .unwrap_or_else(|| plist.name.clone());
                let path_text = app_path.to_string_lossy().into_owned();
                apps.push(AppEntry {
                    id: entry_id(&path_text),
                    name: plist.name.clone(),
                    display_name,
                    path: path_text,
                    icon_data_url: icon_data_url(&app_path, &plist, &cache_dir),
                });
            }
        }
        apps.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
        apps
    }
}

#[cfg(target_os = "windows")]
mod windows {
    use std::collections::HashSet;
    use std::fs;
    use std::path::{Path, PathBuf};

    use super::{entry_id, AppEntry};

    fn walk_shortcuts(dir: &Path, seen: &mut HashSet<PathBuf>, shortcuts: &mut Vec<PathBuf>) {
        if !dir.is_dir() {
            return;
        }
        let real = fs::canonicalize(dir).unwrap_or_else(|_| dir.to_path_buf());
        if !seen.insert(real) {
            return;
        }
        let Ok(entries) = fs::read_dir(dir) else {
            return;
        };
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                walk_shortcuts(&path, seen, shortcuts);
            } else if path.extension().and_then(|ext| ext.to_str()) == Some("lnk") {
                shortcuts.push(path);
            }
        }
    }

    pub fn scan(scan_paths: Vec<String>) -> Vec<AppEntry> {
        let mut paths = scan_paths;
        if let Ok(program_data) = std::env::var("PROGRAMDATA") {
            paths.push(format!(
                "{program_data}\\Microsoft\\Windows\\Start Menu\\Programs"
            ));
        }
        if let Ok(app_data) = std::env::var("APPDATA") {
            paths.push(format!("{app_data}\\Microsoft\\Windows\\Start Menu\\Programs"));
        }

        let mut seen = HashSet::new();
        let mut shortcuts = Vec::new();
        for raw_path in paths {
            walk_shortcuts(Path::new(&raw_path), &mut seen, &mut shortcuts);
        }
        shortcuts.sort();
        shortcuts
            .into_iter()
            .map(|path| {
                let path_text = path.to_string_lossy().into_owned();
                let name = path
                    .file_stem()
                    .and_then(|stem| stem.to_str())
                    .unwrap_or("")
                    .to_string();
                AppEntry {
                    id: entry_id(&path_text),
                    name: name.clone(),
                    display_name: name,
                    path: path_text,
                    icon_data_url: String::new(),
                }
            })
            .collect()
    }
}

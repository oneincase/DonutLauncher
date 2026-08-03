use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::{AppHandle, Manager};

fn default_scan_paths() -> Vec<String> {
    let mut paths = Vec::new();
    #[cfg(target_os = "macos")]
    paths.push("/System/Applications".to_string());
    paths.push("/Applications".to_string());
    if let Some(home) = dirs::home_dir() {
        paths.push(home.join("Applications").to_string_lossy().into_owned());
    }
    paths
}

fn default_center_icon_path() -> String {
    "/center.jpg".to_string()
}

#[cfg(target_os = "macos")]
const SYSTEM_APPS_PATH: &str = "/System/Applications";

fn ensure_system_apps_path(settings: &mut Settings) {
    #[cfg(target_os = "macos")]
    if !settings.scan_paths.iter().any(|path| path == SYSTEM_APPS_PATH) {
        settings.scan_paths.insert(0, SYSTEM_APPS_PATH.to_string());
    }
    #[cfg(not(target_os = "macos"))]
    let _ = settings;
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct Settings {
    pub scan_paths: Vec<String>,
    pub ring_colors: Vec<String>,
    pub ring_opacity: f64,
    pub ring_stroke_width: f64,
    pub shortcut: String,
    pub center_icon_path: String,
    pub center_icon_size: f64,
    pub enable_rotation: bool,
    pub rotation_speed: f64,
    pub icon_scale: f64,
    pub target_fps: f64,
    pub auto_check_update: bool,
    pub auto_launch: bool,
    pub favorites: Vec<String>,
    pub sort_mode: String,
    pub recent_usage: HashMap<String, u64>,
    pub excluded_apps: Vec<String>,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            scan_paths: default_scan_paths(),
            ring_colors: vec![
                "#FF6B9D".to_string(),
                "#4ECDC4".to_string(),
                "#FFE66D".to_string(),
            ],
            ring_opacity: 0.45,
            ring_stroke_width: 2.0,
            shortcut: "Option+Space".to_string(),
            center_icon_path: String::new(),
            center_icon_size: 56.0,
            enable_rotation: true,
            rotation_speed: 1.0,
            icon_scale: 1.25,
            target_fps: 60.0,
            auto_check_update: true,
            auto_launch: false,
            favorites: Vec::new(),
            sort_mode: "name".to_string(),
            recent_usage: HashMap::new(),
            excluded_apps: Vec::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingsView {
    #[serde(flatten)]
    pub settings: Settings,
    pub default_scan_paths: Vec<String>,
    pub default_center_icon_path: String,
}

pub struct SettingsState(pub Mutex<Settings>);

impl Default for SettingsState {
    fn default() -> Self {
        Self(Mutex::new(Settings::default()))
    }
}

impl SettingsState {
    pub fn load(app: &AppHandle) -> Result<Self, String> {
        let path = settings_path(app)?;
        let mut settings = if path.exists() {
            let raw = fs::read_to_string(&path).map_err(|err| err.to_string())?;
            serde_json::from_str::<Settings>(&raw).map_err(|err| err.to_string())?
        } else {
            Settings::default()
        };
        ensure_system_apps_path(&mut settings);
        Ok(Self(Mutex::new(settings)))
    }

    pub fn save(&self, app: &AppHandle) -> Result<(), String> {
        let path = settings_path(app)?;
        let settings = self.0.lock().unwrap().clone();
        let json = serde_json::to_string_pretty(&settings).map_err(|err| err.to_string())?;
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).map_err(|err| err.to_string())?;
        }
        let temp_path = path.with_extension("json.tmp");
        fs::write(&temp_path, json).map_err(|err| err.to_string())?;
        fs::rename(&temp_path, &path).map_err(|err| err.to_string())
    }
}

fn settings_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_config_dir()
        .map(|dir| dir.join("settings.json"))
        .map_err(|err| err.to_string())
}

pub fn settings_exists(app: &AppHandle) -> bool {
    settings_path(app).map(|path| path.exists()).unwrap_or(false)
}

pub fn validate(settings: &Settings) -> Result<(), String> {
    if !(0.0..=1.0).contains(&settings.ring_opacity) {
        return Err("ringOpacity 必须在 0 到 1 之间".to_string());
    }
    if !(1.0..=50.0).contains(&settings.ring_stroke_width) {
        return Err("ringStrokeWidth 必须在 1 到 50 之间".to_string());
    }
    if !(20.0..=120.0).contains(&settings.center_icon_size) {
        return Err("centerIconSize 必须在 20 到 120 之间".to_string());
    }
    if !(0.0..=3.0).contains(&settings.rotation_speed) {
        return Err("rotationSpeed 必须在 0 到 3 之间".to_string());
    }
    if !(1.0..=2.5).contains(&settings.icon_scale) {
        return Err("iconScale 必须在 1 到 2.5 之间".to_string());
    }
    if settings.target_fps != 0.0 && !(15.0..=240.0).contains(&settings.target_fps) {
        return Err("targetFps 必须是 0 或 15-240 之间的值".to_string());
    }
    if !["name", "recent", "favorites"].contains(&settings.sort_mode.as_str()) {
        return Err("sortMode 必须是 name/recent/favorites".to_string());
    }
    Ok(())
}

pub fn merge(current: &Settings, partial: &Value) -> Result<Settings, String> {
    let mut value = serde_json::to_value(current).map_err(|err| err.to_string())?;
    if let (Some(map), Some(part)) = (value.as_object_mut(), partial.as_object()) {
        for (key, item) in part {
            map.insert(key.clone(), item.clone());
        }
    }
    let merged: Settings = serde_json::from_value(value).map_err(|err| err.to_string())?;
    validate(&merged)?;
    Ok(merged)
}

pub fn settings_view(settings: Settings) -> SettingsView {
    SettingsView {
        settings,
        default_scan_paths: default_scan_paths(),
        default_center_icon_path: default_center_icon_path(),
    }
}

fn copy_dir_recursive(from: &Path, to: &Path) {
    if !from.is_dir() {
        return;
    }
    let _ = fs::create_dir_all(to);
    let Ok(entries) = fs::read_dir(from) else {
        return;
    };
    for entry in entries.flatten() {
        let source = entry.path();
        let target = to.join(entry.file_name());
        if source.is_dir() {
            copy_dir_recursive(&source, &target);
        } else if source.is_file() {
            let _ = fs::copy(&source, &target);
        }
    }
}

fn legacy_config_dirs() -> Vec<PathBuf> {
    let mut dirs = Vec::new();
    if let Some(home) = dirs::home_dir() {
        dirs.push(home.join("Library/Application Support/DonutLauncher"));
        dirs.push(home.join("Library/Application Support/甜甜圈启动台"));
    }
    if let Ok(app_data) = std::env::var("APPDATA") {
        let base = PathBuf::from(app_data);
        dirs.push(base.join("DonutLauncher"));
        dirs.push(base.join("甜甜圈启动台"));
    }
    dirs
}

pub fn migrate_legacy_config(app: &AppHandle) {
    let Ok(path) = settings_path(app) else {
        return;
    };
    if path.exists() {
        return;
    }

    let Some(legacy_dir) = legacy_config_dirs().into_iter().find(|dir| dir.join("config.json").is_file()) else {
        return;
    };
    let Ok(raw) = fs::read_to_string(legacy_dir.join("config.json")) else {
        return;
    };
    let Ok(value) = serde_json::from_str::<Value>(&raw) else {
        return;
    };
    let Ok(settings) = serde_json::from_value::<Settings>(value) else {
        return;
    };
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    if let Ok(json) = serde_json::to_string_pretty(&settings) {
        let _ = fs::write(&path, json);
    }
    if let Ok(app_data) = app.path().app_data_dir() {
        copy_dir_recursive(&legacy_dir.join("icon-cache"), &app_data.join("icon-cache"));
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn defaults_are_valid() {
        let settings = Settings::default();
        assert!(validate(&settings).is_ok());
        assert_eq!(settings.shortcut, "Option+Space");
        assert_eq!(settings.sort_mode, "name");
        assert_eq!(settings.target_fps, 60.0);
    }

    #[test]
    fn merge_updates_only_provided_fields() {
        let current = Settings::default();
        let partial = serde_json::json!({ "ringOpacity": 0.8 });
        let merged = merge(&current, &partial).unwrap();
        assert_eq!(merged.ring_opacity, 0.8);
        assert_eq!(merged.ring_colors, current.ring_colors);
    }

    #[test]
    fn merge_rejects_out_of_range_values() {
        let current = Settings::default();
        let partial = serde_json::json!({ "iconScale": 9.0 });
        assert!(merge(&current, &partial).is_err());
    }

    #[test]
    fn defaults_include_system_apps_on_macos() {
        let paths = default_scan_paths();
        #[cfg(target_os = "macos")]
        assert!(paths.contains(&"/System/Applications".to_string()));
        assert!(paths.contains(&"/Applications".to_string()));
    }

    #[test]
    fn ensure_system_apps_path_adds_only_when_missing() {
        let mut settings = Settings::default();
        settings.scan_paths = vec!["/Applications".to_string()];
        ensure_system_apps_path(&mut settings);
        #[cfg(target_os = "macos")]
        assert_eq!(
            settings.scan_paths.first().map(String::as_str),
            Some("/System/Applications")
        );

        let before = settings.scan_paths.clone();
        ensure_system_apps_path(&mut settings);
        assert_eq!(settings.scan_paths, before);
    }
}

#[cfg(test)]
mod scan_integration_tests {
    #[cfg(target_os = "macos")]
    #[test]
    fn scans_system_applications() {
        let apps = crate::scanner::scan_applications(
            vec!["/System/Applications".to_string()],
            std::env::temp_dir().join("donut-test-icon-cache"),
        );
        let names: Vec<&str> = apps.iter().map(|app| app.name.as_str()).collect();
        assert!(names.contains(&"Calculator"), "计算器应被扫描到，实际: {names:?}");
        assert!(names.contains(&"Disk Utility"), "磁盘工具应被扫描到");
        assert!(!apps.is_empty());
    }
}

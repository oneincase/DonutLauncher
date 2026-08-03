use std::time::{SystemTime, UNIX_EPOCH};

use tauri::{AppHandle, Manager, State};
use tauri_plugin_autostart::ManagerExt;

use crate::scanner::{self, AppEntry};
use crate::settings::{self, SettingsState, SettingsView};

#[tauri::command]
pub fn get_apps(
    app: AppHandle,
    state: State<'_, crate::AppState>,
    settings_state: State<'_, SettingsState>,
) -> Result<Vec<AppEntry>, String> {
    let apps = state.apps.lock().unwrap().clone();
    if !apps.is_empty() {
        return Ok(apps);
    }
    refresh_apps(app, state, settings_state)
}

#[tauri::command]
pub fn refresh_apps(
    app: AppHandle,
    state: State<'_, crate::AppState>,
    settings_state: State<'_, SettingsState>,
) -> Result<Vec<AppEntry>, String> {
    let scan_paths = settings_state.0.lock().unwrap().scan_paths.clone();
    let cache_dir = app
        .path()
        .app_data_dir()
        .map(|dir| dir.join("icon-cache"))
        .map_err(|err| err.to_string())?;
    let apps = scanner::scan_applications(scan_paths, cache_dir);
    *state.apps.lock().unwrap() = apps.clone();
    Ok(apps)
}

#[tauri::command]
pub fn launch_app(
    app: AppHandle,
    app_path: String,
    state: State<'_, crate::AppState>,
    settings_state: State<'_, SettingsState>,
) -> Result<(), String> {
    opener::open(&app_path).map_err(|err| err.to_string())?;

    let mut changed = false;
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64;
    {
        let mut settings = settings_state.0.lock().unwrap();
        let apps = state.apps.lock().unwrap();
        if let Some(entry) = apps.iter().find(|entry| entry.path == app_path) {
            settings.recent_usage.insert(entry.id.clone(), now);
            changed = true;
        }
    }
    if changed {
        let _ = settings_state.save(&app);
    }
    crate::window::hide_main_window(&app);
    Ok(())
}

#[tauri::command]
pub fn get_settings(settings_state: State<'_, SettingsState>) -> Result<SettingsView, String> {
    let settings = settings_state.0.lock().unwrap().clone();
    Ok(settings::settings_view(settings))
}

#[tauri::command]
pub fn set_settings(
    app: AppHandle,
    partial: serde_json::Value,
    settings_state: State<'_, SettingsState>,
) -> Result<SettingsView, String> {
    let current = settings_state.0.lock().unwrap().clone();
    let merged = settings::merge(&current, &partial)?;
    *settings_state.0.lock().unwrap() = merged.clone();
    settings_state.save(&app)?;
    if merged.shortcut != current.shortcut {
        crate::shortcut::reapply_shortcut(&app);
    }
    if merged.auto_launch != current.auto_launch {
        let autostart = app.autolaunch();
        let result = if merged.auto_launch {
            autostart.enable()
        } else {
            autostart.disable()
        };
        if let Err(err) = result {
            log::error!("failed to update autostart: {err}");
        }
    }
    Ok(settings::settings_view(merged))
}

#[tauri::command]
pub fn reset_settings(
    app: AppHandle,
    settings_state: State<'_, SettingsState>,
) -> Result<SettingsView, String> {
    let defaults = settings::Settings::default();
    *settings_state.0.lock().unwrap() = defaults.clone();
    settings_state.save(&app)?;
    crate::shortcut::reapply_shortcut(&app);
    Ok(settings::settings_view(defaults))
}

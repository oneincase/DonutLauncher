#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod scanner;
mod settings;
mod shortcut;
mod tray;
mod window;

use std::sync::Mutex;

use tauri::Manager;
use tauri_plugin_autostart::ManagerExt;

pub struct AppState {
    pub apps: Mutex<Vec<scanner::AppEntry>>,
}

pub struct ShortcutState(pub Mutex<Option<String>>);

fn sync_autostart(app: &tauri::AppHandle, settings: &settings::Settings) {
    let autostart = app.autolaunch();
    let enabled = autostart.is_enabled().unwrap_or(false);
    let desired = settings.auto_launch;
    if enabled == desired {
        return;
    }
    let result = if desired {
        autostart.enable()
    } else {
        autostart.disable()
    };
    if let Err(err) = result {
        log::warn!("failed to sync autostart: {err}");
    }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            window::show_main_window(app);
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_log::Builder::new().build())
        .plugin(
            tauri_plugin_autostart::Builder::new()
                .macos_launcher(tauri_plugin_autostart::MacosLauncher::LaunchAgent)
                .build(),
        )
        .manage(AppState {
            apps: Mutex::new(Vec::new()),
        })
        .manage(ShortcutState(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![
            commands::get_apps,
            commands::refresh_apps,
            commands::launch_app,
            commands::get_settings,
            commands::set_settings,
            commands::reset_settings
        ])
        .setup(|app| {
            let handle = app.handle();
            settings::migrate_legacy_config(handle);
            let first_run = !settings::settings_exists(handle);
            let settings_state = settings::SettingsState::load(handle).unwrap_or_default();
            app.manage(settings_state);
            if first_run {
                let state = app.state::<settings::SettingsState>();
                if let Err(err) = state.save(handle) {
                    log::warn!("failed to save default settings on first run: {err}");
                }
            }
            let loaded = {
                let state = app.state::<settings::SettingsState>();
                let guard = state.0.lock().unwrap();
                guard.clone()
            };
            sync_autostart(handle, &loaded);
            window::show_main_window(handle);
            if let Err(err) = tray::create_tray(handle) {
                log::warn!("tray creation failed: {err}");
            }
            if let Err(err) = shortcut::register_current_shortcut(handle) {
                log::warn!("global shortcut registration failed: {err}");
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            window::handle_window_event(window, event);
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

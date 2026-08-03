use std::str::FromStr;

use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

use crate::{settings::SettingsState, ShortcutState as StoredShortcutState};

pub fn normalize_shortcut(raw: &str) -> String {
    raw.replace("Option", "Alt")
}

fn register_shortcut(app: &AppHandle, raw: &str) -> Result<(), String> {
    let normalized = normalize_shortcut(raw);
    let shortcut = Shortcut::from_str(&normalized).map_err(|err| err.to_string())?;
    app.global_shortcut()
        .on_shortcut(shortcut, |app_handle, _shortcut, event| {
            if event.state() == ShortcutState::Pressed {
                crate::window::toggle_main_window(app_handle);
            }
        })
        .map_err(|err| err.to_string())?;
    Ok(())
}

fn unregister_shortcut(app: &AppHandle, raw: &str) -> Result<(), String> {
    let shortcut = Shortcut::from_str(&normalize_shortcut(raw)).map_err(|err| err.to_string())?;
    app.global_shortcut()
        .unregister(shortcut)
        .map_err(|err| err.to_string())
}

pub fn register_current_shortcut(app: &AppHandle) -> Result<(), String> {
    let settings = app.state::<SettingsState>();
    let raw = settings.0.lock().unwrap().shortcut.clone();
    match register_shortcut(app, &raw) {
        Ok(()) => {
            *app.state::<StoredShortcutState>().0.lock().unwrap() = Some(raw);
            Ok(())
        }
        Err(err) => {
            log::error!("failed to register shortcut {raw}: {err}");
            let _ = app.emit("shortcut-error", raw);
            Err(err)
        }
    }
}

pub fn reapply_shortcut(app: &AppHandle) {
    let settings = app.state::<SettingsState>();
    let raw = settings.0.lock().unwrap().shortcut.clone();
    let previous = app.state::<StoredShortcutState>().0.lock().unwrap().clone();
    if previous.as_deref() == Some(raw.as_str()) {
        return;
    }
    if let Some(old) = previous {
        if let Err(err) = unregister_shortcut(app, &old) {
            log::warn!("failed to unregister old shortcut {old}: {err}");
        }
    }
    match register_shortcut(app, &raw) {
        Ok(()) => {
            *app.state::<StoredShortcutState>().0.lock().unwrap() = Some(raw);
        }
        Err(err) => {
            log::error!("failed to register shortcut {raw}: {err}");
            let _ = app.emit("shortcut-error", raw);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::normalize_shortcut;

    #[test]
    fn normalizes_option_to_alt() {
        assert_eq!(normalize_shortcut("Option+Space"), "Alt+Space");
        assert_eq!(normalize_shortcut("Command+Shift+A"), "Command+Shift+A");
    }
}

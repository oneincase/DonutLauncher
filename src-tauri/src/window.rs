use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder, Window, WindowEvent};

const MAIN_WINDOW_LABEL: &str = "main";
const HIDDEN_WINDOW_TTL_SECS: u64 = 60;

pub fn get_main_window(app: &AppHandle) -> Option<tauri::WebviewWindow> {
    app.get_webview_window(MAIN_WINDOW_LABEL)
}

pub fn create_main_window(app: &AppHandle) -> tauri::Result<tauri::WebviewWindow> {
    let window = WebviewWindowBuilder::new(app, MAIN_WINDOW_LABEL, WebviewUrl::App("index.html".into()))
        .title("甜甜圈控制台")
        .inner_size(900.0, 900.0)
        .resizable(false)
        .decorations(false)
        .transparent(true)
        .always_on_top(true)
        .skip_taskbar(true)
        .shadow(false)
        .visible(false)
        .build()?;

    #[cfg(target_os = "macos")]
    window.set_visible_on_all_workspaces(true)?;

    Ok(window)
}

pub fn show_main_window(app: &AppHandle) {
    let window = if let Some(window) = get_main_window(app) {
        window
    } else {
        match create_main_window(app) {
            Ok(window) => window,
            Err(err) => {
                log::error!("failed to create main window: {err}");
                return;
            }
        }
    };
    let _ = window.show();
    let _ = window.set_focus();
    let _ = app.emit("show", ());
}

pub fn toggle_main_window(app: &AppHandle) {
    if let Some(window) = get_main_window(app) {
        if window.is_visible().unwrap_or(false) {
            hide_main_window(app);
        } else {
            show_main_window(app);
        }
    } else {
        show_main_window(app);
    }
}

pub fn hide_main_window(app: &AppHandle) {
    if let Some(window) = get_main_window(app) {
        let _ = window.hide();
        let _ = app.emit("hide", ());
        schedule_destroy(app.clone());
    }
}

pub fn handle_window_event(window: &Window, event: &WindowEvent) {
    if window.label() != MAIN_WINDOW_LABEL {
        return;
    }
    if let WindowEvent::Focused(false) = event {
        let app = window.app_handle().clone();
        // A native file/folder picker is modal and steals focus while it is
        // open; do not hide the launcher in that case, otherwise the window
        // disappears once the user finishes picking.
        let dialog_open = app
            .state::<crate::AppState>()
            .dialog_open
            .load(std::sync::atomic::Ordering::Relaxed);
        if dialog_open {
            return;
        }
        let _ = window.hide();
        let _ = app.emit("hide", ());
        schedule_destroy(app);
    } else if let WindowEvent::Focused(true) = event {
        // Re-focusing means any picker is gone; clear the flag as a safety
        // net in case the frontend missed resetting it (e.g. user cancelled).
        window
            .app_handle()
            .state::<crate::AppState>()
            .dialog_open
            .store(false, std::sync::atomic::Ordering::Relaxed);
    }
}

fn schedule_destroy(app: AppHandle) {
    // Destroying the last window on Windows exits the process, so keep the
    // hidden window around there and only reap it on macOS.
    #[cfg(target_os = "macos")]
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_secs(HIDDEN_WINDOW_TTL_SECS));
        if let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) {
            if !window.is_visible().unwrap_or(false) {
                let _ = window.destroy();
            }
        }
    });
    #[cfg(not(target_os = "macos"))]
    let _ = app;
}

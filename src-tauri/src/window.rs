use tauri::{AppHandle, Emitter, Listener, Manager, WebviewUrl, WebviewWindowBuilder, Window, WindowEvent};

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

fn ensure_main_window(app: &AppHandle) -> Option<tauri::WebviewWindow> {
    if let Some(window) = get_main_window(app) {
        Some(window)
    } else {
        match create_main_window(app) {
            Ok(window) => Some(window),
            Err(err) => {
                log::error!("failed to create main window: {err}");
                None
            }
        }
    }
}

pub fn register_window_ready(app: &AppHandle) {
    let handle = app.clone();
    let shown = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));
    let listener_shown = shown.clone();
    app.listen("window-ready", move |_event| {
        if listener_shown.swap(true, std::sync::atomic::Ordering::Relaxed) {
            return;
        }
        if let Some(window) = get_main_window(&handle) {
            handle
                .state::<crate::AppState>()
                .window_ever_focused
                .store(true, std::sync::atomic::Ordering::Relaxed);
            let _ = window.show();
            let _ = window.set_focus();
            let _ = handle.emit("show", ());
        }
    });
    // Fallback: if the frontend never finishes initialising, still reveal the
    // window after a while so it never stays hidden forever.
    let fallback = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_secs(5));
        if shown.swap(true, std::sync::atomic::Ordering::Relaxed) {
            return;
        }
        if let Some(window) = get_main_window(&fallback) {
            if !window.is_visible().unwrap_or(false) {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }
    });
}

pub fn show_main_window(app: &AppHandle) {
    let Some(window) = ensure_main_window(app) else {
        return;
    };
    // The window is about to be shown/focused, so treat it as focused even if
    // the platform does not deliver a Focused(true) event (some Windows setups).
    app.state::<crate::AppState>()
        .window_ever_focused
        .store(true, std::sync::atomic::Ordering::Relaxed);
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
    let app_state = window.app_handle().state::<crate::AppState>();
    if let WindowEvent::Focused(true) = event {
        app_state
            .window_ever_focused
            .store(true, std::sync::atomic::Ordering::Relaxed);
        // Re-focusing means any picker is gone; clear the flag as a safety
        // net in case the frontend missed resetting it (e.g. user cancelled).
        app_state
            .dialog_open
            .store(false, std::sync::atomic::Ordering::Relaxed);
    } else if let WindowEvent::Focused(false) = event {
        // The window starts hidden and may report a blur before it has ever
        // been shown/focused (Windows); ignore that so it does not get hidden
        // right away on first launch.
        if !app_state
            .window_ever_focused
            .load(std::sync::atomic::Ordering::Relaxed)
        {
            return;
        }
        let app = window.app_handle().clone();
        // A native file/folder picker is modal and steals focus while it is
        // open; do not hide the launcher in that case, otherwise the window
        // disappears once the user finishes picking.
        if app_state.dialog_open.load(std::sync::atomic::Ordering::Relaxed) {
            return;
        }
        let _ = window.hide();
        let _ = app.emit("hide", ());
        schedule_destroy(app);
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

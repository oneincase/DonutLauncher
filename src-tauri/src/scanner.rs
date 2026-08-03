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
        windows::scan(scan_paths, cache_dir)
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
    use std::time::UNIX_EPOCH;

    use super::{data_url, entry_id, md5_hex, AppEntry};

    // Windows Start Menu shortcut names are often English even on a Chinese
    // system, so map known names to their Chinese equivalents.
    const WINDOWS_APP_CHINESE_NAMES: &[(&str, &str)] = &[
        ("3D Viewer", "3D 查看器"),
        ("Alarms & Clock", "闹钟和时钟"),
        ("Calculator", "计算器"),
        ("Calendar", "日历"),
        ("Camera", "相机"),
        ("Character Map", "字符映射表"),
        ("Command Prompt", "命令提示符"),
        ("Control Panel", "控制面板"),
        ("Device Manager", "设备管理器"),
        ("Disk Cleanup", "磁盘清理"),
        ("Disk Management", "磁盘管理"),
        ("Event Viewer", "事件查看器"),
        ("Feedback Hub", "反馈中心"),
        ("File Explorer", "文件资源管理器"),
        ("Get Help", "获取帮助"),
        ("Getting Started", "入门"),
        ("Groove Music", "Groove 音乐"),
        ("Mail", "邮件"),
        ("Magnifier", "放大镜"),
        ("Maps", "地图"),
        ("Math Input Panel", "数学输入面板"),
        ("Microsoft Store", "Microsoft Store"),
        ("Mixed Reality Portal", "Mixed Reality 门户"),
        ("Movies & TV", "电影和电视"),
        ("Narrator", "讲述人"),
        ("Notepad", "记事本"),
        ("On-Screen Keyboard", "屏幕键盘"),
        ("OneNote", "OneNote"),
        ("Paint", "画图"),
        ("People", "人脉"),
        ("Photos", "照片"),
        ("PowerShell", "PowerShell"),
        ("Registry Editor", "注册表编辑器"),
        ("Run", "运行"),
        ("Services", "服务"),
        ("Settings", "设置"),
        ("Snipping Tool", "截图工具"),
        ("Sticky Notes", "便笺"),
        ("Store", "Microsoft Store"),
        ("Task Manager", "任务管理器"),
        ("Terminal", "终端"),
        ("Tips", "使用技巧"),
        ("Voice Recorder", "语音录音机"),
        ("Windows Defender", "Windows Defender"),
        ("Windows Media Player", "Windows Media Player"),
        ("Windows Security", "Windows 安全中心"),
        ("Windows Update", "Windows 更新"),
        ("WordPad", "写字板"),
        ("Xbox", "Xbox"),
    ];

    fn windows_chinese_name(name: &str) -> Option<&str> {
        WINDOWS_APP_CHINESE_NAMES
            .iter()
            .find(|(key, _)| key.eq_ignore_ascii_case(name))
            .map(|(_, value)| *value)
    }

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

    fn lnk_target_path(lnk: &parselnk::Lnk) -> Option<PathBuf> {
        let base = lnk
            .link_info
            .local_base_path_unicode
            .as_ref()
            .or(lnk.link_info.local_base_path.as_ref())?;
        let suffix = lnk
            .link_info
            .common_path_suffix_unicode
            .as_ref()
            .or(lnk.link_info.common_path_suffix.as_ref());
        let joined = match suffix {
            Some(s) if s.starts_with('\\') || s.starts_with('/') => format!("{}{}", base, s),
            Some(s) => format!("{}\\{}", base, s),
            None => base.clone(),
        };
        Some(PathBuf::from(joined))
    }

    // "C:\app.exe,0" -> "C:\app.exe" (strip a trailing icon resource index)
    fn strip_icon_index(path: &Path) -> PathBuf {
        let text = path.to_string_lossy();
        match text.rsplit_once(',') {
            Some((head, idx)) if idx.parse::<i32>().is_ok() => PathBuf::from(head),
            _ => path.to_path_buf(),
        }
    }

    fn ico_to_png(ico_bytes: &[u8]) -> Option<Vec<u8>> {
        let icon_dir = ico::IconDir::read(std::io::Cursor::new(ico_bytes)).ok()?;
        let entry = icon_dir
            .entries()
            .iter()
            .max_by_key(|e| (e.width() * e.height(), e.bits_per_pixel()))?;
        let image = entry.decode().ok()?;
        let mut png = Vec::new();
        image.write_png(&mut png).ok()?;
        Some(png)
    }

    fn extract_icon_png(lnk_path: &Path) -> Option<Vec<u8>> {
        let lnk = parselnk::Lnk::try_from(lnk_path).ok()?;

        // Prefer the .lnk's declared icon source; fall back to the target executable.
        let icon_location = lnk
            .string_data
            .icon_location
            .as_ref()
            .map(|path| strip_icon_index(path))
            .filter(|path| path.is_file());
        let icon_src = icon_location
            .or_else(|| lnk_target_path(&lnk))
            .filter(|path| path.is_file());

        // Standalone .ico files convert directly.
        if let Some(src) = &icon_src {
            if src
                .extension()
                .and_then(|ext| ext.to_str())
                .map(|ext| ext.eq_ignore_ascii_case("ico"))
                .unwrap_or(false)
            {
                if let Ok(bytes) = fs::read(src) {
                    if let Some(png) = ico_to_png(&bytes) {
                        return Some(png);
                    }
                }
            }
        }

        // Any PE (exe/dll) exposes its embedded icons through the same resource API.
        // UWP/AppX apps (Calculator, Photos, Settings...) have no icon resources in
        // their exe, so this fails and we fall back to the Shell resolver below.
        if let Some(src) = &icon_src {
            if let Ok(exe_bytes) = fs::read(src) {
                if let Ok(icons) = exeico::get_icos(&exe_bytes) {
                    if let Some(first) = icons.first() {
                        if let Some(png) = ico_to_png(&first.data) {
                            return Some(png);
                        }
                    }
                }
            }
        }

        // Shell fallback: resolve the .lnk through the Windows Shell so UWP apps
        // get their proper icon.
        shell_icon_png(lnk_path)
    }

    #[cfg(target_os = "windows")]
    fn shell_icon_png(lnk_path: &Path) -> Option<Vec<u8>> {
        use std::ffi::OsStr;
        use std::io::Cursor;
        use std::mem::MaybeUninit;
        use std::os::windows::ffi::OsStrExt;

        use windows::core::PCWSTR;
        use windows::Win32::Graphics::Gdi::{
            BI_RGB, BITMAP, BITMAPINFO, BITMAPINFOHEADER, DIB_RGB_COLORS, DeleteObject, GetDC,
            GetDIBits, GetObjectW, HGDIOBJ, ReleaseDC,
        };
        use windows::Win32::Storage::FileSystem::FILE_FLAGS_AND_ATTRIBUTES;
        use windows::Win32::UI::Shell::{SHFILEINFOW, SHGetFileInfoW, SHGFI_ICON};
        use windows::Win32::UI::WindowsAndMessaging::{DestroyIcon, GetIconInfo, HICON};

        struct AutoDc(windows::Win32::Graphics::Gdi::HDC);
        impl Drop for AutoDc {
            fn drop(&mut self) {
                if !self.0 .0.is_null() {
                    unsafe {
                        ReleaseDC(None, self.0);
                    }
                }
            }
        }
        struct AutoObject(HGDIOBJ);
        impl Drop for AutoObject {
            fn drop(&mut self) {
                if !self.0 .0.is_null() {
                    unsafe {
                        DeleteObject(self.0);
                    }
                }
            }
        }
        struct AutoIcon(HICON);
        impl Drop for AutoIcon {
            fn drop(&mut self) {
                if !self.0 .0.is_null() {
                    unsafe {
                        DestroyIcon(self.0);
                    }
                }
            }
        }

        // Resolve the .lnk through the Shell to get its HICON.
        let wide: Vec<u16> = OsStr::new(lnk_path).encode_wide().chain(Some(0)).collect();
        let mut info = MaybeUninit::<SHFILEINFOW>::uninit();
        let result = unsafe {
            SHGetFileInfoW(
                PCWSTR::from_raw(wide.as_ptr()),
                FILE_FLAGS_AND_ATTRIBUTES(0),
                Some(info.as_mut_ptr()),
                std::mem::size_of::<SHFILEINFOW>() as u32,
                SHGFI_ICON,
            )
        };
        if result == 0 {
            return None;
        }
        let info = unsafe { info.assume_init() };
        let hicon = info.hIcon;
        if hicon.0.is_null() {
            return None;
        }

        // Convert the HICON to RGBA via GetIconInfo + GetDIBits.
        let mut icon_info = MaybeUninit::uninit();
        let ok = unsafe { GetIconInfo(hicon, icon_info.as_mut_ptr()) };
        if ok.is_err() {
            unsafe {
                DestroyIcon(hicon);
            }
            return None;
        }
        let icon_info = unsafe { icon_info.assume_init() };
        let _mask_guard = AutoObject(HGDIOBJ::from(icon_info.hbmMask));
        let _color_guard = AutoObject(HGDIOBJ::from(icon_info.hbmColor));
        let _icon_guard = AutoIcon(hicon);

        let mut bm = MaybeUninit::<BITMAP>::uninit();
        let size = std::mem::size_of::<BITMAP>() as i32;
        let n = unsafe {
            GetObjectW(
                HGDIOBJ::from(icon_info.hbmColor),
                size,
                Some(bm.as_mut_ptr().cast()),
            )
        };
        if n != size {
            return None;
        }
        let bm = unsafe { bm.assume_init() };
        let width = bm.bmWidth.unsigned_abs();
        let height = bm.bmHeight.unsigned_abs();
        if width == 0 || height == 0 {
            return None;
        }

        let mut buf = vec![0u32; (width as usize) * (height as usize)];
        let dc = unsafe { GetDC(None) };
        if dc.0.is_null() {
            return None;
        }
        let _dc_guard = AutoDc(dc);

        let mut bi = BITMAPINFO {
            bmiHeader: BITMAPINFOHEADER {
                biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
                biWidth: bm.bmWidth,
                biHeight: -(bm.bmHeight as i32),
                biPlanes: 1,
                biBitCount: 32,
                biCompression: BI_RGB.0,
                biSizeImage: 0,
                biXPelsPerMeter: 0,
                biYPelsPerMeter: 0,
                biClrUsed: 0,
                biClrImportant: 0,
            },
            bmiColors: [Default::default()],
        };
        let lines = unsafe {
            GetDIBits(
                dc,
                icon_info.hbmColor,
                0,
                height,
                Some(buf.as_mut_ptr().cast()),
                &mut bi,
                DIB_RGB_COLORS,
            )
        };
        if lines == 0 || lines as u32 != height {
            return None;
        }

        // Read the 1-bit AND-mask bitmap to fill in alpha for icons that store
        // transparency in the mask plane (16/24bpp icons) instead of a 32-bit
        // alpha channel. A set mask bit means transparent, a clear bit opaque.
        let mask_bits = if bm.bmBitsPixel < 32 {
            read_mono_mask(dc, icon_info.hbmMask, width, height)
        } else {
            None
        };

        // BGRA -> RGBA
        let mut rgba = Vec::with_capacity(buf.len() * 4);
        for (i, px) in buf.iter().enumerate() {
            let b = (px & 0xff) as u8;
            let g = ((px >> 8) & 0xff) as u8;
            let r = ((px >> 16) & 0xff) as u8;
            let mut a = ((px >> 24) & 0xff) as u8;
            if let Some(mask) = &mask_bits {
                let byte = mask[i / 8];
                let bit = byte & (0x80 >> (i % 8));
                let transparent = bit != 0;
                a = if transparent { 0 } else { 255 };
            }
            rgba.extend_from_slice(&[r, g, b, a]);
        }

        let image = image::RgbaImage::from_raw(width, height, rgba)?;
        let mut png = Vec::new();
        image
            .write_to(&mut Cursor::new(&mut png), image::ImageFormat::Png)
            .ok()?;
        Some(png)
    }

    // Reads a 1-bit-per-pixel mask bitmap into a packed byte array (MSB first,
    // rows padded to 32-bit alignment), so alpha can be derived for icons that
    // encode transparency through the mask plane.
    fn read_mono_mask(
        dc: windows::Win32::Graphics::Gdi::HDC,
        mask: windows::Win32::Graphics::Gdi::HBITMAP,
        width: u32,
        height: u32,
    ) -> Option<Vec<u8>> {
        use std::mem::MaybeUninit;

        use windows::Win32::Graphics::Gdi::{BITMAP, BI_RGB, DIB_RGB_COLORS, GetDIBits, GetObjectW};

        if mask.0.is_null() {
            return None;
        }
        let mut bm = MaybeUninit::<BITMAP>::uninit();
        let size = std::mem::size_of::<BITMAP>() as i32;
        let n = unsafe { GetObjectW(HGDIOBJ::from(mask), size, Some(bm.as_mut_ptr().cast())) };
        if n != size {
            return None;
        }
        let bm = unsafe { bm.assume_init() };
        if bm.bmWidth == 0 || bm.bmHeight == 0 {
            return None;
        }
        // 1bpp scan lines are padded to 32-bit boundaries.
        let stride = ((bm.bmWidth as u32 + 31) / 32) * 4;
        let mut bits = vec![0u8; (stride * bm.bmHeight.unsigned_abs()) as usize];
        let mut bi = BITMAPINFO {
            bmiHeader: BITMAPINFOHEADER {
                biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
                biWidth: bm.bmWidth,
                biHeight: -(bm.bmHeight as i32),
                biPlanes: 1,
                biBitCount: 1,
                biCompression: BI_RGB.0,
                biSizeImage: 0,
                biXPelsPerMeter: 0,
                biYPelsPerMeter: 0,
                biClrUsed: 0,
                biClrImportant: 0,
            },
            bmiColors: [Default::default()],
        };
        let lines = unsafe {
            GetDIBits(
                dc,
                mask,
                0,
                bm.bmHeight.unsigned_abs(),
                Some(bits.as_mut_ptr().cast()),
                &mut bi,
                DIB_RGB_COLORS,
            )
        };
        if lines == 0 {
            return None;
        }

        // Pack the padded rows into a tight MSB-first byte array.
        let row_bytes = (width + 7) / 8;
        let mut packed = vec![0u8; (row_bytes * height) as usize];
        for y in 0..height {
            let src = &bits[(y as usize) * stride as usize..(y as usize) * stride as usize + row_bytes as usize];
            let dst = &mut packed[(y as usize) * row_bytes as usize..(y as usize) * row_bytes as usize + row_bytes as usize];
            dst.copy_from_slice(src);
        }
        Some(packed)
    }

    fn icon_data_url(lnk_path: &Path, cache_dir: &Path) -> String {
        let mtime = fs::metadata(lnk_path)
            .ok()
            .and_then(|meta| meta.modified().ok())
            .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
            .map(|duration| duration.as_millis() as u64)
            .unwrap_or(0);
        let hash = md5_hex(&lnk_path.to_string_lossy());
        let cache_file = cache_dir.join(format!("win-{hash}-{mtime}.png"));
        if cache_file.is_file() {
            if let Ok(bytes) = fs::read(&cache_file) {
                return data_url(&bytes);
            }
        }
        let _ = fs::create_dir_all(cache_dir);
        if let Some(png) = extract_icon_png(lnk_path) {
            let _ = fs::write(&cache_file, &png);
            return data_url(&png);
        }
        String::new()
    }

    pub fn scan(scan_paths: Vec<String>, cache_dir: PathBuf) -> Vec<AppEntry> {
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
                let display_name = windows_chinese_name(&name)
                    .map(|value| value.to_string())
                    .unwrap_or_else(|| name.clone());
                AppEntry {
                    id: entry_id(&path_text),
                    name: name.clone(),
                    display_name,
                    path: path_text,
                    icon_data_url: icon_data_url(&path, &cache_dir),
                }
            })
            .collect()
    }
}

# Rust Installation Guide for Zorviz Developer

**You only need to do this ONCE on your development machine.**
Your clients (shops) will **NOT** need to install this. They will receive a finished `.exe` or `.msi` installer.

## Step 1: Download the Installer
1.  Go to [https://rustup.rs/](https://rustup.rs/)
2.  It should detect you are on Windows. Click **"Download rustup-init.exe"**.
    *   *Direct Link:* [https://win.rustup.rs/x86_64](https://win.rustup.rs/x86_64)

## Step 2: Run the Installer
1.  Run the downloaded `rustup-init.exe`.
2.  A terminal window will open.
3.  It might ask to install "Visual Studio C++ Build Tools".
    *   **If yes:** Allow it to install the prerequisites (this takes a few minutes).
    *   **If no/already installed:** It will show installation options.
4.  When prompted `1) Proceed with installation (default)`, type `1` and press **Enter**.
5.  Wait for the installation to complete. It will download the compiler and standard library.

## Step 3: Verify Installation
1.  **Close all open Terminal/PowerShell windows** (Important! Environment variables update only after restart).
2.  Open a **new** PowerShell window.
3.  Run the following command:
    ```powershell
    rustc --version
    ```
4.  You should see something like: `rustc 1.75.0 (82e1608df 2023-12-21)`

## Step 4: Configure VS Code (Optional but Recommended)
1.  Open VS Code Extensions (`Ctrl+Shift+X`).
2.  Search for **`rust-analyzer`**.
3.  Install it.

---

## FAQ

**Q: Do my clients need to install Rust?**
**A: NO.**
When we run `npm run tauri build`, it bundles everything into a standalone installer (e.g., `Zorviz_Setup_1.0.0.exe`). You send this file to the shop. They install it just like Chrome or Excel. They don't need Rust, Node.js, or Git.

**Q: Why do I need it?**
**A:** Tauri uses Rust to build the high-performance "shell" that runs your app. It's what allows the app to talk to the Operating System (File System, Printer, LAN Network) securely.

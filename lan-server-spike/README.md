# LAN Server Connectivity Spike 🔌

A proof-of-concept to test if mobile devices can connect to a Rust HTTP server running on a Windows desktop PC over the local network.

## Purpose

This spike validates a critical assumption for the Zorviz project:
> **Can mechanics on their mobile phones connect to the shop desktop app via local Wi-Fi?**

## What This Tests

✅ Rust HTTP server binding to `0.0.0.0` (accessible on LAN)  
✅ Mobile browser connecting to desktop server  
✅ API calls from mobile to desktop  
✅ Serving static HTML pages  
✅ CORS configuration for cross-origin requests  

## Quick Start

### 1. Run the Server

```bash
cd lan-server-spike
npm start
```

You should see output like:

```
🚀 Starting LAN Server Spike (Node.js Version)...
📍 Local IP: 192.168.1.100

✅ Server is running!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📱 Desktop App: http://localhost:3030/index.html
📱 Mechanic Mobile: http://192.168.1.100:3030/mechanic.html
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 2. Test on Desktop

Open `http://localhost:3030/index.html` in your browser. You'll see the desktop UI with your local IP address.

### 3. Test on Mobile

1. **Connect your phone to the SAME Wi-Fi network** as your PC
2. Open your phone's browser (Chrome/Safari)
3. Navigate to the URL shown in the server output (e.g., `http://192.168.1.100:3030/mechanic.html`)
4. You should see the mobile mechanic interface!

### 4. Test API Connectivity

On the mobile page, tap the **"Fetch Server Time"** button. If you see the server time, the connection works!

## Troubleshooting

### ❌ Can't connect from phone?

**Issue:** Windows Firewall might be blocking the connection.

**Fix:**
1. Open Windows Defender Firewall
2. Go to "Advanced settings" → "Inbound Rules" → "New Rule"
3. Rule Type: Port
4. Protocol: TCP, Port: 3030
5. Action: Allow the connection
6. Apply to all profiles
7. Name it "Zorviz LAN Server"

Alternatively, run this PowerShell command as Administrator:

```powershell
New-NetFirewallRule -DisplayName "Zorviz LAN Server" -Direction Inbound -Protocol TCP -LocalPort 3030 -Action Allow
```

### ❌ Getting "Connection Refused"?

1. Make sure the server is running (`cargo run`)
2. Verify your phone is on the **same Wi-Fi network**
3. Try pinging your PC from another device: `ping 192.168.1.100`

### ❌ Wrong IP address shown?

If you have multiple network adapters, the auto-detected IP might be wrong. Check your correct IP with:

```bash
ipconfig
```

Look for the IPv4 address of your Wi-Fi adapter (usually starts with `192.168.x.x` or `10.0.x.x`).

## Architecture

```
┌─────────────────┐         Local Wi-Fi Network         ┌─────────────────┐
│   Desktop PC    │                                      │  Mobile Phone   │
│                 │                                      │   (Mechanic)    │
│  ┌───────────┐  │                                      │                 │
│  │    GUI    │  │                                      │  ┌───────────┐  │
│  └─────┬─────┘  │                                      │  │  Browser  │  │
│        │        │                                      │  └─────┬─────┘  │
│  ┌─────▼─────┐  │      HTTP (Port 3030)               │        │        │
│  │   Axum    │◄─┼──────────────────────────────────────┼────────┘        │
│  │  Server   │  │                                      │                 │
│  └─────┬─────┘  │                                      │   GET /api/time │
│        │        │                                      │   POST /api/jobs│
│  ┌─────▼─────┐  │                                      │                 │
│  │  SQLite   │  │                                      └─────────────────┘
│  │    DB     │  │
│  └───────────┘  │
└─────────────────┘
```

## Key Files

- **`src/main.rs`** - Rust HTTP server with Axum
- **`index.html`** - Desktop UI (shows server IP)
- **`mechanic.html`** - Mobile mechanic interface
- **`Cargo.toml`** - Rust dependencies

## API Endpoints

- `GET /api/info` - Returns server IP and URL
- `GET /api/time` - Returns current server time (for connectivity test)
- `GET /mechanic.html` - Serves the mechanic mobile page

## Success Criteria

✅ **This spike is successful if:**
1. Server starts and displays local IP
2. Desktop browser can access `http://localhost:3030/index.html`
3. Mobile browser can access `http://<LOCAL_IP>:3030/mechanic.html`
4. Mobile can successfully call `/api/time` and receive a response

## Next Steps

If this spike is successful, we can confidently build the full Tauri app with:
- Embedded Axum server in Tauri backend
- Real SQLite database
- Authentication & authorization
- WebSocket support (if needed for real-time updates)

## Notes

- The server binds to `0.0.0.0:3030`, making it accessible to all devices on the local network
- CORS is wide open (`allow_origin(Any)`) for testing—production should restrict this
- No authentication for this spike—real app will require auth tokens
- This is a standalone Rust binary, not yet integrated into Tauri

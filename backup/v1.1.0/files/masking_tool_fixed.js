const http = require('http');
const fs = require('fs');
const path = require('path');

// 設定連接埠
const PORT = 3001;

// 直接指定絕對路徑 (注意反斜線轉義)
const IMG_DIR = "C:\\Users\\ottoy\\OneDrive\\Desktop\\極致核心 網頁\\img";

console.log(`Target Image Directory: ${IMG_DIR}`);

const server = http.createServer((req, res) => {
    // 設置 CORS 以防萬一
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // 1. 取得圖片列表
    if (req.url === '/list') {
        fs.readdir(IMG_DIR, (err, files) => {
            if (err) {
                console.error("Error reading dir:", err);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: "無法讀取資料夾: " + err.message }));
                return;
            }
            // 過濾圖片檔案
            const images = files.filter(f => /\.(jpg|jpeg|png|JPG|JPEG|PNG)$/.test(f));
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(images));
        });
        return;
    }

    // 2. 讀取單張圖片
    if (req.url.startsWith('/image/')) {
        try {
            const filename = decodeURIComponent(req.url.substring(7));
            const filepath = path.join(IMG_DIR, filename);
            
            // 簡單的安全檢查，防止讀取上層目錄
            if (!filepath.startsWith(IMG_DIR)) {
                res.writeHead(403);
                res.end("Access Denied");
                return;
            }

            if (fs.existsSync(filepath)) {
                const stream = fs.createReadStream(filepath);
                res.writeHead(200);
                stream.pipe(res);
            } else {
                res.writeHead(404);
                res.end("Not Found");
            }
        } catch (e) {
            console.error(e);
            res.writeHead(500);
            res.end("Server Error");
        }
        return;
    }

    // 3. 儲存圖片 (接收 Base64)
    if (req.url === '/save' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const { filename, image } = JSON.parse(body);
                // 去除 base64 標頭
                const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
                const buffer = Buffer.from(base64Data, 'base64');
                const filepath = path.join(IMG_DIR, filename);
                
                fs.writeFile(filepath, buffer, (err) => {
                    if (err) {
                        console.error("Save error:", err);
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: err.message }));
                        return;
                    }
                    console.log(`Saved: ${filename}`);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true }));
                });
            } catch (e) {
                console.error("Parse error:", e);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: e.message }));
            }
        });
        return;
    }

    // 4. 前端介面 (HTML)
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ProCore 車牌遮蔽工作站</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        body { background: #111; color: #eee; height: 100vh; display: flex; overflow: hidden; font-family: sans-serif; }
        #sidebar { width: 280px; background: #1a1a1a; border-right: 1px solid #333; display: flex; flex-direction: column; }
        .file-list { flex: 1; overflow-y: auto; }
        .file-item { padding: 12px 15px; cursor: pointer; border-bottom: 1px solid #2a2a2a; font-size: 0.9rem; color: #aaa; transition: 0.2s; display: flex; align-items: center; justify-content: space-between; }
        .file-item:hover { background: #252525; color: #fff; }
        .file-item.active { background: #D4AF37; color: #000; font-weight: bold; border-color: #D4AF37; }
        #workspace { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; position: relative; background: #000; overflow: hidden; }
        canvas { box-shadow: 0 0 30px rgba(0,0,0,0.5); max-width: 95%; max-height: 85vh; cursor: crosshair; background: #222; }
        #toolbar { width: 100%; height: 60px; background: #1a1a1a; display: flex; align-items: center; justify-content: space-between; padding: 0 20px; border-bottom: 1px solid #333; }
        .btn { padding: 8px 20px; border-radius: 4px; font-weight: bold; cursor: pointer; transition: 0.2s; border: none; }
        .btn-save { background: #D4AF37; color: #000; }
        .btn-save:hover { background: #c5a028; transform: translateY(-1px); }
        .btn-reset { background: #444; color: #fff; }
        .btn-reset:hover { background: #555; }
        #status { color: #888; font-size: 0.9rem; font-family: monospace; }
        .tip { padding: 15px; background: #222; font-size: 0.8rem; color: #666; border-top: 1px solid #333; }
    </style>
</head>
<body>
    <div id="sidebar">
        <div class="p-4 text-xs font-bold text-gray-500 uppercase tracking-widest border-b border-gray-800">
            Image List (${IMG_DIR.replace(/\\\\/g, '/')})
        </div>
        <div class="file-list" id="fileList">
            <div class="p-4 text-center text-gray-600">載入中...</div>
        </div>
        <div class="tip">
            操作說明：<br>
            1. 點選左側照片<br>
            2. 用滑鼠框選車牌<br>
            3. 點選右上方儲存
        </div>
    </div>
    <div style="flex:1; display:flex; flex-direction:column;">
        <div id="toolbar">
            <div id="status">準備就緒</div>
            <div class="flex gap-4">
                <button class="btn btn-reset" onclick="resetImage()">↩ 還原重置</button>
                <button class="btn btn-save" onclick="saveImage()">💾 覆蓋儲存</button>
            </div>
        </div>
        <div id="workspace">
            <canvas id="canvas"></canvas>
            <div id="welcome" class="absolute text-gray-600 text-xl pointer-events-none">請選擇一張照片開始編輯</div>
        </div>
    </div>

    <script>
        const canvas = document.getElementById('canvas');
        const ctx = canvas.getContext('2d');
        let currentFile = '';
        let originalImage = new Image();
        let isDrawing = false;
        let startX, startY;

        // 初始化
        fetch('/list')
            .then(r => r.json())
            .then(files => {
                const list = document.getElementById('fileList');
                list.innerHTML = ''; // 清空 loading
                
                if (files.error) {
                    list.innerHTML = '<div class="p-4 text-red-500">'+files.error+'</div>';
                    return;
                }
                
                if (files.length === 0) {
                    list.innerHTML = '<div class="p-4 text-gray-500">找不到圖片</div>';
                    return;
                }

                files.forEach(f => {
                    const div = document.createElement('div');
                    div.className = 'file-item';
                    div.innerText = f;
                    div.onclick = () => loadFile(f, div);
                    list.appendChild(div);
                });
            })
            .catch(err => {
                document.getElementById('fileList').innerHTML = '<div class="p-4 text-red-500">連線錯誤</div>';
            });

        function loadFile(filename, el) {
            currentFile = filename;
            document.querySelectorAll('.file-item').forEach(d => d.classList.remove('active'));
            if(el) el.classList.add('active');
            
            document.getElementById('welcome').style.display = 'none';
            document.getElementById('status').innerText = '讀取中...';
            
            originalImage.src = '/image/' + encodeURIComponent(filename);
            originalImage.onload = () => {
                resetImage();
                document.getElementById('status').innerText = '正在編輯: ' + filename;
            };
            originalImage.onerror = () => {
                document.getElementById('status').innerText = '讀取失敗';
            };
        }

        function resetImage() {
            // 計算縮放比例以適應螢幕
            const maxWidth = document.getElementById('workspace').clientWidth * 0.95;
            const maxHeight = document.getElementById('workspace').clientHeight * 0.95;
            
            let w = originalImage.width;
            let h = originalImage.height;
            
            // 保持比例縮放
            const ratio = Math.min(maxWidth / w, maxHeight / h);
            
            // 設定 Canvas 顯示尺寸 (CSS) 與 實際尺寸 (Attribute)
            // 為了保持畫質，Canvas 實際尺寸等於原圖尺寸
            canvas.width = w;
            canvas.height = h;
            
            // 用 CSS 控制顯示大小
            canvas.style.width = (w * ratio) + 'px';
            canvas.style.height = (h * ratio) + 'px';
            
            ctx.drawImage(originalImage, 0, 0);
        }

        // 馬賽克功能
        function mosaic(x, y, w, h) {
            // 確保座標為正
            if (w < 0) { x += w; w = -w; }
            if (h < 0) { y += h; h = -h; }

            const blockSize = Math.max(10, Math.floor(Math.min(w, h) / 10)); // 動態調整格子大小
            const imageData = ctx.getImageData(x, y, w, h);
            const data = imageData.data;
            const imgW = canvas.width; // 原圖寬度
            
            // 簡單算法：直接在 Canvas 上重繪矩形
            for(let py = y; py < y + h; py += blockSize) {
                for(let px = x; px < x + w; px += blockSize) {
                    // 取樣中心點顏色
                    const sampleX = Math.min(px + Math.floor(blockSize/2), x + w - 1);
                    const sampleY = Math.min(py + Math.floor(blockSize/2), y + h - 1);
                    
                    const pIndex = (sampleY * imgW + sampleX) * 4;
                    // 注意：這裡直接讀取 canvas 的像素資料可能比較慢，但對單次操作還好
                    // 為了簡單，我們直接用 getImageData 取得的小區塊數據
                    // 這裡簡化：只畫矩形，不取平均色 (取左上角顏色即可達到馬賽克效果)
                    
                    const dataIndex = ((py - y) * w + (px - x)) * 4;
                    // 這邊邏輯太複雜，改用更簡單的 API 方法
                }
            }
            
            // 使用 Canvas API 實現馬賽克：
            // 1. 關閉平滑
            ctx.imageSmoothingEnabled = false;
            
            // 2. 將選取區域縮小
            const smallCanvas = document.createElement('canvas');
            smallCanvas.width = w / 15; // 縮小係數
            smallCanvas.height = h / 15;
            const sCtx = smallCanvas.getContext('2d');
            sCtx.drawImage(canvas, x, y, w, h, 0, 0, smallCanvas.width, smallCanvas.height);
            
            // 3. 再放大畫回去
            ctx.drawImage(smallCanvas, 0, 0, smallCanvas.width, smallCanvas.height, x, y, w, h);
        }

        // 滑鼠事件
        canvas.onmousedown = (e) => {
            isDrawing = true;
            const rect = canvas.getBoundingClientRect();
            // 計算滑鼠在 Canvas (原圖解析度) 中的座標
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            startX = (e.clientX - rect.left) * scaleX;
            startY = (e.clientY - rect.top) * scaleY;
        };

        canvas.onmouseup = (e) => {
            if(!isDrawing) return;
            isDrawing = false;
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            const endX = (e.clientX - rect.left) * scaleX;
            const endY = (e.clientY - rect.top) * scaleY;
            
            const w = endX - startX;
            const h = endY - startY;
            
            // 避免誤觸微小移動
            if(Math.abs(w) < 5 || Math.abs(h) < 5) return;

            // 執行馬賽克
            mosaic(startX, startY, w, h);
            
            // 畫個邊框提示已處理 (黃色)
            ctx.strokeStyle = 'rgba(212, 175, 55, 0.8)';
            ctx.lineWidth = 5;
            ctx.strokeRect(startX, startY, w, h);
            
            // 閃爍一下去除邊框
            setTimeout(() => {
               // 重新繪製該區域的馬賽克 (覆蓋掉邊框)
               mosaic(startX, startY, w, h);
            }, 300);
        };

        function saveImage() {
            const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
            const btn = document.querySelector('.btn-save');
            const originalText = btn.innerText;
            btn.innerText = '儲存中...';
            btn.disabled = true;

            fetch('/save', {
                method: 'POST',
                body: JSON.stringify({ filename: currentFile, image: dataUrl })
            }).then(r => r.json()).then(res => {
                btn.innerText = originalText;
                btn.disabled = false;
                if(res.success) {
                    const status = document.getElementById('status');
                    status.innerText = '✅ 已覆蓋儲存！';
                    status.style.color = '#4ade80';
                    setTimeout(() => { 
                        status.innerText = '正在編輯: ' + currentFile; 
                        status.style.color = '#888';
                    }, 2000);
                    // 更新 originalImage，這樣重置時就是新的
                    originalImage.src = dataUrl; 
                } else {
                    alert('儲存失敗: ' + res.error);
                }
            }).catch(e => {
                alert('連線錯誤');
                btn.innerText = originalText;
                btn.disabled = false;
            });
        }
    </script>
</body>
</html>
    `);
});

server.listen(PORT, () => {
    console.log(\`Tool running at http://localhost:\${PORT}\`);
});

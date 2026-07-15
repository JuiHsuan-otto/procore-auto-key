const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
// 目標圖片資料夾 (網頁使用的圖片)
const IMG_DIR = path.join(process.env.USERPROFILE, 'OneDrive', 'Desktop', '極致核心 網頁', 'img');

const server = http.createServer((req, res) => {
    // 1. 取得圖片列表
    if (req.url === '/list') {
        fs.readdir(IMG_DIR, (err, files) => {
            if (err) {
                res.writeHead(500);
                res.end(JSON.stringify({ error: err.message }));
                return;
            }
            const images = files.filter(f => /\.(jpg|jpeg|png)$/i.test(f));
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(images));
        });
        return;
    }

    // 2. 讀取單張圖片
    if (req.url.startsWith('/image/')) {
        const filename = decodeURIComponent(req.url.substring(7));
        const filepath = path.join(IMG_DIR, filename);
        fs.readFile(filepath, (err, data) => {
            if (err) {
                res.writeHead(404);
                res.end("Not Found");
                return;
            }
            res.writeHead(200);
            res.end(data);
        });
        return;
    }

    // 3. 儲存圖片 (接收 Base64)
    if (req.url === '/save' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const { filename, image } = JSON.parse(body);
                const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
                const buffer = Buffer.from(base64Data, 'base64');
                const filepath = path.join(IMG_DIR, filename);
                
                fs.writeFile(filepath, buffer, (err) => {
                    if (err) throw err;
                    console.log(`Saved: ${filename}`);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true }));
                });
            } catch (e) {
                res.writeHead(500);
                res.end(JSON.stringify({ error: e.message }));
            }
        });
        return;
    }

    // 4. 前端介面
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
        body { background: #111; color: #eee; height: 100vh; display: flex; overflow: hidden; }
        #sidebar { width: 250px; background: #222; border-right: 1px solid #444; overflow-y: auto; }
        .file-item { padding: 10px 15px; cursor: pointer; border-bottom: 1px solid #333; font-size: 0.9rem; color: #aaa; transition: 0.2s; }
        .file-item:hover { background: #333; color: #fff; }
        .file-item.active { background: #D4AF37; color: #000; font-weight: bold; }
        #workspace { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; position: relative; background: #000; }
        canvas { box-shadow: 0 0 20px rgba(0,0,0,0.5); max-width: 90%; max-height: 85vh; cursor: crosshair; }
        #toolbar { width: 100%; height: 60px; background: #222; display: flex; align-items: center; justify-content: space-between; padding: 0 20px; border-bottom: 1px solid #444; }
        .btn { padding: 8px 20px; border-radius: 4px; font-weight: bold; cursor: pointer; transition: 0.2s; }
        .btn-save { background: #D4AF37; color: #000; }
        .btn-save:hover { background: #c5a028; }
        .btn-reset { background: #444; color: #fff; }
        .btn-reset:hover { background: #555; }
        #status { color: #888; font-size: 0.9rem; }
    </style>
</head>
<body>
    <div id="sidebar">
        <div class="p-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Image List</div>
        <div id="fileList"></div>
    </div>
    <div style="flex:1; display:flex; flex-direction:column;">
        <div id="toolbar">
            <div id="status">準備就緒</div>
            <div class="flex gap-4">
                <button class="btn btn-reset" onclick="resetImage()">↩ 重置</button>
                <button class="btn btn-save" onclick="saveImage()">💾 覆蓋儲存</button>
            </div>
        </div>
        <div id="workspace">
            <canvas id="canvas"></canvas>
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
                files.forEach(f => {
                    const div = document.createElement('div');
                    div.className = 'file-item';
                    div.innerText = f;
                    div.onclick = () => loadFile(f, div);
                    list.appendChild(div);
                });
                if(files.length > 0) loadFile(files[0], list.children[1]); // Skip header
            });

        function loadFile(filename, el) {
            currentFile = filename;
            document.querySelectorAll('.file-item').forEach(d => d.classList.remove('active'));
            if(el) el.classList.add('active');
            
            originalImage.src = '/image/' + encodeURIComponent(filename);
            originalImage.onload = () => {
                resetImage();
                document.getElementById('status').innerText = '正在編輯: ' + filename;
            };
        }

        function resetImage() {
            // 縮放 Canvas 以適應螢幕，但保持解析度
            canvas.width = originalImage.width;
            canvas.height = originalImage.height;
            ctx.drawImage(originalImage, 0, 0);
        }

        // 馬賽克功能
        function mosaic(x, y, w, h) {
            const blockSize = 15; // 馬賽克格子大小
            const imageData = ctx.getImageData(x, y, w, h);
            const data = imageData.data;
            
            for(let py = 0; py < h; py += blockSize) {
                for(let px = 0; px < w; px += blockSize) {
                    // 取區塊平均色
                    const pixelIndex = (py * w + px) * 4;
                    const r = data[pixelIndex];
                    const g = data[pixelIndex+1];
                    const b = data[pixelIndex+2];
                    
                    // 填滿區塊
                    ctx.fillStyle = \`rgb(\${r},\${g},\${b})\`;
                    ctx.fillRect(x + px, y + py, blockSize, blockSize);
                }
            }
        }

        // 滑鼠事件
        canvas.onmousedown = (e) => {
            isDrawing = true;
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            startX = (e.clientX - rect.left) * scaleX;
            startY = (e.clientY - rect.top) * scaleY;
        };

        canvas.onmousemove = (e) => {
            if(!isDrawing) return;
            // 預覽框 (可選，這裡直接畫可能會閃爍，先不做預覽)
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
            
            // 執行馬賽克
            mosaic(startX, startY, w, h);
            
            // 畫個邊框提示已處理
            ctx.strokeStyle = '#D4AF37';
            ctx.lineWidth = 2;
            ctx.strokeRect(startX, startY, w, h);
            setTimeout(() => {
                // 去除邊框 (重繪該區域馬賽克) - 簡化：直接保留馬賽克效果
                mosaic(startX, startY, w, h); 
            }, 200);
        };

        function saveImage() {
            const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
            fetch('/save', {
                method: 'POST',
                body: JSON.stringify({ filename: currentFile, image: dataUrl })
            }).then(r => r.json()).then(res => {
                if(res.success) {
                    const status = document.getElementById('status');
                    status.innerText = '✅ 已儲存！';
                    status.style.color = '#4ade80';
                    setTimeout(() => { 
                        status.innerText = '正在編輯: ' + currentFile; 
                        status.style.color = '#888';
                    }, 2000);
                    // 重新載入原圖以確保同步
                    originalImage.src = dataUrl;
                }
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

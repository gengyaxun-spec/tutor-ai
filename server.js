const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = 3000;

// API 配置
const API_CONFIG = {
    baseUrl: 'api.moonshot.cn',
    apiKey: 'sk-crWOzpLn54JgZ5fnfgwWLQKSwIL44rxHilyIBK6m08rKBjvy'
};

// MIME 类型
const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml'
};

// 代理 API 请求
function proxyAPIRequest(req, res, body) {
    const options = {
        hostname: API_CONFIG.baseUrl,
        port: 443,
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${API_CONFIG.apiKey}`,
            'Content-Length': Buffer.byteLength(body)
        }
    };

    const proxyReq = https.request(options, (proxyRes) => {
        res.writeHead(proxyRes.statusCode, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        });
        proxyRes.pipe(res);
    });

    proxyReq.on('error', (e) => {
        console.error('API 请求错误:', e.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { message: e.message } }));
    });

    proxyReq.write(body);
    proxyReq.end();
}

// 创建服务器
const server = http.createServer((req, res) => {
    // 处理 CORS 预检请求
    if (req.method === 'OPTIONS') {
        res.writeHead(200, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        });
        res.end();
        return;
    }

    // API 代理
    if (req.url === '/api/chat' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            proxyAPIRequest(req, res, body);
        });
        return;
    }

    // 静态文件服务
    let filePath = req.url === '/' ? '/index.html' : req.url;
    filePath = path.join(__dirname, filePath);

    const ext = path.extname(filePath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404);
                res.end('404 Not Found');
            } else {
                res.writeHead(500);
                res.end('Server Error');
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content);
        }
    });
});

server.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════╗
║       AI 题目解析助手服务器已启动                    ║
╠════════════════════════════════════════════════════╣
║  访问地址: http://localhost:${PORT}                   ║
║  按 Ctrl+C 停止服务器                               ║
╚════════════════════════════════════════════════════╝
    `);
});

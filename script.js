// DOM 元素
const questionInput = document.getElementById('questionInput');
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const browseBtn = document.getElementById('browseBtn');
const previewArea = document.getElementById('previewArea');
const previewImage = document.getElementById('previewImage');
const removeBtn = document.getElementById('removeBtn');
const analyzeBtn = document.getElementById('analyzeBtn');
const statusArea = document.getElementById('statusArea');
const statusText = document.getElementById('statusText');
const resultContent = document.getElementById('resultContent');

// 存储上传的图片数据
let uploadedImageData = null;

// API 配置 - 使用本地代理服务器避免 CORS 问题
const API_CONFIG = {
    // 通过本地代理服务器调用（运行 node server.js 启动）
    proxyUrl: '/api/chat',
    // 直接调用（可能有 CORS 限制）
    directUrl: 'https://api.moonshot.cn/v1/chat/completions',
    apiKey: 'sk-crWOzpLn54JgZ5fnfgwWLQKSwIL44rxHilyIBK6m08rKBjvy',
    textModel: 'kimi-latest',
    visionModel: 'moonshot-v1-8k-vision-preview'
};

// 检测是否通过本地服务器运行
const isLocalServer = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

// 初始化事件监听
function init() {
    // 文件上传相关事件
    browseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        fileInput.click();
    });

    uploadArea.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', handleFileSelect);

    // 拖拽上传
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('drag-over');
    });

    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('drag-over');
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('drag-over');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFile(files[0]);
        }
    });

    // 移除图片
    removeBtn.addEventListener('click', removeImage);

    // 解析按钮
    analyzeBtn.addEventListener('click', startAnalysis);
}

// 处理文件选择
function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
        handleFile(file);
    }
}

// 处理文件
function handleFile(file) {
    // 验证文件类型
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
        showToast('请上传 PNG 或 JPG 格式的图片');
        return;
    }

    // 验证文件大小（200MB）
    if (file.size > 200 * 1024 * 1024) {
        showToast('文件大小不能超过 200MB');
        return;
    }

    // 读取并预览图片
    const reader = new FileReader();
    reader.onload = (e) => {
        uploadedImageData = e.target.result;
        previewImage.src = uploadedImageData;
        uploadArea.style.display = 'none';
        previewArea.style.display = 'block';
    };
    reader.readAsDataURL(file);
}

// 移除图片
function removeImage() {
    uploadedImageData = null;
    previewImage.src = '';
    fileInput.value = '';
    previewArea.style.display = 'none';
    uploadArea.style.display = 'flex';
}

// 系统提示词
const SYSTEM_PROMPT = `你是一位专业的学科导师，擅长解析各类题目。请按照以下格式输出解析：

1. 首先用亲切的语气打招呼，简要说明题目考察的知识点
2. 【知识点】列出本题涉及的核心知识点
3. 【启发式引导】
   - 理解题意：帮助学生理解题目
   - 分解问题：将问题拆解成小步骤
   - 联系生活：用生活实例类比
4. 【详细推导过程】逐步展示解题步骤，每一步都要有清晰的说明
5. 最后给出明确的答案

请确保解释清晰易懂，适合学生理解。如果是图片题目，请先识别图片中的题目内容再进行解析。`;

// 开始解析
async function startAnalysis() {
    const question = questionInput.value.trim();
    
    if (!question && !uploadedImageData) {
        showToast('请输入题目或上传题目图片');
        return;
    }

    // 显示加载状态
    analyzeBtn.disabled = true;
    statusArea.style.display = 'flex';
    updateStatus('正在连接 AI 模型...', true);

    try {
        // 调用 Kimi API
        const result = await callKimiAPI(question, uploadedImageData);
        
        // 显示结果
        displayResult(result);
        
        // 更新状态
        updateStatus('解析完成', false);
        
    } catch (error) {
        console.error('API 调用失败:', error);
        showToast('解析失败：' + (error.message || '请稍后重试'));
        updateStatus('解析失败', false);
    } finally {
        analyzeBtn.disabled = false;
    }
}

// 调用 Kimi API
async function callKimiAPI(question, imageData) {
    updateStatus('正在进行多模态学术逻辑推导...', true);
    
    // 构建消息内容
    let messages = [
        {
            role: 'system',
            content: SYSTEM_PROMPT
        }
    ];

    // 根据是否有图片选择不同的请求方式
    if (imageData) {
        // 有图片时使用视觉模型
        const userContent = [];
        
        // 添加图片
        userContent.push({
            type: 'image_url',
            image_url: {
                url: imageData
            }
        });
        
        // 添加文字说明
        if (question) {
            userContent.push({
                type: 'text',
                text: `请解析这道题目。补充说明：${question}`
            });
        } else {
            userContent.push({
                type: 'text',
                text: '请识别并解析图片中的题目。'
            });
        }
        
        messages.push({
            role: 'user',
            content: userContent
        });
    } else {
        // 纯文字时使用文本模型
        messages.push({
            role: 'user',
            content: `请解析以下题目：\n\n${question}`
        });
    }

    // 选择模型
    const model = imageData ? API_CONFIG.visionModel : API_CONFIG.textModel;
    
    // 请求体
    const requestBody = {
        model: model,
        messages: messages,
        temperature: 0.7,
        max_tokens: 4096
    };

    let response;
    
    // 根据运行环境选择请求方式
    if (isLocalServer) {
        // 通过本地代理服务器
        response = await fetch(API_CONFIG.proxyUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });
    } else {
        // 直接调用（可能有 CORS 问题）
        response = await fetch(API_CONFIG.directUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_CONFIG.apiKey}`
            },
            body: JSON.stringify(requestBody)
        });
    }

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData.error?.message || `请求失败 (${response.status})`;
        
        // 提供更友好的错误提示
        if (errorMsg.includes('Invalid Authentication')) {
            throw new Error('API Key 无效，请检查 API Key 是否正确');
        } else if (response.status === 0 || errorMsg.includes('Failed to fetch')) {
            throw new Error('网络请求失败，请运行 node server.js 启动本地服务器');
        }
        throw new Error(errorMsg);
    }

    const data = await response.json();
    
    if (!data.choices || data.choices.length === 0) {
        throw new Error('未获取到解析结果');
    }

    return data.choices[0].message.content;
}

// 更新状态
function updateStatus(text, isLoading) {
    statusText.textContent = text;
    const statusIcon = statusArea.querySelector('.status-icon');
    
    if (isLoading) {
        statusIcon.innerHTML = '<div class="loading-spinner"></div>';
    } else {
        statusIcon.innerHTML = '<span class="check-icon">✓</span>';
        // 3秒后隐藏状态
        setTimeout(() => {
            statusArea.style.display = 'none';
        }, 3000);
    }
}

// 配置 marked 选项
function configureMarked() {
    if (typeof marked !== 'undefined') {
        marked.setOptions({
            breaks: true,
            gfm: true,
            highlight: function(code, lang) {
                if (typeof hljs !== 'undefined' && lang && hljs.getLanguage(lang)) {
                    try {
                        return hljs.highlight(code, { language: lang }).value;
                    } catch (e) {}
                }
                return code;
            }
        });
    }
}

// 将 Markdown 转换为美观的 HTML
function formatResultToHTML(text) {
    // 预处理：处理中文标题格式 【xxx】
    text = text.replace(/^【([^】]+)】$/gm, '## $1');
    text = text.replace(/【([^】]+)】/g, '**【$1】**');
    
    // 预处理：确保数学公式格式正确
    text = text.replace(/\$\$([^$]+)\$\$/g, '<div class="math-block">$1</div>');
    text = text.replace(/\$([^$]+)\$/g, '<span class="math-inline">$1</span>');
    
    // 使用 marked 解析 Markdown
    if (typeof marked !== 'undefined') {
        configureMarked();
        text = marked.parse(text);
    } else {
        // 降级处理：基本的 Markdown 转换
        text = fallbackMarkdownParse(text);
    }
    
    // 后处理：为特定元素添加样式类
    text = postProcessHTML(text);
    
    return text;
}

// 降级 Markdown 解析（当 marked 库不可用时）
function fallbackMarkdownParse(text) {
    // 处理标题
    text = text.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    text = text.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    text = text.replace(/^# (.+)$/gm, '<h1>$1</h1>');
    
    // 处理加粗和斜体
    text = text.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>');
    text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    text = text.replace(/___([^_]+)___/g, '<strong><em>$1</em></strong>');
    text = text.replace(/__([^_]+)__/g, '<strong>$1</strong>');
    text = text.replace(/_([^_]+)_/g, '<em>$1</em>');
    
    // 处理代码块
    text = text.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>');
    text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // 处理无序列表
    text = text.replace(/^[\s]*[-*]\s+(.+)$/gm, '<li>$1</li>');
    text = text.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');
    
    // 处理有序列表
    text = text.replace(/^[\s]*(\d+)\.\s+(.+)$/gm, '<li>$2</li>');
    
    // 处理段落
    const lines = text.split('\n');
    let result = '';
    let inParagraph = false;
    
    for (let line of lines) {
        line = line.trim();
        if (!line) {
            if (inParagraph) {
                result += '</p>';
                inParagraph = false;
            }
            continue;
        }
        
        if (line.startsWith('<h') || line.startsWith('<ul') || line.startsWith('<ol') || 
            line.startsWith('<li') || line.startsWith('<pre') || line.startsWith('<div')) {
            if (inParagraph) {
                result += '</p>';
                inParagraph = false;
            }
            result += line;
        } else if (!inParagraph) {
            result += '<p>' + line;
            inParagraph = true;
        } else {
            result += '<br>' + line;
        }
    }
    
    if (inParagraph) {
        result += '</p>';
    }
    
    return result;
}

// HTML 后处理
function postProcessHTML(html) {
    // 为标题添加样式类
    html = html.replace(/<h2>/g, '<h2 class="md-heading md-h2">');
    html = html.replace(/<h3>/g, '<h3 class="md-heading md-h3">');
    
    // 为列表添加样式类
    html = html.replace(/<ul>/g, '<ul class="md-list">');
    html = html.replace(/<ol>/g, '<ol class="md-list md-ordered">');
    
    // 为代码块添加样式类
    html = html.replace(/<pre>/g, '<pre class="md-code-block">');
    html = html.replace(/<code>/g, '<code class="md-code">');
    
    // 为段落添加样式类
    html = html.replace(/<p>/g, '<p class="md-paragraph">');
    
    // 处理数学公式样式
    html = html.replace(/(\d+\s*[×÷+\-*/=]\s*\d+(?:\s*[×÷+\-*/=]\s*\d+)*)/g, 
        '<span class="math-formula">$1</span>');
    
    // 为答案或重要结论添加高亮
    html = html.replace(/(?:答案|答|结论|因此|所以)[：:]\s*([^<\n]+)/g, 
        '<div class="answer-highlight"><span class="answer-label">答案</span><span class="answer-content">$1</span></div>');
    
    return html;
}

// 显示解析结果
function displayResult(content) {
    // 将内容格式化为 HTML
    const formattedContent = formatResultToHTML(content);
    
    const resultHTML = `
        <div class="analysis-result">
            <div class="result-body markdown-body">
                ${formattedContent}
            </div>
        </div>
    `;

    resultContent.innerHTML = resultHTML;
    
    // 代码高亮
    if (typeof hljs !== 'undefined') {
        document.querySelectorAll('pre code').forEach((block) => {
            hljs.highlightElement(block);
        });
    }
}

// 显示提示
function showToast(message) {
    // 创建 toast 元素
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        padding: 12px 24px;
        background: rgba(0, 0, 0, 0.8);
        color: white;
        border-radius: 8px;
        font-size: 14px;
        z-index: 1000;
        animation: fadeInOut 3s ease;
    `;
    toast.textContent = message;
    
    // 添加动画样式
    const style = document.createElement('style');
    style.textContent = `
        @keyframes fadeInOut {
            0% { opacity: 0; transform: translateX(-50%) translateY(-10px); }
            15% { opacity: 1; transform: translateX(-50%) translateY(0); }
            85% { opacity: 1; transform: translateX(-50%) translateY(0); }
            100% { opacity: 0; transform: translateX(-50%) translateY(-10px); }
        }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(toast);
    
    // 3秒后移除
    setTimeout(() => {
        toast.remove();
        style.remove();
    }, 3000);
}

// 初始化
init();

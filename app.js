// ==================== AI API 配置 ====================
const AI_CONFIG = {
  qwen: {
    apiKey: 'sk-9a1e257a8d714563b952e49775906be0',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen-plus',
    name: '通义千问',
    enabled: true
  },
  minimax: {
    apiKey: 'sk-api-AW_aoqIvh71dYejWyvae1BnC6jpqiUBnqvgrO81Vpiu77XpnC0WeIUyVuiS60HqTg3HWoVPmMDdI828DaZzHAKIG6LrVNxz97VJY1QRWVjzIIngNJ34KHTs',
    baseUrl: 'https://api.minimaxi.com',
    model: 'MiniMax-M2.7',
    name: 'MiniMax',
    // MiniMax用chatcompletion_v2接口，非OpenAI兼容格式
    useCustomEndpoint: true,
    enabled: true
  },
  deepseek: {
    apiKey: 'sk-dbcf9c27331e45e282bac0383586afe4',
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-chat',
    name: 'DeepSeek',
    enabled: false  // 余额不足，待充值
  }
};

// 各工具使用的模型：主模型 + 备用模型（自动降级）
const TOOL_MODELS = {
  content:  { primary: 'qwen', fallback: 'minimax' },  // 内容创作中心
  training: { primary: 'qwen', fallback: 'minimax' },   // 前台培训管家
  analysis: { primary: 'qwen', fallback: 'minimax' }    // 数据分析助手
};

// ==================== AI 调用封装 ====================
async function callAI(provider, messages, options = {}) {
  const config = AI_CONFIG[provider];
  if (!config || !config.enabled) {
    throw new Error(`${config?.name || provider} 未启用`);
  }

  let response;
  if (config.useCustomEndpoint) {
    // MiniMax 专用接口
    response = await fetch(`${config.baseUrl}/v1/text/chatcompletion_v2`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: options.model || config.model,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        temperature: options.temperature || 0.7,
        max_completion_tokens: options.maxTokens || 2000
      })
    });

    const data = await response.json();
    if (data.base_resp && data.base_resp.status_code !== 0) {
      throw new Error(`${config.name}: ${data.base_resp.status_msg}`);
    }
    if (data.choices && data.choices[0]) {
      return data.choices[0].message?.content || data.choices[0].text || '';
    }
    throw new Error(`${config.name}: 返回内容为空`);
  } else {
    // OpenAI 兼容接口（通义千问、DeepSeek）
    response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: options.model || config.model,
        messages: messages,
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens || 2000
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `API调用失败 (${response.status})`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }
}

// 带自动降级的AI调用
async function callAIWithFallback(toolKey, messages, options = {}) {
  const modelConfig = TOOL_MODELS[toolKey] || { primary: 'qwen' };
  const primary = modelConfig.primary;
  const fallback = modelConfig.fallback;

  try {
    return await callAI(primary, messages, options);
  } catch (err) {
    console.warn(`${AI_CONFIG[primary]?.name} 调用失败: ${err.message}，尝试降级到 ${AI_CONFIG[fallback]?.name}`);
    if (fallback && AI_CONFIG[fallback]?.enabled) {
      return await callAI(fallback, messages, options);
    }
    throw err; // 没有备用就抛原始错误
  }
}

// ==================== Prompt 管理 ====================
// ★ 管理员在此修改 Prompt，所有用户立即生效 ★
// 编辑方式：点击侧边栏 logo 3次 → 输入密码进入管理员 → Prompt调教中修改
// 修改后点击「导出配置」，将生成的 JS 代码替换到此处即可
const PROMPTS = {
  ctrip: `你是酒店OTA运营专家，擅长撰写携程社区笔记。

写作风格要求：
- 真实感强，像真实住客的体验分享，不要像广告
- 细节丰富，有画面感，有温度
- 自然融入酒店卖点，不要硬广
- 加入实用小贴士
- 结尾带相关话题标签
- 适当使用Emoji，但不要过多
- 字数控制在300-500字

请根据以下信息生成携程社区内容：
- 酒店名称：{{hotelName}}
- 内容主题：{{topic}}
- 卖点关键词：{{keywords}}
- 补充信息：{{extra}}`,

  multi: `你是多平台内容改编专家。将原始内容改编为指定平台的风格。

平台风格要求：
- 小红书：笔记体，多用Emoji，分段短，标题吸睛，带话题标签
- 微信公众号：深度长文，逻辑清晰，有观点有分析，专业但接地气
- 抖音文案：口语化，有悬念有反转，适合配音，带话题
- 美团点评：简洁实用，突出性价比和服务体验

原始内容：
{{content}}

请改编为以下平台：{{platforms}}`,

  training: `你是酒店前台培训管家，拥有丰富的酒店服务经验和专业知识。

你的职责：
- 根据酒店知识库和应急预案，回答前台工作中的问题
- 提供标准、专业、统一的话术模板
- 给出清晰的处理步骤和注意事项
- 回答简洁实用，方便前台快速查阅

知识库内容：
{{knowledge}}

请回答以下问题：
{{question}}`,

  analysis: `你是酒店运营数据分析专家。请根据上传的数据生成专业的运营分析报告。

报告要求：
- 01/02/03分点结构，层次清晰
- 核心指标用数据卡片展示（出租率、ADR、RevPAR）
- OTA渠道分析：各渠道占比、趋势变化
- 找出问题点并给出改进建议
- 语言专业但易懂，适合管理层阅读

数据内容：
{{data}}

分析维度：{{dimensions}}
报告类型：{{reportType}}`
};

// ==================== Prompt 云端同步 ====================
// 三层架构：GitHub 云端(raw读取，无需token) → localStorage 缓存 → 代码内置默认值
// 管理员同步：通过 GitHub API 需要 token，管理员首次使用时输入并存 localStorage
const PROMPTS_CLOUD_URL = 'https://raw.githubusercontent.com/sxie738-bot/hotel-ai-workbench/main/prompts.json';
const PROMPTS_API_URL = 'https://api.github.com/repos/sxie738-bot/hotel-ai-workbench/contents/prompts.json';
let cloudPrompts = null; // 云端 Prompt 缓存

// 获取管理员保存的 GitHub Token（存在 localStorage，不会硬编码）
function getGitHubToken() {
  return localStorage.getItem('github_token') || '';
}

// 设置 GitHub Token（管理员首次同步时调用）
function setGitHubToken(token) {
  localStorage.setItem('github_token', token.trim());
}

// 从 GitHub 拉取云端 Prompt（页面加载时自动执行）
async function fetchCloudPrompts() {
  try {
    const resp = await fetch(PROMPTS_CLOUD_URL + '?t=' + Date.now()); // 加时间戳防缓存
    if (!resp.ok) throw new Error('fetch failed');
    cloudPrompts = await resp.json();
    // 同步到 localStorage
    Object.keys(cloudPrompts).forEach(key => {
      if (key.startsWith('_')) return; // 跳过元数据字段
      localStorage.setItem(`prompt_${key}`, cloudPrompts[key]);
    });
    return true;
  } catch (e) {
    console.log('云端 Prompt 拉取失败，使用本地缓存：', e.message);
    return false;
  }
}

// 获取 Prompt：优先 localStorage（含云端同步），没有则用代码内置默认值
function getPrompt(key) {
  const saved = localStorage.getItem(`prompt_${key}`);
  if (saved) return saved;
  return PROMPTS[key] || '';
}

// 保存 Prompt：写 localStorage + 内存，管理员模式下同步到 GitHub
async function savePrompt(key, value) {
  PROMPTS[key] = value;
  localStorage.setItem(`prompt_${key}`, value);

  if (isAdmin) {
    showToast('✅ Prompt已保存');
    // 尝试同步到 GitHub（静默，不阻塞用户）
    syncPromptToCloud(key, value);
  }
}

// 同步单个 Prompt 到 GitHub（管理员专用）
async function syncPromptToCloud(key, value) {
  try {
    // 1. 先获取当前云端文件内容（需要 SHA）
    const token = getGitHubToken();
    if (!token) {
      showToast('⚠️ 请先设置 GitHub Token（点「同步设置」）', 'warning');
      return;
    }
    const resp = await fetch(PROMPTS_API_URL, {
      headers: { 'Authorization': `token ${token}` }
    });
    const data = await resp.json();
    const sha = data.sha;

    // 2. 更新整个 prompts.json（把当前值合并进去）
    const cloudData = await fetch(PROMPTS_CLOUD_URL + '?t=' + Date.now()).then(r => r.json()).catch(() => ({}));
    cloudData[key] = value;
    cloudData._updated = new Date().toISOString();

    const content = btoa(unescape(encodeURIComponent(JSON.stringify(cloudData, null, 2))));

    const updateResp = await fetch(PROMPTS_API_URL, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `token ${token}`
      },
      body: JSON.stringify({
        message: `更新 Prompt: ${key}`,
        content: content,
        sha: sha
      })
    });

    if (updateResp.ok) {
      showToast('☁️ 已同步到云端，全员生效');
    }
  } catch (e) {
    console.log('云端同步失败（本地已保存）：', e.message);
  }
}

// 一键同步所有 Prompt 到 GitHub
async function syncAllPrompts() {
  if (!isAdmin) return;

  try {
    const token = getGitHubToken();
    if (!token) {
      showToast('⚠️ 请先设置 GitHub Token（点「同步设置」）', 'warning');
      return;
    }
    showToast('⏳ 正在同步到云端...');

    // 获取当前云端 SHA
    const resp = await fetch(PROMPTS_API_URL, {
      headers: { 'Authorization': `token ${token}` }
    });
    const data = await resp.json();
    const sha = data.sha;

    // 合并所有当前 Prompt
    const cloudData = {};
    ['ctrip', 'multi', 'training', 'analysis'].forEach(key => {
      cloudData[key] = getPrompt(key);
    });
    cloudData._updated = new Date().toISOString();

    const content = btoa(unescape(encodeURIComponent(JSON.stringify(cloudData, null, 2))));

    const updateResp = await fetch(PROMPTS_API_URL, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `token ${token}`
      },
      body: JSON.stringify({
        message: '同步所有 Prompt',
        content: content,
        sha: sha
      })
    });

    if (updateResp.ok) {
      showToast('☁️ 全部 Prompt 已同步到云端，所有用户下次打开自动更新');
    } else {
      showToast('❌ 同步失败，请稍后重试', 'error');
    }
  } catch (e) {
    console.log('云端同步失败：', e.message);
    showToast('❌ 同步失败（网络问题），本地已保存', 'warning');
  }
}

// 重置单个 Prompt 为云端版本
function resetPrompt(key) {
  localStorage.removeItem(`prompt_${key}`);
  renderPromptCard(key);
  showToast('已恢复为云端版本');
}

// 导出配置代码（备份用）
function exportConfig() {
  const allKeys = Object.keys(PROMPTS);
  const currentPrompts = {};
  allKeys.forEach(key => { currentPrompts[key] = getPrompt(key); });

  const configCode = `// ★ 酒店AI工作台 Prompt 配置（导出备份）★
// 当前所有生效的 Prompt
const PROMPTS = ${JSON.stringify(currentPrompts, null, 2)};`;

  const blob = new Blob([configCode], { type: 'application/javascript' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'prompts-config-backup.js';
  a.click();
  URL.revokeObjectURL(url);
  showToast('配置备份已下载');
}

// 刷新单个 Prompt 卡片的显示
function renderPromptCard(key) {
  const promptCard = document.querySelector(`.prompt-card[data-prompt="${key}"]`);
  if (!promptCard) return;

  const currentVal = getPrompt(key);
  const isCustom = localStorage.getItem(`prompt_${key}`) !== null;
  const previewEl = promptCard.querySelector('.prompt-preview');
  const actionsEl = promptCard.querySelector('.prompt-actions');
  const statusEl = promptCard.querySelector('.prompt-status');

  if (isCustom) {
    statusEl.textContent = '已自定义';
    statusEl.classList.add('configured');
    statusEl.style.background = 'var(--accent-light)';
    statusEl.style.color = 'var(--accent)';
  } else {
    statusEl.textContent = '默认';
    statusEl.classList.add('configured');
    statusEl.style.background = '';
    statusEl.style.color = '';
  }

  previewEl.innerHTML = escapeHtml(currentVal).substring(0, 100) + '...';
  actionsEl.innerHTML = `
    <button class="btn-sm" onclick="editPrompt('${key}')">✏️ 编辑</button>
    <button class="btn-sm" onclick="copyPrompt('${key}')">📋 复制</button>
    ${isCustom ? `<button class="btn-sm" onclick="resetPrompt('${key}')" style="color:var(--danger);">🔄 恢复默认</button>` : ''}
  `;
}

// ==================== 管理员模式 ====================
// 点击侧边栏 logo 3次弹出密码框，输入正确进入管理员模式
const ADMIN_PASSWORD = 'hotel2026';
let isAdmin = false;

// Logo 3击检测
let logoClickCount = 0;
let logoClickTimer = null;

function initAdminGate() {
  const logoArea = document.getElementById('logoArea');
  if (!logoArea) return;

  logoArea.addEventListener('click', () => {
    logoClickCount++;
    clearTimeout(logoClickTimer);

    // 2次点击给个提示
    if (logoClickCount === 2) {
      showToast('再点一次进入管理员模式...');
    }

    if (logoClickCount >= 3) {
      logoClickCount = 0;
      if (isAdmin) {
        // 已是管理员 → 退出
        exitAdmin();
      } else {
        // 未登录 → 弹密码框
        showAdminModal();
      }
    } else {
      // 1.5秒内没点够3次就重置
      logoClickTimer = setTimeout(() => { logoClickCount = 0; }, 1500);
    }
  });
}

function showAdminModal() {
  const modal = document.getElementById('adminModal');
  const input = document.getElementById('adminPasswordInput');
  const error = document.getElementById('adminError');
  modal.style.display = 'flex';
  input.value = '';
  error.style.display = 'none';
  setTimeout(() => input.focus(), 100);
}

function closeAdminModal() {
  document.getElementById('adminModal').style.display = 'none';
}

function submitAdminPassword() {
  const input = document.getElementById('adminPasswordInput');
  const error = document.getElementById('adminError');
  const password = input.value.trim();

  if (password === ADMIN_PASSWORD) {
    isAdmin = true;
    closeAdminModal();
    activateAdminUI();
    showToast('✅ 已进入管理员模式');
  } else {
    error.style.display = 'block';
    input.value = '';
    input.focus();
  }
}

// 回车提交密码
document.addEventListener('DOMContentLoaded', () => {
  const adminInput = document.getElementById('adminPasswordInput');
  if (adminInput) {
    adminInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') submitAdminPassword();
    });
  }
});

function activateAdminUI() {
  document.querySelectorAll('.admin-only').forEach(el => el.style.display = '');
  document.querySelectorAll('.admin-hide').forEach(el => el.style.display = 'none');

  // 更新问候语
  const hour = new Date().getHours();
  let greeting = '你好';
  if (hour < 6) greeting = '夜深了';
  else if (hour < 12) greeting = '上午好';
  else if (hour < 14) greeting = '中午好';
  else if (hour < 18) greeting = '下午好';
  else greeting = '晚上好';

  const adminGreeting = document.getElementById('adminGreeting');
  if (adminGreeting) {
    adminGreeting.textContent = `${greeting}，谢瑷瞳 👋`;
  }
}

function exitAdmin() {
  isAdmin = false;
  document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
  document.querySelectorAll('.admin-hide').forEach(el => el.style.display = '');
  showToast('已退出管理员模式');
}

// Token 设置弹窗
function showTokenSetup() {
  const modal = document.getElementById('tokenModal');
  const input = document.getElementById('tokenInput');
  const status = document.getElementById('tokenStatus');
  modal.style.display = 'flex';
  const existing = getGitHubToken();
  if (existing) {
    input.value = existing;
    status.textContent = '✅ 已配置 Token';
    status.style.color = 'var(--success)';
  } else {
    input.value = '';
    status.textContent = '';
  }
  setTimeout(() => input.focus(), 100);
}

function closeTokenModal() {
  document.getElementById('tokenModal').style.display = 'none';
}

async function saveToken() {
  const input = document.getElementById('tokenInput');
  const status = document.getElementById('tokenStatus');
  const token = input.value.trim();

  if (!token) {
    status.textContent = '❌ Token 不能为空';
    status.style.color = '#dc2626';
    return;
  }

  // 验证 Token 是否有效
  try {
    const resp = await fetch(PROMPTS_API_URL, {
      headers: { 'Authorization': `token ${token}` }
    });
    if (resp.ok) {
      setGitHubToken(token);
      status.textContent = '✅ Token 验证成功，已保存';
      status.style.color = 'var(--success)';
      showToast('✅ 同步设置已保存');
      setTimeout(() => closeTokenModal(), 1000);
    } else {
      status.textContent = '❌ Token 无效或权限不足（需要 Contents 读写权限）';
      status.style.color = '#dc2626';
    }
  } catch (e) {
    status.textContent = '❌ 验证失败，请检查网络';
    status.style.color = '#dc2626';
  }
}

// ==================== 知识库管理 ====================
let knowledgeBase = JSON.parse(localStorage.getItem('knowledge_base') || '[]');

function saveKnowledge() {
  localStorage.setItem('knowledge_base', JSON.stringify(knowledgeBase));
}

function addKnowledge(item) {
  knowledgeBase.push({
    id: Date.now(),
    ...item,
    createdAt: new Date().toLocaleString('zh-CN')
  });
  saveKnowledge();
}

function deleteKnowledge(id) {
  knowledgeBase = knowledgeBase.filter(k => k.id !== id);
  saveKnowledge();
}

function getKnowledgeText() {
  if (knowledgeBase.length === 0) return '暂无知识库内容';
  return knowledgeBase.map(k => `【${k.category}】${k.title}\n${k.content}`).join('\n\n---\n\n');
}

// ==================== 页面导航 ====================
function navigateTo(page) {
  // 先移除所有 active
  document.querySelectorAll('.nav-item').forEach(item => {
    if (item.dataset.page === page) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // 用 rAF 确保先隐藏再显示，避免同时渲染两个页面
  requestAnimationFrame(() => {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const target = document.getElementById('page-' + page);
    if (target) {
      requestAnimationFrame(() => {
        target.classList.add('active');
      });
    }

    // 更新标题
    const titles = {
      dashboard: '工作台',
      content: '内容创作中心',
      training: '前台培训管家',
      analysis: '数据分析助手',
      settings: '系统设置'
    };
    document.getElementById('pageTitle').textContent = titles[page] || '';
    document.getElementById('sidebar').classList.remove('open');

    // 刷新知识库
    if (page === 'training') {
      updateKnowledgeCount();
      renderKnowledgeList();
    }
  });
}

document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    navigateTo(item.dataset.page);
  });
});

// ==================== Tab切换 ====================
function initTabs() {
  document.querySelectorAll('.tab-bar').forEach(bar => {
    bar.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tabId = btn.dataset.tab;
        const container = bar.parentElement;

        // 切换按钮高亮
        bar.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // 切换内容（用rAF避免同时渲染两个tab）
        container.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        requestAnimationFrame(() => {
          const target = document.getElementById('tab-' + tabId);
          if (target) target.classList.add('active');
        });
      });
    });
  });
}

// ==================== 设置页导航 ====================
function initSettingsNav() {
  document.querySelectorAll('.settings-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const setting = btn.dataset.setting;
      document.querySelectorAll('.settings-nav-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.setting-section').forEach(s => s.classList.remove('active'));
      const target = document.getElementById('setting-' + setting);
      if (target) target.classList.add('active');
    });
  });
}

// ==================== 移动端菜单 ====================
document.getElementById('menuToggle').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('open');
});

// ==================== Toast提示 ====================
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.textContent = message;
  const bgColor = type === 'error' ? '#dc2626' : type === 'warning' ? '#d97706' : '#1f2937';
  toast.style.cssText = `
    position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%);
    background: ${bgColor}; color: #fff; padding: 10px 24px;
    border-radius: 8px; font-size: 14px; z-index: 1000;
    animation: fadeIn 0.2s ease; max-width: 80%; text-align: center;
  `;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

// ==================== 复制 ====================
function copyOutput(id) {
  const el = document.getElementById(id);
  const text = el.innerText;
  navigator.clipboard.writeText(text).then(() => {
    showToast('已复制到剪贴板');
  }).catch(() => {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    showToast('已复制到剪贴板');
  });
}

// ==================== 内容创作：携程社区生成 ====================
async function generateCtrip() {
  const hotelName = document.querySelector('#tab-ctrip .form-input').value.trim();
  const topic = document.querySelector('#tab-ctrip .form-select').value;
  const keywords = document.querySelectorAll('#tab-ctrip .form-input')[1].value.trim();
  const extra = document.querySelector('#tab-ctrip .form-textarea').value.trim();

  if (!hotelName) {
    showToast('请填写酒店名称', 'warning');
    return;
  }

  const output = document.getElementById('ctrip-output');
  output.innerHTML = `
    <div style="text-align:center; padding:60px 20px; color:var(--text-muted);">
      <div style="font-size:32px; margin-bottom:12px;">⏳</div>
      <p>AI正在生成内容...</p>
      <p style="font-size:12px; margin-top:8px;">使用通义千问 · 预计5-10秒</p>
    </div>
  `;

  try {
    let prompt = getPrompt('ctrip');
    prompt = prompt.replace('{{hotelName}}', hotelName)
                   .replace('{{topic}}', topic || '综合体验')
                   .replace('{{keywords}}', keywords || '无特定关键词')
                   .replace('{{extra}}', extra || '无');

    const result = await callAIWithFallback('content', [
      { role: 'system', content: '你是酒店OTA运营专家，擅长撰写携程社区笔记。输出纯文本，不要用markdown格式。' },
      { role: 'user', content: prompt }
    ]);

    output.innerHTML = `<div style="line-height:1.8; white-space:pre-wrap;">${escapeHtml(result)}</div>`;
  } catch (err) {
    output.innerHTML = `
      <div style="text-align:center; padding:40px 20px; color:#dc2626;">
        <div style="font-size:32px; margin-bottom:12px;">❌</div>
        <p>生成失败：${escapeHtml(err.message)}</p>
        <p style="font-size:12px; margin-top:8px; color:var(--text-muted);">请检查API配置是否正确</p>
      </div>
    `;
  }
}

// 重新生成
function regenerate() {
  generateCtrip();
}

// ==================== 内容创作：多平台复用 ====================
async function generateMulti() {
  const content = document.querySelector('#tab-multi .form-textarea').value.trim();
  if (!content) {
    showToast('请输入原始内容', 'warning');
    return;
  }

  const checkboxes = document.querySelectorAll('#tab-multi .checkbox-item input[type="checkbox"]');
  const platforms = [];
  checkboxes.forEach(cb => {
    if (cb.checked) platforms.push(cb.parentElement.textContent.trim());
  });

  if (platforms.length === 0) {
    showToast('请至少选择一个目标平台', 'warning');
    return;
  }

  const outputContainer = document.querySelector('#tab-multi .output-area');
  outputContainer.innerHTML = `
    <div style="text-align:center; padding:60px 20px; color:var(--text-muted);">
      <div style="font-size:32px; margin-bottom:12px;">⏳</div>
      <p>AI正在适配多平台内容...</p>
      <p style="font-size:12px; margin-top:8px;">使用通义千问 · 适配 ${platforms.length} 个平台</p>
    </div>
  `;

  try {
    let prompt = getPrompt('multi');
    prompt = prompt.replace('{{content}}', content)
                   .replace('{{platforms}}', platforms.join('、'));

    const result = await callAIWithFallback('content', [
      { role: 'system', content: '你是多平台内容改编专家。为每个平台分别输出内容，用平台名称作为标题分隔。输出纯文本，不用markdown。' },
      { role: 'user', content: prompt }
    ]);

    outputContainer.innerHTML = `<div style="line-height:1.8; white-space:pre-wrap;">${escapeHtml(result)}</div>`;
  } catch (err) {
    outputContainer.innerHTML = `
      <div style="text-align:center; padding:40px 20px; color:#dc2626;">
        <div style="font-size:32px; margin-bottom:12px;">❌</div>
        <p>生成失败：${escapeHtml(err.message)}</p>
      </div>
    `;
  }
}

// ==================== 前台培训管家：智能问答 ====================
let chatHistory = [];

function handleChat(e) {
  if (e.key === 'Enter') sendMessage();
}

async function sendMessage() {
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (!text) return;

  const messages = document.getElementById('chatMessages');

  // 移除欢迎界面
  const welcome = messages.querySelector('.chat-welcome');
  if (welcome) welcome.remove();

  // 用户消息
  messages.innerHTML += `
    <div class="chat-msg user">
      <div class="chat-avatar">我</div>
      <div class="chat-bubble">${escapeHtml(text)}</div>
    </div>
  `;

  input.value = '';

  // 加载中
  messages.innerHTML += `
    <div class="chat-msg bot" id="loading-msg">
      <div class="chat-avatar">🤖</div>
      <div class="chat-bubble">
        <div style="text-align:center; padding:20px; color:var(--text-muted);">⏳ 正在查询知识库...</div>
      </div>
    </div>
  `;
  messages.scrollTop = messages.scrollHeight;

  // 构建消息上下文
  chatHistory.push({ role: 'user', content: text });

  const systemPrompt = getPrompt('training')
    .replace('{{knowledge}}', getKnowledgeText())
    .replace('{{question}}', text);

  try {
    const allMessages = [
      { role: 'system', content: `你是酒店前台培训管家。根据以下知识库回答问题。如果知识库中没有相关内容，请根据你的酒店服务专业知识回答，并标注"（仅供参考）"。回答要简洁实用，方便前台快速使用。\n\n知识库：\n${getKnowledgeText()}` },
      ...chatHistory.slice(-10) // 保留最近10条上下文
    ];

    const result = await callAIWithFallback('training', allMessages, { temperature: 0.5 });

    chatHistory.push({ role: 'assistant', content: result });

    // 替换加载消息
    const loadingMsg = document.getElementById('loading-msg');
    if (loadingMsg) {
      loadingMsg.querySelector('.chat-bubble').innerHTML = result.replace(/\n/g, '<br>');
    }
  } catch (err) {
    const loadingMsg = document.getElementById('loading-msg');
    if (loadingMsg) {
      loadingMsg.querySelector('.chat-bubble').innerHTML = `<span style="color:#dc2626;">❌ 回复失败：${escapeHtml(err.message)}</span>`;
    }
  }

  messages.scrollTop = messages.scrollHeight;
}

function updateKnowledgeCount() {
  const countEl = document.querySelector('.chat-welcome strong');
  if (countEl) {
    const emergencyCount = document.querySelectorAll('.emergency-card p:not(.emergency-loaded)').length;
    countEl.textContent = knowledgeBase.length;
  }
}

// ==================== 知识库管理 ====================
function renderKnowledgeList() {
  const list = document.getElementById('knowledgeList');
  if (knowledgeBase.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <span>📭</span>
        <p>知识库为空</p>
        <p class="empty-hint">点击「录入知识」添加酒店信息、服务规范、价格政策等</p>
      </div>
    `;
    return;
  }

  list.innerHTML = knowledgeBase.map(k => `
    <div class="knowledge-item" style="background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius-md); padding:var(--space-4); margin-bottom:var(--space-3);">
      <div style="display:flex; justify-content:space-between; align-items:start;">
        <div>
          <div style="display:flex; gap:var(--space-2); align-items:center; margin-bottom:var(--space-2);">
            <span style="background:var(--primary-bg); color:var(--primary); font-size:11px; padding:2px 8px; border-radius:10px;">${escapeHtml(k.category)}</span>
            <strong style="font-size:14px;">${escapeHtml(k.title)}</strong>
          </div>
          <p style="font-size:13px; color:var(--text-secondary); line-height:1.6; max-height:60px; overflow:hidden;">${escapeHtml(k.content)}</p>
          <span style="font-size:11px; color:var(--text-muted); margin-top:4px; display:block;">${k.createdAt}</span>
        </div>
        <button class="btn-sm" onclick="deleteKnowledge(${k.id}); renderKnowledgeList(); showToast('已删除');" style="flex-shrink:0;">🗑️</button>
      </div>
    </div>
  `).join('');
}

// ==================== 数据分析：真实AI分析 ====================
let uploadedFileContent = null;

async function startAnalysis() {
  if (!uploadedFileContent) {
    showToast('请先上传数据文件', 'warning');
    return;
  }

  // 获取分析维度
  const checkboxes = document.querySelectorAll('#tab-upload .checkbox-group input[type="checkbox"]');
  const dimensions = [];
  checkboxes.forEach(cb => {
    if (cb.checked) dimensions.push(cb.parentElement.textContent.trim());
  });

  const reportType = document.querySelector('#tab-upload .form-select').value;

  // 切换到报告Tab
  document.querySelectorAll('#page-analysis .tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('#page-analysis .tab-btn[data-tab="report"]').classList.add('active');
  document.querySelectorAll('#page-analysis .tab-content').forEach(c => c.classList.remove('active'));
  document.getElementById('tab-report').classList.add('active');

  const container = document.querySelector('.report-container');
  container.innerHTML = `
    <div style="text-align:center; padding:60px 20px; color:var(--text-muted);">
      <div style="font-size:32px; margin-bottom:12px;">📊</div>
      <p>AI正在分析数据...</p>
      <p style="font-size:12px; margin-top:8px;">使用通义千问 · 预计10-20秒</p>
    </div>
  `;

  try {
    let prompt = getPrompt('analysis');
    prompt = prompt.replace('{{data}}', uploadedFileContent)
                   .replace('{{dimensions}}', dimensions.join('、'))
                   .replace('{{reportType}}', reportType);

    const result = await callAIWithFallback('analysis', [
      { role: 'system', content: '你是酒店运营数据分析专家，擅长从数据中发现问题并给出 actionable 的改进建议。输出格式：使用简单的文本排版，用数字序号和符号组织内容，便于阅读。' },
      { role: 'user', content: prompt }
    ], { temperature: 0.3, maxTokens: 4000 });

    container.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
        <h3 style="color:var(--primary);">📊 ${escapeHtml(reportType)}</h3>
        <div style="display:flex; gap:8px;">
          <button class="btn-sm" onclick="copyOutput('report-content')">📋 复制</button>
        </div>
      </div>
      <div id="report-content" style="line-height:1.8; white-space:pre-wrap;">${escapeHtml(result)}</div>
      <p style="color:var(--text-muted); font-size:12px; margin-top:20px; padding-top:16px; border-top:1px solid var(--border);">
        此报告由 DeepSeek AI 自动生成 · ${new Date().toLocaleString('zh-CN')}
      </p>
    `;
  } catch (err) {
    container.innerHTML = `
      <div style="text-align:center; padding:40px 20px; color:#dc2626;">
        <div style="font-size:32px; margin-bottom:12px;">❌</div>
        <p>分析失败：${escapeHtml(err.message)}</p>
        <p style="font-size:12px; margin-top:8px; color:var(--text-muted);">请检查API配置</p>
      </div>
    `;
  }
}

// ==================== 文件上传 ====================
document.getElementById('fileInput').addEventListener('change', function(e) {
  const file = e.target.files[0];
  if (!file) return;

  document.getElementById('uploadArea').style.display = 'none';
  document.getElementById('uploadPreview').style.display = 'block';
  document.getElementById('fileName').textContent = file.name;
  document.getElementById('fileSize').textContent = (file.size / 1024).toFixed(1) + ' KB';

  // 读取文件内容
  const reader = new FileReader();
  reader.onload = function(e) {
    uploadedFileContent = e.target.result;
    showToast('文件已加载，可以开始分析');
  };
  reader.readAsText(file);
});

function removeFile() {
  document.getElementById('uploadArea').style.display = '';
  document.getElementById('uploadPreview').style.display = 'none';
  document.getElementById('fileInput').value = '';
  uploadedFileContent = null;
}

// ==================== 弹窗 ====================
function showUploadModal() {
  document.getElementById('uploadModal').style.display = 'flex';
}

function closeModal() {
  document.getElementById('uploadModal').style.display = 'none';
}

document.getElementById('uploadModal').addEventListener('click', function(e) {
  if (e.target === this) closeModal();
});

// 保存知识条目
function saveKnowledgeItem() {
  const category = document.querySelector('#uploadModal .form-select').value;
  const title = document.querySelector('#uploadModal .form-input[type="text"]').value.trim();
  const content = document.querySelector('#uploadModal .form-textarea').value.trim();

  if (!title || !content) {
    showToast('请填写标题和内容', 'warning');
    return;
  }

  addKnowledge({ category, title, content });
  renderKnowledgeList();
  closeModal();
  showToast('知识已保存');

  // 清空表单
  document.querySelector('#uploadModal .form-input[type="text"]').value = '';
  document.querySelector('#uploadModal .form-textarea').value = '';
}

// ==================== Prompt 编辑 ====================
function editPrompt(key) {
  const promptCard = document.querySelector(`.prompt-card[data-prompt="${key}"]`);
  if (!promptCard) return;

  const currentPrompt = PROMPTS[key];
  const previewEl = promptCard.querySelector('.prompt-preview');
  const actionsEl = promptCard.querySelector('.prompt-actions');

  // 切换为编辑模式
  previewEl.innerHTML = `<textarea class="form-textarea prompt-edit-area" style="min-height:200px; font-size:13px; line-height:1.6;" placeholder="在此输入Prompt...">${escapeHtml(currentPrompt)}</textarea>`;
  actionsEl.innerHTML = `
    <button class="btn-sm btn-primary" onclick="savePromptEdit('${key}')">💾 保存</button>
    <button class="btn-sm" onclick="cancelPromptEdit('${key}')">取消</button>
  `;
}

function savePromptEdit(key) {
  const textarea = document.querySelector(`.prompt-card[data-prompt="${key}"] .prompt-edit-area`);
  if (!textarea) return;

  const newPrompt = textarea.value.trim();
  if (!newPrompt) {
    showToast('Prompt不能为空', 'warning');
    return;
  }

  savePrompt(key, newPrompt);
  renderPromptCard(key);
  showToast('✅ Prompt已保存，立即生效');
}

function cancelPromptEdit(key) {
  renderPromptCard(key);
}

function copyPrompt(key) {
  navigator.clipboard.writeText(getPrompt(key)).then(() => {
    showToast('Prompt已复制');
  });
}

// ==================== 拖拽上传 ====================
const uploadArea = document.getElementById('uploadArea');
if (uploadArea) {
  ['dragenter', 'dragover'].forEach(event => {
    uploadArea.addEventListener(event, (e) => {
      e.preventDefault();
      uploadArea.style.borderColor = 'var(--primary)';
      uploadArea.style.background = 'var(--primary-bg)';
    });
  });

  ['dragleave', 'drop'].forEach(event => {
    uploadArea.addEventListener(event, (e) => {
      e.preventDefault();
      uploadArea.style.borderColor = '';
      uploadArea.style.background = '';
    });
  });

  uploadArea.addEventListener('drop', (e) => {
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.csv') || file.name.endsWith('.txt'))) {
      document.getElementById('uploadArea').style.display = 'none';
      document.getElementById('uploadPreview').style.display = 'block';
      document.getElementById('fileName').textContent = file.name;
      document.getElementById('fileSize').textContent = (file.size / 1024).toFixed(1) + ' KB';

      const reader = new FileReader();
      reader.onload = function(ev) {
        uploadedFileContent = ev.target.result;
        showToast('文件已加载');
      };
      reader.readAsText(file);
    }
  });
}

// ==================== 工具函数 ====================
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ==================== 初始化 ====================
document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initSettingsNav();
  initAdminGate();
  renderKnowledgeList();

  // 从 GitHub 拉取云端 Prompt（后台静默加载，加载完后刷新卡片）
  fetchCloudPrompts().then(() => {
    ['ctrip', 'multi', 'training', 'analysis'].forEach(key => renderPromptCard(key));
  });

  // 刷新 Prompt 卡片状态（先用本地缓存渲染）
  ['ctrip', 'multi', 'training', 'analysis'].forEach(key => renderPromptCard(key));

  // 普通用户模式下隐藏管理员元素
  document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
  document.querySelectorAll('.admin-hide').forEach(el => el.style.display = '');

  // 更新日期
  const dateEl = document.getElementById('todayDate');
  if (dateEl) {
    dateEl.textContent = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
  }
});

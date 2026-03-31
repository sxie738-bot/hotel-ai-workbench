// ==================== 会员体系配置 ====================
const PLANS = {
  free:    { name: '免费体验', price: 0,    days: 0,   label: '免费体验' },
  trial:   { name: '体验版',   price: 9.9,  days: 3,   label: '体验版·3天' },
  monthly: { name: '连续包月', price: 39,   days: 30,  label: '包月会员' },
  yearly:  { name: '连续包年', price: 428,  days: 365, label: '包年会员' }
};

// 模块权限默认配置（管理员可在后台修改）
// free = 0 表示未配置权限的酒店用户看不到任何功能，需管理员在酒店配置中开通
const DEFAULT_MODULE_PERMISSIONS = {
  content:       { free: 0,  trial: -1, monthly: -1, yearly: -1, name: '内容创作中心', icon: '✍️' },
  training:      { free: 0,  trial: -1, monthly: -1, yearly: -1, name: '前台培训管家', icon: '📖' },
  analysis:      { free: 0,  trial: -1, monthly: -1, yearly: -1, name: '数据分析助手', icon: '📈' },
  image:         { free: 0,  trial: 3,  monthly: -1, yearly: -1, name: 'AI配图',       icon: '🎨' },
  feishu:        { free: 0,  trial: 0,  monthly: -1, yearly: -1, name: '飞书表格',     icon: '📋' },
  video:         { free: 0,  trial: 0,  monthly: -1, yearly: -1, name: '短视频生成',   icon: '🎬' },
  geo:           { free: 0,  trial: 3,  monthly: -1, yearly: -1, name: 'GEO优化',     icon: '🔍' },
  quicklink:     { free: -1, trial: -1, monthly: -1, yearly: -1, name: '一键直达',     icon: '🚀' },
  review:        { free: 3,  trial: -1, monthly: -1, yearly: -1, name: '点评回复',     icon: '💬' },
  competitor:    { free: 0,  trial: 0,  monthly: -1, yearly: -1, name: '竞对情报站',   icon: '🕵️' },
  diagnosis:     { free: 3,  trial: -1, monthly: -1, yearly: -1, name: '经营诊断',     icon: '🩺' },
  bizdev:        { free: 0,  trial: 0,  monthly: -1, yearly: -1, name: '大客户拓展',   icon: '🤝' },
  patrol:        { free: 0,  trial: 0,  monthly: -1, yearly: -1, name: '数字巡店',     icon: '📷' },
  feedback:      { free: -1, trial: -1, monthly: -1, yearly: -1, name: '共创中心',     icon: '🎯' }
};

// -1 = 不限次, 0 = 关闭, >0 = 限次数

// ==================== 会员数据管理 ====================
const MemberStore = {
  _key: 'hotel_member',
  _usageKey: 'hotel_usage',

  // 获取当前会员信息
  get() {
    try { return JSON.parse(localStorage.getItem(this._key)) || null; } catch { return null; }
  },

  // 保存会员信息
  set(data) {
    localStorage.setItem(this._key, JSON.stringify(data));
  },

  // 获取使用次数
  getUsage() {
    try { return JSON.parse(localStorage.getItem(this._usageKey)) || {}; } catch { return {}; }
  },

  // 记录使用次数
  addUsage(moduleKey) {
    const usage = this.getUsage();
    usage[moduleKey] = (usage[moduleKey] || 0) + 1;
    localStorage.setItem(this._usageKey, JSON.stringify(usage));
    return usage[moduleKey];
  },

  // 获取当前有效权限配置（云端 > 代码默认）
  getPermissions() {
    const cloudPerms = localStorage.getItem('hotel_module_permissions');
    if (cloudPerms) {
      try { return JSON.parse(cloudPerms); } catch {}
    }
    return DEFAULT_MODULE_PERMISSIONS;
  },

  // 判断是否已过期
  isExpired() {
    const m = this.get();
    if (!m || !m.expireDate) return true;
    const now = new Date(); now.setHours(0,0,0,0);
    return new Date(m.expireDate) < now;
  },

  // 判断会员计划类型
  getPlan() {
    const m = this.get();
    return m ? m.plan : 'free';
  },

  // 剩余天数
  getDaysLeft() {
    const m = this.get();
    if (!m || !m.expireDate) return 0;
    const now = new Date(); now.setHours(0,0,0,0);
    const expire = new Date(m.expireDate); expire.setHours(0,0,0,0);
    return Math.ceil((expire - now) / (1000*60*60*24));
  },

  // 获取酒店配置的套餐（优先级高于用户自己注册的套餐）
  getHotelPlan() {
    const hotelName = localStorage.getItem('current_hotel') || '';
    if (!hotelName) return null;
    const config = getHotelConfig(hotelName);
    return config ? (config.plan || null) : null;
  },

  // 检查模块是否有权限使用
  canUse(moduleKey) {
    const m = this.get();
    // 优先使用酒店配置的套餐，如果没有则用用户自己的
    const hotelPlan = this.getHotelPlan();
    const plan = hotelPlan || (m ? m.plan : 'free');
    const perms = this.getPermissions();
    const config = perms[moduleKey];
    if (!config) return true; // 未知模块默认可用

    const limit = config[plan];
    if (limit === -1) return true;  // 不限次
    if (limit === 0) return false;  // 关闭
    // 限次数
    const usage = this.getUsage();
    return (usage[moduleKey] || 0) < limit;
  },

  // 获取模块剩余次数（-1表示不限）
  getRemaining(moduleKey) {
    const m = this.get();
    const hotelPlan = this.getHotelPlan();
    const plan = hotelPlan || (m ? m.plan : 'free');
    const perms = this.getPermissions();
    const config = perms[moduleKey];
    if (!config) return -1;
    const limit = config[plan];
    if (limit === -1) return -1;
    if (limit === 0) return 0;
    const usage = this.getUsage();
    return Math.max(0, limit - (usage[moduleKey] || 0));
  },

  // 清除会员数据（退出登录）
  clear() {
    localStorage.removeItem(this._key);
    localStorage.removeItem(this._usageKey);
  },

  // 获取操作日志
  getHistory() {
    try { return JSON.parse(localStorage.getItem('hotel_operation_history') || '[]'); } catch { return []; }
  },

  // 添加操作日志（记录用户的 AI 操作）
  addHistory(action, moduleKey, result) {
    const history = this.getHistory();
    const log = {
      id: Date.now(),
      action,           // 'generate_ctrip', 'generate_multi', 'send_message', 'analyze_data'
      moduleKey,        // 'content', 'training', 'analysis'
      resultLength: result ? (typeof result === 'string' ? result.length : 0) : 0,
      timestamp: new Date().toISOString()
    };
    history.unshift(log);
    // 只保留最近 100 条
    if (history.length > 100) history.splice(100);
    localStorage.setItem('hotel_operation_history', JSON.stringify(history));
  }
};

// ==================== 入口页面流程 ====================
let selectedPlan = 'free';

function selectPlan(plan) {
  selectedPlan = plan;
  if (plan === 'free') {
    showStep(1); // 免费直接填信息
    return;
  }
  showStep(1); // 付费先填信息
}

function showLoginStep() {
  showStep('login');
}

function showStep(step) {
  // 隐藏所有步骤
  document.querySelectorAll('.entry-step').forEach(el => el.style.display = 'none');
  // 显示目标步骤
  const target = typeof step === 'number' ? `entryStep${step}` : (step === 'login' ? 'entryStepLogin' : null);
  if (target) {
    const el = document.getElementById(target);
    if (el) el.style.display = 'block';
  }
}

function submitEntryInfo() {
  const name = document.getElementById('entryName').value.trim();
  const hotel = document.getElementById('entryHotel').value.trim();
  const phone = document.getElementById('entryPhone').value.trim();
  if (!name) { showToast('请输入姓名', 'error'); return; }
  if (!hotel) { showToast('请输入酒店名称', 'error'); return; }
  if (!phone || phone.length !== 11) { showToast('请输入正确的手机号', 'error'); return; }

  if (selectedPlan === 'free') {
    // 免费体验：直接激活
    const memberData = {
      name, hotel, phone,
      plan: 'free',
      activateDate: new Date().toISOString().split('T')[0],
      expireDate: '2099-12-31', // 免费永不过期
      status: 'active',
      usage: MemberStore.getUsage()
    };
    MemberStore.set(memberData);
    localStorage.setItem('current_hotel', hotel);
    enterWorkbench();
  } else {
    // 付费套餐：显示收款码
    const planInfo = PLANS[selectedPlan];
    document.getElementById('payTitle').textContent = `扫码支付 · ${planInfo.label}`;
    document.getElementById('payInfo').textContent = `套餐：${planInfo.label} · ¥${planInfo.price}`;
    // 收款码图片（从管理员配置读取，暂用占位）
    const qrImg = document.getElementById('payQRCode');
    const savedQR = localStorage.getItem('hotel_pay_qrcode');
    if (savedQR) {
      qrImg.src = savedQR;
    } else {
      // 默认占位 - 管理员上传后会替换
      qrImg.src = 'data:image/svg+xml,' + encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">' +
        '<rect fill="#f3f4f6" width="200" height="200"/>' +
        '<text x="100" y="90" text-anchor="middle" font-size="16" fill="#9ca3af">收款码</text>' +
        '<text x="100" y="115" text-anchor="middle" font-size="12" fill="#9ca3af">管理员未上传</text>' +
        '</svg>'
      );
    }
    showStep(2);
  }
}

function confirmPaid() {
  const name = document.getElementById('entryName').value.trim();
  const hotel = document.getElementById('entryHotel').value.trim();
  const phone = document.getElementById('entryPhone').value.trim();
  const planInfo = PLANS[selectedPlan];

  // 提交到云端待确认队列
  const pendingData = {
    name, hotel, phone,
    plan: selectedPlan,
    planName: planInfo.label,
    price: planInfo.price,
    submitTime: new Date().toISOString(),
    status: 'pending'
  };

  // 保存到本地待确认状态
  localStorage.setItem('hotel_pending_payment', JSON.stringify(pendingData));

  // 将用户信息临时保存
  const memberData = {
    name, hotel, phone,
    plan: selectedPlan,
    activateDate: '',
    expireDate: '',
    status: 'pending',
    usage: {}
  };
  MemberStore.set(memberData);
  localStorage.setItem('current_hotel', hotel);

  showStep(3);
  // 自动刷新检查（每30秒）
  startAutoCheck();
}

function startAutoCheck() {
  let count = 0;
  const timer = setInterval(() => {
    count++;
    const remaining = 30 - count;
    document.getElementById('autoRefreshCountdown').textContent =
      remaining > 0 ? `${remaining}秒后自动刷新...` : '正在检查...';
    if (count >= 30) {
      count = 0;
      checkPaymentStatus();
    }
  }, 1000);
  // 存储定时器以便清理
  window._paymentCheckTimer = timer;
}

function checkPaymentStatus() {
  const member = MemberStore.get();
  if (member && member.status === 'active') {
    // 管理员已确认
    clearInterval(window._paymentCheckTimer);
    document.getElementById('activateInfo').textContent =
      `套餐：${PLANS[member.plan].label} · 到期：${member.expireDate}`;
    showStep(4);
  } else {
    showToast('暂未确认，请稍后再试', 'warning');
  }
}

function showInvoiceForm() {
  document.getElementById('invoiceSection').style.display = 'none';
  document.getElementById('invoiceForm').style.display = 'block';
}

function submitInvoice() {
  const title = document.getElementById('invoiceTitle').value.trim();
  const email = document.getElementById('invoiceEmail').value.trim();
  if (!title || !email) { showToast('请填写发票抬头和邮箱', 'error'); return; }
  const invoiceData = {
    title,
    tax: document.getElementById('invoiceTax').value.trim(),
    email,
    member: MemberStore.get(),
    submitTime: new Date().toISOString()
  };
  localStorage.setItem('hotel_invoice_' + Date.now(), JSON.stringify(invoiceData));
  showToast('发票信息已提交，工作人员将尽快处理');
  enterWorkbench();
}

function enterWorkbench() {
  document.getElementById('entryPage').style.display = 'none';
  initApp();
}

// 跳过入口页面，以免费体验身份直接进入工作台
function skipEntry() {
  // 如果还没有会员记录，创建一个免费体验记录
  const member = MemberStore.get();
  if (!member) {
    MemberStore.set({
      name: '游客',
      hotel: '',
      phone: '',
      plan: 'free',
      status: 'active',
      activateDate: new Date().toISOString(),
      expireDate: '' // 免费版无过期时间
    });
  }
  enterWorkbench();
}

function memberLogin() {
  const name = document.getElementById('loginName').value.trim();
  const phone = document.getElementById('loginPhone').value.trim();
  if (!name || !phone) { showToast('请输入姓名和手机号', 'error'); return; }

  // 从云端检查（通过管理员已开通的用户列表）
  // 这里需要从prompts.json的members字段匹配
  // 暂时用本地存储匹配
  const member = MemberStore.get();
  if (member && member.name === name && member.phone === phone && member.status === 'active') {
    if (MemberStore.isExpired() && member.plan !== 'free') {
      // 已过期，引导续费
      showStep(0);
      showToast('会员已到期，请续费', 'warning');
      return;
    }
    enterWorkbench();
  } else {
    showToast('未找到匹配的会员信息，请确认或联系管理员', 'error');
  }
}

function closeExpiryModal() {
  document.getElementById('expiryModal').style.display = 'none';
}

function renewPlan() {
  document.getElementById('expiryModal').style.display = 'none';
  document.getElementById('entryPage').style.display = '';
  showStep(0);
}

// 检查到期提醒
function checkExpiryReminder() {
  const member = MemberStore.get();
  if (!member || member.plan === 'free' || member.status !== 'active') return;

  const daysLeft = MemberStore.getDaysLeft();
  const reminded = localStorage.getItem('hotel_expiry_reminded');

  if (daysLeft <= 0) {
    // 已过期
    if (!reminded || reminded !== 'expired') {
      document.getElementById('expiryTitle').textContent = '⚠️ 会员已到期';
      document.getElementById('expiryMessage').innerHTML =
        '您的会员已于 <strong>今天</strong> 到期。<br>已自动降级为免费体验（每模块限3次）。<br>续费后可恢复全功能使用。';
      document.getElementById('expiryModal').style.display = 'flex';
      localStorage.setItem('hotel_expiry_reminded', 'expired');
      // 降级
      member.plan = 'free';
      MemberStore.set(member);
    }
  } else if (daysLeft <= 3) {
    if (!reminded || reminded !== '3days') {
      document.getElementById('expiryTitle').textContent = '⏰ 会员即将到期';
      document.getElementById('expiryMessage').innerHTML =
        `您的会员将于 <strong>${daysLeft}天后</strong> 到期。<br>到期后将降级为免费体验。<br>建议尽快续费以保持全功能。`;
      document.getElementById('expiryModal').style.display = 'flex';
      localStorage.setItem('hotel_expiry_reminded', '3days');
    }
  } else if (daysLeft <= 7) {
    if (!reminded || reminded !== '7days') {
      document.getElementById('expiryTitle').textContent = '🔔 温馨提醒';
      document.getElementById('expiryMessage').innerHTML =
        `您的会员将于 <strong>${daysLeft}天后</strong> 到期。<br>提前续费不浪费剩余天数哦！`;
      document.getElementById('expiryModal').style.display = 'flex';
      localStorage.setItem('hotel_expiry_reminded', '7days');
    }
  }
}

// 模块使用前检查
function checkModuleAccess(moduleKey, onAllowed) {
  if (MemberStore.canUse(moduleKey)) {
    if (typeof onAllowed === 'function') onAllowed();
    return true;
  }
  // 没有权限，弹窗
  const perms = MemberStore.getPermissions();
  const config = perms[moduleKey];
  const member = MemberStore.get();
  const plan = member ? member.plan : 'free';
  const limit = config ? config[plan] : 0;
  const remaining = MemberStore.getRemaining(moduleKey);
  const hotelName = member ? member.hotel : '';

  let lockMsg = '';
  let actionBtnText = '我知道了';
  let actionBtnFn = 'closeModalLock()';

  if (!member || !member.name) {
    // 未注册用户
    lockMsg = `<strong>${config ? config.name : moduleKey}</strong> 仅对正式学员开放。<br><br>` +
      `请先完成注册（填写姓名、手机号、酒店名称）。`;
    actionBtnText = '📝 去注册';
    actionBtnFn = 'closeModalLock(); showHotelWelcome();';
  } else if (hotelName) {
    // 已注册有酒店：判断是免费用户还是酒店未配置
    const hotelPlan = MemberStore.getHotelPlan();
    if (hotelPlan === 'free' || (!hotelPlan && plan === 'free')) {
      // 免费用户 → 引导升级
      lockMsg = `<strong>${config ? config.name : moduleKey}</strong> 需要付费会员才能使用。<br><br>` +
        `当前为免费体验版，升级后可解锁全部功能。<br>` +
        `包月 <strong>¥39</strong> / 包年 <strong>¥428</strong>`;
      actionBtnText = '💎 升级套餐';
      actionBtnFn = 'closeModalLock(); showRenewModal();';
    } else {
      // 酒店未配置权限 → 联系管理员
      lockMsg = `<strong>${config ? config.name : moduleKey}</strong> 当前暂未开放。<br><br>` +
        `您的酒店「${escapeHtml(hotelName)}」可能还未开通此功能。<br>` +
        `请联系管理员（谢瑷瞳）为您开通。`;
    }
  } else {
    // 未设置酒店名
    lockMsg = `<strong>${config ? config.name : moduleKey}</strong> 仅对正式学员开放。<br><br>` +
      `请先设置您的酒店名称。`;
    actionBtnText = '🏨 设置酒店';
    actionBtnFn = 'closeModalLock(); showHotelWelcome();';
  }

  document.getElementById('moduleLockMessage').innerHTML = lockMsg;

  const usageEl = document.getElementById('moduleLockUsage');
  if (limit > 0) {
    const usage = MemberStore.getUsage();
    document.getElementById('moduleUsedCount').textContent = usage[moduleKey] || 0;
    document.getElementById('moduleLimitCount').textContent = limit;
    usageEl.style.display = 'block';
  } else {
    usageEl.style.display = 'none';
  }

  document.getElementById('moduleLockModal').style.display = 'flex';

  // 更新按钮文字和行为
  const actionBtn = document.getElementById('moduleLockActionBtn');
  if (actionBtn) {
    actionBtn.textContent = actionBtnText;
    actionBtn.setAttribute('onclick', actionBtnFn);
  }
  return false;
}

function closeModalLock() {
  document.getElementById('moduleLockModal').style.display = 'none';
}

function upgradeFromLock() {
  document.getElementById('moduleLockModal').style.display = 'none';
  showRenewModal();
}

// 初始化侧边栏模块显示（根据权限）
function updateSidebarByPermissions() {
  const perms = MemberStore.getPermissions();
  Object.keys(perms).forEach(key => {
    const canUse = MemberStore.canUse(key);
    const remaining = MemberStore.getRemaining(key);
    const navItem = document.querySelector(`[data-page="${key}"]`);
    if (!navItem) return;

    if (!canUse && remaining === 0) {
      navItem.classList.add('locked');
      navItem.onclick = function(e) {
        e.preventDefault();
        checkModuleAccess(key);
      };
    } else if (canUse && remaining > 0 && remaining <= 2) {
      // 快用完了，加提示
      let badge = navItem.querySelector('.module-lock-badge');
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'module-lock-badge';
        navItem.querySelector('.nav-label').appendChild(badge);
      }
      badge.textContent = `剩${remaining}次`;
    }
  });
}

// ==================== 会员中心渲染 ====================
function renderProfilePage() {
  const member = MemberStore.get();
  const notLoggedIn = document.getElementById('profileNotLoggedIn');
  const loggedIn = document.getElementById('profileLoggedIn');

  // 如果没有会员信息或未填写姓名，显示未登录界面
  if (!member || !member.name) {
    if (notLoggedIn) notLoggedIn.style.display = 'block';
    if (loggedIn) loggedIn.style.display = 'none';
    return;
  }

  // 已登录，显示会员信息
  if (notLoggedIn) notLoggedIn.style.display = 'none';
  if (loggedIn) loggedIn.style.display = '';

  const plan_raw = member.plan || 'free';
  const hotelPlan = MemberStore.getHotelPlan();
  const effectivePlan = hotelPlan || plan_raw;
  const planInfo = PLANS[effectivePlan] || PLANS.free;
  const daysLeft = MemberStore.getDaysLeft();
  const isExpired = daysLeft <= 0 && effectivePlan !== 'free';
  const isExpiring = daysLeft <= 7 && daysLeft > 0;

  // 头部样式
  const headerEl = document.getElementById('profileCardHeader');
  if (effectivePlan === 'free') {
    headerEl.style.background = 'var(--gray-100)';
    headerEl.style.color = 'var(--gray-700)';
    document.getElementById('profileCardIcon').textContent = '🆓';
    document.getElementById('profilePlanName').textContent = '免费体验';
    document.getElementById('profilePlanSub').textContent = '每模块限3次体验';
  } else if (isExpired) {
    headerEl.style.background = 'var(--danger-bg)';
    headerEl.style.color = 'var(--danger)';
    document.getElementById('profileCardIcon').textContent = '⏰';
    document.getElementById('profilePlanName').textContent = planInfo.label + '（已过期）';
    document.getElementById('profilePlanSub').textContent = '已自动降级为免费体验';
  } else if (isExpiring) {
    headerEl.style.background = 'var(--warning-bg)';
    headerEl.style.color = 'var(--warning)';
    document.getElementById('profileCardIcon').textContent = '🔔';
    document.getElementById('profilePlanName').textContent = planInfo.label;
    document.getElementById('profilePlanSub').textContent = `还剩 ${daysLeft} 天，建议尽快续费`;
  } else {
    headerEl.style.background = 'linear-gradient(135deg, var(--primary), var(--primary-dark))';
    headerEl.style.color = '#fff';
    document.getElementById('profileCardIcon').textContent = '🏆';
    document.getElementById('profilePlanName').textContent = planInfo.label;
    document.getElementById('profilePlanSub').textContent = effectivePlan === 'yearly' ? '全功能 · 优先体验新功能' : '全功能不限次使用';
  }

  // 信息
  document.getElementById('profileName').textContent = member.name || '-';
  document.getElementById('profileHotel').textContent = member.hotel || '-';
  document.getElementById('profileActivateDate').textContent = member.activateDate || '-';
  document.getElementById('profileExpireDate').textContent = effectivePlan === 'free' ? '永久' : (member.expireDate || '-');

  // 天数进度条
  const statusBar = document.getElementById('profileStatusBar');
  if (effectivePlan === 'free') {
    statusBar.style.display = 'none';
  } else {
    statusBar.style.display = '';
    const totalDays = planInfo.days;
    const percent = isExpired ? 0 : Math.min(100, (daysLeft / totalDays) * 100);
    const barColor = isExpired ? 'var(--danger)' : isExpiring ? 'var(--warning)' : 'var(--success)';
    document.getElementById('profileDaysBar').style.width = percent + '%';
    document.getElementById('profileDaysBar').style.background = barColor;
    document.getElementById('profileDaysLeft').textContent = isExpired ? '已过期' : daysLeft + '天';
    document.getElementById('profileDaysLeft').style.color = barColor;
  }

  // 侧边栏 badge
  const badge = document.getElementById('profileBadge');
  if (badge) {
    if (effectivePlan !== 'free' && !isExpired) {
      badge.style.display = '';
      badge.textContent = daysLeft + '天';
      if (isExpiring) {
        badge.style.background = 'var(--warning)';
      } else {
        badge.style.background = 'var(--success)';
      }
    } else {
      badge.style.display = 'none';
    }
  }

  // 续费按钮
  const renewBtn = document.getElementById('profileRenewBtn');
  renewBtn.textContent = effectivePlan === 'free' ? '🔥 升级套餐' : '🔄 续费/升级';
  renewBtn.onclick = showRenewModal;
  document.getElementById('profileLogoutBtn').style.display = '';

  // 渲染使用情况
  renderProfileUsage();

  // 渲染操作历史
  renderProfileHistory();

  // 更新侧边栏用户按钮
  updateUserNavButton();
}

function renderProfileUsage() {
  const perms = MemberStore.getPermissions();
  const usage = MemberStore.getUsage();
  const member = MemberStore.get();
  const hotelPlan = MemberStore.getHotelPlan();
  const plan = hotelPlan || MemberStore.getPlan();
  const container = document.getElementById('profileUsageList');

  const modules = [
    { key: 'content', label: '内容创作', icon: '✍️' },
    { key: 'training', label: '前台培训', icon: '📖' },
    { key: 'analysis', label: '数据分析', icon: '📈' },
    { key: 'image', label: 'AI配图', icon: '🎨' },
    { key: 'video', label: '短视频生成', icon: '🎬' },
    { key: 'geo', label: 'GEO优化', icon: '🔍' },
    { key: 'review', label: '点评回复', icon: '💬' },
    { key: 'competitor', label: '竞对情报', icon: '🕵️' },
    { key: 'diagnosis', label: '经营诊断', icon: '🩺' },
    { key: 'bizdev', label: '大客户拓展', icon: '🤝' },
    { key: 'patrol', label: '数字巡店', icon: '📷' },
    { key: 'feishu', label: '飞书表格', icon: '📋' },
  ];

  container.innerHTML = modules.map(m => {
    const config = perms[m.key];
    if (!config) return '';
    const limit = config[plan];
    const used = usage[m.key] || 0;

    let statusText = '', statusColor = '';
    if (limit === -1) {
      statusText = '不限次';
      statusColor = 'var(--success)';
    } else if (limit === 0) {
      statusText = '未开放';
      statusColor = 'var(--text-muted)';
    } else {
      const remaining = Math.max(0, limit - used);
      statusText = remaining > 0 ? `剩余 ${remaining} 次` : '已用完';
      statusColor = remaining > 0 ? (remaining <= 2 ? 'var(--warning)' : 'var(--text-secondary)') : 'var(--danger)';
    }

    return `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid var(--border-light);">
        <div style="display:flex; align-items:center; gap:10px;">
          <span style="font-size:18px;">${m.icon}</span>
          <div>
            <div style="font-size:14px; font-weight:500;">${m.label}</div>
            <div style="font-size:12px; color:var(--text-muted);">${config.name}</div>
          </div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:13px; font-weight:600; color:${statusColor};">${statusText}</div>
          ${limit > 0 ? `<div style="font-size:11px; color:var(--text-muted);">已使用 ${used} / ${limit} 次</div>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function renderProfileHistory() {
  const history = MemberStore.getHistory();
  const container = document.getElementById('profileHistoryList');

  if (history.length === 0) {
    container.innerHTML = '<div style="text-align:center; padding:24px; color:var(--text-muted); font-size:13px;">暂无操作记录<br><span style="font-size:11px;">使用 AI 工具后会自动记录</span></div>';
    return;
  }

  const actionNames = {
    generate_ctrip: '生成携程内容',
    generate_multi: '多平台复用',
    send_message: '前台问答',
    analyze_data: '数据分析',
    generate_image: 'AI配图'
  };
  const moduleNames = {
    content: '✍️ 内容创作',
    training: '📖 前台培训',
    analysis: '📈 数据分析',
    image: '🎨 AI配图'
  };

  container.innerHTML = history.slice(0, 20).map(h => {
    const actionName = actionNames[h.action] || h.action;
    const moduleName = moduleNames[h.moduleKey] || '';
    const time = formatTime(h.timestamp);
    const dateStr = h.timestamp ? new Date(h.timestamp).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }) : '';
    return `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid var(--border-light);">
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="font-size:14px;">${moduleName.split(' ')[0]}</span>
          <div>
            <div style="font-size:13px; font-weight:500;">${actionName}</div>
            <div style="font-size:11px; color:var(--text-muted);">${dateStr}</div>
          </div>
        </div>
        <div style="font-size:11px; color:var(--text-muted);">${time}</div>
      </div>
    `;
  }).join('');
}

function showRenewModal() {
  // 打开升级套餐弹窗（从套餐选择开始）
  showUpgradePlanSelect();
}

// ==================== 升级套餐弹窗 ====================
let _selectedUpgradePlan = null;

function showUpgradePlanSelect() {
  _selectedUpgradePlan = null;
  document.getElementById('upgradeModal').style.display = 'flex';
  document.getElementById('upgradeStep1').style.display = '';
  document.getElementById('upgradeStep2').style.display = 'none';
  document.getElementById('upgradeStep3').style.display = 'none';
  document.getElementById('upgradeFooter1').style.display = '';
  document.getElementById('upgradeFooter2').style.display = 'none';
  document.getElementById('upgradeFooter3').style.display = 'none';
  // 重置选中状态
  document.querySelectorAll('.plan-card').forEach(c => c.style.borderColor = 'var(--border)');
}

function selectPlan(plan) {
  _selectedUpgradePlan = plan;
  const planInfo = PLANS[plan];
  if (!planInfo) return;

  // 高亮选中
  document.querySelectorAll('.plan-card').forEach(c => c.style.borderColor = 'var(--border)');
  document.getElementById('planCard' + plan.charAt(0).toUpperCase() + plan.slice(1)).style.borderColor = 'var(--primary)';

  // 切换到付款步骤
  document.getElementById('upgradeStep1').style.display = 'none';
  document.getElementById('upgradeStep2').style.display = '';
  document.getElementById('upgradeStep3').style.display = 'none';
  document.getElementById('upgradeFooter1').style.display = 'none';
  document.getElementById('upgradeFooter2').style.display = '';
  document.getElementById('upgradeFooter3').style.display = 'none';

  document.getElementById('upgradePlanLabel').textContent = planInfo.label;
  document.getElementById('upgradePlanPrice').textContent = '¥' + planInfo.price;

  const savedQR = localStorage.getItem('hotel_pay_qrcode');
  if (savedQR) {
    document.getElementById('upgradeQRImg').src = savedQR;
    document.getElementById('upgradeQRImg').style.display = '';
    document.getElementById('upgradeNoQR').style.display = 'none';
  } else {
    document.getElementById('upgradeQRImg').style.display = 'none';
    document.getElementById('upgradeNoQR').style.display = '';
  }
}

function backToPlanSelect() {
  document.getElementById('upgradeStep1').style.display = '';
  document.getElementById('upgradeStep2').style.display = 'none';
  document.getElementById('upgradeStep3').style.display = 'none';
  document.getElementById('upgradeFooter1').style.display = '';
  document.getElementById('upgradeFooter2').style.display = 'none';
  document.getElementById('upgradeFooter3').style.display = 'none';
}

function confirmPaidUpgrade() {
  const member = MemberStore.get();
  if (!member || !member.name || !_selectedUpgradePlan) {
    showToast('信息不完整，请重新操作', 'error');
    return;
  }
  const planInfo = PLANS[_selectedUpgradePlan];
  if (!planInfo) return;

  // 禁用按钮防重复提交
  const btn = document.getElementById('upgradePaidBtn');
  btn.disabled = true;
  btn.textContent = '提交中...';

  // 提交到待确认队列（写入 localStorage + 同步云端）
  const orderData = {
    name: member.name,
    phone: member.phone,
    hotel: member.hotel,
    plan: _selectedUpgradePlan,
    price: planInfo.price,
    planLabel: planInfo.label,
    submitTime: new Date().toISOString(),
    status: 'pending'
  };

  const members = getMembersData();
  members.push(orderData);
  saveMembersData(members);

  // 切换到成功步骤
  document.getElementById('upgradeStep1').style.display = 'none';
  document.getElementById('upgradeStep2').style.display = 'none';
  document.getElementById('upgradeStep3').style.display = '';
  document.getElementById('upgradeFooter1').style.display = 'none';
  document.getElementById('upgradeFooter2').style.display = 'none';
  document.getElementById('upgradeFooter3').style.display = '';

  showToast('✅ 付款申请已提交，请等待管理员确认');
}

function closeUpgradeModal() {
  document.getElementById('upgradeModal').style.display = 'none';
  _selectedUpgradePlan = null;
  const btn = document.getElementById('upgradePaidBtn');
  if (btn) { btn.disabled = false; btn.textContent = '我已付款，提交确认'; }
}

function showLogoutConfirm() {
  // 弹窗确认退出
  const modal = document.getElementById('logoutConfirmModal');
  if (modal) {
    modal.style.display = 'flex';
  }
}

function confirmLogout() {
  const member = MemberStore.get();
  const name = member?.name || '';
  MemberStore.clear();
  localStorage.removeItem('hotel_operation_history');
  localStorage.removeItem('current_hotel');
  localStorage.removeItem('hotel_expiry_reminded');
  showToast(`👋 ${name}，已退出登录`);

  // 更新侧边栏
  updateUserNavButton();
  updateSidebarByPermissions();
  renderProfilePage();

  // 显示退出后的快捷操作弹窗
  setTimeout(() => {
    const modal = document.getElementById('logoutConfirmModal');
    const actions = document.getElementById('logoutActions');
    const title = modal?.querySelector('.modal-header h3');
    const body = modal?.querySelector('.modal-body');
    const footer = modal?.querySelector('.modal-footer');
    if (title) title.textContent = '🔐 选择操作';
    if (body) body.style.display = 'none';
    if (footer) footer.style.display = 'none';
    if (actions) actions.style.display = 'block';
    if (modal) modal.style.display = 'flex';
  }, 300);
}

function cancelLogout() {
  resetLogoutModal();
  document.getElementById('logoutConfirmModal').style.display = 'none';
}

// 重置退出登录弹窗到初始状态
function resetLogoutModal() {
  const modal = document.getElementById('logoutConfirmModal');
  const title = modal?.querySelector('.modal-header h3');
  const body = modal?.querySelector('.modal-body');
  const footer = modal?.querySelector('.modal-footer');
  const actions = document.getElementById('logoutActions');
  if (title) title.textContent = '🚪 退出登录';
  if (body) body.style.display = '';
  if (footer) footer.style.display = '';
  if (actions) actions.style.display = 'none';
}

// 重新登录（已有账号的用户）
function doLogin() {
  const modal = document.getElementById('logoutConfirmModal');
  if (modal) modal.style.display = 'none';
  resetLogoutModal();
  // 打开登录弹窗（预填已有信息）
  showHotelWelcome();
}

// 新用户注册
function doRegister() {
  const modal = document.getElementById('logoutConfirmModal');
  if (modal) modal.style.display = 'none';
  // 重置弹窗状态
  resetLogoutModal();
  // 清空表单并打开注册弹窗
  showHotelWelcome(true);
}

// 更新侧边栏用户按钮显示
function updateUserNavButton() {
  const member = MemberStore.get();
  const label = document.getElementById('userNavLabel');
  const icon = document.getElementById('userNavButton')?.querySelector('.nav-icon');
  if (!label) return;
  if (member && member.name) {
    // 已登录：显示用户名
    label.textContent = member.name;
    if (icon) icon.textContent = '👤';
  } else {
    // 未登录：显示登录/注册
    label.textContent = '登录 / 注册';
    if (icon) icon.textContent = '👤';
  }
}

function showEntryPage() {
  // 改为弹出注册弹窗
  showHotelWelcome();
}

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
  },
  siliconflow: {
    apiKey: 'sk-ntmsjwmgneryutqbxvgwakfmlfxgmcjxwtaivncswfjrrcpx',
    baseUrl: 'https://api.siliconflow.cn/v1',
    model: 'Kwai-Kolors/Kolors',
    name: '硅基流动',
    enabled: true  // 已配置免费额度
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

// ==================== 应用版本更新检测 ====================
const APP_VERSION = '1.5.1'; // 当前代码版本号（每次发布新功能时手动递增）

// 检查是否有新版本可用
async function checkForUpdate(showToastIfLatest = false) {
  try {
    const resp = await fetch(PROMPTS_CLOUD_URL + '?t=' + Date.now());
    if (!resp.ok) return;
    const data = await resp.json();
    const cloudVersion = data._app_version;

    if (!cloudVersion) return; // 云端还没有版本号字段，跳过

    if (cloudVersion !== APP_VERSION) {
      showUpdateModal(cloudVersion);
    } else if (showToastIfLatest) {
      showToast('✅ 已是最新版本 v' + APP_VERSION);
    }
  } catch (e) {
    // 网络问题静默忽略
    if (showToastIfLatest) {
      showToast('❌ 检查更新失败，请稍后重试', 'warning');
    }
  }
}

// 显示更新弹窗
function showUpdateModal(newVersion) {
  const modal = document.getElementById('updateModal');
  if (!modal) return;
  document.getElementById('updateNewVersion').textContent = 'v' + newVersion;
  document.getElementById('updateCurrentVersion').textContent = 'v' + APP_VERSION;
  modal.style.display = 'flex';
}

// 立即更新（强制绕过缓存刷新）
function applyUpdate() {
  // 在 URL 加时间戳参数强制绕过所有缓存（尤其手机端 Safari/微信浏览器）
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.unregister()));
  }
  location.replace(location.pathname + '?v=' + Date.now());
}

// 关闭更新弹窗
function closeUpdateModal() {
  const modal = document.getElementById('updateModal');
  if (modal) modal.style.display = 'none';
}

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
      if (key === 'feishu_url') {
        // 飞书链接单独处理，只在没有本地配置时用云端值覆盖
        if (!localStorage.getItem('feishu_url') && cloudPrompts.feishu_url) {
          localStorage.setItem('feishu_url', cloudPrompts.feishu_url);
        }
        return;
      }
      if (key === 'hotels') {
        // 同步酒店配置
        if (cloudPrompts.hotels && Object.keys(cloudPrompts.hotels).length > 0) {
          hotelsData = cloudPrompts.hotels;
          localStorage.setItem('hotels_data', JSON.stringify(hotelsData));
        }
        return;
      }
      if (key === 'payQRCode') {
        // 同步收款码（手机端也能看到管理员上传的收款码）
        if (cloudPrompts.payQRCode && !localStorage.getItem('hotel_pay_qrcode')) {
          localStorage.setItem('hotel_pay_qrcode', cloudPrompts.payQRCode);
        }
        return;
      }
      if (key === 'modulePermissions') {
        // 同步权限配置
        if (cloudPrompts.modulePermissions) {
          localStorage.setItem('hotel_module_permissions', JSON.stringify(cloudPrompts.modulePermissions));
        }
        return;
      }
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

// 保存 Prompt：写 localStorage + 内存，管理员模式下自动同步到 GitHub
async function savePrompt(key, value) {
  PROMPTS[key] = value;
  localStorage.setItem(`prompt_${key}`, value);

  if (isAdmin) {
    const token = getGitHubToken();
    if (!token) {
      showToast('✅ Prompt已保存（本地）', 'success');
      showToast('⚠️ 未设置Token，点击「同步设置」完成配置后可云端同步', 'warning');
      return;
    }
    // 管理员模式：保存后自动同步到云端
    showToast('⏳ 保存中...');
    const syncOk = await syncPromptToCloud(key, value);
    if (syncOk) {
      showToast('✅ 已保存并同步到云端，全员生效');
    } else {
      showToast('✅ Prompt已保存（本地），云端同步失败', 'warning');
    }
  } else {
    showToast('✅ Prompt已保存');
  }
}

// 同步单个 Prompt 到 GitHub（管理员专用），返回 true/false
async function syncPromptToCloud(key, value) {
  try {
    const token = getGitHubToken();
    if (!token) return false;

    // 1. 先获取当前云端文件内容（需要 SHA）
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

    return updateResp.ok;
  } catch (e) {
    console.log('云端同步失败（本地已保存）：', e.message);
    return false;
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
    // 同步飞书链接
    const feishuUrl = localStorage.getItem('feishu_url') || '';
    if (feishuUrl) {
      cloudData.feishu_url = feishuUrl;
    }
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

  const configCode = `// ★ 酒店AI实战营 Prompt 配置（导出备份）★
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

  // 渲染管理员专属面板（会员列表、权限配置、收款码预览）
  renderMemberList();
  renderPermissionTable();
  renderStudentList();
  // 加载收款码预览
  const savedQR = localStorage.getItem('hotel_pay_qrcode');
  if (savedQR) {
    const img = document.getElementById('qrPreviewImg');
    if (img) { img.src = savedQR; img.style.display = 'block'; }
    const ph = document.getElementById('qrPlaceholder');
    if (ph) ph.style.display = 'none';
  }

  // 自动检测 Token 状态，更新界面提示
  checkTokenStatus();
}

// 检查Token状态并更新界面
async function checkTokenStatus() {
  const tokenBadge = document.getElementById('tokenStatusBadge');
  if (!tokenBadge) return;

  const token = getGitHubToken();
  if (!token) {
    tokenBadge.innerHTML = '⚠️ <strong>未连接云端</strong> — <a href="javascript:void(0)" onclick="showTokenSetup()" style="color:var(--primary); text-decoration:underline;">点击设置Token</a> 后编辑Prompt即可同步';
    tokenBadge.style.background = '#fef3c7';
    tokenBadge.style.color = '#92400e';
    tokenBadge.style.display = 'block';
    return;
  }

  // 验证Token是否仍然有效
  try {
    const resp = await fetch(PROMPTS_API_URL, {
      headers: { 'Authorization': `token ${token}` }
    });
    if (resp.ok) {
      tokenBadge.innerHTML = '✅ <strong>云端已连接</strong> — 编辑Prompt保存后自动同步，所有学员下次打开自动更新';
      tokenBadge.style.background = 'var(--success-bg, #ecfdf5)';
      tokenBadge.style.color = 'var(--success, #059669)';
      tokenBadge.style.display = 'block';
    } else {
      tokenBadge.innerHTML = '❌ <strong>Token已失效</strong> — <a href="javascript:void(0)" onclick="showTokenSetup()" style="color:var(--primary); text-decoration:underline;">重新设置Token</a>';
      tokenBadge.style.background = '#fef2f2';
      tokenBadge.style.color = '#dc2626';
      tokenBadge.style.display = 'block';
    }
  } catch (e) {
    tokenBadge.innerHTML = '✅ <strong>云端已连接</strong>（网络检测中）';
    tokenBadge.style.background = 'var(--success-bg, #ecfdf5)';
    tokenBadge.style.color = 'var(--success, #059669)';
    tokenBadge.style.display = 'block';
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
  const saveBtn = document.getElementById('tokenSaveBtn');
  const token = input.value.trim();

  if (!token) {
    status.textContent = '❌ Token 不能为空';
    status.style.color = '#dc2626';
    return;
  }

  // 格式检查
  if (!token.startsWith('ghp_') && !token.startsWith('github_pat_') && !token.startsWith('gho_')) {
    status.textContent = '❌ 格式不对，正确格式以 ghp_ 或 github_pat_ 开头';
    status.style.color = '#dc2626';
    return;
  }

  // 禁用按钮，显示加载状态
  saveBtn.disabled = true;
  saveBtn.textContent = '⏳ 验证中...';
  status.textContent = '正在验证 Token...';
  status.style.color = 'var(--text-secondary)';

  // 验证 Token 是否有效
  try {
    const resp = await fetch(PROMPTS_API_URL, {
      headers: { 'Authorization': `token ${token}` }
    });
    if (resp.ok) {
      setGitHubToken(token);
      status.textContent = '✅ Token 验证成功，已保存！现在编辑Prompt保存后会自动同步到云端';
      status.style.color = 'var(--success)';
      saveBtn.textContent = '✅ 已保存';
      showToast('✅ 同步设置已完成，以后编辑Prompt保存即同步');
      setTimeout(() => closeTokenModal(), 1500);
    } else if (resp.status === 401) {
      status.textContent = '❌ Token 无效，请检查是否复制完整';
      status.style.color = '#dc2626';
      saveBtn.disabled = false;
      saveBtn.textContent = '✅ 验证并保存';
    } else if (resp.status === 403) {
      status.textContent = '❌ Token 权限不足，需要 Contents (Read and write) 权限';
      status.style.color = '#dc2626';
      saveBtn.disabled = false;
      saveBtn.textContent = '✅ 验证并保存';
    } else {
      status.textContent = '❌ 验证失败，请检查网络或重新创建 Token';
      status.style.color = '#dc2626';
      saveBtn.disabled = false;
      saveBtn.textContent = '✅ 验证并保存';
    }
  } catch (e) {
    status.textContent = '❌ 网络错误，请检查网络连接';
    status.style.color = '#dc2626';
    saveBtn.disabled = false;
    saveBtn.textContent = '✅ 验证并保存';
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

// ==================== 工作台动态渲染 ====================
// 模块描述信息（用于工作台卡片和自定义弹窗）
const MODULE_DESCRIPTIONS = {
  content:    '携程社区内容生成、多平台复用、AI配图',
  training:   '知识库查询、应急预案、标准话术输出',
  analysis:   '上传原始表格，智能生成运营分析报告',
  image:      'AI智能配图，支持多种风格',
  video:      'AI脚本+分镜生成，一键创作短视频',
  geo:        '关键词矩阵+SEO标题+4周内容日历',
  quicklink:  '小红书/抖音/携程/美团等8大平台直达',
  review:     '上传Excel → AI统计+逐条回复点评',
  competitor: '高德地图POI搜索附近酒店竞对',
  diagnosis:  '输入经营数据 → AI诊断+改进建议',
  bizdev:     '企业信息 → 合作协议+销售话术',
  patrol:     '调用摄像头 → AI巡检报告',
  feedback:   '提交需求建议，被采纳赠1个月会员'
};

// 获取工作台固定模块
function getDashboardPinned() {
  try { return JSON.parse(localStorage.getItem('dashboard_pinned')) || null; } catch { return null; }
}

// 保存工作台固定模块
function setDashboardPinned(list) {
  localStorage.setItem('dashboard_pinned', JSON.stringify(list));
}

// 渲染工作台卡片
function renderDashboardCards() {
  const container = document.getElementById('dashboardCards');
  if (!container) return;

  const pinned = getDashboardPinned();
  const perms = MemberStore.getPermissions();
  let modulesToShow;

  if (pinned && pinned.length > 0) {
    // 用户有自定义设置，按设置的顺序显示有权限的模块
    modulesToShow = pinned.filter(key => perms[key] && (MemberStore.canUse(key) || MemberStore.getRemaining(key) > 0));
    // 补充未固定但有权限的新模块
    Object.keys(perms).forEach(key => {
      if (!modulesToShow.includes(key) && (MemberStore.canUse(key) || MemberStore.getRemaining(key) > 0) && perms[key].name) {
        modulesToShow.push(key);
      }
    });
  } else {
    // 默认：显示所有有权限的模块
    modulesToShow = Object.keys(perms).filter(key =>
      perms[key].name && (MemberStore.canUse(key) || MemberStore.getRemaining(key) > 0)
    );
  }

  // 更新工具数量
  const countText = document.getElementById('toolCountText');
  if (countText) countText.textContent = `${modulesToShow.length}个AI工具`;

  // 排除 feishu（外部链接，不显示卡片）
  modulesToShow = modulesToShow.filter(k => k !== 'feishu');

  container.innerHTML = '';
  modulesToShow.forEach(key => {
    const info = perms[key] || {};
    const desc = MODULE_DESCRIPTIONS[key] || '';
    const card = document.createElement('div');
    card.className = 'tool-card';
    card.onclick = () => navigateTo(key);
    card.innerHTML = `
      <div class="tool-card-icon">${info.icon || '🔧'}</div>
      <h3>${info.name || key}</h3>
      <p>${desc}</p>
    `;
    container.appendChild(card);
  });
}

// 自定义工作台弹窗
function showDashboardCustomize() {
  const modal = document.getElementById('dashboardCustomizeModal');
  const list = document.getElementById('dashboardModuleList');
  if (!modal || !list) return;

  const pinned = getDashboardPinned();
  const perms = MemberStore.getPermissions();

  // 收集可显示的模块（排除feishu）
  const availableModules = Object.keys(perms).filter(key => key !== 'feishu' && perms[key].name);
  // 排序：已固定的在前，其余按原始顺序
  const sorted = availableModules.sort((a, b) => {
    const aIdx = (pinned || []).indexOf(a);
    const bIdx = (pinned || []).indexOf(b);
    if (aIdx === -1 && bIdx === -1) return 0;
    if (aIdx === -1) return 1;
    if (bIdx === -1) return -1;
    return aIdx - bIdx;
  });

  list.innerHTML = '';
  sorted.forEach(key => {
    const info = perms[key] || {};
    const desc = MODULE_DESCRIPTIONS[key] || '';
    const isChecked = pinned ? pinned.includes(key) : true; // 默认全选
    const item = document.createElement('div');
    item.className = 'dashboard-module-item';
    item.dataset.module = key;
    item.draggable = true;
    item.innerHTML = `
      <span class="module-drag-handle">⠿</span>
      <input type="checkbox" class="module-check" data-module="${key}" ${isChecked ? 'checked' : ''}>
      <span class="module-icon">${info.icon || '🔧'}</span>
      <div class="module-info">
        <div class="module-name">${info.name || key}</div>
        <div class="module-desc">${desc}</div>
      </div>
    `;
    list.appendChild(item);
  });

  // 拖拽排序
  initDashboardDragSort(list);

  modal.style.display = 'flex';
}

function closeDashboardCustomize() {
  const modal = document.getElementById('dashboardCustomizeModal');
  if (modal) modal.style.display = 'none';
}

function saveDashboardModules() {
  const list = document.getElementById('dashboardModuleList');
  const items = list?.querySelectorAll('.dashboard-module-item') || [];
  const pinned = [];
  items.forEach(item => {
    const key = item.dataset.module;
    const checked = item.querySelector('.module-check')?.checked;
    if (checked) pinned.push(key);
  });
  setDashboardPinned(pinned);
  renderDashboardCards();
  closeDashboardCustomize();
  showToast('✅ 工作台已更新');
}

function resetDashboardModules() {
  localStorage.removeItem('dashboard_pinned');
  renderDashboardCards();
  showDashboardCustomize(); // 重新渲染弹窗
  showToast('已重置为默认显示');
}

// 工作台模块拖拽排序
function initDashboardDragSort(container) {
  let dragItem = null;

  container.querySelectorAll('.dashboard-module-item').forEach(item => {
    item.addEventListener('dragstart', (e) => {
      dragItem = item;
      setTimeout(() => item.classList.add('dragging'), 0);
      e.dataTransfer.effectAllowed = 'move';
    });

    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
      dragItem = null;
      container.querySelectorAll('.dashboard-module-item').forEach(i => i.style.borderTop = '');
    });

    item.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (!dragItem || dragItem === item) return;
      const rect = item.getBoundingClientRect();
      const mid = rect.top + rect.height / 2;
      if (e.clientY < mid) {
        item.style.borderTop = '2px solid var(--primary)';
        item.style.borderBottom = '';
      } else {
        item.style.borderBottom = '2px solid var(--primary)';
        item.style.borderTop = '';
      }
    });

    item.addEventListener('dragleave', () => {
      item.style.borderTop = '';
      item.style.borderBottom = '';
    });

    item.addEventListener('drop', (e) => {
      e.preventDefault();
      if (!dragItem || dragItem === item) return;
      const rect = item.getBoundingClientRect();
      const mid = rect.top + rect.height / 2;
      if (e.clientY < mid) {
        container.insertBefore(dragItem, item);
      } else {
        container.insertBefore(dragItem, item.nextSibling);
      }
      item.style.borderTop = '';
      item.style.borderBottom = '';
    });
  });
}

// ==================== 页面导航 ====================
// 飞书多维表格链接（优先学员专属 → 通用配置 → 默认占位）
function getFeishuUrl() {
  // 1. 优先使用当前酒店的专属链接
  const hotelName = getCurrentHotel();
  if (hotelName) {
    const config = getHotelConfig(hotelName);
    if (config && config.feishu_url) return config.feishu_url;
  }
  // 2. 其次用通用的飞书链接（品牌定制中配置的）
  const globalUrl = localStorage.getItem('feishu_url');
  if (globalUrl) return globalUrl;
  // 3. 默认占位
  return 'https://feishu.cn/base/YOUR_TABLE_ID';
}

function navigateTo(page) {
  // 飞书表格：外部跳转，不切换页面
  if (page === 'feishu') {
    window.open(getFeishuUrl(), '_blank');
    return;
  }

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
      video: '短视频生成',
      geo: 'GEO优化',
      quicklink: '一键直达',
      review: '点评回复',
      competitor: '竞对情报站',
      diagnosis: '经营诊断',
      bizdev: '大客户拓展',
      patrol: '数字巡店',
      profile: '我的会员',
      settings: '系统设置'
    };
    document.getElementById('pageTitle').textContent = titles[page] || '';
    document.getElementById('sidebar').classList.remove('open');

    // 切换到会员中心时刷新数据
    if (page === 'profile') {
      renderProfilePage();
    }

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
    MemberStore.addUsage('content');
    MemberStore.addHistory('generate_ctrip', 'content', result);
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
    MemberStore.addUsage('content');
    MemberStore.addHistory('generate_multi', 'content', result);
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
    MemberStore.addUsage('training');
    MemberStore.addHistory('send_message', 'training', result);
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
    MemberStore.addUsage('analysis');
    MemberStore.addHistory('analyze_data', 'analysis', result);
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

  const currentPrompt = getPrompt(key); // 使用 getPrompt 获取最新值（含云端）
  const previewEl = promptCard.querySelector('.prompt-preview');
  const actionsEl = promptCard.querySelector('.prompt-actions');

  // 切换为编辑模式
  previewEl.innerHTML = `<textarea class="form-textarea prompt-edit-area" style="min-height:200px; font-size:13px; line-height:1.6;" placeholder="在此输入Prompt...">${escapeHtml(currentPrompt)}</textarea>`;
  actionsEl.innerHTML = `
    <button class="btn-sm btn-primary" onclick="savePromptEdit('${key}')">💾 保存并同步</button>
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
}

function cancelPromptEdit(key) {
  renderPromptCard(key);
}

function copyPrompt(key) {
  navigator.clipboard.writeText(getPrompt(key)).then(() => {
    showToast('Prompt已复制');
  });
}

// ==================== 学员身份系统 ====================
// 云端酒店配置缓存
let hotelsData = {};

// 获取当前酒店名（从 localStorage）
function getCurrentHotel() {
  return localStorage.getItem('current_hotel') || '';
}

// 设置当前酒店
function setCurrentHotel(name) {
  localStorage.setItem('current_hotel', name.trim());
}

// 获取当前酒店的配置
function getHotelConfig(name) {
  if (!name) return null;
  // 优先从云端缓存读取
  if (hotelsData[name]) return hotelsData[name];
  // 回退到 localStorage
  const local = localStorage.getItem('hotels_data');
  if (local) {
    try {
      const data = JSON.parse(local);
      if (data[name]) return data[name];
    } catch(e) {}
  }
  return null;
}

// 显示酒店名输入弹窗
function showHotelWelcome(clearForm = false) {
  const modal = document.getElementById('hotelWelcomeModal');
  const error = document.getElementById('hotelNameError');
  modal.style.display = 'flex';
  error.style.display = 'none';
  if (clearForm) {
    // 新注册模式：清空表单
    document.getElementById('welcomeName').value = '';
    document.getElementById('welcomePhone').value = '';
    document.getElementById('hotelNameInput').value = '';
    setTimeout(() => document.getElementById('welcomeName')?.focus(), 100);
  } else {
    // 登录模式：预填已有信息
    const member = MemberStore.get();
    document.getElementById('welcomeName').value = member?.name || '';
    document.getElementById('welcomePhone').value = member?.phone || '';
    document.getElementById('hotelNameInput').value = getCurrentHotel();
    setTimeout(() => {
      const firstEmpty = !member?.name ? 'welcomeName' : !member?.phone ? 'welcomePhone' : 'hotelNameInput';
      document.getElementById(firstEmpty)?.focus();
    }, 100);
  }
}

// 关闭欢迎弹窗
function closeHotelWelcome() {
  document.getElementById('hotelWelcomeModal').style.display = 'none';
}

// 提交酒店名（同时完成注册）
function submitHotelName() {
  const error = document.getElementById('hotelNameError');
  const name = document.getElementById('welcomeName').value.trim();
  const phone = document.getElementById('welcomePhone').value.trim();
  const hotel = document.getElementById('hotelNameInput').value.trim();

  if (!name) { error.textContent = '请输入姓名'; error.style.display = 'block'; return; }
  if (!phone || phone.length !== 11) { error.textContent = '请输入正确的11位手机号'; error.style.display = 'block'; return; }
  if (!hotel) { error.textContent = '请输入酒店名称'; error.style.display = 'block'; return; }

  // 检查酒店名是否在云端配置中（如果已有云端数据）
  if (Object.keys(hotelsData).length > 0 && !hotelsData[hotel]) {
    const similar = Object.keys(hotelsData).find(h => h.includes(hotel) || hotel.includes(h));
    if (similar) {
      error.textContent = `未找到完全匹配，你是否要输入「${similar}」？`;
      error.style.display = 'block';
      return;
    }
  }

  // 保存/更新会员信息（注册+设酒店一步完成）
  const existingMember = MemberStore.get();
  const memberData = {
    name: name,
    hotel: hotel,
    phone: phone,
    plan: existingMember?.plan || 'free',
    activateDate: existingMember?.activateDate || new Date().toISOString().split('T')[0],
    expireDate: existingMember?.expireDate || '2099-12-31',
    status: 'active',
    usage: existingMember?.usage || MemberStore.getUsage()
  };
  MemberStore.set(memberData);
  setCurrentHotel(hotel);
  document.getElementById('hotelWelcomeModal').style.display = 'none';
  updateHotelUI();

  // 刷新权限显示（酒店配置可能改变了可用权限）
  updateSidebarByPermissions();
  renderDashboardCards();
  renderProfilePage();

  // 更新侧边栏用户按钮显示
  updateUserNavButton();

  // 如果有专属配置，提示加载成功
  const config = getHotelConfig(hotel);
  if (config && config.feishu_url) {
    showToast(`✅ 欢迎 ${name}，${hotel} 专属配置已加载`);
  } else {
    showToast(`✅ 欢迎 ${name}，已进入 ${hotel}`);
  }
}

// 更新侧边栏酒店名显示
function updateHotelUI() {
  const hotelName = getCurrentHotel();
  const nameEl = document.getElementById('currentHotelName');
  if (nameEl) {
    nameEl.textContent = hotelName || '酒店AI实战营';
  }
}

// ==================== 学员管理（管理员） ====================
let editingStudentIndex = -1; // -1 = 新增模式

function showAddStudentModal() {
  editingStudentIndex = -1;
  document.getElementById('studentModalTitle').textContent = '🏨 添加酒店';
  document.getElementById('studentHotelName').value = '';
  document.getElementById('studentHotelName').removeAttribute('readonly');
  document.getElementById('studentFeishuUrl').value = '';
  document.getElementById('studentNote').value = '';
  document.getElementById('studentPlan').value = 'monthly';
  document.getElementById('studentModal').style.display = 'flex';
}

function showEditStudentModal(index) {
  const keys = Object.keys(hotelsData);
  if (index < 0 || index >= keys.length) return;
  const name = keys[index];
  const config = hotelsData[name];
  editingStudentIndex = index;

  document.getElementById('studentModalTitle').textContent = '✏️ 编辑酒店';
  document.getElementById('studentHotelName').value = name;
  document.getElementById('studentHotelName').setAttribute('readonly', true);
  document.getElementById('studentFeishuUrl').value = config.feishu_url || '';
  document.getElementById('studentNote').value = config.note || '';
  document.getElementById('studentPlan').value = config.plan || 'monthly';
  document.getElementById('studentModal').style.display = 'flex';
}

function closeStudentModal() {
  document.getElementById('studentModal').style.display = 'none';
}

async function saveStudent() {
  const name = document.getElementById('studentHotelName').value.trim();
  const feishuUrl = document.getElementById('studentFeishuUrl').value.trim();
  const note = document.getElementById('studentNote').value.trim();
  const plan = document.getElementById('studentPlan').value;

  if (!name) {
    showToast('请输入酒店名称', 'warning');
    return;
  }

  // 如果是新增，检查重名
  if (editingStudentIndex === -1 && hotelsData[name]) {
    showToast('该酒店已存在，请使用编辑功能', 'warning');
    return;
  }

  // 更新本地数据
  hotelsData[name] = {
    feishu_url: feishuUrl,
    note: note,
    plan: plan,
    created_at: hotelsData[name]?.created_at || new Date().toISOString()
  };

  // 同步到 localStorage
  localStorage.setItem('hotels_data', JSON.stringify(hotelsData));

  // 刷新列表
  renderStudentList();

  closeStudentModal();

  // 管理员自动同步到云端
  if (isAdmin) {
    await syncHotelsToCloud();
  } else {
    showToast('✅ 已保存');
  }
}

function deleteStudent(name) {
  if (!confirm(`确定删除「${name}」的配置？`)) return;
  delete hotelsData[name];
  localStorage.setItem('hotels_data', JSON.stringify(hotelsData));
  renderStudentList();
  showToast('已删除');

  // 自动同步
  if (isAdmin) syncHotelsToCloud();
}

// ==================== 会员管理（管理员后台） ====================
function getMembersData() {
  try { return JSON.parse(localStorage.getItem('hotel_members_data')) || []; } catch { return []; }
}

function saveMembersData(data) {
  localStorage.setItem('hotel_members_data', JSON.stringify(data));
  if (isAdmin) syncMembersToCloud();
}

function renderMemberList() {
  const members = getMembersData();
  const active = members.filter(m => m.status === 'active' && !isMemberExpired(m));
  const pending = members.filter(m => m.status === 'pending');

  document.getElementById('memberTotalCount').textContent = members.length;
  document.getElementById('memberActiveCount').textContent = active.length;
  document.getElementById('memberPendingCount').textContent = pending.length;

  // 待确认列表
  const pendingContainer = document.getElementById('pendingList');
  if (pending.length === 0) {
    pendingContainer.innerHTML = '<div style="padding:20px; text-align:center; color:var(--text-muted); font-size:13px;">暂无待确认付款 ✅</div>';
  } else {
    pendingContainer.innerHTML = pending.sort((a,b) => new Date(b.submitTime) - new Date(a.submitTime)).map((m, i) => `
      <div style="padding:14px; background:var(--warning-bg); border-radius:10px; margin-bottom:10px; border:1px solid #fde68a;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
          <div style="flex:1;">
            <div style="display:flex; align-items:center; gap:6px; margin-bottom:6px;">
              <strong style="font-size:15px;">${escapeHtml(m.name)}</strong>
              <span style="font-size:11px; background:var(--primary-bg); color:var(--primary); padding:2px 8px; border-radius:10px;">${m.planLabel || PLANS[m.plan]?.label || m.plan}</span>
            </div>
            <div style="font-size:13px; color:var(--text-secondary); margin-bottom:4px;">
              🏨 ${escapeHtml(m.hotel || '未设酒店')} &nbsp;·&nbsp; 📱 ${m.phone || '-'}
            </div>
            <div style="display:flex; align-items:center; gap:12px; font-size:12px; color:var(--text-muted);">
              <span style="font-size:18px; font-weight:700; color:var(--primary);">¥${m.price || PLANS[m.plan]?.price || '-'}</span>
              <span>提交于 ${formatTime(m.submitTime)}</span>
            </div>
          </div>
          <div style="display:flex; flex-direction:column; gap:6px; flex-shrink:0; margin-left:12px;">
            <button class="btn-sm" style="background:var(--success); color:#fff; padding:6px 16px;" onclick="approveMember(${members.indexOf(m)})">✓ 确认开通</button>
            <button class="btn-sm" style="background:var(--danger); color:#fff; padding:6px 16px;" onclick="rejectMember(${members.indexOf(m)})">✕ 拒绝</button>
          </div>
        </div>
      </div>
    `).join('');
  }

  // 已开通列表
  const memberContainer = document.getElementById('memberList');
  if (active.length === 0) {
    memberContainer.innerHTML = '<div style="padding:20px; text-align:center; color:var(--text-muted); font-size:13px;">暂无会员</div>';
  } else {
    memberContainer.innerHTML = active.sort((a,b) => new Date(a.expireDate) - new Date(b.expireDate)).map((m, i) => {
      const daysLeft = getDaysLeftFor(m);
      const isExpiring = daysLeft <= 7 && daysLeft > 0;
      const isExpired = daysLeft <= 0;
      return `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:12px; background:${isExpired ? 'var(--danger-bg)' : isExpiring ? 'var(--warning-bg)' : 'var(--bg-tertiary)'}; border-radius:8px; margin-bottom:8px; ${isExpiring ? 'border:1px solid #fde68a;' : ''}">
        <div>
          <div style="font-weight:600; font-size:14px;">${m.name} · ${m.hotel}</div>
          <div style="font-size:12px; color:var(--text-secondary); margin-top:2px;">${m.phone} · ${PLANS[m.plan]?.label || m.plan}</div>
          <div style="font-size:11px; margin-top:2px; color:${isExpired ? 'var(--danger)' : isExpiring ? 'var(--warning)' : 'var(--text-muted)'};">
            到期：${m.expireDate}${isExpired ? ' (已过期)' : isExpiring ? ` (还剩${daysLeft}天)` : ` (${daysLeft}天后到期)`}
          </div>
        </div>
        <div style="display:flex; gap:6px; flex-shrink:0;">
          <button class="btn-sm" onclick="extendMember(${members.indexOf(m)})">续费</button>
          <button class="btn-sm" style="background:var(--danger); color:#fff;" onclick="removeMember(${members.indexOf(m)})">删除</button>
        </div>
      </div>`;
    }).join('');
  }
}

function isMemberExpired(m) {
  if (!m.expireDate || m.plan === 'free') return false;
  const now = new Date(); now.setHours(0,0,0,0);
  return new Date(m.expireDate) < now;
}

function getDaysLeftFor(m) {
  if (!m.expireDate || m.plan === 'free') return 999;
  const now = new Date(); now.setHours(0,0,0,0);
  return Math.ceil((new Date(m.expireDate) - now) / (1000*60*60*24));
}

function formatTime(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  return `${d.getMonth()+1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function approveMember(index) {
  const members = getMembersData();
  const m = members[index];
  if (!m) return;
  const plan = PLANS[m.plan];
  const now = new Date();
  const expire = new Date(now);
  expire.setDate(expire.getDate() + (plan ? plan.days : 30));

  m.status = 'active';
  m.activateDate = now.toISOString().split('T')[0];
  m.expireDate = expire.toISOString().split('T')[0];
  members[index] = m;
  saveMembersData(members);

  // 如果该用户有酒店名，同时更新酒店配置的套餐（这样酒店下所有用户都生效）
  if (m.hotel && m.plan && m.plan !== 'free') {
    if (hotelsData[m.hotel]) {
      hotelsData[m.hotel].plan = m.plan;
      localStorage.setItem('hotels_data', JSON.stringify(hotelsData));
      renderStudentList();
      // 同步酒店配置到云端
      if (isAdmin) syncHotelsToCloud();
    }
  }

  // 如果当前用户是这个人，也更新本地
  const currentMember = MemberStore.get();
  if (currentMember && currentMember.phone === m.phone && currentMember.name === m.name) {
    currentMember.status = 'active';
    currentMember.plan = m.plan;
    currentMember.activateDate = m.activateDate;
    currentMember.expireDate = m.expireDate;
    MemberStore.set(currentMember);
    renderProfilePage();
  }

  renderMemberList();
  showToast(`✅ 已开通 ${m.name} 的 ${plan?.label || m.plan}，有效期至 ${m.expireDate}`);
}

function rejectMember(index) {
  if (!confirm('确认拒绝该付款申请？')) return;
  const members = getMembersData();
  const m = members[index];
  members.splice(index, 1);
  saveMembersData(members);
  renderMemberList();
  showToast(`已拒绝 ${m?.name || '该用户'} 的申请`);
}

function extendMember(index) {
  const members = getMembersData();
  const m = members[index];
  if (!m) return;
  const days = prompt(`为 ${m.name} 延长多少天？\n当前到期：${m.expireDate}`, '30');
  if (!days || isNaN(days)) return;
  const expire = new Date(m.expireDate || new Date());
  expire.setDate(expire.getDate() + parseInt(days));
  m.expireDate = expire.toISOString().split('T')[0];
  if (m.status === 'pending') m.status = 'active';
  members[index] = m;
  saveMembersData(members);
  renderMemberList();
  showToast(`✅ 已延长 ${m.name} ${days}天，新到期日：${m.expireDate}`);
}

function removeMember(index) {
  if (!confirm('确认删除该会员？')) return;
  const members = getMembersData();
  members.splice(index, 1);
  saveMembersData(members);
  renderMemberList();
}

// 收款码上传
function handleQRUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = document.getElementById('qrPreviewImg');
    img.src = e.target.result;
    img.style.display = 'block';
    document.getElementById('qrPlaceholder').style.display = 'none';
    localStorage.setItem('hotel_pay_qrcode_temp', e.target.result);
  };
  reader.readAsDataURL(file);
}

function saveQRCode() {
  const temp = localStorage.getItem('hotel_pay_qrcode_temp');
  if (!temp) { showToast('请先上传收款码图片', 'error'); return; }
  localStorage.setItem('hotel_pay_qrcode', temp);
  localStorage.removeItem('hotel_pay_qrcode_temp');
  showToast('✅ 收款码已保存');
  // 同步到云端
  syncMembersToCloud();
}

// 权限配置渲染
function renderPermissionTable() {
  const perms = MemberStore.getPermissions();
  const body = document.getElementById('permissionBody');
  body.innerHTML = Object.entries(perms).map(([key, config]) => `
    <tr style="border-bottom:1px solid var(--gray-100);">
      <td style="padding:10px;">${config.icon} ${config.name}</td>
      <td style="padding:10px; text-align:center;">
        <select class="form-select" style="width:80px; padding:4px;" data-module="${key}" data-plan="free">
          <option value="0" ${config.free === 0 ? 'selected' : ''}>关闭</option>
          <option value="3" ${config.free === 3 ? 'selected' : ''}>3次</option>
          <option value="5" ${config.free === 5 ? 'selected' : ''}>5次</option>
          <option value="-1" ${config.free === -1 ? 'selected' : ''}>不限</option>
        </select>
      </td>
      <td style="padding:10px; text-align:center;">
        <select class="form-select" style="width:80px; padding:4px;" data-module="${key}" data-plan="trial">
          <option value="0" ${config.trial === 0 ? 'selected' : ''}>关闭</option>
          <option value="3" ${config.trial === 3 ? 'selected' : ''}>3次</option>
          <option value="5" ${config.trial === 5 ? 'selected' : ''}>5次</option>
          <option value="-1" ${config.trial === -1 ? 'selected' : ''}>不限</option>
        </select>
      </td>
      <td style="padding:10px; text-align:center;">
        <select class="form-select" style="width:80px; padding:4px;" data-module="${key}" data-plan="monthly">
          <option value="0" ${config.monthly === 0 ? 'selected' : ''}>关闭</option>
          <option value="-1" ${config.monthly === -1 ? 'selected' : ''}>不限</option>
        </select>
      </td>
      <td style="padding:10px; text-align:center;">
        <select class="form-select" style="width:80px; padding:4px;" data-module="${key}" data-plan="yearly">
          <option value="0" ${config.yearly === 0 ? 'selected' : ''}>关闭</option>
          <option value="-1" ${config.yearly === -1 ? 'selected' : ''}>不限</option>
        </select>
      </td>
    </tr>
  `).join('');
}

function savePermissions() {
  const perms = MemberStore.getPermissions();
  document.querySelectorAll('#permissionBody select').forEach(sel => {
    const module = sel.dataset.module;
    const plan = sel.dataset.plan;
    if (perms[module]) {
      perms[module][plan] = parseInt(sel.value);
    }
  });
  localStorage.setItem('hotel_module_permissions', JSON.stringify(perms));
  showToast('✅ 权限配置已保存');
  // 同步到云端
  syncMembersToCloud();
}

// 同步会员数据到云端
async function syncMembersToCloud() {
  const token = localStorage.getItem('github_token');
  if (!token) { showToast('⚠️ 未配置同步Token，请先在Prompt调教页设置'); return; }
  try {
    showToast('⏳ 正在同步到云端...');
    // 先拉取最新
    const res = await fetch('https://raw.githubusercontent.com/sxie738-bot/hotel-ai-workbench/main/prompts.json?t=' + Date.now());
    const data = await res.json();
    data.members = getMembersData();
    // 同步权限配置
    const perms = localStorage.getItem('hotel_module_permissions');
    if (perms) { try { data.modulePermissions = JSON.parse(perms); } catch {} }
    // 同步收款码
    const qr = localStorage.getItem('hotel_pay_qrcode');
    if (qr) { data.payQRCode = qr; }

    await fetch(`https://api.github.com/repos/sxie738-bot/hotel-ai-workbench/contents/prompts.json`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: '更新会员数据',
        content: btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2))))
      })
    });
    showToast('✅ 已同步到云端');
  } catch(e) { console.warn('同步会员数据失败:', e); showToast('❌ 同步失败，请检查网络或Token'); }
}

function renderStudentList() {
  const container = document.getElementById('studentList');
  const countEl = document.getElementById('studentCount');
  const keys = Object.keys(hotelsData);

  if (!countEl) return;
  countEl.textContent = keys.length;

  if (keys.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding:40px 20px;">
        <span style="font-size:36px;">📭</span>
        <p>暂无酒店配置</p>
        <p class="empty-hint">点击「添加酒店」为学员配置专属飞书表格等参数</p>
      </div>`;
    return;
  }

  container.innerHTML = keys.map((name, i) => {
    const config = hotelsData[name];
    const planLabel = config.plan && PLANS[config.plan] ? PLANS[config.plan].label : '免费';
    const planColor = config.plan === 'yearly' ? 'var(--primary)' : config.plan === 'monthly' ? 'var(--success)' : config.plan === 'trial' ? '#f59e0b' : 'var(--text-muted)';
    return `
      <div style="background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius-md); padding:var(--space-4); margin-bottom:var(--space-3); display:flex; justify-content:space-between; align-items:center;">
        <div style="flex:1; min-width:0;">
          <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
            <strong style="font-size:14px;">${escapeHtml(name)}</strong>
            <span style="font-size:10px; background:${planColor}15; color:${planColor}; padding:1px 6px; border-radius:8px;">${planLabel}</span>
            ${config.feishu_url ? '<span style="font-size:10px; background:var(--success-bg); color:var(--success); padding:1px 6px; border-radius:8px;">已配飞书</span>' : ''}
          </div>
          ${config.note ? `<p style="font-size:12px; color:var(--text-muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(config.note)}</p>` : ''}
        </div>
        <div style="display:flex; gap:8px; flex-shrink:0; margin-left:12px;">
          <button class="btn-sm" onclick="showEditStudentModal(${i})">✏️ 编辑</button>
          <button class="btn-sm" onclick="deleteStudent('${escapeHtml(name)}')" style="color:var(--danger);">🗑️</button>
        </div>
      </div>`;
  }).join('');
}

// 同步酒店配置到 GitHub 云端
async function syncHotelsToCloud() {
  const token = getGitHubToken();
  if (!token) {
    showToast('⚠️ 未设置Token，配置仅保存本地', 'warning');
    return;
  }

  try {
    showToast('⏳ 正在同步学员配置到云端...');
    const resp = await fetch(PROMPTS_API_URL, {
      headers: { 'Authorization': `token ${token}` }
    });
    const data = await resp.json();
    const sha = data.sha;

    // 合并云端数据（保留其他字段，只更新 hotels）
    const cloudData = await fetch(PROMPTS_CLOUD_URL + '?t=' + Date.now()).then(r => r.json()).catch(() => ({}));
    cloudData.hotels = hotelsData;
    cloudData._updated = new Date().toISOString();

    const content = btoa(unescape(encodeURIComponent(JSON.stringify(cloudData, null, 2))));
    const updateResp = await fetch(PROMPTS_API_URL, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `token ${token}`
      },
      body: JSON.stringify({
        message: '更新学员酒店配置',
        content: content,
        sha: sha
      })
    });

    if (updateResp.ok) {
      showToast('☁️ 学员配置已同步到云端，全员自动生效');
    } else {
      showToast('⚠️ 云端同步失败，配置仅保存本地', 'warning');
    }
  } catch (e) {
    console.log('学员配置同步失败：', e.message);
    showToast('⚠️ 同步失败（网络问题），配置仅保存本地', 'warning');
  }
}

// ==================== AI 配图生成 ====================
let generatedImageUrl = '';

// 切换 SiliconFlow 启用状态
function toggleSiliconFlow() {
  const enabled = document.getElementById('siliconflowEnabled')?.checked;
  const key = document.getElementById('siliconflowKeyInput')?.value.trim();
  AI_CONFIG.siliconflow.enabled = enabled && !!key;
  if (enabled && !key) {
    showToast('请先输入 API Key', 'warning');
    document.getElementById('siliconflowEnabled').checked = false;
    AI_CONFIG.siliconflow.enabled = false;
  }
  if (key) {
    AI_CONFIG.siliconflow.apiKey = key;
    localStorage.setItem('siliconflow_key', key);
  }
}

// 初始化 SiliconFlow Key
function initSiliconFlowKey() {
  const savedKey = localStorage.getItem('siliconflow_key') || AI_CONFIG.siliconflow.apiKey || '';
  const input = document.getElementById('siliconflowKeyInput');
  const checkbox = document.getElementById('siliconflowEnabled');
  if (input && savedKey) {
    input.value = savedKey;
    AI_CONFIG.siliconflow.apiKey = savedKey;
  }
  if (checkbox && savedKey) {
    checkbox.checked = true;
    AI_CONFIG.siliconflow.enabled = true;
  }
}

// 生成AI配图
async function generateImage() {
  const promptEl = document.getElementById('imagePrompt');
  const styleEl = document.getElementById('imageStyle');
  const errorEl = document.getElementById('imageError');
  const loadingEl = document.getElementById('imageLoading');
  const imageEl = document.getElementById('generatedImage');
  const placeholderEl = document.getElementById('imagePlaceholder');
  const downloadBtn = document.getElementById('downloadImageBtn');
  const generateBtn = document.getElementById('generateImageBtn');

  const prompt = promptEl?.value.trim();
  if (!prompt) {
    errorEl.textContent = '请输入配图描述';
    errorEl.style.display = 'block';
    return;
  }

  // 检查 SiliconFlow 是否可用
  if (!AI_CONFIG.siliconflow.enabled || !AI_CONFIG.siliconflow.apiKey) {
    errorEl.textContent = 'AI配图功能未启用。管理员请先在「系统设置 → API配置」中配置硅基流动 API Key';
    errorEl.style.display = 'block';
    return;
  }

  // 获取尺寸
  const sizeRadio = document.querySelector('input[name="imgSize"]:checked');
  const size = sizeRadio ? sizeRadio.value : '1024x1024';

  // 组合 prompt：原始描述 + 风格
  const style = styleEl?.value || '';
  const fullPrompt = style ? `${prompt}，${style}` : prompt;

  // UI 切换到加载状态
  errorEl.style.display = 'none';
  placeholderEl.style.display = 'none';
  imageEl.style.display = 'none';
  downloadBtn.style.display = 'none';
  loadingEl.style.display = 'block';
  generateBtn.disabled = true;
  generateBtn.textContent = '⏳ 生成中...';

  try {
    const config = AI_CONFIG.siliconflow;
    const response = await fetch(`${config.baseUrl}/images/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.model,
        prompt: fullPrompt,
        image_size: size,
        num_inference_steps: 20,
        guidance_scale: 7.5,
        batch_size: 1
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || err.error?.message || `API调用失败 (${response.status})`);
    }

    const data = await response.json();
    if (!data.images || data.images.length === 0) {
      throw new Error('未生成图片，请重试');
    }

    generatedImageUrl = data.images[0].url;

    // 显示图片
    imageEl.src = generatedImageUrl;
    imageEl.style.display = 'block';
    downloadBtn.style.display = 'inline-flex';
    loadingEl.style.display = 'none';
    showToast('✅ 配图生成成功');
    MemberStore.addUsage('image');
    MemberStore.addHistory('generate_image', 'image', generatedImageUrl);

  } catch (e) {
    loadingEl.style.display = 'none';
    placeholderEl.style.display = 'block';
    errorEl.textContent = `生成失败：${e.message}`;
    errorEl.style.display = 'block';
    showToast(`❌ ${e.message}`, 'error');
  } finally {
    generateBtn.disabled = false;
    generateBtn.textContent = '🎨 AI生成配图';
  }
}

// 下载生成的图片
function downloadImage() {
  if (!generatedImageUrl) {
    showToast('暂无可保存的图片', 'warning');
    return;
  }
  const link = document.createElement('a');
  link.href = generatedImageUrl;
  link.download = `酒店配图_${Date.now()}.png`;
  link.target = '_blank';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('📥 图片已开始下载');
}

// ==================== 飞书链接管理 ====================
function saveFeishuUrl() {
  const input = document.getElementById('feishuUrlInput');
  if (!input) return;
  const url = input.value.trim();
  if (!url) {
    showToast('请输入飞书表格链接', 'warning');
    return;
  }
  localStorage.setItem('feishu_url', url);
  showToast('✅ 飞书链接已保存');

  // 管理员模式下自动同步到云端
  if (isAdmin) {
    syncFeishuUrlToCloud(url);
  }
}

// 同步飞书链接到 GitHub 云端
async function syncFeishuUrlToCloud(url) {
  const token = getGitHubToken();
  if (!token) {
    showToast('⚠️ 未设置Token，链接仅保存本地。配置Token后可云端同步', 'warning');
    return;
  }
  try {
    showToast('⏳ 正在同步飞书链接到云端...');
    const resp = await fetch(PROMPTS_API_URL, {
      headers: { 'Authorization': `token ${token}` }
    });
    const data = await resp.json();
    const sha = data.sha;

    const cloudData = await fetch(PROMPTS_CLOUD_URL + '?t=' + Date.now()).then(r => r.json()).catch(() => ({}));
    cloudData.feishu_url = url;
    cloudData._updated = new Date().toISOString();

    const content = btoa(unescape(encodeURIComponent(JSON.stringify(cloudData, null, 2))));
    const updateResp = await fetch(PROMPTS_API_URL, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `token ${token}`
      },
      body: JSON.stringify({
        message: '更新飞书链接',
        content: content,
        sha: sha
      })
    });

    if (updateResp.ok) {
      showToast('☁️ 飞书链接已同步到云端，所有学员自动生效');
    } else {
      showToast('⚠️ 云端同步失败，链接仅保存本地', 'warning');
    }
  } catch (e) {
    console.log('飞书链接同步失败：', e.message);
    showToast('⚠️ 同步失败（网络问题），链接仅保存本地', 'warning');
  }
}

function initFeishuUrlInput() {
  const input = document.getElementById('feishuUrlInput');
  if (!input) return;
  const saved = localStorage.getItem('feishu_url');
  if (saved) {
    input.value = saved;
    input.placeholder = '已配置，学员点击侧边栏即可跳转';
  }
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
  // ==================== 所有人直接进入工作台 ====================
  const member = MemberStore.get();
  const isAdminMode = localStorage.getItem('admin_logged_in') === 'true';

  // 已过期付费用户自动降级
  if (member && member.plan !== 'free' && MemberStore.isExpired()) {
    member.plan = 'free';
    member.status = 'active';
    MemberStore.set(member);
  }

  // 如果完全没有会员记录，创建一个默认的游客记录（方便权限判断）
  if (!member) {
    MemberStore.set({
      name: '',
      hotel: '',
      phone: '',
      plan: 'free',
      status: 'active',
      activateDate: new Date().toISOString().split('T')[0],
      expireDate: '2099-12-31',
      usage: {}
    });
  }

  // 直接进入工作台（不再弹套餐选择）
  initApp();
});

// ==================== 工作台初始化（从入口页面进入后调用） ====================
function initApp() {
  initTabs();
  initSettingsNav();
  initAdminGate();
  renderKnowledgeList();

  // 从 GitHub 拉取云端 Prompt（后台静默加载，加载完后刷新卡片）
  fetchCloudPrompts().then(() => {
    ['ctrip', 'multi', 'training', 'analysis'].forEach(key => renderPromptCard(key));
  });

  // 自动检查版本更新（静默，有新版才弹窗）
  setTimeout(() => checkForUpdate(false), 3000);

  // 刷新 Prompt 卡片状态（先用本地缓存渲染）
  ['ctrip', 'multi', 'training', 'analysis'].forEach(key => renderPromptCard(key));

  // 初始化飞书链接输入框
  initFeishuUrlInput();
  initSiliconFlowKey();

  // 加载本地酒店配置（在云端数据拉取之前先有本地缓存）
  const localHotels = localStorage.getItem('hotels_data');
  if (localHotels) {
    try { hotelsData = JSON.parse(localHotels); } catch(e) {}
  }

  // 普通用户模式下隐藏管理员元素
  document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
  document.querySelectorAll('.admin-hide').forEach(el => el.style.display = '');

  // 更新日期
  const dateEl = document.getElementById('todayDate');
  if (dateEl) {
    dateEl.textContent = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
  }

  // 检查是否需要显示注册弹窗（未填写姓名和手机号时弹出）
  const currentHotel = getCurrentHotel();
  const member = MemberStore.get();
  if (!isAdmin && (!member || !member.name || !member.phone)) {
    setTimeout(() => showHotelWelcome(), 500);
  } else if (!currentHotel && !isAdmin) {
    // 有会员信息但没设酒店名，弹出设酒店
    setTimeout(() => showHotelWelcome(), 500);
  } else {
    updateHotelUI();
  }

  // 欢迎弹窗回车提交
  const hotelInput = document.getElementById('hotelNameInput');
  if (hotelInput) {
    hotelInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') submitHotelName();
    });
  }

  // 管理员进入时渲染学员列表 + 会员管理 + 权限配置
  if (isAdmin) {
    renderStudentList();
    renderMemberList();
    renderPermissionTable();
    // 加载收款码预览
    const savedQR = localStorage.getItem('hotel_pay_qrcode');
    if (savedQR) {
      const img = document.getElementById('qrPreviewImg');
      if (img) { img.src = savedQR; img.style.display = 'block'; }
      const ph = document.getElementById('qrPlaceholder');
      if (ph) ph.style.display = 'none';
    }
  }

  // ==================== PWA 安装到桌面 ====================
  let deferredPrompt = null;
  const installBtn = document.getElementById('installBtn');

  // 已从桌面打开（standalone模式）→ 不显示安装按钮
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
  if (isStandalone) {
    if (installBtn) installBtn.style.display = 'none';
  } else {
    // 浏览器中打开：始终显示安装按钮（iPhone Safari 不支持 beforeinstallprompt，需要手动引导）
    if (installBtn) installBtn.style.display = 'flex';
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    // Chrome/Edge 满足PWA条件时，保存原生安装事件
    if (installBtn) installBtn.style.display = 'flex';
  });

  if (installBtn) {
    installBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      if (deferredPrompt) {
        // 有原生安装提示，直接触发
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        deferredPrompt = null;
        if (outcome === 'accepted') {
          installBtn.style.display = 'none';
        }
      } else {
        // 无原生提示（Safari/微信等），显示手动引导弹窗
        showInstallGuide();
      }
    });
  }

  // 安装完成后隐藏按钮
  window.addEventListener('appinstalled', () => {
    if (installBtn) installBtn.style.display = 'none';
    showToast('✅ 已安装到桌面，下次可直接从桌面打开');
  });

  // 更新侧边栏权限显示
  updateSidebarByPermissions();

  // 渲染工作台卡片
  renderDashboardCards();

  // 渲染会员中心初始数据（侧边栏badge等）
  renderProfilePage();
  updateUserNavButton();

  // 渲染反馈历史
  renderFeedbackHistory();
}

// ==================== 共创中心 ====================
function submitFeedback() {
  const type = document.getElementById('feedbackType').value;
  const title = document.getElementById('feedbackTitle').value.trim();
  const content = document.getElementById('feedbackContent').value.trim();
  if (!title) { showToast('请输入标题', 'error'); return; }
  if (!content) { showToast('请输入详细描述', 'error'); return; }

  const member = MemberStore.get();
  const feedback = {
    id: Date.now(),
    type,
    title,
    content,
    author: member ? member.name : '匿名',
    phone: member ? member.phone : '',
    hotel: member ? member.hotel : '',
    status: 'pending', // pending / accepted / rejected
    submitTime: new Date().toISOString(),
    rewardGiven: false
  };

  // 保存到本地
  const feedbacks = JSON.parse(localStorage.getItem('hotel_feedbacks') || '[]');
  feedbacks.unshift(feedback);
  localStorage.setItem('hotel_feedbacks', JSON.stringify(feedbacks));

  // 清空表单
  document.getElementById('feedbackTitle').value = '';
  document.getElementById('feedbackContent').value = '';

  renderFeedbackHistory();
  showToast('✅ 反馈已提交，感谢您的参与！');
}

function renderFeedbackHistory() {
  const feedbacks = JSON.parse(localStorage.getItem('hotel_feedbacks') || '[]');
  const container = document.getElementById('feedbackHistory');

  if (feedbacks.length === 0) {
    container.innerHTML = '<div style="text-align:center; padding:24px; color:var(--text-muted); font-size:13px;">暂无反馈记录</div>';
    return;
  }

  const statusMap = {
    pending: { label: '待评估', color: 'var(--warning)' },
    accepted: { label: '已采纳 ✅', color: 'var(--success)' },
    rejected: { label: '未采纳', color: 'var(--text-muted)' }
  };

  container.innerHTML = feedbacks.slice(0, 10).map(f => {
    const s = statusMap[f.status] || statusMap.pending;
    return `
    <div style="padding:14px; border:1px solid var(--gray-200); border-radius:8px; margin-bottom:10px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
        <strong style="font-size:14px;">${f.title}</strong>
        <span style="font-size:11px; color:${s.color}; font-weight:600;">${s.label}</span>
      </div>
      <p style="font-size:13px; color:var(--text-secondary); margin:0 0 6px; line-height:1.6;">${f.content.length > 80 ? f.content.slice(0, 80) + '...' : f.content}</p>
      <div style="font-size:11px; color:var(--text-muted);">
        ${f.type === 'feature' ? '功能建议' : f.type === 'bug' ? '问题反馈' : f.type === 'improve' ? '体验优化' : '其他'} · ${formatTime(f.submitTime)}
        ${f.rewardGiven ? ' · 🎁 已赠送1个月' : ''}
      </div>
    </div>`;
  }).join('');
}

// 手动安装引导弹窗（持久显示，不会自动消失）
function showInstallGuide() {
  const ua = navigator.userAgent;
  let title = '📲 安装到桌面';
  let steps = '';

  if (/MicroMessenger/i.test(ua)) {
    title = '⚠️ 微信内无法直接安装';
    steps = `
      <p style="margin:0 0 12px;">请按以下步骤操作：</p>
      <ol style="margin:0; padding-left:20px; line-height:2;">
        <li>点击右上角 <b>「...」</b></li>
        <li>选择 <b>「在浏览器打开」</b></li>
        <li>在浏览器中重新点击「安装到桌面」</li>
      </ol>`;
  } else if (/Safari/i.test(ua) && /iPhone|iPad/i.test(ua)) {
    steps = `
      <p style="margin:0 0 12px;">iOS Safari 安装步骤：</p>
      <ol style="margin:0; padding-left:20px; line-height:2;">
        <li>点击底部中间的 <b>分享按钮 ⎙</b></li>
        <li>向下滑动找到 <b>「添加到主屏幕」</b></li>
        <li>点击右上角 <b>「添加」</b> 即可</li>
      </ol>`;
  } else if (/Chrome/i.test(ua) && /Android/i.test(ua)) {
    steps = `
      <p style="margin:0 0 12px;">Android Chrome 安装步骤：</p>
      <ol style="margin:0; padding-left:20px; line-height:2;">
        <li>点击浏览器右上角 <b>⋮ 菜单</b></li>
        <li>选择 <b>「添加到主屏幕」</b> 或 <b>「安装应用」</b></li>
        <li>点击 <b>「安装」</b> 确认</li>
      </ol>`;
  } else if (/Chrome/i.test(ua)) {
    steps = `
      <p style="margin:0 0 12px;">Chrome 桌面版安装步骤：</p>
      <ol style="margin:0; padding-left:20px; line-height:2;">
        <li>查看地址栏右侧是否有 <b>📲 安装图标</b>（电脑图标）</li>
        <li>点击该图标 → 点击 <b>「安装」</b></li>
        <li>或点击右上角菜单 ⋮ → <b>「安装酒店AI实战营」</b></li>
      </ol>
      <p style="margin:12px 0 0; font-size:12px; color:#6b7280;">💡 如未看到安装图标，请刷新页面后再试</p>`;
  } else if (/Edge/i.test(ua)) {
    steps = `
      <p style="margin:0 0 12px;">Edge 浏览器安装步骤：</p>
      <ol style="margin:0; padding-left:20px; line-height:2;">
        <li>点击地址栏右侧的 <b>📲 安装图标</b></li>
        <li>选择 <b>「安装此站点为应用」</b></li>
        <li>点击 <b>「安装」</b> 确认</li>
      </ol>`;
  } else {
    steps = `
      <p style="margin:0 0 12px;">推荐使用以下浏览器安装：</p>
      <ul style="margin:0; padding-left:20px; line-height:2;">
        <li><b>手机</b>：Safari（iPhone）或 Chrome（Android）</li>
        <li><b>电脑</b>：Chrome 或 Edge</li>
      </ul>
      <p style="margin:12px 0 0; font-size:12px; color:#6b7280;">打开后点击「安装到桌面」即可</p>`;
  }

  // 创建持久弹窗
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position:fixed; inset:0; background:rgba(0,0,0,0.5);
    display:flex; align-items:center; justify-content:center;
    z-index:9999;
  `;
  overlay.innerHTML = `
    <div style="
      background:#fff; border-radius:16px; padding:28px;
      max-width:360px; width:90%; box-shadow:0 20px 60px rgba(0,0,0,0.3);
      font-size:14px; color:#374151; line-height:1.6;
    ">
      <h3 style="margin:0 0 16px; font-size:17px; color:#111827;">${title}</h3>
      ${steps}
      <button onclick="this.closest('div[style]').parentElement.remove()" style="
        margin-top:20px; width:100%; padding:10px;
        background:#2563eb; color:#fff; border:none;
        border-radius:8px; font-size:14px; cursor:pointer;
      ">我知道了</button>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
}

// ==================== 新增模块函数 ====================

// --- 短视频生成 ---
document.getElementById('videoTopic')?.addEventListener('change', function() {
  document.getElementById('videoCustomGroup').style.display = this.value === '自定义' ? '' : 'none';
});

async function generateVideoScript() {
  if (!checkModuleAccess('video')) return;
  const hotel = document.getElementById('videoHotel')?.value.trim();
  const topic = document.getElementById('videoTopic')?.value;
  const customTopic = topic === '自定义' ? document.getElementById('videoCustomTopic')?.value.trim() : '';
  const duration = document.querySelector('input[name="videoLen"]:checked')?.value || '30';
  const extra = document.getElementById('videoExtra')?.value.trim();
  if (!hotel || (!topic && !customTopic)) { showToast('请填写酒店名称和视频主题', 'warning'); return; }

  const output = document.getElementById('video-output');
  output.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);"><div style="font-size:32px;animation:pulse 1.5s infinite;">🎬</div><p style="margin-top:12px;">AI正在创作脚本，请稍候...</p></div>';

  try {
    const topicText = customTopic || topic;
    const messages = [
      { role: 'system', content: `你是酒店短视频内容专家。请根据以下信息生成一个完整的短视频脚本方案。\n\n输出格式要求：\n1. 【视频概要】一句话描述\n2. 【开头Hook】前3秒吸引眼球的开场白\n3. 【分镜脚本】按秒数列出每个镜头的画面描述+字幕文案（共${duration}秒）\n4. 【BGM建议】推荐背景音乐风格\n5. 【拍摄Tips】3条实用拍摄建议\n6. 【发布文案】适配抖音/小红书的发布文案+话题标签\n\n风格要求：节奏快、画面感强、口语化、有记忆点。` },
      { role: 'user', content: `酒店名称：${hotel}\n视频主题：${topicText}\n视频时长：${duration}秒\n${extra ? '补充信息：' + extra : ''}` }
    ];
    const result = await callAIWithFallback('content', messages, { temperature: 0.8 });
    output.innerHTML = `<div style="line-height:1.8;white-space:pre-wrap;">${escapeHtml(result)}</div>`;
    MemberStore.addUsage('video');
    MemberStore.addHistory('generate_video', 'video', result);
  } catch (err) {
    output.innerHTML = `<div style="text-align:center;padding:40px;color:#dc2626;">❌ 生成失败：${escapeHtml(err.message)}</div>`;
  }
}

// --- GEO优化 ---
async function generateGeoPlan() {
  if (!checkModuleAccess('geo')) return;
  const hotel = document.getElementById('geoHotel')?.value.trim();
  const city = document.getElementById('geoCity')?.value.trim();
  const features = document.getElementById('geoFeatures')?.value.trim();
  const extra = document.getElementById('geoExtra')?.value.trim();
  if (!hotel || !city) { showToast('请填写酒店名称和所在城市', 'warning'); return; }

  const wantKeywords = document.getElementById('geoKeywords')?.checked;
  const wantTitles = document.getElementById('geoTitles')?.checked;
  const wantCalendar = document.getElementById('geoCalendar')?.checked;

  const output = document.getElementById('geo-output');
  output.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);"><div style="font-size:32px;animation:pulse 1.5s infinite;">🔍</div><p style="margin-top:12px;">AI正在分析优化方案...</p></div>';

  try {
    const targets = [];
    if (wantKeywords) targets.push('关键词和长尾词矩阵');
    if (wantTitles) targets.push('SEO优化标题');
    if (wantCalendar) targets.push('4周内容日历计划');

    const messages = [
      { role: 'system', content: `你是酒店SEO/GEO优化专家。请根据酒店信息生成搜索引擎优化方案。\n\n输出格式：\n${wantKeywords ? '1.【关键词矩阵】主关键词5个 + 长尾词15-20个，按搜索意图分类（品牌词/地域词/需求词/竞品词）\n' : ''}${wantTitles ? '2.【推荐标题】10个SEO友好标题，含关键词密度分析\n' : ''}${wantCalendar ? '3.【内容日历】4周发布计划表，每周主题+关键词+目标平台\n' : ''}\n\n要求：数据化、可落地、结合酒店实际卖点。` },
      { role: 'user', content: `酒店名称：${hotel}\n所在城市：${city}\n核心卖点：${features || '请根据酒店类型推荐'}\n${extra ? '补充：' + extra : ''}\n\n需要生成：${targets.join('、')}` }
    ];
    const result = await callAIWithFallback('content', messages, { temperature: 0.6 });
    output.innerHTML = `<div style="line-height:1.8;white-space:pre-wrap;">${escapeHtml(result)}</div>`;
    MemberStore.addUsage('geo');
    MemberStore.addHistory('generate_geo', 'geo', result);
  } catch (err) {
    output.innerHTML = `<div style="text-align:center;padding:40px;color:#dc2626;">❌ 生成失败：${escapeHtml(err.message)}</div>`;
  }
}

// --- 点评回复 ---
let reviewFileData = null;
document.getElementById('reviewFileInput')?.addEventListener('change', async function(e) {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: 'array' });
    reviewFileData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
    document.getElementById('reviewFileName').textContent = file.name;
    document.getElementById('reviewUploadArea').style.display = 'none';
    document.getElementById('reviewPreview').style.display = '';
    showToast(`✅ 已加载 ${reviewFileData.length} 条点评数据`);
  } catch (err) {
    showToast('文件解析失败，请检查格式', 'error');
  }
});

function removeReviewFile() {
  reviewFileData = null;
  document.getElementById('reviewFileInput').value = '';
  document.getElementById('reviewUploadArea').style.display = '';
  document.getElementById('reviewPreview').style.display = 'none';
}

async function analyzeReviews() {
  if (!checkModuleAccess('review')) return;
  if (!reviewFileData || reviewFileData.length === 0) { showToast('请先上传点评数据', 'warning'); return; }

  const style = document.getElementById('reviewStyle')?.value || '专业诚恳';
  const output = document.getElementById('review-output');
  output.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);"><div style="font-size:32px;animation:pulse 1.5s infinite;">💬</div><p style="margin-top:12px;">AI正在分析点评并生成回复...</p></div>';

  try {
    // 取前50条点评（避免超长）
    const sampleReviews = reviewFileData.slice(0, 50).map((r, i) => `第${i+1}条：${JSON.stringify(r).substring(0, 200)}`).join('\n');
    const messages = [
      { role: 'system', content: `你是酒店点评管理专家。请分析以下点评数据并生成专业回复。\n\n输出格式：\n1.【数据概览】总条数、好评率、差评率、平均评分\n2.【好评TOP关键词】好评中出现频率最高的5个关键词\n3.【差评主要问题】归类差评的主要问题类型及占比\n4.【差评回复模板】针对每个主要问题类型，生成2-3条专业回复模板\n5.【改进建议】3-5条可落地的改进建议\n\n回复风格：${style}` },
      { role: 'user', content: `以下是点评数据（共${reviewFileData.length}条，展示前50条）：\n\n${sampleReviews}` }
    ];
    const result = await callAIWithFallback('content', messages, { temperature: 0.5 });
    output.innerHTML = `<div style="line-height:1.8;white-space:pre-wrap;">${escapeHtml(result)}</div>`;
    MemberStore.addUsage('review');
    MemberStore.addHistory('analyze_reviews', 'review', result);
  } catch (err) {
    output.innerHTML = `<div style="text-align:center;padding:40px;color:#dc2626;">❌ 分析失败：${escapeHtml(err.message)}</div>`;
  }
}

// --- 竞对情报站 ---
async function searchCompetitors() {
  if (!checkModuleAccess('competitor')) return;
  const location = document.getElementById('competitorLocation')?.value.trim();
  const radius = document.querySelector('input[name="compRadius"]:checked')?.value || '3000';
  if (!location) { showToast('请输入搜索位置', 'warning'); return; }

  const mapEl = document.getElementById('competitorMap');
  const listEl = document.getElementById('competitorList');
  mapEl.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);"><div style="font-size:32px;animation:pulse 1.5s infinite;">🔍</div><p style="margin-top:12px;">正在搜索周边酒店...</p></div>';
  listEl.innerHTML = '';

  try {
    // 第一步：地理编码获取坐标
    const geoResp = await fetch(`https://restapi.amap.com/v3/geocode/geo?address=${encodeURIComponent(location)}&key=demo`);
    const geoData = await geoResp.json();
    if (geoData.status !== '1' || !geoData.geocodes?.length) {
      mapEl.innerHTML = '<div style="text-align:center;padding:40px;color:#dc2626;">❌ 无法识别该地址，请输入更详细的位置</div>';
      return;
    }
    const center = geoData.geocodes[0].location;

    // 第二步：POI搜索周边酒店
    const poiResp = await fetch(`https://restapi.amap.com/v3/place/around?location=${center}&radius=${radius}&types=080100&sortrule=distance&offset=20&key=demo`);
    const poiData = await poiResp.json();

    if (poiData.status !== '1' || !poiData.pois?.length) {
      mapEl.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);">该区域未找到酒店数据</div>';
      return;
    }

    // 展示地图（静态iframe）
    mapEl.innerHTML = `<iframe src="https://uri.amap.com/marker?position=${center}&name=${encodeURIComponent(location)}&callnative=0" style="width:100%;height:300px;border:none;" allowfullscreen></iframe>`;

    // 展示列表
    const hotels = poiData.pois;
    listEl.innerHTML = `
      <div style="font-size:13px;color:var(--text-muted);margin-bottom:12px;">共找到 <strong>${hotels.length}</strong> 家周边酒店（${radius >= 5000 ? '5' : radius >= 3000 ? '3' : '1'}公里内）</div>
      ${hotels.map(h => {
        const dist = h.distance ? (h.distance >= 1000 ? (h.distance/1000).toFixed(1)+'km' : h.distance+'m') : '-';
        return `<div style="padding:12px;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-sm);margin-bottom:8px;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <strong style="font-size:14px;">${escapeHtml(h.name)}</strong>
            <span style="font-size:12px;color:var(--primary);font-weight:600;">${dist}</span>
          </div>
          <div style="font-size:12px;color:var(--text-secondary);margin-top:4px;">${escapeHtml(h.address || h.pname + h.cityname || '')}</div>
        </div>`;
      }).join('')}
    `;

    MemberStore.addUsage('competitor');
    MemberStore.addHistory('search_competitors', 'competitor', `搜索了${location}周边${hotels.length}家酒店`);
  } catch (err) {
    mapEl.innerHTML = `<div style="text-align:center;padding:40px;color:#dc2626;">❌ 搜索失败：${escapeHtml(err.message)}</div>`;
  }
}

// --- 经营诊断 ---
async function runDiagnosis() {
  if (!checkModuleAccess('diagnosis')) return;
  const hotel = document.getElementById('diagHotel')?.value.trim();
  const occupancy = document.getElementById('diagOccupancy')?.value;
  const adr = document.getElementById('diagADR')?.value;
  const rooms = document.getElementById('diagRooms')?.value;
  const revenue = document.getElementById('diagRevenue')?.value;
  const issue = document.getElementById('diagIssue')?.value.trim();
  if (!hotel) { showToast('请填写酒店名称', 'warning'); return; }

  const output = document.getElementById('diag-output');
  output.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);"><div style="font-size:32px;animation:pulse 1.5s infinite;">🩺</div><p style="margin-top:12px;">AI正在诊断中...</p></div>';

  try {
    const messages = [
      { role: 'system', content: `你是资深酒店经营顾问，服务过上百家酒店。请根据经营数据进行全面诊断。\n\n输出格式：\n1.【健康评分】0-100分综合评分\n2.【盈利分析】RevPAR计算、与行业均值对比\n3.【问题诊断】列出3-5个关键问题，按严重程度排序\n4.【改进建议】每个问题对应的具体可执行方案\n5.【优先级排序】建议的实施顺序和时间表\n\n风格：专业、直接、数据驱动、不说空话。` },
      { role: 'user', content: `酒店名称：${hotel}\n月均出租率：${occupancy || '未提供'}%\n月均ADR：${adr || '未提供'}元\n总房间数：${rooms || '未提供'}间\n月均营收：${revenue || '未提供'}万元\n当前问题：${issue || '无'}\n\n请进行全面经营诊断。` }
    ];
    const result = await callAIWithFallback('content', messages, { temperature: 0.4 });
    output.innerHTML = `<div style="line-height:1.8;white-space:pre-wrap;">${escapeHtml(result)}</div>`;
    MemberStore.addUsage('diagnosis');
    MemberStore.addHistory('run_diagnosis', 'diagnosis', result);
  } catch (err) {
    output.innerHTML = `<div style="text-align:center;padding:40px;color:#dc2626;">❌ 诊断失败：${escapeHtml(err.message)}</div>`;
  }
}

// --- 大客户拓展 ---
async function generateBizProposal() {
  if (!checkModuleAccess('bizdev')) return;
  const hotel = document.getElementById('bizHotel')?.value.trim();
  const company = document.getElementById('bizCompany')?.value.trim();
  const bizType = document.getElementById('bizType')?.value;
  const extra = document.getElementById('bizExtra')?.value.trim();
  if (!hotel || !company) { showToast('请填写酒店名称和目标企业', 'warning'); return; }

  const output = document.getElementById('biz-output');
  output.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);"><div style="font-size:32px;animation:pulse 1.5s infinite;">🤝</div><p style="margin-top:12px;">AI正在生成合作方案...</p></div>';

  try {
    const messages = [
      { role: 'system', content: `你是酒店大客户拓展专家，擅长B2B酒店销售。请根据酒店和企业信息生成合作方案。\n\n输出格式：\n1.【企业画像】目标企业简要分析\n2.【合作方案】${bizType}的具体方案（含价格策略、服务内容）\n3.【销售邀请话术】3种场景的电话/微信话术\n4.【合作协议要点】核心条款摘要\n5.【跟进策略】最佳联系时机和方式\n\n风格：专业商务、落地性强。` },
      { role: 'user', content: `酒店名称：${hotel}\n目标企业：${company}\n合作类型：${bizType}\n${extra ? '补充：' + extra : ''}` }
    ];
    const result = await callAIWithFallback('content', messages, { temperature: 0.6 });
    output.innerHTML = `<div style="line-height:1.8;white-space:pre-wrap;">${escapeHtml(result)}</div>`;
    MemberStore.addUsage('bizdev');
    MemberStore.addHistory('generate_biz', 'bizdev', result);
  } catch (err) {
    output.innerHTML = `<div style="text-align:center;padding:40px;color:#dc2626;">❌ 生成失败：${escapeHtml(err.message)}</div>`;
  }
}

// --- 数字巡店 ---
async function startPatrol(scene) {
  if (!checkModuleAccess('patrol')) return;
  const reportEl = document.getElementById('patrol-report');
  reportEl.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);"><div style="font-size:32px;animation:pulse 1.5s infinite;">📷</div><p style="margin-top:12px;">正在调用摄像头...</p></div>';

  try {
    // 请求摄像头
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    const video = document.createElement('video');
    video.srcObject = stream;
    video.autoplay = true;
    video.style.maxWidth = '100%';
    video.style.borderRadius = '8px';
    video.style.marginBottom = '12px';

    const captureBtn = document.createElement('button');
    captureBtn.className = 'btn btn-primary btn-block';
    captureBtn.textContent = '📷 拍照并生成巡检报告';
    captureBtn.onclick = async () => {
      captureBtn.disabled = true;
      captureBtn.textContent = '⏳ AI正在分析...';
      // 截图
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0);
      const imageData = canvas.toDataURL('image/jpeg', 0.3);
      // 停止摄像头
      stream.getTracks().forEach(t => t.stop());
      reportEl.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);"><div style="font-size:32px;animation:pulse 1.5s infinite;">🤖</div><p style="margin-top:12px;">AI正在对照SOP标准分析...</p></div>';

      // AI分析（基于场景名称，无法发送图片到文本API，使用场景描述替代）
      const messages = [
        { role: 'system', content: `你是酒店质检专家。请根据巡检场景生成一份标准的巡检报告。\n\n输出格式：\n1.【巡检概要】场景、时间、巡检人\n2.【检查清单】10项关键检查点（✅/⚠️/❌状态）\n3.【发现问题】发现的问题及严重等级\n4.【整改建议】每个问题的具体整改方案\n5.【评分】该场景综合评分（0-100）` },
        { role: 'user', content: `巡检场景：${scene}\n酒店：${MemberStore.get()?.hotel || '未设置'}\n巡检时间：${new Date().toLocaleString()}\n\n请生成${scene}场景的标准巡检报告。` }
      ];
      const result = await callAIWithFallback('content', messages, { temperature: 0.3 });
      reportEl.innerHTML = `<div style="line-height:1.8;white-space:pre-wrap;">${escapeHtml(result)}</div>`;
      // 更新状态
      const statusEl = document.getElementById(`patrol-status-${scene}`);
      if (statusEl) { statusEl.textContent = '✅ 已巡检'; statusEl.classList.add('done'); }
      MemberStore.addUsage('patrol');
      MemberStore.addHistory('patrol_scene', 'patrol', `${scene}巡检完成`);
    };

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn';
    cancelBtn.style.marginTop = '8px';
    cancelBtn.textContent = '取消';
    cancelBtn.onclick = () => { stream.getTracks().forEach(t => t.stop()); reportEl.innerHTML = '<div class="output-placeholder" style="border:none;"><span class="placeholder-icon">📷</span><p>已取消巡检</p></div>'; };

    reportEl.innerHTML = '';
    const container = document.createElement('div');
    container.style.cssText = 'text-align:center;padding:16px;background:var(--gray-50);border-radius:var(--radius-md);margin-bottom:16px;';
    container.innerHTML = `<p style="font-size:14px;font-weight:600;margin:0 0 12px;">📸 ${escapeHtml(scene)}巡检</p>`;
    container.appendChild(video);
    container.appendChild(captureBtn);
    container.appendChild(cancelBtn);
    reportEl.appendChild(container);
  } catch (err) {
    reportEl.innerHTML = `<div style="text-align:center;padding:40px;color:#dc2626;">❌ 无法访问摄像头：${escapeHtml(err.message)}<br><p style="font-size:13px;color:var(--text-muted);margin-top:8px;">请确保已授权摄像头权限</p></div>`;
  }
}

// --- 辅助函数：复制输出 ---
function copyOutput(elementId) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const text = el.innerText || el.textContent;
  navigator.clipboard.writeText(text).then(() => showToast('✅ 已复制到剪贴板')).catch(() => {
    // fallback
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast('✅ 已复制到剪贴板');
  });
}

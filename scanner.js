// ========== 超高效扫码引擎 ==========

class QRScanner {
    constructor() {
        this.video = document.getElementById('camera-view');
        this.scanArea = document.getElementById('scan-area');
        this.autoFrame = document.getElementById('auto-frame');
        this.statusOverlay = document.getElementById('status-overlay');
        this.infoMaterial = document.getElementById('info-material');
        this.infoVibrator = document.getElementById('info-vibrator');
        this.dot1 = document.getElementById('dot1');
        this.dot2 = document.getElementById('dot2');
        
        this.stream = null;
        this.isRunning = false;
        this.currentStep = 1; // 1=物料码, 2=振动盘
        this.scanLocked = false;
        this.materialCode = null;
        this.vibratorCode = null;
        
        // ZXing扫码器
        this.codeReader = null;
        this.scanTimer = null;
        
        // AI框动画
        this.frameAnimationId = null;
        this.lastDetectionTime = 0;
        this.detectionConfidence = 0;
        
        this.init();
    }
    
    init() {
        document.getElementById('btn-start').addEventListener('click', () => this.start());
        document.getElementById('btn-reset').addEventListener('click', () => this.reset());
    }
    
    extractCode(fullCode) {
        const idx = fullCode.toUpperCase().lastIndexOf('P');
        return idx === -1 ? fullCode : fullCode.substring(idx);
    }
    
    async start() {
        if (this.isRunning) return;
        
        try {
            // 请求最高质量视频
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'environment',
                    width: { ideal: 1920 },
                    height: { ideal: 1920 },
                    zoom: { ideal: 2 } // 默认2倍变焦
                }
            });
            
            this.video.srcObject = this.stream;
            await this.video.play();
            
            // 初始化ZXing
            this.codeReader = new ZXing.BrowserQRCodeReader();
            
            this.isRunning = true;
            this.scanLocked = false;
            this.currentStep = 1;
            this.updateUI();
            
            // 启动超快速扫码循环
            this.startRapidScan();
            
            document.getElementById('btn-start').textContent = '⏺ 扫描中';
            document.getElementById('btn-start').style.opacity = '0.7';
            
        } catch (err) {
            console.error('启动失败:', err);
            this.statusOverlay.textContent = '❌ 摄像头不可用';
            this.statusOverlay.className = 'status-overlay status-error';
        }
    }
    
    // 快速扫码循环（每100ms一次）
    startRapidScan() {
        const scan = async () => {
            if (!this.isRunning) return;
            
            try {
                const result = await this.codeReader.decodeFromVideoElement(this.video);
                
                if (result && !this.scanLocked) {
                    const code = result.text.trim();
                    
                    // 检测到二维码，更新框位置
                    this.updateAutoFrame(result.resultPoints);
                    this.lastDetectionTime = Date.now();
                    this.detectionConfidence = Math.min(1, this.detectionConfidence + 0.3);
                    
                    // 处理扫码结果
                    if (this.currentStep === 1) {
                        this.handleMaterialCode(code);
                    } else if (this.currentStep === 2) {
                        this.handleVibratorCode(code);
                    }
                } else {
                    // 逐渐降低置信度
                    this.detectionConfidence = Math.max(0, this.detectionConfidence - 0.05);
                    this.updateAutoFrame(null);
                }
                
            } catch (e) {
                // 没扫到码，正常
                this.detectionConfidence = Math.max(0, this.detectionConfidence - 0.02);
            }
            
            // 自适应扫描频率
            const interval = this.detectionConfidence > 0.5 ? 50 : 100;
            this.scanTimer = setTimeout(scan, interval);
        };
        
        scan();
    }
    
    // 更新自动框位置（模拟微信的绿框）
    updateAutoFrame(resultPoints) {
        if (resultPoints && resultPoints.length >= 3) {
            const videoRect = this.scanArea.getBoundingClientRect();
            const videoW = this.video.videoWidth;
            const videoH = this.video.videoHeight;
            
            const scaleX = videoRect.width / videoW;
            const scaleY = videoRect.height / videoH;
            
            // 计算二维码在屏幕上的位置
            const points = resultPoints.map(p => ({
                x: p.x * scaleX,
                y: p.y * scaleY
            }));
            
            const minX = Math.min(...points.map(p => p.x));
            const minY = Math.min(...points.map(p => p.y));
            const maxX = Math.max(...points.map(p => p.x));
            const maxY = Math.max(...points.map(p => p.y));
            
            // 设置框位置（稍微放大10%）
            const padding = 0.1;
            const w = (maxX - minX) * (1 + padding * 2);
            const h = (maxY - minY) * (1 + padding * 2);
            
            this.autoFrame.style.left = (minX - (maxX - minX) * padding) + 'px';
            this.autoFrame.style.top = (minY - (maxY - minY) * padding) + 'px';
            this.autoFrame.style.width = w + 'px';
            this.autoFrame.style.height = h + 'px';
            this.autoFrame.classList.add('detected');
        } else {
            this.autoFrame.classList.remove('detected');
        }
    }
    
    handleMaterialCode(code) {
        this.scanLocked = true;
        this.materialCode = this.extractCode(code);
        this.infoMaterial.textContent = this.materialCode;
        
        this.statusOverlay.textContent = '✅ 物料码已记录';
        this.statusOverlay.className = 'status-overlay status-success';
        
        if (navigator.vibrate) navigator.vibrate(30);
        
        // 0.3秒后切换扫描振动盘
        setTimeout(() => {
            this.currentStep = 2;
            this.scanLocked = false;
            this.updateUI();
            this.statusOverlay.textContent = '🔍 对准振动盘码';
            this.statusOverlay.className = 'status-overlay status-info';
        }, 300);
    }
    
    handleVibratorCode(code) {
        this.scanLocked = true;
        this.vibratorCode = code;
        this.infoVibrator.textContent = this.vibratorCode;
        
        if (this.materialCode === this.vibratorCode) {
            this.statusOverlay.textContent = '✅ 匹配成功！';
            this.statusOverlay.className = 'status-overlay status-success';
            if (navigator.vibrate) navigator.vibrate(50);
            
            // 0.5秒后自动重置循环
            setTimeout(() => {
                this.resetForNext();
            }, 500);
        } else {
            this.statusOverlay.textContent = '❌ 不匹配！';
            this.statusOverlay.className = 'status-overlay status-error';
            if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 500]);
            
            // 3秒后重置
            setTimeout(() => {
                this.resetForNext();
            }, 3000);
        }
        
        this.dot1.classList.add('done');
        this.dot2.classList.add('done');
    }
    
    resetForNext() {
        this.materialCode = null;
        this.vibratorCode = null;
        this.currentStep = 1;
        this.scanLocked = false;
        
        this.infoMaterial.textContent = '等待扫描...';
        this.infoVibrator.textContent = '等待扫描...';
        
        this.dot1.className = 'dot active';
        this.dot2.className = 'dot';
        
        this.statusOverlay.textContent = '📱 对准物料码';
        this.statusOverlay.className = 'status-overlay status-info';
    }
    
    reset() {
        this.isRunning = false;
        
        if (this.scanTimer) {
            clearTimeout(this.scanTimer);
            this.scanTimer = null;
        }
        
        if (this.stream) {
            this.stream.getTracks().forEach(t => t.stop());
            this.stream = null;
        }
        
        this.video.srcObject = null;
        this.materialCode = null;
        this.vibratorCode = null;
        this.currentStep = 1;
        
        this.infoMaterial.textContent = '等待扫描...';
        this.infoVibrator.textContent = '等待扫描...';
        this.dot1.className = 'dot active';
        this.dot2.className = 'dot';
        this.autoFrame.classList.remove('detected');
        
        this.statusOverlay.textContent = '准备就绪';
        this.statusOverlay.className = 'status-overlay status-info';
        
        document.getElementById('btn-start').textContent = '▶ 开始扫描';
        document.getElementById('btn-start').style.opacity = '1';
    }
    
    updateUI() {
        if (this.currentStep === 1) {
            this.dot1.className = 'dot active';
            this.dot2.className = 'dot';
        } else {
            this.dot1.className = 'dot done';
            this.dot2.className = 'dot active';
        }
    }
}

// 启动
const scanner = new QRScanner();
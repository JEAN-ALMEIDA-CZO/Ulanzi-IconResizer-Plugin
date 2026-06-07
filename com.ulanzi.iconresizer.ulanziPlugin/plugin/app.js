import fs from 'fs';
import path from 'path';
import os from 'os';
import http from 'http';
import { fileURLToPath } from 'url';

import UlanzideckApi from '../libs/node/ulanzideckApi.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = path.join(__dirname, '..');

const appId = 'com.ulanzi.ulanzistudio.iconresizer';

// Pasta base de ícones do Ulanzi
let ICONS_BASE_DIR;
if (os.platform() === 'darwin') {
    ICONS_BASE_DIR = path.join(os.homedir(), 'Library', 'Application Support', 'Ulanzi', 'UlanziDeck', 'Icons');
} else {
    ICONS_BASE_DIR = path.join(os.homedir(), 'AppData', 'Roaming', 'Ulanzi', 'UlanziDeck', 'Icons');
}
const DEFAULT_DIR = path.join(ICONS_BASE_DIR, 'IconResizer');

// Cria a pasta padrão automaticamente ao iniciar
if (!fs.existsSync(DEFAULT_DIR)) {
    fs.mkdirSync(DEFAULT_DIR, { recursive: true });
}

// Debug logging desligado por padrão (produção). Ative com a env ICONRESIZER_DEBUG=1.
const DEBUG = process.env.ICONRESIZER_DEBUG === '1';
function dlog(msg) {
    if (!DEBUG) return;
    try {
        fs.appendFileSync(path.join(DEFAULT_DIR, 'debug_log.txt'), `[${new Date().toISOString()}] ${msg}\n`);
    } catch (e) { /* logging nunca deve quebrar o serviço */ }
}

dlog('--- INICIANDO SERVIÇO ---');
dlog(`Diretório Padrão: ${DEFAULT_DIR}`);

// ============================================
// Mensagem (toast) localizada ao pressionar a tecla
// ============================================
// O SDK não expõe o idioma da UI no backend, então detectamos o locale do SO
// (Intl) e mapeamos para um dos 9 idiomas suportados. Carregamos a chave
// `toast_press` do <lang>.json correspondente.
function detectBackendLang() {
    try {
        const loc = (Intl.DateTimeFormat().resolvedOptions().locale || 'en').toLowerCase();
        if (loc.startsWith('zh')) return (loc.includes('tw') || loc.includes('hk') || loc.includes('hant')) ? 'zh_TW' : 'zh';
        const base = loc.split(/[-_]/)[0];
        return ['en', 'pt', 'es', 'fr', 'de', 'ja', 'ko'].includes(base) ? base : 'en';
    } catch (e) { return 'en'; }
}

let TOAST_MSG = 'Ulanzi IconResizer';
(function loadToastMsg() {
    const lang = detectBackendLang();
    for (const code of [lang, 'en']) {
        try {
            const j = JSON.parse(fs.readFileSync(path.join(PLUGIN_ROOT, `${code}.json`), 'utf8'));
            const msg = j.Localization && j.Localization.toast_press;
            if (msg) { TOAST_MSG = msg; return; }
        } catch (e) { /* tenta o próximo */ }
    }
})();
dlog(`Idioma do toast: ${detectBackendLang()} | Mensagem: ${TOAST_MSG}`);

// ============================================
// Canal 1: WebSocket via SDK Ulanzi
// ============================================
const $UD = new UlanzideckApi();
$UD.connect(appId);
globalThis.$UD = $UD;

$UD.onConnected(() => {
    console.log('[IconResizer] Main Service conectado via WebSocket');
});

// Evitar crash por erro de WebSocket não tratado
$UD.onError((err) => {
    console.log('[IconResizer] WebSocket erro (ignorado):', typeof err === 'string' ? err : '');
});

$UD.onClose(() => {
    console.log('[IconResizer] WebSocket fechado');
});

// Persistência de ícone ao recarregar
$UD.onAdd((data) => {
    if (data.param) {
        if (data.param.gifBase64) {
            $UD.setGifDataIcon(data.context, data.param.gifBase64);
        } else if (data.param.base64) {
            $UD.setBaseDataIcon(data.context, data.param.base64);
        }
    }
});

// Recebe do PI via sendToPlugin (API nova)
$UD.on('sendToPlugin', (data) => {
    const action = data?.payload?.action;
    dlog(`Evento: sendToPlugin | Payload: ${action}`);

    if (action === 'saveIcon') {
        const payload = data.payload;
        if (!payload.base64) {
            dlog('ERRO: base64 está vazio no payload');
            return;
        }
        const result = saveIconToLibrary(payload.base64, payload.filename || 'icon.png', payload.folder || 'IconResizer');
        if (result.success && data.context) {
            setTimeout(() => {
                $UD.setPathIcon(data.context, result.path);
                $UD.getSettings(data.context);
            }, 500);
        }
    }
});

// Recebe do PI via paramfromplugin (API antiga/fallback)
$UD.on('paramfromplugin', (data) => {
    dlog(`Evento: paramfromplugin | Action: ${data?.param?.action}`);
    if (data && data.param && data.param.action === 'saveIcon') {
        const result = saveIconToLibrary(data.param.base64, data.param.filename, data.param.folder);
        if (result.success && data.context) {
            setTimeout(() => {
                $UD.setPathIcon(data.context, result.path);
                $UD.getSettings(data.context);
            }, 500);
        }
    }
});

// Listener para QUALQUER evento do SDK (para debug)
$UD.on('connected', () => dlog('SDK Conectado!'));
$UD.on('error', (err) => dlog(`SDK Erro: ${err}`));

// Botão pressionado no hardware → toast com o nome do plugin no idioma do usuário
$UD.onRun((data) => {
    $UD.toast(TOAST_MSG);
});

// ============================================
// Canal 2: HTTP Server local (fallback seguro com porta randômica)
// ============================================
import RandomPort from '../libs/node/randomPort.js';
const rp = new RandomPort(19000, 20000); // Faixa de portas sugerida
const HTTP_PORT = rp.getPort();

const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    if (req.method === 'GET' && req.url === '/status') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', port: HTTP_PORT }));
        return;
    }

    if (req.method === 'POST' && req.url === '/save') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const result = saveIconToLibrary(data.base64, data.filename, data.folder);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(result));
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
            }
        });
        return;
    }

    res.writeHead(404);
    res.end();
});

server.listen(HTTP_PORT, '127.0.0.1', () => {
    console.log(`[IconResizer] HTTP server ativo na porta ${HTTP_PORT}`);
    dlog(`HTTP Server iniciado na porta ${HTTP_PORT}`);
});

server.on('error', (err) => {
    console.log(`[IconResizer] HTTP server erro na porta ${HTTP_PORT}:`, err.message);
    dlog(`ERRO HTTP Server: ${err.message}`);
});

// ============================================
// Função de salvamento (usada por ambos canais)
// ============================================
function saveIconToLibrary(base64Data, filename, folder = 'IconResizer') {
    try {
        if (!base64Data) throw new Error("Dados base64 ausentes");

        const targetDir = path.join(ICONS_BASE_DIR, folder);

        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }

        dlog(`saveIconToLibrary: ${filename} em ${folder} (Target: ${targetDir})`);

        const safeName = (filename || 'image.png').replace(/[<>:"/\\|?*]/g, '_');
        const filePath = path.join(targetDir, safeName);

        // Remove prefixo se existir (embora o PI deva enviar sem)
        const pureBase64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;

        const buffer = Buffer.from(pureBase64, 'base64');
        fs.writeFileSync(filePath, buffer);

        dlog(`Sucesso: ${filePath} (${buffer.length} bytes)`);

        try { $UD.toast('Saved successfully!'); } catch (e) { }

        return { success: true, path: filePath };
    } catch (err) {
        dlog(`ERRO AO SALVAR: ${err.message}`);
        return { success: false, error: err.message };
    }
}

console.log('[IconResizer] Main Service iniciado');

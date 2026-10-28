/* tb.js — 淘金币/直播浏览任务 自托管引擎 v2（直播场景版）
 * 由快捷指令以 data:text/html 方式在 Safari 里执行，依赖三个全局：
 *   DATA       nock.json 的完整配置对象
 *   runNum     旧版遗留值（可能是字典脏数据，已容错）
 *   configValue 方案编号，""=淘宝主站
 *
 * v2 相对原版的改动：
 *   1) 补上 task_sessionId 轮换 —— 没有它服务端不认任务会话，页面打开但不读秒、不计进度
 *   2) item 支持三种写法：纯 deliveryId / "id 秒数" / {url, wait} 完整地址对象
 *   3) 完整地址型任务（:// 或 http 开头）直接用，不再拼 baseurl
 *   4) 开关：disableBefore / disablePromo / only / startFrom
 *   5) wait 缺省 18 秒
 */
function run() {

    if (!DATA || !DATA.activity || Object.prototype.toString.call(DATA.activity.taskList) !== '[object Array]') {
        return JSON.stringify({ succes: 'ok', data: [] });
    }

    var ACT = DATA.activity;
    var TD = DATA.taskData || {};
    function isArr(v) { return Object.prototype.toString.call(v) === '[object Array]'; }
    function num(v, d) { var n = Number(v); return (isFinite(n) && n > 0) ? n : d; }

    /* ===== 1. 推广码：唯一真源 = activity.mine；DEFAULT 只在配置缺失时兜底 ===== */
    var DEFAULT = { red: '', cart: '', pv: '', help: '' };

    var RE_LINK = /(?:https?:\/\/)?(?:m\.tb\.cn\/h\.)([A-Za-z0-9]{5,12})(?![A-Za-z0-9])/;
    function parseLink(v) {
        var s = String(v == null ? '' : v).replace(/^\s+|\s+$/g, '');
        if (!s) return null;
        var m = s.match(RE_LINK);
        if (m) return { code: m[1], tail: s.slice(m.index + m[0].length) };
        if (/^[A-Za-z0-9]{5,12}$/.test(s)) return { code: s, tail: '' };
        return null;
    }

    var MINE = (function () {
        var m = ACT.mine || {};
        var keys = ['red', 'cart', 'pv', 'help'];
        var r = {};
        for (var i = 0; i < keys.length; i++) {
            var p = parseLink(m[keys[i]]);
            if (!p && DEFAULT[keys[i]]) p = { code: DEFAULT[keys[i]], tail: '' };
            r[keys[i]] = p ? p.code : '';
            r[keys[i] + 'Url'] = p ? ('://m.tb.cn/h.' + p.code + p.tail) : '';
        }
        r.codes = [];
        for (var j = 0; j < keys.length; j++) { if (r[keys[j]]) r.codes.push(r[keys[j]]); }
        if (isArr(m.codes)) {
            for (var k = 0; k < m.codes.length; k++) {
                var pe = parseLink(m.codes[k]);
                if (pe && r.codes.indexOf(pe.code) < 0) r.codes.push(pe.code);
            }
        }
        return r;
    })();

    /* ===== 2. 防盗自愈 + 助力位处理 ===== */
    (function () {
        function isMine(c) { return MINE.codes.indexOf(c) >= 0; }
        function app(u, defCode) {
            var p = parseLink(u);
            if (!p) return u;
            return 'taobao://m.tb.cn/h.' + (isMine(p.code) ? p.code : defCode) + p.tail;
        }
        function fmt(u) {
            var p = parseLink(u);
            if (!p) return u;
            return '://m.tb.cn/h.' + p.code + p.tail;
        }
        try {
            var mp = ACT.mapping || {};
            for (var k in mp) {
                if (!mp[k] || typeof mp[k].url !== 'string') continue;
                var def = String(k).indexOf('购物车') >= 0 ? MINE.cart : MINE.red;
                mp[k].url = app(mp[k].url, def);
            }
            var tl = ACT.taskList || [];
            var noHelp = ACT.disableBefore === true;
            for (var i = 0; i < tl.length; i++) {
                var tk = (TD[tl[i]] || {}).task;
                if (!tk) continue;
                if (noHelp) { tk.before = []; continue; }
                var bl = isArr(tk.before) ? tk.before : [];
                var out = [];
                for (var j = 0; j < bl.length; j++) {
                    var b = bl[j];
                    if (typeof b === 'string') b = { url: b, wait: 8 };
                    if (!b || typeof b !== 'object') continue;
                    if (typeof b.url !== 'string' || !b.url) continue;
                    out.push({ url: MINE.helpUrl ? MINE.helpUrl : fmt(b.url), wait: b.wait || 8 });
                }
                if (!out.length && MINE.helpUrl) out.push({ url: MINE.helpUrl, wait: 8 });
                tk.before = out;
            }
        } catch (e) { }
    })();

    /* ===== 3. 方案表 ===== */
    var pvStr = MINE.pv, endStr = MINE.red;
    var noPromo = ACT.disablePromo === true;

    var taobaoScheme = {
        scheme: 'taobao',
        main: 'taobao://m.taobao.com/tbopen/index.html?h5Url=https://m.taobao.com',
        start: 'taobao://m.tb.cn/h.' + pvStr,
        end: 'taobao://m.tb.cn/h.' + endStr
    };
    var tmScheme = {
        scheme: 'tmall://page.tm/appLink?&action=ali.open.nav&h5Url=',
        main: 'tmall://page.tm/appLink?&action=ali.open.nav&h5Url=https%3A%2F%2Fwww.tmall.com%2F',
        start: 'tmall://page.tm/appLink?&action=ali.open.nav&h5Url=https://m.tb.cn/h.' + pvStr,
        end: 'tmall://page.tm/appLink?&action=ali.open.nav&h5Url=https%3A%2F%2Fwww.tmall.com%2F',
        type: 'url'
    };
    var dtScheme = {
        scheme: 'taobaoliveshare',
        main: 'taobaoliveshare://m.taobaolive.com/home.html',
        start: 'taobaoliveshare://m.tb.cn/h.' + pvStr,
        end: 'taobaoliveshare://m.taobaolive.com/home.html'
    };
    var schemes = { 1: [taobaoScheme], 2: [tmScheme, taobaoScheme], 3: [taobaoScheme, tmScheme, dtScheme], 4: [tmScheme], 5: [dtScheme] };
    var MoreKey = String(configValue).replace(/\s/g, '');
    var More = schemes[MoreKey] ? MoreKey : '1';
    var scheme = schemes[More];

    /* ===== 4. 拼队列 ===== */
    var taskList = (ACT.taskList || []).map(function (v) { return TD[v]; }).filter(function (v) { return !!v; });
    var only = isArr(ACT.only) ? ACT.only.map(function (x) { return String(x); }) : null;
    var data = [];

    // 任务会话号：服务端靠它判定"这是一次任务浏览"，缺了就不读秒、不计进度
    var useSid = ACT.useSessionId !== false;          // 关掉就完全不挂会话号
    // H5 落地页必须包一层 tbopen 跳板（照作者 tb.js / tj.js 的 wrapFull）
    // 直接 taobao://host/path 不会带 App 内 webview 上下文，落地页不认任务会话。
    var TBOPEN = 'taobao://m.taobao.com/tbopen/index.html?h5Url=';
    function wrapFull(u) {
        var x = String(u == null ? '' : u).replace(/^\s+|\s+$/g, '');
        if (!x) return '';
        if (/^(taobao|taobaolite|tmall|alipays|alipay|sinaweibo|ksnebula|baiduboxapp|baiduboxlite):\/\//i.test(x)) return x;
        if (/^https?:\/\//i.test(x)) return TBOPEN + encodeURIComponent(x);
        if (x.indexOf('://') === 0) return TBOPEN + encodeURIComponent('https' + x);
        return x;
    }
    function sessionId(i) {
        if (!useSid) return '';
        return (i % 2 === 0) ? '&task_sessionId=9808_101351_1772518898210' : '&task_sessionId=9808_101351_1778308582483';
    }
    var mainEvery = num(ACT.mainEvery, 2);            // 每 N 条任务后插一次淘宝主站
    function hitOnly(txt) {
        if (!only || !only.length) return true;
        for (var i = 0; i < only.length; i++) { if (String(txt).indexOf(only[i]) >= 0) return true; }
        return false;
    }

    scheme.map(function (s) {
        taskList.map(function (oneTask) {
            var _t = oneTask.task || {};
            var items = _t.item || [];
            var before = _t.before || [];
            var baseUrl = _t.baseurl;
            var wait = num(_t.wait, 18);
            var paramObj = _t.param || {};

            before.map(function (v) {
                data.push({
                    url: s.type ? s.scheme + encodeURIComponent('https' + v.url) : s.scheme + v.url,
                    wait: num(v.wait, 8)
                });
            });

            if (s && s.end && !noPromo) data.push({ url: s.end, wait: 8 });
            if (s && s.start && !noPromo) data.push({ url: s.start, wait: 5 });
            data.push({ url: s.main, wait: 5 });

            items.map(function (v, i) {
                var objWait = 0, src = v;
                if (v && typeof v === 'object') { src = v.url; if (num(v.wait, 0) > 0) objWait = num(v.wait, 0); }

                var raw = String(src == null ? '' : src).replace(/^\s+|\s+$/g, '');
                if (!raw) return;
                if (!hitOnly(raw)) return;

                var isFull = raw.indexOf('://') === 0 || /^https?:\/\//i.test(raw);

                if (isFull) {
                    data.push({
                        url: wrapFull(raw),
                        wait: objWait > 0 ? objWait : wait
                    });
                    if (i % mainEvery === 0) data.push({ url: s.main, wait: 5 });
                    return;
                }

                var params = raw.split(' ');
                var url = baseUrl;
                for (var key in paramObj) {
                    var arr = paramObj[key];
                    if (!isArr(arr) || !arr.length) continue;
                    url = url.replace(new RegExp(key, 'g'), arr[Math.floor(Math.random() * arr.length)]);
                }
                params.map(function (p, pi) {
                    if (!p) return;
                    url = url.replace(new RegExp('占位参数' + (pi + 1), 'g'), p);
                });

                var thisWait = wait;
                if (params.length > 1 && /^\d+$/.test(params[1])) thisWait = parseInt(params[1], 10);

                data.push({
                    url: s.type ? s.scheme + encodeURIComponent('https' + url) : wrapFull(url),
                    wait: thisWait
                });
                if (i % mainEvery === 0) data.push({ url: s.main, wait: 5 });
            });

            if (s && s.end && !noPromo) data.push({ url: s.end, wait: 5 });
        });
    });

    /* ===== 5. 断点续跑：优先 activity.startFrom，其次兼容旧 runNum ===== */
    var startFrom = parseInt(ACT.startFrom, 10);
    if (!(startFrom > 0)) {
        var rn = String(runNum == null ? '' : runNum).replace(/[^0-9]/g, '');
        startFrom = rn ? parseInt(rn, 10) : 1;
    }
    if (startFrom > 1) data = data.slice(startFrom - 1);

    return JSON.stringify({ succes: 'ok', data: data });
}

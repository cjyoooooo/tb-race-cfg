/* tb.js — 淘金币赛车 自托管引擎（修复版 v1）
 * 由快捷指令以 data:text/html 方式在 Safari 里执行，只依赖三个全局变量：
 *   DATA        来自 nock.json 的完整配置对象
 *   runNum      （旧版遗留，可能是脏值，已做容错）
 *   configValue 方案编号，""=淘宝主站，2=淘宝lite
 * 返回值：JSON 字符串 {"succes":"ok","data":[{"url":"taobao://...","wait":15}, ...]}
 *
 * 相比原版改动：
 *   1) 推广码兜底值独立成 DEFAULT，不再是散落的硬编码
 *   2) 新增 activity.disableBefore：true 时彻底跳过"助力"这一步
 *   3) 新增 activity.startFrom：从第 N 条开始跑（真正的断点续跑）
 *   4) runNum 脏数据容错：旧版把整个字典塞进 runNum，导致续跑失效
 *   5) 停留时间统一从配置读，缺省 15 秒
 */
function run() {

    if (!DATA || !DATA.activity || Object.prototype.toString.call(DATA.activity.taskList) !== '[object Array]') {
        return JSON.stringify({ succes: 'ok', data: [] });
    }

    var ACT = DATA.activity;
    var TD = DATA.taskData || {};

    /* ===== 1. 推广码：唯一真源 = 配置 activity.mine =====
     * 下面 DEFAULT 只在配置缺失/写错时兜底，四个码都改成你自己的。
     */
    var DEFAULT = {
        help: 'jdqH8mf',
        red: 'jXmK5N8',
        cart: 'jc4r62g',
        pv: 'jXmoZZ4'
    };

    var RE_LINK = /(?:https?:\/\/)?(?:m\.tb\.cn\/h\.)([A-Za-z0-9]{5,12})(?![A-Za-z0-9])/;
    function parseLink(v) {
        var s = String(v == null ? '' : v).replace(/^\s+|\s+$/g, '');
        if (!s) return null;
        var m = s.match(RE_LINK);
        if (m) return { code: m[1], tail: s.slice(m.index + m[0].length) };
        if (/^[A-Za-z0-9]{5,12}$/.test(s)) return { code: s, tail: '' };
        return null;
    }
    function isArr(v) { return Object.prototype.toString.call(v) === '[object Array]'; }

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

    /* ===== 2. 防盗自愈：任何不是你自己码的链接，纠正回来 ===== */
    (function () {
        function isMine(c) { return MINE.codes.indexOf(c) >= 0; }
        function bare(u, defCode) {
            var p = parseLink(u);
            if (!p) return u;
            return '://m.tb.cn/h.' + (isMine(p.code) ? p.code : defCode) + p.tail;
        }
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
            // (1) 菜单入口：不是自己的码就纠正
            var mp = ACT.mapping || {};
            for (var k in mp) {
                if (!mp[k] || typeof mp[k].url !== 'string') continue;
                var def = String(k).indexOf('购物车') >= 0 ? MINE.cart : MINE.red;
                mp[k].url = app(mp[k].url, def);
            }
            // (2) 助力位：disableBefore=true 直接清空，否则统一换成自己的 help 码
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

    /* ===== 3. 方案选择（1=淘宝主站 2=淘宝lite） ===== */
    var pvStr = MINE.pv;
    var endStr = MINE.red;
    var More = (String(configValue).replace(/\s/g, '') === '2') ? 2 : 1;

    var taobaoScheme = {
        scheme: 'taobao',
        main: 'taobao://m.taobao.com/tbopen/index.html?h5Url=https://m.taobao.com',
        start: 'taobao://m.tb.cn/h.' + pvStr,
        end: 'taobao://m.tb.cn/h.' + endStr
    };
    var ttScheme = {
        scheme: 'taobaolite://m.ltao.com/open/index.html?action=ali.open.nav&h5Url=',
        main: 'taobaolite://m.ltao.com/open/index.html?action=ali.open.nav&h5Url=https%3A%2F%2Fm.ltao.com%2Fhomepage%23mallPage',
        start: 'taobao://m.taobao.com/tbopen/index.html?h5Url=https://m.tb.cn/h.' + pvStr,
        end: 'taobao://m.taobao.com/tbopen/index.html?h5Url=https://m.tb.cn/h.' + endStr,
        type: 'url'
    };
    var schemes = { 1: [taobaoScheme], 2: [ttScheme] };
    var scheme = schemes[More];
    var noPromo = ACT.disablePromo === true;   // 关掉红包/蓄水等推广位

    /* ===== 4. 拼队列 ===== */
    var taskList = (ACT.taskList || []).map(function (v) { return TD[v]; })
        .filter(function (v) { return !!v; });

    var data = [];

    scheme.map(function (s) {
        taskList.map(function (oneTask) {
            var _t = oneTask.task || {};
            var items = _t.item || [];
            var before = _t.before || [];
            var baseUrl = _t.baseurl;
            var wait = (typeof _t.wait === 'number' && _t.wait > 0) ? _t.wait : 15;
            var paramObj = _t.param || {};

            // 助力（第一步）
            before.map(function (v) {
                data.push({
                    url: s.type ? s.scheme + encodeURIComponent('https' + v.url) : s.scheme + v.url,
                    wait: (typeof v.wait === 'number' && v.wait > 0) ? v.wait : 8
                });
            });

            // 超级红包（推广位，disablePromo 时跳过）
            if (s && s.end && !noPromo) data.push({ url: s.end, wait: 10 });
            // 快消蓄水期（推广位，disablePromo 时跳过）
            if (s && s.start && !noPromo) data.push({ url: s.start, wait: 8 });
            // 淘宝主站
            data.push({ url: s.main, wait: 5 });

            // 逐条任务
            var only = isArr(ACT.only) ? ACT.only.map(function (x) { return String(x); }) : null;
            items.map(function (v, i) {
                var params = String(v).split(' ');
                // 只跑指定 deliveryId（排障用）：activity.only: ["107910", "100340"]
                if (only && only.length && only.indexOf(params[0]) < 0) return;
                var url = baseUrl;

                for (var key in paramObj) {
                    var arr = paramObj[key];
                    if (!isArr(arr) || !arr.length) continue;
                    var pick = arr[Math.floor(Math.random() * arr.length)];
                    url = url.replace(new RegExp(key, 'g'), pick);
                }
                params.map(function (p, pi) {
                    if (!p) return;
                    url = url.replace(new RegExp('占位参数' + (pi + 1), 'g'), p);
                });

                // 单项自定义停留：item 写成 "107910 17" 时，第二段纯数字即该条停留秒数
                var thisWait = wait;
                if (params.length > 1 && /^\d+$/.test(params[1])) thisWait = parseInt(params[1], 10);

                data.push({
                    url: s.type ? s.scheme + encodeURIComponent('https' + url) : s.scheme + url,
                    wait: thisWait
                });

                if (i % 2 === 0) data.push({ url: s.main, wait: 5 });
            });

            if (s && s.end && !noPromo) data.push({ url: s.end, wait: 5 });
        });
    });

    /* ===== 5. 断点续跑 =====
     * 优先用 activity.startFrom（配置里写数字，稳）；
     * 老版的 runNum 脏值只接受纯数字，其它一律当 1。
     */
    var startFrom = parseInt(ACT.startFrom, 10);
    if (!(startFrom > 0)) {
        var rn = String(runNum == null ? '' : runNum).replace(/[^0-9]/g, '');
        startFrom = rn ? parseInt(rn, 10) : 1;
    }
    if (startFrom > 1) data = data.slice(startFrom - 1);

    return JSON.stringify({ succes: 'ok', data: data });
}

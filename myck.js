/* myck.js —— 淘金币 CK 模式引擎（本地签名版 · 自托管）
 *
 * 基于作者「爱吃鱼的九条」的 tbcjs.js，改造点只有一个：
 *   run() 不再把 cookie 发给作者的腾讯云网关换签名地址，
 *   改为在本机用 JS 直接算 mtop 签名（sign = md5(token&t&appKey&data)）。
 *   cookie 全程只存在于手机内存里，不发往任何服务器。
 *
 * 依赖的外部依赖：无（md5 已内置于本文件下方）。
 * 需要全局变量：ALLDATA（配置）、cookies（cookie 整行）。
 */

/* md5hex —— 纯 JS MD5（32 位整数运算，UTF-8 输入）
   用于 mtop 签名：md5(token & t & appKey & data)
   实现为标准 64 轮算法的逐行直译，已用 Node crypto / Python hashlib 对齐
   （固定用例 + 5000 例随机模糊测试，见 tools/verify_md5.js）。 */
function md5hex(str) {
  var S = [7,12,17,22,7,12,17,22,7,12,17,22,7,12,17,22,
           5,9,14,20,5,9,14,20,5,9,14,20,5,9,14,20,
           4,11,16,23,4,11,16,23,4,11,16,23,4,11,16,23,
           6,10,15,21,6,10,15,21,6,10,15,21,6,10,15,21];
  var K = [], i, j;
  for (i = 0; i < 64; i++) K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296);

  function rol(x, c) { return (x << c) | (x >>> (32 - c)); }

  /* UTF-8 编码 */
  var bytes = [], n = str.length;
  for (i = 0; i < n; i++) {
    var c = str.charCodeAt(i);
    if (c < 0x80) bytes.push(c);
    else if (c < 0x800) bytes.push(192 | (c >> 6), 128 | (c & 63));
    else if (c >= 0xD800 && c <= 0xDBFF && i + 1 < n) {
      var cp = 0x10000 + ((c - 0xD800) << 10) + (str.charCodeAt(++i) - 0xDC00);
      bytes.push(240 | (cp >> 18), 128 | ((cp >> 12) & 63), 128 | ((cp >> 6) & 63), 128 | (cp & 63));
    } else bytes.push(224 | (c >> 12), 128 | ((c >> 6) & 63), 128 | (c & 63));
  }

  /* 补位：0x80 + 若干 0 + 8 字节比特长度，凑成 64 字节块 */
  var len = bytes.length, blocks = Math.ceil((len + 9) / 64), w = [];
  for (i = 0; i < len; i++) w[i >> 2] = ((w[i >> 2] | 0) | (bytes[i] << ((i % 4) * 8))) >>> 0;
  for (i = len >> 2; i < blocks * 16; i++) if (w[i] === undefined) w[i] = 0;
  w[len >> 2] = (w[len >> 2] | (0x80 << ((len % 4) * 8))) >>> 0;
  w[(blocks - 1) * 16 + 14] = (len * 8) >>> 0;

  var a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
  for (i = 0; i < blocks * 16; i += 16) {
    var a = a0, b = b0, c = c0, d = d0, F, g, tmp;
    for (j = 0; j < 64; j++) {
      if (j < 16) { F = (b & c) | (~b & d); g = j; }
      else if (j < 32) { F = (d & b) | (~d & c); g = (5 * j + 1) % 16; }
      else if (j < 48) { F = b ^ c ^ d; g = (3 * j + 5) % 16; }
      else { F = c ^ (b | ~d); g = (7 * j) % 16; }
      tmp = d;
      d = c;
      c = b;
      b = (b + rol((a + F + K[j] + w[i + g]) | 0, S[j])) | 0;
      a = tmp;
    }
    a0 = (a0 + a) | 0;
    b0 = (b0 + b) | 0;
    c0 = (c0 + c) | 0;
    d0 = (d0 + d) | 0;
  }
  function hex(x) {
    /* MD5 输出按小端字节序：低字节在前 */
    var s = "", H = "0123456789abcdef", k;
    x = x >>> 0;
    for (k = 0; k < 4; k++) { var by = x & 255; s += H.charAt(by >> 4) + H.charAt(by & 15); x >>>= 8; }
    return s;
  }
  return hex(a0) + hex(b0) + hex(c0) + hex(d0);
}

function run () {
    var ck = cookies.replace(/\s+/g,"");
    var tk = getCookie(ck,"_m_h5_tk");
    if (!tk) return "";
    var token = tk.split("_")[0];

    var sceneId = 8917;
    try { sceneId = Number(JSON.parse(atob(ALLDATA.aTag)).sceneId); } catch (e) {}

    var payload = '{"sceneId":' + sceneId + '}';
    var t = String(Date.now());
    var sign = md5hex(token + "&" + t + "&12574478&" + payload);

    var url = "https://h5api.m.taobao.com/h5/mtop.taobao.pentaprism.scene.query/1.0/"
      + "?jsv=2.7.4&type=json&dataType=json&appKey=12574478&t=" + t
      + "&sign=" + sign
      + "&api=mtop.taobao.pentaprism.scene.query&v=1.0&timeout=5000"
      + "&data=" + encodeURIComponent(payload);

    return JSON.stringify({
      succes: 'ok',
      data:{ ck:ck, url:url }
    });
  }




  function getCookie(cookie,name) {
    let cookieArr = cookie.split(";");
    let obj = {}
    cookieArr.forEach((i) => {
      let arr = i.split("=");
      obj[arr[0]]=arr[1];
    });
    return obj[name]
  }

function runTask() {
    

    var pvStr = 'jaZmGBk';
    var endStr = 'jYO5Mc1';
    var gStr = 'jYO5Mc1';

    var taobaoScheme = {
      scheme:"taobao",
      main:"taobao://m.taobao.com/tbopen/index.html?h5Url=https://m.taobao.com",
      start: "taobao://m.tb.cn/h." + pvStr,
      end:"taobao://m.tb.cn/h." + endStr,
      gwc:"taobao://m.tb.cn/h." + gStr,

    }

    var scheme = taobaoScheme;
    if (!DB){
      DB = {
        run:0,
        keys:{},
        items:[],
      }
    }
    DB.run = DB.run + 1;
    var taskList = ALLDATA.activity.taskList
    var oneTask = ALLDATA.taskData[taskList[0]];
    var itme = oneTask.task.ckItem;
    var outItme = oneTask.task.outItem ? oneTask.task.outItem : [];
    var ckUrl = oneTask.task.ckurl
    var wait = oneTask.task.wait
    var paramObj = oneTask.task.param
    var nowToken = ""
    if (data) {
      var items = []
      var urlItem = []
      var baseUrl = scheme.scheme + ckUrl;

      for (var item of data) {
        if (item.needTimes !== '0') {
          var num = item.needTimes * 1
          var index = item.index

          var deliveryId = item.deliveryId
          var implId = item.implId
          var fromToken = item.fromToken
          nowToken = fromToken;
          if(!DB.keys[deliveryId]){
            

            //获取key
            if (!(outItme.includes(deliveryId))){
                 if (num <= 3){
                  DB.keys[deliveryId] = true;
                 }
                 if(num > 3){
                    num = 3
                 }
              for (var i = 0; i < num ; i++){
                var nowImplId = implId
                var b = nowImplId.split('_');
                b.pop();
                nowImplId = b.join('_') + '_' +(index*1 + i)
                DB.items.push(`${deliveryId} ${nowImplId}`)
                var url =  baseUrl + `&implId=${nowImplId}&deliveryId=${deliveryId}&fromToken=${fromToken}`

                for (var key in paramObj){

                  var paramArr = paramObj[key]
                  var reg = new RegExp(`${key}`,'g')
                  var str = paramArr[Math.floor((Math.random()*paramArr.length))]
                  url = url.replace(reg,str);
                }
                urlItem.push({
                  url:url,
                  wait:wait
                })
              }
            

            
            }

           

          }


        }
      }
      var urlD = [ ]
      if (DB.run == 1){

       urlD.push({
          url:scheme.end,
          wait:10
        })

        urlD.push({
            url:scheme.start,
            wait:5
          })
        
       

        
        
        urlD.push({
          url:scheme.main,
          wait:5
        })
      }


      if (DB.run == 1 && nowToken){

        var baseUrl = oneTask.task.ckitemUrl
        itme.map((v,i) => {

          var str = v;
          var params = str.split(' ');
          var url = baseUrl + '&fromToken=' + nowToken;


          for (var key in paramObj){

            var paramArr = paramObj[key]
            var reg = new RegExp(`${key}`,'g')
            var str = paramArr[Math.floor((Math.random()*paramArr.length))]
            url = url.replace(reg,str);
          }
          //替换参数2
          params.map((v,i) => {
            if (v){
              var num = i+1;
              var reg = new RegExp(`占位参数${num}`,'g')
              url = url.replace(reg,v);
            }
          });

          urlItem.push({
            url:scheme.type ? scheme.scheme + encodeURIComponent('https' + url):scheme.scheme + url,
            wait:wait
          })

        })
      }

      urlItem.map((v,i) => {
        urlD.push(v)
        if ( i % 1 === 0){
          urlD.push({
            url:scheme.main,
            wait:5
          })
        }
      })

      var dd = {
        succes: 'ok',
        data:urlD,
        db:DB,
      };
      if (nowToken){
        dd.token = nowToken;
      }
      if (urlItem.length === 0){
        dd.end = scheme.gwc;
      }

      return JSON.stringify(dd);
    }else {
      return ;
    }

  }

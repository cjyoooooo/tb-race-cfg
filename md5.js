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

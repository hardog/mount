
/**
 * Module dependencies.
 */

var debug = require('debug')('koa-mount');
var compose = require('koa-compose');
var assert = require('assert');

/**
 * Expose `mount()`.
 */

module.exports = mount;

// 了解中间件挂载后结合koa应用中中间件的执行顺序是怎样的?
// 如何做到挂载在某一指定路径下的, 如何执行的?
// mount('/a/', a), 访问/a/xx 时 match(path)返回什么?
// mount内中间件与未被mount中间件path的异同?
function mount(prefix, app) {
  // 默认prefix为 /
  if ('string' != typeof prefix) {
    app = prefix;
    prefix = '/';
  }

  assert('/' == prefix[0], 'mount path must begin with "/"');

  // compose
  var downstream = app.middleware
    ? compose(app.middleware)
    : app;

  // 根目录无需挂载
  if ('/' == prefix) return downstream;
  // 检查prefix 是否以/结束
  var trailingSlash = '/' == prefix.slice(-1);

  var name = app.name || 'unnamed';
  debug('mount %s %s', prefix, name);

  // 重新返回一个中间件供koa中app.use使用
  return function *(upstream){
    var prev = this.path;
    // 去掉prefix后的路径
    var newPath = match(prev);
    debug('mount %s %s -> %s', prefix, name, newPath);
    if (!newPath) return yield* upstream;

    // mountPath 保存挂载前缀, path保存去prefix后的路径
    this.mountPath = prefix;
    this.path = newPath;
    debug('enter %s -> %s', prev, this.path);

    // 传进downstream中的generator是在compose(koa-compose)链末尾
    // 挂载的路由先全部执行完, 再执行app.use中挂载的下一个中间件
    // 如: var app = koa();
    // app.use(mount('/a', a))
    // app.use(function *b(){});
    // 上述先执行完a, 再执行中间件b, 注意顺序
    yield* downstream.call(this, function *(){
      // 在upstream中恢复path
      this.path = prev;
      yield* upstream;
      this.path = newPath;
    }.call(this));

    debug('leave %s -> %s', prev, this.path);
    this.path = prev;
  }
  
  // path / prefix
  // /lkajsldkjf    /images/ => false
  // /images        /images => /
  // /images        /images/ => false
  // /images/asdf   /images/ => asdf
  // /images/xxx    /images => /xxx
  function match(path) {
    // path不是以[prefix]打头的, 如path: /a, prefix: /b/xx
    if (0 != path.indexOf(prefix)) return false;

    // 将path路径中的[prefix]用'' 取代, 默认以/打头
    var newPath = path.replace(prefix, '') || '/';
    // 是否以/结尾, 是则直接返回
    if (trailingSlash) return newPath;

    // 新路径必须以/打头
    if ('/' != newPath[0]) return false;
    return newPath;
  }
}

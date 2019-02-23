# vue-prerender-demo

```bash
# 开发
$ npm run serve

# 打包
$ npm run build
```

## 实现原理

预渲染实现原理其实不难，对于一个普通的 vue spa 应用，打包后的 html 页面其实只包含了基本的 html、body 等元素，然后引入一个 js。我们可以用 puppeteer 去打开这个页面（以前是 phantomjs），然后用它的 `page.content()` api 获取的 html 代码代替原始的打包后的代码

我们可以手动去 dist 目录下做这个事情，prerender-spa-plugin 这个 webpack 的 plugin 帮助我们自动做完了这个事情，它会默认打开 express 作为 server，然后用 puppeteer 去抓页面，然后根据路由生成静态页面

和原始的 vue spa 相比，修改的代码并不是很多

vue.config.js 文件中新增 plugin：

```js
new PrerenderSPAPlugin({
  staticDir: path.join(__dirname, 'dist'),
  routes: [ '/', '/about' ],

  renderer: new Renderer({
    headless: false,
    renderAfterDocumentEvent: 'render-event'
  })
})
```

routes 表示我们会用 puppeteer 去模拟打开的路径，这里提一点，**vue 路由模式只能是 history**，以 demo 为例，我们会生成 /index.html 以及 /about/index.html 两个 html 文件，之后我们直接打开 / 或者 /about 其实访问到的是两个 html 文件了，这个 hash 模式做不了

另外一个选项 renderAfterDocumentEvent 需要注意下，demo 中表示客户端 js 代码抛出 'render-event' 这个自定义事件后，puppeteer 才去抓取 html 代码

我们可以看 main.js 代码：

```js
new Vue({
  router,
  render: function (h) { return h(App) },
  mounted () {
    // You'll need this for renderAfterDocumentEvent.
    document.dispatchEvent(new Event('render-event'))
  }
}).$mount('#app')
```

默认是 puppeteer 打开页面完成后就去抓取 html 内容，另外还可以选择配置打开页面后的指定时间后去抓取，或者页面中某个元素出现后去抓取，具体可以看选项。其实这个 demo renderAfterDocumentEvent 配置与否效果一样

另外注意下 routes 中每个模拟打开的页面，如果配置了 renderAfterDocumentEvent，js 中都需要 dispatchEvent，不然 puppeteer 会一直等待导致 build 失败

我个人比较关注异步接口数据的 ssr，如果页面中有异步请求的，也是可以的，反正只要在请求已经 get 到，然后渲染到页面后 dispatchEvent 就好了，如果多个异步请求都要渲染，那就 promise.all 之后 dispatchEvent 吧。这个时候也有个坏处，就是不能像 demo 一样只在一个地方 dispatchEvent 就好了，每个页面可能都要单独 dispatchEvent 了

另外需要注意下，**这个插件只会修改 html，不会修改 js**，所以 html 虽然会被预渲染，**但是该执行的 js 一样会执行**。比如说你要处理一个异步请求，虽然预渲染可以做到将请求结果渲染到 html，但是异步请求还是会执行，不像 ssr，服务端执行异步请求，客户端就不用执行了，因为预渲染没有 server

## 应用场景和局限性

比较适合静态页面。比如我要开发几个静态页面，用 vue 上手比较快，但是又要考虑 seo，就可以用这个方式解决

局限性主要在以下几个场景：

* 动态路由。比如有个 /:city 的路由，如果要做，需要把所有情况都列出放到 routes 中
* 路由过多。因为 build 到时候需要模拟打开所有路由，构建太慢
* 经常发生变化的页面，数据实时性展示（比如体育比赛等）。预渲染会让你的页面显示不正确直到脚本加载完成并替换成新的数据，这是一个不好的用户体验
* 动态数据页面，即不同的用户需要看到不同的数据，比如 /my-profile 页



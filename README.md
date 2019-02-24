# vue-prerender-demo

```bash
# 开发
$ npm run serve

# 打包
$ npm run build
```

## 实现原理

**用 prerender-spa-plugin 实现预渲染并不仅仅适用于 vue，事实上，适用于任何页面**

预渲染实现原理其实不难，对于一个普通的 vue spa 应用，打包后的 html 页面其实只包含了基本的 html、body 等元素，然后引入一个 js。我们可以用 puppeteer 去打开这个页面（以前是 phantomjs），然后用它的 `page.content()` api 获取的 html 代码代替原始的打包后的代码

我们可以手动去 dist 目录下做这个事情，prerender-spa-plugin 这个 webpack 的 plugin 帮助我们自动做完了这个事情，它会默认在 dist 下用 express 作为 server（就能打开页面），然后用 puppeteer 去抓页面，然后根据路由生成静态页面

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

比较适合静态页面。比如我要开发几个静态页面，用 vue 上手比较快，但是又要考虑 seo 或者考虑弱网条件，就可以用这个方式解决

局限性主要在以下几个场景：

* 动态路由。比如有个 /:city 的路由，如果要做，需要把所有情况都列出放到 routes 中
* 路由过多。因为 build 到时候需要模拟打开所有路由，构建太慢
* 经常发生变化的页面，数据实时性展示（比如体育比赛等）。预渲染会让你的页面显示不正确直到脚本加载完成并替换成新的数据，这是一个不好的用户体验
* 动态数据页面，即不同的用户需要看到不同的数据，比如 /my-profile 页

另外，关于体验上，如果是像 demo 一样用 vue 做静态页面，体验还是不错的（尽管拼接生成元素的 js 还是会执行，但是因为执行前后的内容一致，所以并没有感觉），如果是做异步请求的预渲染，举个例子比如有这样一个 .vue 文件：

```vue
<template>
  <div id="app">
    <ul>
      <li v-for="item in list" :key="item.id"><a :href="item.url">{{ item.title }}</a></li>
    </ul>
  </div>
</template>

<script>
export default {
  name: 'app',
  data () {
    return {
      list: []
    }
  },
  created() {
    fetch('/api/topics/hot.json')
      .then(res => res.json())
      .then(data => {
        this.list = data
      })
  }
}
</script>
```

如果我们对它做了预渲染，接口请求到的数据是会渲染到 html 上的，所以一开始我们是有数据的，然后运行 js，vue 开始初始化，一开始 list 是空数组，于是页面数据又没了，然后又请求接口，数据又有了，于是就有一个 有->没有->有 的过程。唯一的好处是 seo 的问题解决了，另外如果弱网条件下迟迟加载不了 js，数据也是可以显示的

实际测试中，大多看到的是 没有->有 这个过程，因为 有->没有 这个过程太快了。我们可以模拟弱网情况，就能看到这个过程

突然想到仿佛有个 [injectProperty](https://github.com/chrisvfritz/prerender-spa-plugin#prerendererrenderer-puppeteer-options) 选项可以在环境中插入值，可以看下 [这个 demo](https://github.com/chrisvfritz/prerender-spa-plugin/tree/master/examples/vanilla-simple)

于是修改配置：

```js
renderer: new Renderer({
  // Optional - The name of the property to add to the window object with the contents of `inject`.
  injectProperty: '__PRERENDER_INJECTED',
  // Optional - Any values you'd like your app to have access to via `window.injectProperty`.
  inject: {
    foo: 'bar'
  },
  headless: false,
  renderAfterDocumentEvent: 'render-event'
})
```

理想中是在 js 中根据 window['__PRERENDER_INJECTED'] 去判断是否进行异步请求的操作，但是在 js 中打印它都是 undefined，此法失败

看了下代码：

```js
if (options.inject) {
  await page.evaluateOnNewDocument(`(function () { window['${options.injectProperty}'] = ${JSON.stringify(options.inject)}; })();`)
}
```

也就是说配置了这个选项，在 puppeteer 去抓取页面的时候，会在上下文中执行以上代码（也就是插入 window['__PRERENDER_INJECTED'] 值），如果代码中有以下这样操作：

```js
document.body.innerHTML += `<p>Injected: ${JSON.stringify(window['__PRERENDER_INJECTED'])}</p>`
```

这是会生效的，因为 puppeteer 会抓取 html 代码，反之如果是在 js 里判断这个值，它只存在 puppeteer 打开的上下文中

所以对于这样的异步请求数据，个人建议不使用预渲染

**个人觉得预渲染就适合做静态页面**
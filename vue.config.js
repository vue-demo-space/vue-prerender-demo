const PrerenderSPAPlugin = require('prerender-spa-plugin')
const Renderer = PrerenderSPAPlugin.PuppeteerRenderer
const path = require('path')

module.exports = {
  configureWebpack: config => {
    if (process.env.NODE_ENV === 'production') {
      // 为生产环境修改配置...
      return {
        plugins: [
          new PrerenderSPAPlugin({
            staticDir: path.join(__dirname, 'dist'),
            routes: [ '/', '/about' ],

            renderer: new Renderer({
              headless: false,
              renderAfterDocumentEvent: 'render-event'
            })
          })
        ]
      }
    } else {
      // 为开发环境修改配置...
    }
  }
}
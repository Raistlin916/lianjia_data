const log4js = require('log4js')
const path = require('path')

log4js.configure({
  appenders: { error: { type: 'file', filename: path.join(__dirname, '../../data/log/error.log') } },
  categories: { default: { appenders: ['error'], level: 'error' } }
})

module.exports = log4js.getLogger('error')

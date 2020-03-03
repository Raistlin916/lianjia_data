const path = require('path')
const fs = require('fs')
const axios = require('axios')
const $ = require('cheerio')
const dayjs = require('dayjs')
const _ = require('lodash')
const git = require('simple-git')()
const urlencode = require('urlencode')
const { ConcurrencyManager } = require('axios-concurrency')
const log = require('./common/log')

ConcurrencyManager(axios, 5)

const getTaobaoUrl = name =>
  `https://sf.taobao.com/item_list.htm?category=50025969&city=${urlencode.encode(
    name,
    'gbk'
  )}`

const fetchCityList = async () =>
  $((await axios.get(`https://www.lianjia.com/city/`)).data)
    .find('.city_list_li_selected a')
    .map((i, elem) => ({
      url: $(elem).attr('href'),
      name: $(elem).text(),
      id: ($(elem)
        .attr('href')
        .match(/^https:\/\/(\w+)\.lianjia.com.*$/) || [])[1]
    }))
    .get()
    .filter(i => i.id)
    .concat([
      {
        id: 'jiangsu_taizhou',
        name: '泰州',
        lianjia: false
      }
    ])

const current = dayjs().format('YYYY-MM-DD')
const pathMap = {
  lianjia: path.join(__dirname, '../data/lianjia'),
  taobao: path.join(__dirname, '../data/taobao_paimai')
}
const getPath = (id, type) => path.join(pathMap[type], `${id}.json`)

const fetch = {
  lianjia: async ({ id }) =>
    +$((await axios.get(`https://${id}.lianjia.com/`)).data)
      .find('.house-num li:first-child')
      .text()
      .match(/\d+/)[0],
  taobao: async ({ name }) =>
    +$((await axios.get(getTaobaoUrl(name))).data)
      .find('.count')
      .text()
}

const wrapFetchedData = (id, type) => count => ({
  type,
  id,
  result: {
    listingNumber: count,
    createAt: Date.now(),
    date: current
  },
  origin: read(id, type)
})

const wrapFetch = type => async cityObj => {
  try {
    if (cityObj[type] === false) {
      return undefined
    }
    const logName = `fetch ${type}-${cityObj.id} success`
    console.time(logName)
    const result = await fetch[type](cityObj).then(
      wrapFetchedData(cityObj.id, type)
    )
    console.timeEnd(logName)
    return result
  } catch (e) {
    log.error('fetch fail', e, cityObj)
    return undefined
  }
}

const fetchData = async list =>
  (
    await Promise.all(
      list.reduce(
        (pre, curr) =>
          pre.concat(
            [wrapFetch('lianjia'), wrapFetch('taobao')].map(item => item(curr))
          ),
        []
      )
    )
  ).filter(i => i)

const read = (id, type) => {
  try {
    const data = fs.readFileSync(getPath(id, type))
    return JSON.parse(data)
  } catch (e) {
    return []
  }
}

const merge = list =>
  list.map(item => ({
    ..._.omit(item, 'result', 'origin'),
    list: _.uniqBy(item.origin.concat(item.result), 'date')
  }))

const saveLocal = list =>
  list.forEach(item =>
    fs.writeFileSync(
      getPath(item.id, item.type),
      JSON.stringify(item.list, null, 2)
    )
  )

const init = () => {
  Object.values(pathMap).forEach(dir => fs.existsSync(dir) || fs.mkdirSync(dir))
  return new Promise((resolve, reject) =>
    git
      .addConfig('user.name', 'Industrious robot')
      .branch(['data', 'origin/data'])
      .checkout('data')
      .mergeFromTo('master', 'data', '--squash', err =>
        err ? reject(err) : resolve()
      )
  )
}

const commit = () => {
  return new Promise((resolve, reject) =>
    git
      .add('./*')
      .commit(`save at ${current}`)
      .push('origin', 'data', err => (err ? reject(err) : resolve()))
  )
}

const print = text => data => console.log(text) || data

init()
  .then(fetchCityList)
  .then(print('fetch index success'))
  .then(fetchData)
  .then(print('fetch pages success'))
  .then(merge)
  .then(print('merge success'))
  .then(saveLocal)
  .then(print('saveLocal success'))
  .then(commit)
  .then(print('commit success'))
  .catch(msg => console.print(msg))

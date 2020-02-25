const path = require('path')
const fs = require('fs')
const axios = require('axios')
const $ = require('cheerio')
const dayjs = require('dayjs')
const _ = require('lodash')
const git = require('simple-git')()

const cityList = [
  {
    id: 'hz',
    name: '杭州'
  },
  {
    id: 'sh',
    name: '上海'
  },
  {
    id: 'su',
    name: '苏州'
  }
]
const current = dayjs().format('YYYY-MM-DD')
const lianjiaPath = path.join(__dirname, '../data/lianjia')

const getCityListingNumber = html =>
  +$(html)
    .find('.house-num li:first-child')
    .text()
    .match(/\d+/)[0]

const createCityData = list => {
  const create = async city => {
    const res = await axios.get(`https://${city}.lianjia.com/`)
    const listingNumber = getCityListingNumber(res.data)
    return {
      listingNumber,
      createAt: Date.now(),
      date: current,
      city
    }
  }

  return Promise.all(list.map(item => create(item.id)))
}

const readLocal = list => {
  const read = city => {
    try {
      const data = fs.readFileSync(path.join(lianjiaPath, `${city}.json`))
      return JSON.parse(data)
    } catch (e) {
      return []
    }
  }

  return list.reduce(
    (previous, item) => ({
      ...previous,
      [item.id]: {
        city: item.id,
        list: read(item.id)
      }
    }),
    {}
  )
}

const merge = list => {
  const origin = readLocal(cityList)
  return list.map(item => ({
    ...item,
    list: origin[item.city]
      ? _.uniqBy([...origin[item.city].list, _.omit(item, 'city')], 'date')
      : [_.omit(item, 'city')]
  }))
}

const saveLocal = list => {
  const dir = lianjiaPath
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir)
  }
  const save = (city, data) =>
    fs.writeFileSync(
      path.join(dir, `${city}.json`),
      JSON.stringify(data, null, 2)
    )
  list.forEach(item => save(item.city, item.list))
}

const init = () => {
  return new Promise((resolve, reject) =>
    git
      .checkout('data')
      .mergeFromTo('master', 'data', err => (err ? reject(err) : resolve()))
  )
}

const commit = () => {
  return new Promise((resolve, reject) =>
    git
      .add('./*')
      .addConfig('user.name', 'Industrious robot')
      .commit(`save at ${current}`)
      .push('origin', 'data', err => (err ? reject(err) : resolve()))
  )
}

const log = text => data => console.log(text) || data

init()
  .then(() => createCityData(cityList))
  .then(merge)
  .then(log('merge success'))
  .then(saveLocal)
  .then(log('saveLocal success'))
  .then(commit)
  .then(log('commit success'))
  .catch(msg => console.log(msg))

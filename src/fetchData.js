const path = require('path')
const fs = require('fs')
const axios = require('axios')
const $ = require('cheerio')
const dayjs = require('dayjs')
const _ = require('lodash')

const cityList = [
  {
    id: 'hz',
    name: '杭州'
  },
  {
    id: 'sh',
    name: '上海'
  }
]

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
      date: dayjs().format('YYYY-MM-DD'),
      city
    }
  }

  return Promise.all(list.map(item => create(item.id)))
}

const readLocal = list => {
  const read = city => {
    try {
      const data = fs.readFileSync(
        path.join(__dirname, '../data', `${city}.json`)
      )
      return JSON.parse(data)
    } catch (e) {
      return []
    }
  }

  return list.map(item => ({
    city: item.id,
    list: read(item.id)
  }))
}

const merge = list => {
  const origin = readLocal(cityList)
  return list.map(item => ({
    ...item,
    list: _.uniqBy([...(origin[item.city] || []), _.omit(item, 'city')], 'date')
  }))
}

const saveLocal = list => {
  const save = (city, data) =>
    fs.writeFileSync(
      path.join(__dirname, '../data', `${city}.json`),
      JSON.stringify(data, null, 2)
    )
  list.forEach(item => save(item.city, item.list))
}

createCityData(cityList)
  .then(merge)
  .then(saveLocal)

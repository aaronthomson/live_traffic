http = require("http")
static = require("node-static")
Faye = require("faye")
url = require("url")
request = require("request")
xmlParser = require("libxml-to-js")
fs = require("fs")
jsdom = require("jsdom")
jquery = fs.readFileSync("./jquery-1.7.1.min.js").toString()

fServer = new Faye.NodeAdapter(
  mount: "/faye"
  timeout: 45
)

server = http.createServer((request, response) ->
  request.addListener "end", ->
    location = url.parse(request.url, true)
    params = (location.query or request.headers)
    file = new static.Server("./public",
      cache: false
    )
    file.serve request, response

  request.addListener "data", (data) ->
    location = url.parse(request.url, true)
    if location.pathname is "/update"
      publishTraffic data
      response.writeHead 200
      response.end "Success!"
)
fServer.attach server
server.listen 8000

publishTraffic = (data) ->
  xmlParser data, (error, result) ->
    for index of result.entry
      unless result.entry[index].content is `undefined`
        jsdom.env
          html: result.entry[index].content["#"]
          src: [ jquery ]
          done: (errors, window) ->
            street = window.$(".tiw-rowStreetTitle:first").text().toLowerCase().replace("various roads", "")
            suburb = window.$(".tiw-rowSuburbStreetTitle").text().toLowerCase().replace("various roads", "").replace("shire council area", "")
            address = ""
            if street
              address = street + " " + suburb + ", NSW"
            else
              address = suburb + ", NSW"
            image = window.$(".tiw-rowCategoryIcon img").attr("src")
            console.log address
            fServer.getClient().publish "/messages",
              address: address
              image: image

getFeeds = ->
  feeds = [ "http://livetraffic.rta.nsw.gov.au/traffic/rss/syd-north.atom", "http://livetraffic.rta.nsw.gov.au/traffic/rss/syd-south.atom", "http://livetraffic.rta.nsw.gov.au/traffic/rss/syd-west.atom", "http://livetraffic.rta.nsw.gov.au/traffic/rss/reg-north.atom", "http://livetraffic.rta.nsw.gov.au/traffic/rss/reg-south.atom", "http://livetraffic.rta.nsw.gov.au/traffic/rss/reg-west.atom" ]
  for feedIndex of feeds
    request feeds[feedIndex], (error, response, body) ->
      publishTraffic response.body

setTimeout (->
  getFeeds()
), 5000

setInterval (->
	getFeeds()
), 30000
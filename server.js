require.paths.unshift(__dirname + "/vendor");

var http       = require('http'),
    static     = require('node-static/lib/node-static'),
		Faye       = require('faye'),
    url        = require('url'),
    htmlparser = require("htmlparser"),
		request    = require('request'),
		xmlParser  = require('libxml-to-js'),
		fs         = require('fs'),
		jsdom      = require('jsdom');
		
var jquery = fs.readFileSync("./jquery-1.7.1.min.js").toString();

var handler = new htmlparser.DefaultHandler(function (error, dom) {
    // console.log(dom);
});

var parser = new htmlparser.Parser(handler);

var fServer = new Faye.NodeAdapter({mount: '/faye', timeout: 45});
var server = http.createServer(function(request, response) {
	request.addListener('end', function() {
		var location = url.parse(request.url, true),
        params = (location.query || request.headers);
		
		var file = new static.Server('./public', {
      cache: false
    });
			file.serve(request, response);
	});
	
	request.addListener('data', function(data) {
		var location = url.parse(request.url, true);
		if (location.pathname == '/update') {
		  publishTraffic(data);
		  
		  response.writeHead(200);
		  response.end("Success!");
	  }
	});
})
fServer.attach(server)

server.listen(8000);

var publishTraffic = function(data) {
	
  xmlParser(data, function(error, result) {
	  for (var index in result.entry){		
		
		  if (result.entry[index].content != undefined){
		
			  jsdom.env({
			    html: result.entry[index].content['#'],
			    src: [
			      jquery
			    ],
			    done: function(errors, window) {
			    	var street    = window.$(".tiw-rowStreetTitle").text().toLowerCase().replace('various roads', '');
			  	 	var suburb    = window.$(".tiw-rowSuburbStreetTitle").text().toLowerCase().replace('various roads', '').replace('shire council area', '');

			  		var address = street + " " + suburb + ", NSW";
						
						console.log(address);
						fServer.getClient().publish('/messages', {
			      			address: address
			      })
			    }
			  });
			}
	  }
	});
};

var getFeeds = function() {	
	var feeds = [
		    'http://livetraffic.rta.nsw.gov.au/traffic/rss/syd-north.atom'
	   	, 'http://livetraffic.rta.nsw.gov.au/traffic/rss/syd-south.atom'
			, 'http://livetraffic.rta.nsw.gov.au/traffic/rss/syd-west.atom'
			, 'http://livetraffic.rta.nsw.gov.au/traffic/rss/reg-north.atom'
			, 'http://livetraffic.rta.nsw.gov.au/traffic/rss/reg-south.atom'
			, 'http://livetraffic.rta.nsw.gov.au/traffic/rss/reg-west.atom'
		];

  	for(var feedIndex = 0; feedIndex < feeds.length; feedIndex++){
			request(feeds[feedIndex], function(error, response, body){
				publishTraffic(response.body);
			});
		}
};

setInterval(function() { getFeeds() }, 10000);
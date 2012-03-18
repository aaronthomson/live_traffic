require.paths.unshift(__dirname + "/vendor");

var http       = require('http'),
		sys        = require('sys'),
		fs         = require('fs'),
    static     = require('node-static/lib/node-static'),
		Faye       = require('faye'),
    url        = require('url'),
    htmlparser = require("htmlparser");

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
	
	parser.parseComplete(data);
	
	console.log(Object.keys(handler.dom))
  
	for(var key in Object.keys(handler.dom)) {
		
			var element = handler.dom[key];
			
			console.log("-----" + element);
			console.log("-----" + element[0]);
			
			if (element != undefined) {
			
		    var suburb    = element.children[0].children[1].children[1].children[0].data;
		    var street    = element.children[0].children[1].children[3].children[0].data;
		    var xStreet   = element.children[0].children[1].children[7].children[0].data;
		    var qualifier = element.children[0].children[1].children[5].children[0].data;
        
		    var address = street.toString() + " " + qualifier.toString() + " " +xStreet.toString() + ", " + suburb.toString() + ", NSW"; // Carrington Rd at Bronte Rd, Waverly, NSW
        
		    fServer.getClient().publish('/messages', {
		    	title: "POST"
        , address: address
	      })
			  console.log("DONE")
		  }
	}
};

var feed = {
  host: 'livetraffic.rta.nsw.gov.au',
  port: 80,
  path: '/traffic/rss/syd-metro.atom'
};

var getFeed = function() {
	http.get(feed, function(res) {
	  res.on('data', function (data) {
		    publishTraffic(data);
		  });
	}).on('error', function(e) {
	  console.log("Got error: " + e.message);
	});
};

setInterval(function() { getFeed() }, 1000);

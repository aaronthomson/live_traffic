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

				console.log(location);
		
		var file = new static.Server('./public', {
      cache: false
    });
			file.serve(request, response);
	});
	
	request.addListener('data', function(data) {
		var location = url.parse(request.url, true);
		if (location.pathname == '/update') {
		  parser.parseComplete(data);
		  
			for(var key in handler.dom) {
				if(key%2 == 1) {
					//TODO: get all the incidents
				  var suburb    = handler.dom[key].children[0].children[1].children[1].children[0].data;
				  var street    = handler.dom[key].children[0].children[1].children[3].children[0].data;
				  var xStreet   = handler.dom[key].children[0].children[1].children[7].children[0].data;
				  var qualifier = handler.dom[key].children[0].children[1].children[5].children[0].data;

				  var address = street.toString() + " " + qualifier.toString() + " " +xStreet.toString() + ", " + suburb.toString() + ", NSW"; // Carrington Rd at Bronte Rd, Waverly, NSW

				console.log(address);

				  fServer.getClient().publish('/messages', {
				  	title: "POST"
		      , address: address
			    })
				}
			}
		  
		  response.writeHead(200);
		  response.end("Success!");
	  }
	});
})
fServer.attach(server)

server.listen(8000);

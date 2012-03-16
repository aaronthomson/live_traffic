require.paths.unshift(__dirname + "/vendor");

var http   = require('http'),
		sys    = require('sys'),
		fs     = require('fs'),
    static = require('node-static/lib/node-static'),
		Faye   = require('faye'),
    url    = require('url');

var fServer = new Faye.NodeAdapter({mount: '/faye', timeout: 45});
var server = http.createServer(function(request, response) {
	request.addListener('end', function() {
		var location = url.parse(request.url, true),
        params = (location.query || request.headers);

				console.log(location);
		
		var file = new static.Server('./public', {
      cache: false
    });
		
		if (location.pathname == '/update') {
			fServer.getClient().publish('/messages', {
				title: "params.title"
      , latitude: params.lat
      , longitude: params.lon
		  })
		  response.writeHead(200);
			response.end("Success!");
	  } else {
			file.serve(request, response);
	  }
	});
})
fServer.attach(server)

server.listen(8000);

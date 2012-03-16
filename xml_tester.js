var http   = require('http'),
    xml2js = require('xml2js');

var parser = new xml2js.Parser();

var server = http.createServer(function(request, response) {
	request.addListener('data', function(data) {
		parser.parseString(data, function (err, result) {
        console.dir(JSON.stringify(result));
        console.log('Done');
    });
		
		response.writeHead(200);
		response.end("Success!");
	});
})

server.listen(8000);

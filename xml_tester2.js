var http       = require('http'),
    htmlparser = require("htmlparser");

var handler = new htmlparser.DefaultHandler(function (error, dom) {
    // console.log(dom);
});

var parser = new htmlparser.Parser(handler);

var server = http.createServer(function(request, response) {
	request.addListener('data', function(data) {
		
		parser.parseComplete(data);
		
		var suburb  =   handler.dom[1].children[0].children[1].children[1].children[0].data;
		var street  =   handler.dom[1].children[0].children[1].children[3].children[0].data;
		var xStreet =   handler.dom[1].children[0].children[1].children[7].children[0].data;
		var qualifier = handler.dom[1].children[0].children[1].children[5].children[0].data;
		
		var address = "" + street + " " + qualifier + " " xStreet + " " + suburb // Carrington Rd at Bronte Rd Waverly
		
		var item = handler.dom[1].children[0].children[1].children[7].children[0].data;
		
		
		
		console.log("----------------------------");
		console.log(item);
		console.log("----------------------------");
		var keys = Object.keys(item);
		console.log("-------------keys------------");
		console.log(keys);
				
		// console.log(JSON.stringify(handler.dom, null, 4));
		
		response.writeHead(200);
		response.end("Success!");
	});
})

server.listen(8000);

var client = new Faye.Client('http://localhost:8000/faye', {
	timeout: 120
});

client.subscribe('/messages', function(message) {
	console.log(message.latitude, message.longitude)
	
	var location = new google.maps.LatLng(message.latitude, message.longitude);
	
	addMarker(location, "TEMP");
});
var client = new Faye.Client('http://localhost:8000/faye', {
	timeout: 120
});

var geocoder = new google.maps.Geocoder();
var latlng = new google.maps.LatLng(-34.397, 150.644);

var publishedAddresses = [];

client.subscribe('/messages', function(message) {
	var address = message.address;
	
	for (var i in publishedAddresses) {
		console.log(publishedAddresses[i]);
		if (publishedAddresses[i] === address) {
			return;
	  }
	}
		
	geocoder.geocode( { 'address': address, 'latLng': latlng}, function(results, status) {
    if (status == google.maps.GeocoderStatus.OK) {
	    addMarker(results[0].geometry.location, message.image);
	  } 
	});
	publishedAddresses.push(address);
});
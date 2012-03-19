var client = new Faye.Client('http://localhost:8000/faye', {
	timeout: 120
});

var geocoder = new google.maps.Geocoder();
var latlng = new google.maps.LatLng(-34.397, 150.644);

client.subscribe('/messages', function(message) {
	var address = message.address;
	
	if (address === "clear"){
		clearOverlays();
		
	} else {
	
	  geocoder.geocode( { 'address': address, 'latLng': latlng}, function(results, status) {
	        if (status == google.maps.GeocoderStatus.OK) {
	          addMarker(results[0].geometry.location, "TEMP");
	        } 
	      });
	}
});
var map;
var markersArray = [];

function initializeMap() {

  var sydney = new google.maps.LatLng(-33.520, 145.969);
  
  var myOptions = {
    center: sydney,
    zoom: 6,
		disableDefaultUI: true,
    mapTypeId: google.maps.MapTypeId.ROADMAP
  };
  map = new google.maps.Map(document.getElementById("map_canvas"),
      myOptions);

	// google.maps.event.addListener(map, 'click', function(event) {
	//   addMarker(event.latLng, 'Hello World!');
	// });
}

function addMarker(location, title) {	
  marker = new google.maps.Marker({
    position: location,
    map: map,
		title: title,
		animation: google.maps.Animation.DROP
  });
  markersArray.push(marker);
}

// Removes the overlays from the map, but keeps them in the array
function clearOverlays() {
  if (markersArray) {
    for (i in markersArray) {
      markersArray[i].setMap(null);
    }
  }
}

// Shows any overlays currently in the array
function showOverlays() {
  if (markersArray) {
    for (i in markersArray) {
      markersArray[i].setMap(map);
    }
  }
}

// Deletes all markers in the array by removing references to them
function deleteOverlays() {
  if (markersArray) {
    for (i in markersArray) {
      markersArray[i].setMap(null);
    }
    markersArray.length = 0;
  }
}

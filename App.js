import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  PermissionsAndroid,
  Platform,
  TouchableOpacity,
} from 'react-native';
import Mapbox from '@rnmapbox/maps';
import Geolocation from '@react-native-community/geolocation';
import { MAPBOX_PUBLIC_TOKEN } from "@env";

// Set your Mapbox public access token (see Mapbox account):contentReference[oaicite:14]{index=14}
Mapbox.setAccessToken(MAPBOX_PUBLIC_TOKEN);

// Optionally set telemtry/other settings here
// Mapbox.setTelemetryEnabled(false);

const App = () => {
  // State for driver location (lat, lon)
  const [driverLocation, setDriverLocation] = useState({
    latitude: 0,
    longitude: 0,
  });
  // State for route coordinates and directions
  const [routeCoords, setRouteCoords] = useState([]); // array of [lon, lat]
  const [eta, setEta] = useState(''); // ETA as string
  const [directions, setDirections] = useState([]); // turn-by-turn instructions
  const [zoom, setZoom] = useState(14);

  // Define destination coordinates (e.g., "Home")
  const destination = {
    latitude: 31.498437202160208,
    longitude: 74.3231083674502,
  }; // replace with your destination

  useEffect(() => {
    // Request location permission (Android) and start watching position
    const requestPermission = async () => {
      if (Platform.OS === 'android') {
        try {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
            {
              title: 'Location Permission',
              message: 'App needs access to your location for navigation',
              buttonPositive: 'OK',
            },
          );
          if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
            console.warn('Location permission denied');
          }
        } catch (err) {
          console.warn(err);
        }
      }
    };
    requestPermission();

    // Start GPS watch
    const watchId = Geolocation.watchPosition(
      position => {
        console.log('position: ', position);
        const {latitude, longitude} = position.coords;
        setDriverLocation({latitude, longitude});
      },
      error => console.error('Geolocation error', error),
      {enableHighAccuracy: true, distanceFilter: 5, interval: 5000},
    );

    // Clean up on unmount
    return () => {
      Geolocation.clearWatch(watchId);
    };
  }, []);

  useEffect(() => {
    // Fetch route whenever driverLocation changes
    if (driverLocation.latitude === 0) return; // skip initial zero coords

    const fetchRoute = async () => {
      const {latitude: startLat, longitude: startLon} = driverLocation;
      const {latitude: endLat, longitude: endLon} = destination;
      // Build Directions API request
      const url =
        `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/` +
        `${startLon},${startLat};${endLon},${endLat}` +
        `?geometries=geojson&overview=full&steps=true&access_token=${MAPBOX_PUBLIC_TOKEN}`;

      try {
        const res = await fetch(url);
        const json = await res.json();
        console.log('json: ', json);
        if (json.routes && json.routes.length > 0) {
          const route = json.routes[0];
          // Update route line coordinates
          setRouteCoords(route.geometry.coordinates);

          // Compute ETA from duration (sec)
          const durationSec = secondsToHms(route.duration);
          setEta(durationSec);

          // Extract turn-by-turn instructions
          const steps = route.legs[0].steps;
          setDirections(steps.map(step => step.maneuver.instruction));
        }
      } catch (err) {
        console.error('Error fetching route:', err);
      }
    };

    fetchRoute();
  }, [driverLocation]);

  const secondsToHms = totalSeconds => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const formattedHours = String(hours).padStart(2, '0');
    const formattedMinutes = String(minutes).padStart(2, '0');
    const formattedSeconds = String(seconds).padStart(0, '0');
    const fixedSeconds = Number(formattedSeconds).toFixed();

    return `${formattedHours}:${formattedMinutes}:${fixedSeconds}`;
  };

  return (
    <View style={styles.container}>
      {/* Map View */}
      <Mapbox.MapView
        style={styles.map}
        styleURL={Mapbox.StyleURL.Street}
        zoomEnabled
        pitchEnabled>
        {/* Camera follows driver location */}
        <Mapbox.Camera
          animationDuration={1000}
          // followUserLocation={true}
          // followZoomLevel={16}
          zoomLevel={zoom}
        />

        {/* Route Line */}
        {routeCoords.length > 0 && (
          <Mapbox.ShapeSource
            id="routeLineSource"
            shape={{
              type: 'FeatureCollection',
              features: [
                {
                  type: 'Feature',
                  geometry: {type: 'LineString', coordinates: routeCoords},
                },
              ],
            }}>
            <Mapbox.LineLayer
              id="routeLineLayer"
              style={{
                lineColor: '#1D6ED3',
                lineWidth: 5,
                lineCap: Mapbox.LineJoin.Round,
              }}
            />
          </Mapbox.ShapeSource>
        )}

        {/* Driver Marker (profile image at current location) */}
        {driverLocation.latitude !== 0 && (
          <Mapbox.PointAnnotation
            id="driverMarker"
            coordinate={[driverLocation.longitude, driverLocation.latitude]}>
            <Image
              source={{uri: 'https://randomuser.me/api/portraits/men/1.jpg'}} // replace with driver image
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                borderWidth: 2,
                borderColor: '#fff',
              }}
            />
          </Mapbox.PointAnnotation>
        )}

        {/* Destination Marker (home icon) */}
        <Mapbox.PointAnnotation
          id="destinationMarker"
          coordinate={[destination.longitude, destination.latitude]}>
          {/* Replace './assets/home.png' with your home icon asset */}
          <Image
            source={require('./assets/home.png')}
            style={{width: 35, height: 35}}
          />
        </Mapbox.PointAnnotation>
      </Mapbox.MapView>
      <View style={styles.controls}>
        <TouchableOpacity onPress={() => setZoom(z => Math.min(z + 1, 18))}>
          <Text style={styles.controlBtn}>＋</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setZoom(z => Math.max(z - 1, 1))}>
          <Text style={styles.controlBtn}>－</Text>
        </TouchableOpacity>
      </View>

      {/* Bottom Sheet Overlay */}
      <View style={styles.bottomSheet}>
        <Image
          source={{uri: 'https://randomuser.me/api/portraits/men/1.jpg'}}
          style={styles.profileImage}
        />
        <View style={styles.statusContainer}>
          <Text style={styles.statusText}>Arriving shortly</Text>
          <Text style={styles.etaText}>ETA: {eta}</Text>
        </View>
      </View>

      {/* Turn-by-Turn Directions (above bottom sheet) */}
      <View style={styles.directionsContainer}>
        {directions.map((instr, idx) => (
          <Text key={idx} style={styles.directionText}>
            • {instr}
          </Text>
        ))}
      </View>
    </View>
  );
};

export default App;

// Styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  bottomSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#ffffffdd',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
  },
  profileImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 10,
  },
  statusContainer: {
    flex: 1,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
  },
  etaText: {
    fontSize: 14,
    marginTop: 4,
  },
  directionsContainer: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 70,
    backgroundColor: '#fff',
    padding: 8,
    borderRadius: 6,
  },
  directionText: {
    fontSize: 12,
    marginVertical: 2,
  },
    controls: {
    position: 'absolute',
    right: 10,
    top: 40,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 6,
    padding: 6,
  },
  controlBtn: {
    fontSize: 24,
    fontWeight: 'bold',
    paddingVertical: 4,
    textAlign: 'center',
  },
});

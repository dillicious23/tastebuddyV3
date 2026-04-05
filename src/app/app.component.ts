import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Geolocation } from '@capacitor/geolocation';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: '<router-outlet />',
})
export class AppComponent implements OnInit {

  async ngOnInit() {
    await this.requestLocationPermissions();
  }

  async requestLocationPermissions() {
    try {
      const status = await Geolocation.requestPermissions();
      console.log('Location permission status:', status.location);

      if (status.location === 'granted') {
        console.log('User accepted! You can now get their lat/lng.');
      }
    } catch (err) {
      console.error('Error requesting location permissions:', err);
    }
  }
}
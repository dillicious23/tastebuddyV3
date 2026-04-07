import { Component, OnInit, NgZone } from '@angular/core';
import { RouterOutlet, Router } from '@angular/router';
import { Geolocation } from '@capacitor/geolocation';
import { App, URLOpenListenerEvent } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: '<router-outlet />',
})
export class AppComponent implements OnInit {

  constructor(private router: Router, private zone: NgZone) {
    this.initializeApp();
  }

  async initializeApp() {
    // 1. Handle Background Resumes (App was minimized)
    App.addListener('appUrlOpen', (event: URLOpenListenerEvent) => {
      this.handleDeepLink(event.url);
    });

    // 2. Handle Cold Starts (App was completely closed)
    const launchData = await App.getLaunchUrl();
    if (launchData && launchData.url) {
      this.handleDeepLink(launchData.url);
    }
  }

  // A reusable function to process the URL
  handleDeepLink(url: string) {
    if (url.includes('tastebuddyv2.web.app')) {
      const path = url.split('tastebuddyv2.web.app').pop();

      if (path) {
        this.zone.run(() => {
          // Delay the navigation by 250 milliseconds so it fires AFTER the Launch screen redirect
          setTimeout(() => {
            this.router.navigateByUrl(path);
          }, 250);
        });
      }
    }
  }

  async ngOnInit() {
    await this.requestLocationPermissions();
  }

  async requestLocationPermissions() {
    try {
      // 💥 NEW: Only request permissions manually if running on a phone
      if (Capacitor.isNativePlatform()) {
        const status = await Geolocation.requestPermissions();
        console.log('Location permission status:', status.location);
      } else {
        console.log('Running on web: Permission will be requested automatically when needed.');
      }
    } catch (err) {
      console.error('Error requesting location permissions:', err);
    }
  }
}
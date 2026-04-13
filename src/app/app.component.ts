import { Component, OnInit, NgZone } from '@angular/core';
import { RouterOutlet, Router } from '@angular/router';
import { Geolocation } from '@capacitor/geolocation';
import { App, URLOpenListenerEvent } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { FirebaseMessaging } from '@capacitor-firebase/messaging';
import { db } from './core/firebase';
import { doc, setDoc } from 'firebase/firestore';

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
    await this.registerPushNotifications();
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

  async registerPushNotifications() {
    // Always register this user in Firestore, even on web (just without an FCM token)
    let myUid = localStorage.getItem('tb_uid');
    if (!myUid) {
      myUid = Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem('tb_uid', myUid);
    }
    const myUsername = localStorage.getItem('tb_username') || 'Someone';

    // Only upsert if user has already completed the launch screen (has a real username)
    if (myUsername && myUsername !== 'Someone') {
      const myAvatar = localStorage.getItem('userAvatar') ?? '🦦';
      const myFriendCode = localStorage.getItem('tb_friend_code') ?? '';
      await setDoc(doc(db, 'users', myUid), {
        uid: myUid,
        username: myUsername,
        avatar: myAvatar,
        friendCode: myFriendCode,
        lastActive: Date.now()
      }, { merge: true });
    }

    // FCM token + push listeners only work on native device
    if (!Capacitor.isNativePlatform()) return;

    try {
      let permStatus = await FirebaseMessaging.checkPermissions();
      if (permStatus.receive === 'prompt') {
        permStatus = await FirebaseMessaging.requestPermissions();
      }
      if (permStatus.receive !== 'granted') {
        console.warn('Push permissions denied');
        return;
      }

      const token = await FirebaseMessaging.getToken();

      if (token.token) {
        await setDoc(doc(db, 'users', myUid), {
          fcmToken: token.token
        }, { merge: true });
      }

      FirebaseMessaging.addListener('notificationReceived', (event) => {
        console.log('Push received: ', event.notification);
      });

      FirebaseMessaging.addListener('notificationActionPerformed', (event: any) => {
        const data = event.notification.data;
        if (data && data['roomCode']) {
          this.zone.run(() => {
            this.router.navigate(['/join', data['roomCode']]);
          });
        }
      });

    } catch (error) {
      console.error('Push Setup Failed:', error);
    }
  }

}
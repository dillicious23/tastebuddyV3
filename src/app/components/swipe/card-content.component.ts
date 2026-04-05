// src/app/components/swipe/card-content.component.ts
import { Component, Input, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Restaurant, GroupMember } from '../../models/restaurant.model';

@Component({
    selector: 'app-card-content',
    standalone: true,
    imports: [CommonModule],
    template: `
    <!-- Image area -->
    <div class="card-image" [style.background]="r.bg">
      
      <img *ngIf="r.imageUrl" [src]="r.imageUrl" 
           style="position:absolute; top:0; left:0; width:100%; height:100%; object-fit:cover; z-index:1;" />
      
      <span *ngIf="!r.imageUrl" class="card-emoji">{{ r.emoji }}</span>
      
      <div class="badge-cuisine">{{ r.cuisine }}</div>
      <div class="badge-dist">
        <svg width="8" height="10" viewBox="0 0 6 8">
          <path d="M3 0C1.4 0 0 1.4 0 3C0 5.4 3 8 3 8S6 5.4 6 3C6 1.4 4.6 0 3 0Z" fill="#60A5FA"/>
          <circle cx="3" cy="3" r="1.1" fill="#0B0F1A"/>
        </svg>
        {{ r.dist }}
      </div>
    </div>

    <!-- Body -->
    <div class="card-body">
      <div class="card-title-row">
        <span class="card-name">{{ r.name }}</span>
        <div class="rating-badge">
          <svg width="10" height="10" viewBox="0 0 10 10">
            <path d="M5 1L6.2 3.8L9 4.1L7 6L7.6 9L5 7.5L2.4 9L3 6L1 4.1L3.8 3.8Z" fill="#F5C518"/>
          </svg>
          <span>{{ r.rating }} ⭐</span>
        </div>
      </div>

      <div class="card-tags">
        <span class="tag">{{ r.price }}</span>
        <span class="tag">{{ r.cuisine }}</span>
        <span class="tag">{{ r.dist }}</span>
        
        <a *ngIf="r.yelpUrl" [href]="r.yelpUrl" target="_blank" rel="noopener noreferrer"
           (touchstart)="$event.stopPropagation()" 
           (mousedown)="$event.stopPropagation()" 
           (click)="$event.stopPropagation()"
           class="tag yelp-tag">
          <img src="assets/icon/yelp_burst.svg" 
               style="width: 14px; height: 14px; margin-right: 5px; object-fit: contain;" 
               alt="Yelp Logo">
          <span style="font-weight: 700;">Yelp</span>
        </a>
      </div> 

      <!-- Social bar -->
      <div class="social-bar" [ngClass]="isSolo ? 'solo-bar' : 'group-bar'">
        <ng-container *ngIf="!isSolo">
          <div class="avatar-stack" style="flex-shrink:0">
            <div *ngFor="let f of r.friends"
                 class="avatar"
                 [style.background]="f.bgColor"
                 [style.color]="f.color"
                 style="width:23px;height:23px;font-size:9px;border-color:#0B0F1A;font-weight:700">
              {{ f.initial }}
            </div>
          </div>
          <span class="social-label">{{ r.label }}</span>
          <span class="social-score" [style.color]="scoreColor(r.score)">{{ r.score }}</span>
        </ng-container>

        <ng-container *ngIf="isSolo">
          <svg width="14" height="14" viewBox="0 0 14 14">
            <circle cx="7" cy="7" r="5.5" stroke="#F59E0B" stroke-width="1.1"/>
            <path d="M7 6v3.5" stroke="#F59E0B" stroke-width="1.4" stroke-linecap="round"/>
            <circle cx="7" cy="4.2" r=".7" fill="#F59E0B"/>
          </svg>
          <span class="solo-text">Swipe right to add this to your wish list.</span>
        </ng-container>
      </div>
    </div>
  `,
    // Styles inherited from swipe.component.scss via :host-context or view-encapsulation: None
    encapsulation: ViewEncapsulation.None, // inherits swipe card styles
})
export class CardContentComponent {
    @Input() r!: Restaurant;
    @Input() isSolo = false;
    @Input() members: GroupMember[] = [];
    @Input() scoreColor: (score: string) => string = s => s === '3/3' ? '#F5C518' : '#4ADE80';
}
